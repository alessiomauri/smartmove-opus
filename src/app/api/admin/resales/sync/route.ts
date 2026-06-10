import { NextRequest, NextResponse, after } from 'next/server';
import { createClient as createSupabaseAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { searchProperties, type ResalesEnvelope, type ResalesProperty } from '@/lib/integrations/resales';
import { runResalesSync, type ResalesPage, type SyncTrigger } from '@/lib/integrations/resales-sync';
import { getSyncState, setSyncState, FULL_IMPORT_KEY, WATERMARK_KEY } from '@/lib/integrations/sync-state';
import { purgeImages } from '@/lib/integrations/cloudflare-images';
import { fetchOwnReferenceSet } from '@/lib/integrations/resales-own';

export const maxDuration = 300;

/**
 * Wall-clock budget for one drain invocation. Each invocation processes
 * as many pages as fit, then (if not done) fires ONE continuation. Kept
 * well under maxDuration (300s) so the run row always finalizes before
 * any platform kill. Env-tunable (the tests set it small to force many
 * chain links).
 */
const DRAIN_BUDGET_MS = Number(process.env.RESALES_DRAIN_BUDGET_MS || '') || 230_000;

/** A run/import older than this with no fresh heartbeat is presumed dead. */
const STALE_MS = 8 * 60 * 1000;

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

  // Cron doubles as the full-import backstop: if an import is mid-flight
  // it resumes it (kickFullImport skips when one is actively draining,
  // takes over when the chain has gone stale). Otherwise: nightly delta.
  const importState = await getSyncState<FullImportState>(supabase, FULL_IMPORT_KEY);
  if (importState?.status === 'running') {
    return kickFullImport(req, supabase, { triggeredBy: null });
  }

  if (await isRunLocked(supabase)) {
    return NextResponse.json({ ok: true, skipped: 'another run is in progress' });
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
    restart?: boolean;
    force?: boolean;
    /** Set by the self-chaining continuation — bypasses the active lock. */
    _continuation?: boolean;
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

  // Full import has its OWN concurrency model (sync_state freshness),
  // so it skips the incremental run-row lock entirely.
  if (body.mode === 'full-import') {
    return kickFullImport(req, supabase, {
      triggeredBy,
      restart: body.restart,
      continuation: body._continuation === true,
    });
  }

  if (!body.force && (await isRunLocked(supabase))) {
    return NextResponse.json(
      { ok: false, error: 'A sync run is already in progress (pass force:true to override)' },
      { status: 409 }
    );
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
 * Flip any `running` run row older than the TTL to `failed`. A run row is
 * only left `running` when its invocation was KILLED mid-flight (deadline
 * drains always finalize), so a stale one is definitively dead. Called on
 * every entry path so a crashed run never deadlocks the next.
 */
async function failStaleRunRows(supabase: SupabaseClient): Promise<void> {
  await supabase
    .from('resales_sync_runs')
    .update({
      status: 'failed',
      error_summary: `Stale: running past ${Math.round(STALE_MS / 60000)}min TTL (invocation presumed killed)`,
      finished_at: new Date().toISOString(),
    })
    .eq('status', 'running')
    .lt('started_at', new Date(Date.now() - STALE_MS).toISOString());
}

/**
 * Overlap guard for INCREMENTAL runs: refuse when another run opened
 * within the TTL and hasn't finished. (Full import uses sync_state
 * freshness instead — see kickFullImport.)
 */
async function isRunLocked(supabase: SupabaseClient): Promise<boolean> {
  await failStaleRunRows(supabase);
  const { data } = await supabase
    .from('resales_sync_runs')
    .select('id')
    .eq('status', 'running')
    .gte('started_at', new Date(Date.now() - STALE_MS).toISOString())
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
    fetchOwnRefs: fetchOwnReferenceSet,
  });

  return NextResponse.json({ ok: report.status !== 'failed', report });
}

/** sync_state heartbeat freshness — a drain persists the cursor every page. */
function isImportFresh(state: FullImportState & { updated_at?: string }): boolean {
  if (!state.updated_at) return false;
  return Date.now() - new Date(state.updated_at).getTime() < STALE_MS;
}

/**
 * Entry point for every full-import invocation (manual Start/Resume,
 * self-chained continuation, cron backstop).
 *
 * It does NOT do the work synchronously — it claims the import in
 * sync_state, schedules the drain in `after()`, and returns IMMEDIATELY.
 * This is the fix for the production self-chaining failure: the previous
 * design awaited the child's full response inside `after()`, so each
 * parent stayed alive for the entire downstream chain, blew maxDuration,
 * and got killed mid-flight (leaving its run row stuck `running`). With
 * immediate-ack, every continuation fetch returns in ~100ms, so the
 * chain is linear and non-nesting — each invocation lives only for its
 * own drain.
 *
 * Concurrency is gated on sync_state freshness (the drain heartbeats the
 * cursor every page), not the run-row lock:
 *   - continuation → always proceeds (it IS the import advancing)
 *   - manual/cron  → skips when a drain is actively heartbeating; takes
 *                    over when the chain has gone stale (killed link)
 */
async function kickFullImport(
  req: NextRequest,
  supabase: SupabaseClient,
  opts: { triggeredBy: string | null; restart?: boolean; continuation?: boolean }
) {
  await failStaleRunRows(supabase);

  let state =
    (await getSyncState<FullImportState & { updated_at?: string }>(supabase, FULL_IMPORT_KEY)) ??
    FRESH_IMPORT;

  const activelyDraining = state.status === 'running' && isImportFresh(state);

  // A non-continuation request must not double-start an active drain.
  if (!opts.continuation && !opts.restart && activelyDraining) {
    return NextResponse.json({ ok: true, started: false, skipped: 'full import already draining', state });
  }

  if (opts.restart || state.status === 'idle' || state.status === 'done' || state.status === 'failed') {
    state = { ...FRESH_IMPORT, status: 'running', started_at: new Date().toISOString() };
  } else {
    state = { ...state, status: 'running' };
  }

  if (state.chunks >= MAX_CHUNKS) {
    state = { ...state, status: 'failed', error: `Invocation ceiling (${MAX_CHUNKS}) reached` };
    await setSyncState(supabase, FULL_IMPORT_KEY, state);
    return NextResponse.json({ ok: false, error: state.error, state }, { status: 500 });
  }

  // Claim synchronously (heartbeats updated_at) BEFORE returning, so a
  // second rapid manual click sees an active drain and backs off.
  await setSyncState(supabase, FULL_IMPORT_KEY, state);

  const origin = continuationOrigin(req);
  after(() => drainFullImport(supabase, opts.triggeredBy, origin));

  return NextResponse.json({ ok: true, started: true, state });
}

/**
 * One drain invocation: resumes from the cursor, walks pages until the
 * feed end OR the wall-clock deadline, persists the cursor every page,
 * and finalizes. If the feed isn't exhausted, fires ONE non-nesting
 * continuation. Runs inside `after()`, well within maxDuration.
 */
async function drainFullImport(
  supabase: SupabaseClient,
  triggeredBy: string | null,
  origin: string
) {
  const deadlineMs = Date.now() + DRAIN_BUDGET_MS;
  let state =
    (await getSyncState<FullImportState>(supabase, FULL_IMPORT_KEY)) ?? FRESH_IMPORT;

  const report = await runResalesSync({
    supabase,
    trigger: 'full-import',
    fetchPage: livePageFetcher(),
    pageSize: 50,
    maxPages: 100_000, // effectively unbounded — the deadline stops us
    deadlineMs,
    useWatermark: false, // full walk: no stop boundary
    triggeredBy,
    startPage: state.page,
    initialQueryId: state.query_id,
    purgeImages,
    fetchOwnRefs: fetchOwnReferenceSet,
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
      await setSyncState(supabase, FULL_IMPORT_KEY, state); // heartbeat
    },
  });

  state = { ...state, chunks: state.chunks + 1 };

  if (report.status === 'failed') {
    // Cursor intact; stays `running` so the nightly cron / manual Resume
    // picks up from here. (Stale-freshness lets a resume take over.)
    state = { ...state, error: report.message };
    await setSyncState(supabase, FULL_IMPORT_KEY, state);
    return;
  }

  if (report.cursor.done) {
    state = { ...state, status: 'done', completed_at: new Date().toISOString(), error: null };
    await setSyncState(supabase, FULL_IMPORT_KEY, state);
    // Seed the incremental watermark from the max LastUpdated observed
    // (page 1 of the DESC walk = the global max). Nightly delta takes over.
    if (state.max_last_updated) {
      await setSyncState(supabase, WATERMARK_KEY, {
        watermark: state.max_last_updated,
        run_id: report.runId,
        seeded_by: 'full-import',
      });
    }
    return;
  }

  // Deadline hit, more to do → chain. The child immediate-acks, so this
  // await returns in ~100ms (no nesting). The nightly cron is the
  // guaranteed backstop if the fetch fails.
  state = { ...state, error: null };
  await setSyncState(supabase, FULL_IMPORT_KEY, state);
  await fireContinuation(origin);
}

/**
 * Absolute origin for the self-call. The request origin is correct in
 * both prod (public domain, protection off) and local dev (localhost),
 * and it self-perpetuates down the chain. Envs are a fallback only for
 * the unusual case where the origin isn't a usable http(s) URL.
 */
function continuationOrigin(req: NextRequest): string {
  const o = req.nextUrl.origin;
  if (o && /^https?:\/\//.test(o)) return o;
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : '') ||
    'http://localhost:3000'
  );
}

async function fireContinuation(origin: string) {
  const secret = process.env.SYNC_CRON_SECRET;
  if (!secret) {
    console.warn('full-import: SYNC_CRON_SECRET unset — relying on the nightly cron backstop');
    return;
  }
  const url = new URL('/api/admin/resales/sync', origin).toString();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-smartmove-cron-secret': secret,
  };
  // Harmless when unset / protection off; needed if Deployment Protection
  // is ever enabled (so the self-call isn't bounced by Vercel's edge).
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ mode: 'full-import', _continuation: true }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error(`full-import continuation HTTP ${res.status} — nightly cron will resume`);
    }
  } catch (e) {
    console.error('full-import continuation fetch failed — nightly cron will resume:', e);
  }
}
