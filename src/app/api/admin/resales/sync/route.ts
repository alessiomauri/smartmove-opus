import { NextRequest, NextResponse, after } from 'next/server';
import { createClient as createSupabaseAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { searchProperties, type ResalesEnvelope, type ResalesProperty } from '@/lib/integrations/resales';
import { runResalesSync, type ResalesPage, type SyncTrigger } from '@/lib/integrations/resales-sync';
import { getSyncState, setSyncState, FULL_IMPORT_KEY } from '@/lib/integrations/sync-state';
import { purgeImages } from '@/lib/integrations/cloudflare-images';

// A paced chunk (≤60 pages at ~2.5 req/s) finishes well inside this.
export const maxDuration = 300;

/**
 * Live-mode Resales sync.
 *
 * Modes:
 *  - INCREMENTAL (default): watermark-driven delta walk. The lower bound
 *    is the persisted max LastUpdated from the last successful run
 *    (sync_state.resales_watermark), minus a 10-minute overlap — never
 *    wall-clock, so a failed night can't skip the updates it missed.
 *  - FULL IMPORT (`mode: 'full-import'`): chunked walk of the entire
 *    feed. Each invocation processes N pages, persists its cursor in
 *    sync_state, and self-chains the next chunk via after() until done —
 *    no single invocation gets near the platform timeout. On completion
 *    the watermark is seeded and nightly incremental takes over.
 *
 * Auth paths:
 *  1. Admin user (Supabase session) — manual trigger from /admin/resales
 *  2. Custom secret — header `x-smartmove-cron-secret` = SYNC_CRON_SECRET
 *     (also used by the self-chaining continuation calls)
 *  3. Vercel Cron — GET with `Authorization: Bearer ${CRON_SECRET}`
 */

interface FullImportState extends Record<string, unknown> {
  status: 'idle' | 'running' | 'done' | 'failed';
  page: number;
  query_id: string | null;
  pages_done: number;
  rows_seen: number;
  total_count: number | null;
  max_last_updated: string | null;
  chunks: number;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

const FRESH_IMPORT: FullImportState = {
  status: 'idle',
  page: 1,
  query_id: null,
  pages_done: 0,
  rows_seen: 0,
  total_count: null,
  max_last_updated: null,
  chunks: 0,
  started_at: null,
  completed_at: null,
  error: null,
};

/** Hard ceiling on self-chained continuations (50k rows ≈ 25 chunks). */
const MAX_CHUNKS = 200;

function serviceClient(): SupabaseClient | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Vercel Cron entrypoint (nightly 03:00). If a full import is mid-flight
 * it continues that instead of the incremental walk — the cron doubles
 * as the backstop that keeps a stalled import moving.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.SYNC_CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = serviceClient() ?? (await createServerSupabaseClient());

  if (await isRunLocked(supabase)) {
    return NextResponse.json({ ok: true, skipped: 'another run is in progress' });
  }

  const importState = await getSyncState<FullImportState>(supabase, FULL_IMPORT_KEY);
  if (importState?.status === 'running') {
    return executeFullImportChunk(req, supabase, { triggeredBy: null });
  }

  return executeIncremental(supabase, {
    trigger: 'cron',
    modifiedSince: null, // watermark decides
    triggeredBy: null,
    pageSize: 50,
    maxPages: 200,
  });
}

export async function POST(req: NextRequest) {
  // ─── Auth ───
  const cronSecret = req.headers.get('x-smartmove-cron-secret');
  const expected = process.env.SYNC_CRON_SECRET;
  let triggeredBy: string | null = null;
  let isSecretAuth = false;

  if (expected && cronSecret === expected) {
    isSecretAuth = true;
  } else {
    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    triggeredBy = user.id;
  }

  // ─── Inputs ───
  let body: {
    mode?: 'incremental' | 'full-import';
    trigger?: SyncTrigger;
    modifiedSince?: string;
    pageSize?: number;
    maxPages?: number;
    pagesPerChunk?: number;
    restart?: boolean;
    force?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  // Secret-authed calls (cron + self-chained continuations) get the
  // service client; manual admin runs ride the admin session.
  const supabase = isSecretAuth
    ? serviceClient() ?? (await createServerSupabaseClient())
    : await createServerSupabaseClient();

  if (!body.force && (await isRunLocked(supabase))) {
    return NextResponse.json(
      { ok: false, error: 'A sync run is already in progress (pass force:true to override)' },
      { status: 409 }
    );
  }

  if (body.mode === 'full-import') {
    return executeFullImportChunk(req, supabase, {
      triggeredBy,
      pagesPerChunk: body.pagesPerChunk,
      restart: body.restart,
    });
  }

  const trigger: SyncTrigger = body.trigger ?? (isSecretAuth ? 'cron' : 'manual');
  const pageSize = Math.min(Math.max(body.pageSize ?? 50, 1), 100);
  const maxPages = Math.min(Math.max(body.maxPages ?? 200, 1), 400);

  return executeIncremental(supabase, {
    trigger,
    modifiedSince: body.modifiedSince ?? null,
    triggeredBy,
    pageSize,
    maxPages,
  });
}

/**
 * Overlap guard: refuse to start when another run opened <20 min ago and
 * hasn't finished. Stale 'running' rows past the TTL are flipped to
 * 'failed' here so a crashed run can't deadlock the schedule.
 */
async function isRunLocked(supabase: SupabaseClient): Promise<boolean> {
  const ttlCutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  await supabase
    .from('resales_sync_runs')
    .update({ status: 'failed', error_summary: 'Stale: still running past 20min TTL', finished_at: new Date().toISOString() })
    .eq('status', 'running')
    .lt('started_at', ttlCutoff);

  const { data } = await supabase
    .from('resales_sync_runs')
    .select('id')
    .eq('status', 'running')
    .gte('started_at', ttlCutoff)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** Throttling lives in the orchestrator; this just calls + validates. */
function livePageFetcher() {
  return async ({
    page,
    queryId,
    pageSize,
  }: {
    page: number;
    queryId: string | null;
    pageSize: number;
  }): Promise<ResalesPage> => {
    const env: ResalesEnvelope<ResalesProperty> = await searchProperties({
      pageSize,
      page,
      queryId: queryId ?? undefined,
      sortType: 3, // LastUpdated DESC (Resales-recommended delta pattern)
      showLastUpdateDate: true,
    });
    if (env.transaction?.status === 'error') {
      throw new Error(`Resales transaction error: ${JSON.stringify(env.transaction)}`);
    }
    const total = env.QueryInfo.PropertyCount;
    const perPage = env.QueryInfo.PropertiesPerPage || pageSize;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const done = page >= totalPages || env.Property.length === 0;
    return {
      properties: env.Property,
      totalCount: total,
      queryId: env.QueryInfo.QueryId || null,
      done,
    };
  };
}

async function executeIncremental(
  supabase: SupabaseClient,
  opts: {
    trigger: SyncTrigger;
    modifiedSince: string | null;
    triggeredBy: string | null;
    pageSize: number;
    maxPages: number;
  }
) {
  const report = await runResalesSync({
    supabase,
    trigger: opts.trigger,
    fetchPage: livePageFetcher(),
    pageSize: opts.pageSize,
    maxPages: opts.maxPages,
    modifiedSince: opts.modifiedSince,
    useWatermark: opts.modifiedSince ? false : true,
    triggeredBy: opts.triggeredBy,
    purgeImages,
  });

  return NextResponse.json({ ok: report.status !== 'failed', report });
}

/**
 * One chunk of the full import. Resumes from the persisted cursor,
 * processes up to `pagesPerChunk` pages, persists the cursor after every
 * page, then self-chains the next chunk via after() until the walk
 * completes. Kill it anywhere — the next invocation (manual, chained, or
 * nightly cron) picks up where it left off.
 */
async function executeFullImportChunk(
  req: NextRequest,
  supabase: SupabaseClient,
  opts: { triggeredBy: string | null; pagesPerChunk?: number; restart?: boolean }
) {
  const pagesPerChunk = Math.min(Math.max(opts.pagesPerChunk ?? 40, 1), 60);

  let state =
    (await getSyncState<FullImportState>(supabase, FULL_IMPORT_KEY)) ?? FRESH_IMPORT;

  if (opts.restart || state.status === 'idle' || state.status === 'done' || state.status === 'failed') {
    state = {
      ...FRESH_IMPORT,
      status: 'running',
      started_at: new Date().toISOString(),
    };
    await setSyncState(supabase, FULL_IMPORT_KEY, state);
  }

  if (state.chunks >= MAX_CHUNKS) {
    state = { ...state, status: 'failed', error: `Chunk ceiling (${MAX_CHUNKS}) reached` };
    await setSyncState(supabase, FULL_IMPORT_KEY, state);
    return NextResponse.json({ ok: false, error: state.error, state }, { status: 500 });
  }

  const pageBefore = state.page;

  const report = await runResalesSync({
    supabase,
    trigger: 'full-import',
    fetchPage: livePageFetcher(),
    pageSize: 50,
    maxPages: pagesPerChunk,
    useWatermark: false, // full walk: no stop boundary
    triggeredBy: opts.triggeredBy,
    startPage: state.page,
    initialQueryId: state.query_id,
    purgeImages,
    onPageComplete: async (cursor) => {
      state = {
        ...state,
        page: cursor.nextPage,
        query_id: cursor.queryId,
        pages_done: state.pages_done + 1,
        rows_seen: state.rows_seen + cursor.rowsSeen,
        max_last_updated:
          cursor.maxLastUpdated && (!state.max_last_updated || cursor.maxLastUpdated > state.max_last_updated)
            ? cursor.maxLastUpdated
            : state.max_last_updated,
      };
      await setSyncState(supabase, FULL_IMPORT_KEY, state);
    },
  });

  if (report.status === 'failed') {
    // Keep status 'running' with the error noted — cursor is intact, the
    // nightly cron (or a manual click) resumes from here.
    state = { ...state, error: report.message, chunks: state.chunks + 1 };
    await setSyncState(supabase, FULL_IMPORT_KEY, state);
    return NextResponse.json({ ok: false, report, state }, { status: 500 });
  }

  if (report.cursor.done) {
    state = {
      ...state,
      status: 'done',
      completed_at: new Date().toISOString(),
      chunks: state.chunks + 1,
      error: null,
    };
    await setSyncState(supabase, FULL_IMPORT_KEY, state);

    // Seed the incremental watermark from the max LastUpdated observed
    // (page 1 of the DESC walk = global max). Nightly delta takes over.
    if (state.max_last_updated) {
      await setSyncState(supabase, 'resales_watermark', {
        watermark: state.max_last_updated,
        run_id: report.runId,
        seeded_by: 'full-import',
      });
    }
    return NextResponse.json({ ok: true, report, state, done: true });
  }

  // More pages to go — guard against a stuck cursor, then chain.
  const madeProgress = state.page > pageBefore || report.pagesWalked > 0;
  state = { ...state, chunks: state.chunks + 1, error: null };
  await setSyncState(supabase, FULL_IMPORT_KEY, state);

  const secret = process.env.SYNC_CRON_SECRET;
  if (madeProgress && secret) {
    const selfUrl = new URL('/api/admin/resales/sync', req.nextUrl.origin).toString();
    after(async () => {
      try {
        await fetch(selfUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-smartmove-cron-secret': secret,
          },
          body: JSON.stringify({ mode: 'full-import', force: false }),
        });
      } catch (e) {
        console.error('full-import continuation failed to schedule:', e);
      }
    });
  }

  return NextResponse.json({
    ok: true,
    report,
    state,
    done: false,
    chained: madeProgress && Boolean(secret),
  });
}
