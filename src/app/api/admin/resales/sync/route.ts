import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { searchProperties, type ResalesEnvelope, type ResalesProperty } from '@/lib/integrations/resales';
import { runResalesSync, type ResalesPage, type SyncTrigger } from '@/lib/integrations/resales-sync';

// A full walk (200 pages × 50) through the Worker proxy will not fit in
// the default function window — give the sync the long-task budget.
export const maxDuration = 300;

/**
 * Live-mode Resales sync.
 *
 * Three auth paths:
 *   1. Admin user (Supabase auth) — manual trigger from /admin/resales (POST)
 *   2. Custom cron — header `x-smartmove-cron-secret` matching SYNC_CRON_SECRET
 *   3. Vercel Cron — GET with `Authorization: Bearer ${CRON_SECRET}`
 *      (Vercel's convention; schedule lives in vercel.json)
 *
 * Walks SearchProperties pages session-aware (P_QueryId) per
 * RESALES_API_REFERENCE §8. Stops at modified-since when given.
 *
 * NOTE: requires the Cloudflare Worker proxy to have valid p1/p2
 * secrets. Until those land, calls return 401 from the Worker —
 * the orchestrator surfaces that as a sync failure with a clear
 * error_summary in resales_sync_runs.
 */

/**
 * Vercel Cron entrypoint. Vercel invokes cron paths with GET and an
 * `Authorization: Bearer <CRON_SECRET>` header. Delta-sync: only rows
 * modified in the last 25h (the nightly window plus margin).
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.SYNC_CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const since = new Date(Date.now() - 25 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
  return executeSync({ trigger: 'cron', modifiedSince: since, triggeredBy: null, pageSize: 50, maxPages: 200 });
}

export async function POST(req: NextRequest) {
  // ─── Auth ───
  const cronSecret = req.headers.get('x-smartmove-cron-secret');
  const expected = process.env.SYNC_CRON_SECRET;
  let triggeredBy: string | null = null;

  if (expected && cronSecret === expected) {
    // Cron call — authenticated.
  } else {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    triggeredBy = user.id;
  }

  // ─── Inputs ───
  let body: { trigger?: SyncTrigger; modifiedSince?: string; pageSize?: number; maxPages?: number } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const trigger: SyncTrigger = body.trigger ?? (cronSecret ? 'cron' : 'manual');

  // Clamp paging inputs — an unbounded maxPages/pageSize would let a
  // single request walk the entire feed at arbitrary granularity.
  const pageSize = Math.min(Math.max(body.pageSize ?? 50, 1), 100);
  const maxPages = Math.min(Math.max(body.maxPages ?? 200, 1), 400);

  return executeSync({
    trigger,
    modifiedSince: body.modifiedSince ?? null,
    triggeredBy,
    pageSize,
    maxPages,
  });
}

async function executeSync(opts: {
  trigger: SyncTrigger;
  modifiedSince: string | null;
  triggeredBy: string | null;
  pageSize: number;
  maxPages: number;
}) {
  // Write client. Manual runs ride the admin's session (cookie client,
  // passes the "Admins can do everything" RLS policy). Cron runs have no
  // session — the anon client would be silently blocked by RLS on every
  // upsert — so they use the service role.
  const supabase =
    opts.trigger === 'cron' && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          { auth: { autoRefreshToken: false, persistSession: false } }
        )
      : await createServerSupabaseClient();

  const fetchPage = async ({
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
      sortType: 3,                  // LastUpdated DESC (Resales-recommended pattern)
      showLastUpdateDate: true,
    });
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

  const report = await runResalesSync({
    supabase,
    trigger: opts.trigger,
    fetchPage,
    pageSize: opts.pageSize,
    maxPages: opts.maxPages,
    modifiedSince: opts.modifiedSince,
    triggeredBy: opts.triggeredBy,
  });

  return NextResponse.json({
    ok: report.status !== 'failed',
    report,
  });
}
