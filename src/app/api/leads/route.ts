import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createLead as createMondayLead } from '@/lib/integrations/monday';

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
});

export async function POST(req: NextRequest) {
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
  const supabase = await createServerSupabaseClient();

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

  // 2. Fire-and-forget Monday push. The wrapper no-ops cleanly when
  // MONDAY_API_TOKEN / MONDAY_BOARD_ID aren't set, which is the
  // launch-day default. When activated, it'll push and stash the
  // returned itemId; if it fails, we log and the lead is queued for
  // retry by a background job (Phase 4 work).
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

  // Mark the lead as "Monday-skipped" or stash the returned item id.
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

  return NextResponse.json({
    ok: true,
    leadId: row.id,
    monday: mondayResult.skipped ? 'skipped' : mondayResult.ok ? 'synced' : 'pending-retry',
  });
}
