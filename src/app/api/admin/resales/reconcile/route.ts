import { NextRequest, NextResponse, after } from 'next/server';
import { createClient as createSupabaseAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { runReconcileChunk } from '@/lib/integrations/resales-reconcile';

export const maxDuration = 300;

/**
 * Weekly reference-set reconciliation (RESALES_SYNC_PROMPT Phase 5).
 *
 * GET  — Vercel Cron (Sunday 04:30, vercel.json) with
 *        `Authorization: Bearer ${CRON_SECRET}`.
 * POST — admin trigger from /admin/resales (or secret header for the
 *        self-chained continuation calls).
 *
 * The full-inventory walk is chunked exactly like the full import: each
 * invocation processes N pages, persists cursor + collected refs in
 * sync_state, self-chains via after() until the walk completes, then
 * diffs and applies in the final invocation.
 */

function serviceClient(): SupabaseClient | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.SYNC_CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = serviceClient() ?? (await createServerSupabaseClient());
  return execute(req, supabase, { triggeredBy: null, restart: true });
}

export async function POST(req: NextRequest) {
  const secretHeader = req.headers.get('x-smartmove-cron-secret');
  const expected = process.env.SYNC_CRON_SECRET;
  let triggeredBy: string | null = null;
  let isSecretAuth = false;

  if (expected && secretHeader === expected) {
    isSecretAuth = true;
  } else {
    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    triggeredBy = user.id;
  }

  let body: { restart?: boolean; pagesPerChunk?: number; continuation?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // empty body fine
  }

  const supabase = isSecretAuth
    ? serviceClient() ?? (await createServerSupabaseClient())
    : await createServerSupabaseClient();

  return execute(req, supabase, {
    triggeredBy,
    // Continuations resume; a fresh admin/cron call restarts the walk.
    restart: body.continuation ? false : body.restart ?? true,
    pagesPerChunk: body.pagesPerChunk,
  });
}

/**
 * Immediate-ack: schedule the reconcile drain in after() and return at
 * once. Same fix as the full-import route — the previous design awaited
 * the continuation's full response inside after(), nesting the awaits
 * across the chain and blowing maxDuration (a ~217-page feed needs two
 * drains, so this bit in prod). Now each drain is independent and its
 * continuation fetch returns in ~100ms.
 */
function execute(
  req: NextRequest,
  supabase: SupabaseClient,
  opts: { triggeredBy: string | null; restart?: boolean; pagesPerChunk?: number }
) {
  const origin = continuationOrigin(req);
  after(() => drainReconcile(supabase, opts.triggeredBy, opts.restart ?? false, opts.pagesPerChunk, origin));
  return NextResponse.json({ ok: true, started: true });
}

async function drainReconcile(
  supabase: SupabaseClient,
  triggeredBy: string | null,
  restart: boolean,
  pagesPerChunk: number | undefined,
  origin: string
) {
  let result;
  try {
    result = await runReconcileChunk({
      supabase,
      triggeredBy,
      restart,
      pagesPerChunk,
      deadlineMs: Date.now() + (Number(process.env.RESALES_DRAIN_BUDGET_MS || '') || 230_000),
    });
  } catch (e) {
    console.error('reconcile drain failed (cron/manual will resume):', e);
    return;
  }
  // Walk incomplete → chain one more drain (child immediate-acks, no
  // nesting). The weekly cron is the backstop if the fetch fails.
  if (!result.done) {
    const secret = process.env.SYNC_CRON_SECRET;
    if (!secret) return;
    const url = new URL('/api/admin/resales/reconcile', origin).toString();
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-smartmove-cron-secret': secret,
    };
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
      headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    }
    try {
      await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ continuation: true }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      console.error('reconcile continuation fetch failed (cron will resume):', e);
    }
  }
}

/** Request origin (correct in prod + local), env fallback for odd cases. */
function continuationOrigin(req: NextRequest): string {
  const o = req.nextUrl.origin;
  if (o && /^https?:\/\//.test(o)) return o;
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}
