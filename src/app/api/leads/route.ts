import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { createLead as createMondayLead } from '@/lib/integrations/monday';
import { notifyNewLead } from '@/lib/integrations/notifications';
import {
  HONEYPOT_FIELD,
  isRateLimited,
  verifySubmitToken,
} from '@/lib/lead-protection';

/**
 * Service-role Supabase client used by this route only.
 *
 * /api/leads is a public-facing endpoint (anon callers post contact
 * forms). We use the service role here for two reasons:
 *   1. INSERT followed by SELECT-id needs read-back access; granting
 *      anon SELECT on `leads` would leak every lead. Service role
 *      bypasses RLS for this single write+read flow only.
 *   2. The Monday-sync columns (monday_item_id, monday_synced_at,
 *      monday_sync_skipped) are written by this same route after the
 *      Monday wrapper returns. Granting anon UPDATE would similarly
 *      over-expose.
 *
 * The route still validates payload via zod and explicitly enumerates
 * the columns it writes, so service role doesn't widen the attack
 * surface beyond what the validator allows.
 */
function getServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Lead capture endpoint.
 *
 * Single source of truth for every lead, regardless of which surface
 * (contact form, viewing request, brochure, two-step landing page,
 * email-selection click, newsletter) it came from. Always writes to
 * the local `leads` table FIRST so we have a durable record even if
 * Monday is down or disabled. Monday wrapper is fire-and-forget —
 * env-gated to no-op when MONDAY_API_TOKEN is unset (per
 * SMARTMOVE_BRIEF §4.5).
 *
 * Public endpoint (anon INSERT allowed by RLS). Honours the source
 * enum and validates with zod so junk data can't reach the DB.
 */

const LeadSchema = z.object({
  source: z.enum([
    'contact-form',
    'viewing-request',
    'brochure-request',
    'email-selection-click',
    'newsletter',
    'two-step-landing',
    'quiz-area',
    'quiz-dev',
    'other',
  ]),
  source_detail: z.string().max(120).optional(),
  // Required contact fields (Step 1 of any funnel)
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  // Optional Step 2 enrichment fields
  bedrooms: z.string().max(20).optional(),
  budget_tier: z.string().max(40).optional(),
  purchase_timeline: z.string().max(40).optional(),
  contact_method: z.string().max(40).optional(),
  message: z.string().max(2000).optional(),
  // Property / dev / agent context (server resolves IDs from refs/slugs)
  property_id: z.string().uuid().optional(),
  property_reference: z.string().max(40).optional(),
  development_id: z.string().uuid().optional(),
  // Tracking
  utm_source: z.string().max(80).optional(),
  utm_medium: z.string().max(80).optional(),
  utm_campaign: z.string().max(80).optional(),
  utm_id: z.string().max(80).optional(),
  language: z.enum(['en', 'es', 'de', 'fr', 'ru', 'nl', 'da', 'sv', 'pl', 'no', 'tr', 'fi', 'hu', 'it']).optional(),
  // ── Anti-spam (stripped before insert) ──
  // Signed mount-time token from /api/leads/token.
  _ts: z.string().max(200).optional(),
  // Honeypot — hidden input humans never see.
  [HONEYPOT_FIELD]: z.string().max(200).optional(),
});

/** Bot-facing success: identical shape to the real one, writes nothing. */
function fakeSuccess() {
  return NextResponse.json({ ok: true, leadId: crypto.randomUUID() });
}

