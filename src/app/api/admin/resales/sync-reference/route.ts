import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { propertyDetails, RESALES_LANG } from '@/lib/integrations/resales';
import { runResalesSync, type ResalesPage } from '@/lib/integrations/resales-sync';
import { fetchOwnReferenceSet } from '@/lib/integrations/resales-own';

/**
 * Single-reference sync. One PropertyDetails call → one upsert.
 *
 * Useful for spot-fixing a stale row, or pulling a specific property
 * an admin found via Resales' own dashboard. Always requests EN+ES so
 * the descriptions JSONB lands populated on first sync.
 *
 * Admin-only.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { reference?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const reference = body.reference?.trim();
  if (!reference) {
    return NextResponse.json({ ok: false, error: 'Missing reference' }, { status: 400 });
  }

  let yielded = false;
  const fetchPage = async (): Promise<ResalesPage> => {
    if (yielded) {
      return { properties: [], totalCount: 1, queryId: null, done: true };
    }
    yielded = true;
    const env = await propertyDetails({
      reference,
      langs: [RESALES_LANG.en, RESALES_LANG.es],
      showGPSCoords: true,
      showDecree218: true,
    });
    const props = (env as { Property?: unknown }).Property;
    const arr = Array.isArray(props) ? props : props ? [props] : [];
    return {
      properties: arr as ResalesPage['properties'],
      totalCount: arr.length,
      queryId: null,
      done: true,
    };
  };

  const report = await runResalesSync({
    supabase,
    trigger: 'single-ref',
    fetchOwnRefs: fetchOwnReferenceSet,
    fetchPage,
    reference,
    triggeredBy: user.id,
  });

  return NextResponse.json({
    ok: report.status !== 'failed',
    report,
  });
}
