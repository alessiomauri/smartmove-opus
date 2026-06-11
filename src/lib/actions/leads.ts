'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
  renderEmailCards,
  renderEmailCardsText,
  type EmailCardProperty,
} from '@/lib/email-card';
import { LEAD_STATUSES, type LeadStatus } from '@/lib/lead-status';

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return supabase;
}

export async function updateLeadStatus(leadId: string, status: LeadStatus): Promise<void> {
  // Server actions receive untyped data at runtime — validate for real.
  if (!(LEAD_STATUSES as readonly string[]).includes(status)) throw new Error('Invalid status');
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from('leads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', leadId);
  if (error) throw new Error(error.message);
}

const CARD_COLUMNS =
  'id, slug, name, location, area, price, price_on_request, bedrooms, bathrooms, interior_size, hero_image, source_id';

/**
 * Build the email-safe selection (text/html + text/plain) for the
 * given properties — by row id (admin listing multi-select) or by
 * Resales reference (lead rows carry property_reference). Order of
 * `ids` is preserved in the paste. `leadId` stamps every link so
 * clicks tie back to the lead.
 */
export async function buildEmailSelection(input: {
  ids?: string[];
  references?: string[];
  leadId?: string;
}): Promise<{ html: string; text: string; count: number }> {
  const supabase = await requireAdmin();
  const found = new Map<string, EmailCardProperty>();

  if (input.ids?.length) {
    const { data, error } = await supabase
      .from('properties')
      .select(CARD_COLUMNS)
      .in('id', input.ids.slice(0, 20));
    if (error) throw new Error(error.message);
    for (const p of (data ?? []) as EmailCardProperty[]) found.set(p.id, p);
  }
  if (input.references?.length) {
    const { data, error } = await supabase
      .from('properties')
      .select(CARD_COLUMNS)
      .in('source_id', input.references.slice(0, 20));
    if (error) throw new Error(error.message);
    for (const p of (data ?? []) as EmailCardProperty[]) found.set(p.id, p);
  }

  // Preserve the admin's selection order where ids were given.
  const ordered: EmailCardProperty[] = [];
  for (const id of input.ids ?? []) {
    const p = found.get(id);
    if (p) {
      ordered.push(p);
      found.delete(id);
    }
  }
  ordered.push(...found.values());

  if (ordered.length === 0) throw new Error('No matching properties found');

  const opts = { leadId: input.leadId };
  return {
    html: renderEmailCards(ordered, opts),
    text: renderEmailCardsText(ordered, opts),
    count: ordered.length,
  };
}
