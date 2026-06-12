import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * /s/{code} → 302 to the stored same-origin path (shared searches and
 * anything future). Human-facing only: X-Robots-Tag noindex. Unknown
 * codes land on the search base rather than a 404 wall.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  let target = '/properties';
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
