import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { isRateLimited } from '@/lib/lead-protection';

/**
 * Short-link minting (Prompt 3). One table, one code style for
 * everything shared: searches (/s/{code}), collections (/c/{code}),
 * future selections/saved-searches.
 *
 * Public minting is allowed (the search Share button is public) but
 * tightly bounded: same-origin paths only, rate-limited, random codes
 * only. CUSTOM slugs (e.g. /c/sierra-blanca-collection) require an
 * authenticated admin.
 */

const MintSchema = z.object({
  target: z.string().min(1).max(600).regex(/^\/[^\s]*$/, 'same-origin path required'),
  kind: z.enum(['search', 'collection']).default('search'),
  context: z.record(z.string(), z.unknown()).optional(),
  /** Admin-only custom code. */
  code: z.string().regex(/^[a-z0-9-]{3,40}$/).optional(),
});

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function randomCode(len = 7): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'; // no 0/O/1/l/i
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

export async function POST(req: NextRequest) {
  if (await isRateLimited(req, ':short-links')) {
    return NextResponse.json(
      { ok: false, error: 'Too many links too fast — try again in a minute.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = MintSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Validation failed' }, { status: 400 });
  }
  const { target, kind, context, code: customCode } = parsed.data;

  // Paranoia on top of the regex: no protocol smuggling.
  if (target.startsWith('//') || target.includes('://')) {
    return NextResponse.json({ ok: false, error: 'Invalid target' }, { status: 400 });
  }

  if (customCode) {
    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Custom slugs are admin-only' },
        { status: 403 }
      );
    }
  }

  const supabase = service();

  // Dedup: same target → same code (keeps repeat shares stable).
  if (!customCode) {
    const { data: existing } = await supabase
      .from('short_links')
      .select('code')
      .eq('target', target)
      .eq('kind', kind)
      .limit(1)
      .maybeSingle();
    if (existing?.code) {
      return NextResponse.json({ ok: true, code: existing.code, reused: true });
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = customCode ?? randomCode();
    const { error } = await supabase
      .from('short_links')
      .insert({ code, target, kind, context: context ?? null });
    if (!error) return NextResponse.json({ ok: true, code });
    if (error.code === '23505') {
      // unique violation
      if (customCode) {
        return NextResponse.json({ ok: false, error: 'That slug is taken' }, { status: 409 });
      }
      continue; // random collision — extremely unlikely; retry
    }
    console.error('short-link insert:', error.message);
    return NextResponse.json({ ok: false, error: 'Could not create link' }, { status: 500 });
  }
  return NextResponse.json({ ok: false, error: 'Could not create link' }, { status: 500 });
}
