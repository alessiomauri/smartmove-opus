import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { revalidateTag } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { runPublishGateBacklog } from '@/lib/integrations/resales-publish-gate';
import { PROPERTIES_TAG } from '@/lib/cache';

// 8k rows = a handful of grouped batch updates — finishes in seconds.
export const maxDuration = 300;

/**
 * Bulk publish-gate pass over the held backlog (review-by-exception).
 *
 * Evaluates every untouched-held Resales property (pending ∧ unpublished
 * ∧ not rejected/removed) against site_settings.publish_gate: passers
 * publish into the full-search inventory, failers get their failing rule
 * keys recorded and stay in the queue. Re-run any time — e.g. right
 * after editing thresholds. `{dryRun:true}` reports without writing.
 *
 * Auth: admin session, or `x-smartmove-cron-secret` for ops/scripts.
 */
export async function POST(req: NextRequest) {
  const secretHeader = req.headers.get('x-smartmove-cron-secret');
  const expected = process.env.SYNC_CRON_SECRET;
  let isSecretAuth = false;

  if (expected && secretHeader === expected) {
    isSecretAuth = true;
  } else {
    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: { dryRun?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // empty body fine
  }

  const supabase = isSecretAuth
    ? serviceClient() ?? (await createServerSupabaseClient())
    : await createServerSupabaseClient();

  let report;
  try {
    report = await runPublishGateBacklog(supabase, { dryRun: body.dryRun === true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }

  if ('skipped' in report) {
    return NextResponse.json({ ok: true, ...report });
  }

  // Newly published rows: invalidate the inventory caches. NO IndexNow
  // ping — gate-published MLS rows are Tier-2 (noindex, out of sitemap);
  // pinging them would invite indexing of pages we deliberately hide.
  const indexnowPinged = 0;
  if (!report.dryRun && report.published > 0) {
    revalidateTag(PROPERTIES_TAG, 'max');
  }

  const message =
    `Scanned ${report.scanned} held: published ${report.published}, ` +
    `held ${report.held}` +
    (report.passedSold ? `, cleared ${report.passedSold} sold` : '') +
    (report.errors.length ? ` — ${report.errors.length} error(s)` : '') +
    (report.dryRun ? ' (dry run)' : '');

  // publishedSlugs can be thousands of entries — return the count only.
  const { publishedSlugs: _slugs, ...rest } = report;
  return NextResponse.json({
    ok: report.errors.length === 0,
    report: { ...rest, indexnowPinged, message },
  });
}

function serviceClient(): SupabaseClient | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
