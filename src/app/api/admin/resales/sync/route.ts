import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { searchProperties, type ResalesEnvelope, type ResalesProperty } from '@/lib/integrations/resales';
import { runResalesSync, type ResalesPage, type SyncTrigger } from '@/lib/integrations/resales-sync';

/**
 * Live-mode Resales sync.
 *
 * Two auth paths:
 *   1. Admin user (Supabase auth) — manual trigger from /admin/resales
 *   2. Cron — header `x-smartmove-cron-secret` matching env SYNC_CRON_SECRET
 *
 * Walks SearchProperties pages session-aware (P_QueryId) per
 * RESALES_API_REFERENCE §8. Stops at modified-since when given.
 *
 * NOTE: requires the Cloudflare Worker proxy to have valid p1/p2
 * secrets. Until those land, calls return 401 from the Worker —
 * the orchestrator surfaces that as a sync failure with a clear
 * error_summary in resales_sync_runs.
 */
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

  // ─── Fetcher (live API via the Worker proxy) ───
  const supabase = await createServerSupabaseClient();

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
    trigger,
    fetchPage,
    pageSize: body.pageSize ?? 50,
    maxPages: body.maxPages ?? 200,
    modifiedSince: body.modifiedSince ?? null,
    triggeredBy,
  });

  return NextResponse.json({
    ok: report.status !== 'failed',
    report,
  });
}
