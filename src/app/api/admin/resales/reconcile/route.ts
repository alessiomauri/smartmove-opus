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

async function execute(
  req: NextRequest,
  supabase: SupabaseClient,
  opts: { triggeredBy: string | null; restart?: boolean; pagesPerChunk?: number }
) {
  const result = await runReconcileChunk({
    supabase,
    triggeredBy: opts.triggeredBy,
    restart: opts.restart,
    pagesPerChunk: opts.pagesPerChunk,
  });

  if (!result.done) {
    const secret = process.env.SYNC_CRON_SECRET;
    if (secret) {
      const selfUrl = new URL('/api/admin/resales/reconcile', req.nextUrl.origin).toString();
      after(async () => {
        try {
          await fetch(selfUrl, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-smartmove-cron-secret': secret,
            },
            body: JSON.stringify({ continuation: true }),
          });
        } catch (e) {
          console.error('reconcile continuation failed to schedule:', e);
        }
      });
    }
    return NextResponse.json({
      ok: true,
      done: false,
      chained: Boolean(secret),
      progress: { page: result.state.page, refsCollected: result.state.refs.length, total: result.state.total_count },
    });
  }

  return NextResponse.json({ ok: true, done: true, summary: result.summary });
}
