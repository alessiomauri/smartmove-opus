'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { logEvent } from '@/lib/events';
import type { SelectionRecord } from '@/app/admin/leads/selection-types';

// Selection rails — EXTEND email_selections + the ordered
// email_selection_properties junction (no parallel table). Auth-gated;
// the editor lives on the admin-only /admin/leads surface.
async function requireAuth() {
  const sb = await createServerSupabaseClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return sb;
}

const PROP_SUMMARY = 'id,name,slug,hero_image,price,price_on_request,location,area,source_id';

/**
 * The property a lead came from, if any — by direct `property_id`, else by
 * Resales `property_reference` → `properties.source_id`. Confirms the row
 * exists and is readable (guards stale ids / FK violations) under the caller's
 * RLS. Returns null for contact/quiz/footer leads with no property context.
 */
async function resolveLeadProperty(
  sb: Awaited<ReturnType<typeof requireAuth>>,
  leadId: string
): Promise<string | null> {
  const { data: lead } = await sb.from('leads').select('property_id, property_reference').eq('id', leadId).maybeSingle();
  if (!lead) return null;
  if (lead.property_id) {
    const { data: p } = await sb.from('properties').select('id').eq('id', lead.property_id).maybeSingle();
    if (p?.id) return p.id as string;
  }
  if (lead.property_reference) {
    const { data: p } = await sb.from('properties').select('id').eq('source_id', lead.property_reference).maybeSingle();
    if (p?.id) return p.id as string;
  }
  return null;
}

export async function getSelectionsForLead(leadId: string): Promise<SelectionRecord[]> {
  const sb = await requireAuth();
  const { data: sels } = await sb.from('email_selections')
    .select('id,name,status,sent_at,send_count').eq('lead_id', leadId).order('created_at', { ascending: false });
  if (!sels?.length) return [];
  const ids = sels.map((s) => s.id);
  const { data: items } = await sb.from('email_selection_properties')
    .select('id,selection_id,property_id,sort_order').in('selection_id', ids).order('sort_order', { ascending: true });
  const propIds = [...new Set((items ?? []).map((i) => i.property_id))];
  const byId = new Map<string, Record<string, unknown>>();
  if (propIds.length) {
    const { data: props } = await sb.from('properties').select(PROP_SUMMARY).in('id', propIds);
    (props ?? []).forEach((p) => byId.set(p.id, p));
  }
  return sels.map((s) => ({
    id: s.id, name: s.name, status: s.status, sentAt: s.sent_at, sendCount: s.send_count ?? 0,
    items: (items ?? []).filter((i) => i.selection_id === s.id).map((i) => ({
      itemId: i.id, propertyId: i.property_id, sortOrder: i.sort_order,
      summary: (byId.get(i.property_id) as SelectionRecord['items'][number]['summary']) ?? null,
    })),
  }));
}

export async function createSelection(leadId: string, name?: string): Promise<string> {
  const sb = await requireAuth();
  const { data, error } = await sb.from('email_selections')
    .insert({ lead_id: leadId, name: name?.trim() || `Selection ${new Date().toISOString().slice(0, 10)}`, status: 'draft' })
    .select('id').single();
  if (error) throw new Error(error.message);

  // Auto-seed the source property: for a lead that came from a specific
  // property page, that listing is added as the first item (sort_order 0) so
  // the editor opens with it already in the list (still add/remove others).
  // Contact/quiz/footer leads (no property context) start empty. This runs on
  // the SAME RLS-bound client as the insert above, so it passes for an agent
  // on their OWN lead and is blocked on another's — and a foreign lead would
  // have already failed the email_selections insert above, never reaching here.
  const sourcePropertyId = await resolveLeadProperty(sb, leadId);
  if (sourcePropertyId) {
    const { error: seedErr } = await sb.from('email_selection_properties')
      .insert({ selection_id: data.id, property_id: sourcePropertyId, sort_order: 0 });
    if (seedErr && seedErr.code !== '23505') console.error('selection source-property auto-seed failed:', seedErr.message);
  }

  await logEvent({ entityType: 'selection', entityId: data.id, action: 'selection_drafted', meta: { leadId, seededSource: !!sourcePropertyId } });
  return data.id;
}

export async function addSelectionItem(selectionId: string, propertyId: string) {
  const sb = await requireAuth();
  const { data: maxRow } = await sb.from('email_selection_properties')
    .select('sort_order').eq('selection_id', selectionId).order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const sort = ((maxRow?.sort_order as number | undefined) ?? -1) + 1;
  const { error } = await sb.from('email_selection_properties').insert({ selection_id: selectionId, property_id: propertyId, sort_order: sort });
  if (error) { if (error.code === '23505') throw new Error('Already in this selection'); throw new Error(error.message); }
}

export async function removeSelectionItem(itemId: string) {
  const sb = await requireAuth();
  const { error } = await sb.from('email_selection_properties').delete().eq('id', itemId);
  if (error) throw new Error(error.message);
}

export async function reorderSelection(orderedItemIds: string[]) {
  const sb = await requireAuth();
  for (let i = 0; i < orderedItemIds.length; i++) {
    const { error } = await sb.from('email_selection_properties').update({ sort_order: i }).eq('id', orderedItemIds[i]);
    if (error) throw new Error(error.message);
  }
}

export async function markSelectionSent(selectionId: string) {
  const sb = await requireAuth();
  const { data: cur } = await sb.from('email_selections').select('send_count').eq('id', selectionId).maybeSingle();
  const now = new Date().toISOString();
  const { error } = await sb.from('email_selections')
    .update({ status: 'sent', sent_at: now, last_sent_at: now, send_count: ((cur?.send_count as number | undefined) ?? 0) + 1 })
    .eq('id', selectionId);
  if (error) throw new Error(error.message);
  await logEvent({ entityType: 'selection', entityId: selectionId, action: 'selection_sent' });
}
