import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * /c/{code} → a shared collection (short or custom slug, e.g.
 * /c/sierra-blanca-collection). Same table as /s/ — the kind just
 * keeps the namespaces readable. Long-form /collection/[slug] URLs
 * remain the canonical pages; these are the share handles. Noindex.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  let target = '/';
  if (/^[a-z0-9-]{3,40}$/.test(code)) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data } = await supabase.rpc('bump_short_link', { p_code: code });
    if (typeof data === 'string' && data.startsWith('/')) target = data;
  }
  const res = NextResponse.redirect(new URL(target, req.nextUrl.origin), 302);
  res.headers.set('X-Robots-Tag', 'noindex');
  return res;
}
