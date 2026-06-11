import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { isRateLimited } from '@/lib/lead-protection';

/**
 * Form-view tracking (impressions). Fired once per form mount via
 * sendBeacon/fetch; submissions are the `leads` rows themselves, so
 * conversion per form = leads ÷ views. Deliberately tiny: no cookies,
 * no user ids, no query strings — just "this form was seen on this
 * path".
 */

const EventSchema = z.object({
  form: z.string().min(1).max(40),
  path: z.string().max(200).optional(),
  detail: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  // Generous limit — it's one beacon per page view; spam just skews
  // the denominator, never creates leads.
  if (await isRateLimited(req, ':track')) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  await supabase.from('lead_form_events').insert({
    form: parsed.data.form,
    event: 'view',
    path: parsed.data.path?.split('?')[0] ?? null,
    detail: parsed.data.detail ?? null,
  });

  return NextResponse.json({ ok: true });
}