export async function POST(req: NextRequest) {
  // 1. Rate limit (Upstash sliding window per IP; skipped when not
  // configured, fails open on Redis trouble — a lead beats a limit).
  if (await isRateLimited(req)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "You're going a little fast — please wait a minute and try again, or email us directly.",
      },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = LeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Validation failed',
        issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // 2. Honeypot filled ⇒ bot. Pretend it worked; drop silently.
  if ((data[HONEYPOT_FIELD] ?? '').trim() !== '') {
    return fakeSuccess();
  }

  // 3. Mount-time token: forged/missing ⇒ hard reject; younger than the
  // human floor (2s from form render) ⇒ silent drop.
  const verdict = verifySubmitToken(data._ts);
  if (verdict === 'invalid') {
    return NextResponse.json(
      { ok: false, error: 'Form session expired — please reload the page and try again.' },
      { status: 400 }
    );
  }
  if (verdict === 'too-fast') {
    return fakeSuccess();
  }
  const supabase = getServiceRoleClient();

  // 1. Always write to local DB first. This is the durable record.
  // If Monday is down or disabled, the lead is still captured.
  const { data: row, error } = await supabase
    .from('leads')
    .insert({
      source: data.source,
      source_detail: data.source_detail ?? null,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      bedrooms: data.bedrooms ?? null,
      budget_tier: data.budget_tier ?? null,
      purchase_timeline: data.purchase_timeline ?? null,
      contact_method: data.contact_method ?? null,
      message: data.message ?? null,
      property_id: data.property_id ?? null,
      property_reference: data.property_reference ?? null,
      development_id: data.development_id ?? null,
      utm_source: data.utm_source ?? null,
      utm_medium: data.utm_medium ?? null,
      utm_campaign: data.utm_campaign ?? null,
      utm_id: data.utm_id ?? null,
      language: data.language ?? 'en',
      status: 'new',
      submitted_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !row) {
    console.error('Lead INSERT failed:', error);
    return NextResponse.json(
      { ok: false, error: 'Could not save lead' },
      { status: 500 }
    );
  }

  // 2. Monday push runs AFTER the response is sent (`after()`), so the
  // public form never waits on the Monday API. The lead is already
  // durably saved above; the push just enriches the row with the item
  // id (or marks it skipped when MONDAY_API_TOKEN isn't set). If the
  // push fails, the lead stays queued for the retry job via the
  // monday_pending index.
  after(async () => {
    try {
      const mondayResult = await createMondayLead({
        name: data.name,
        email: data.email,
        phone: data.phone,
        bedrooms: data.bedrooms,
        budgetTier: data.budget_tier,
        purchaseTimeline: data.purchase_timeline,
        contactMethod: data.contact_method,
        message: data.message,
        source: data.source_detail || data.source,
        propertyReference: data.property_reference,
        utm: {
          source: data.utm_source,
          medium: data.utm_medium,
          campaign: data.utm_campaign,
          id: data.utm_id,
        },
        language: data.language ?? 'en',
        submittedAt: new Date().toISOString(),
      });

      if (mondayResult.skipped) {
        await supabase
          .from('leads')
          .update({ monday_sync_skipped: true })
          .eq('id', row.id);
      } else if (mondayResult.ok && mondayResult.data?.itemId) {
        await supabase
          .from('leads')
          .update({
            monday_item_id: mondayResult.data.itemId,
            monday_synced_at: new Date().toISOString(),
          })
          .eq('id', row.id);
      }
    } catch (e) {
      console.error('Monday push failed for lead', row.id, e);
    }
  });

  // Coarse client location from Vercel edge geo headers — captured post-response
  // (after()), so it NEVER blocks or fails the lead write. Absent locally (no
  // Vercel edge) ⇒ no update, lead still saves. Privacy disclosure → cutover.
  const geoCode = req.headers.get('x-vercel-ip-country');
  const geoCity = req.headers.get('x-vercel-ip-city');
  const geoRegion = req.headers.get('x-vercel-ip-country-region');
  if (geoCode || geoCity) {
    after(async () => {
      try {
        let countryName: string | null = geoCode;
        if (geoCode) { try { countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(geoCode) ?? geoCode; } catch { countryName = geoCode; } }
        await supabase.from('leads').update({
          geo_country_code: geoCode ?? null,
          geo_country: countryName,
          geo_city: [geoCity ? decodeURIComponent(geoCity) : null, geoRegion].filter(Boolean).join(', ') || null,
        }).eq('id', row.id);
      } catch (e) { console.error('geo capture failed for lead', row.id, e); }
    });
  }

  // New-lead notification — email to the configured admin address. Runs
  // post-response and is env-gated (no-ops cleanly when RESEND_API_KEY is
  // unset). Never blocks the form; every send/skip is logged to `events`.
  after(() =>
    notifyNewLead({
      id: row.id, name: data.name, email: data.email, phone: data.phone,
      source: data.source, source_detail: data.source_detail, property_reference: data.property_reference,
      budget_tier: data.budget_tier, purchase_timeline: data.purchase_timeline, message: data.message,
    })
  );

  return NextResponse.json({ ok: true, leadId: row.id });
}
