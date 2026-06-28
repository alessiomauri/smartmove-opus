'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { revalidatePath, updateTag } from 'next/cache';
import { PROPERTIES_TAG } from '@/lib/cache';
import { logEvent } from '@/lib/events';
import type { EntitySummary, FeaturedItem, CuratedListData, CuratedItem, EntityType } from '@/app/admin/curation/types';

type Sb = Awaited<ReturnType<typeof createServerSupabaseClient>>;
async function requireUser(sb: Sb) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('You must be logged in.');
}
const sanitize = (q: string) => q.replace(/[%,()]/g, ' ').trim();

const PROP_COLS = 'id,name,slug,price,price_on_request,hero_image,location,area,source_id,is_featured,published,status';
// developments use ranges/different field names — projected into EntitySummary.
const DEV_COLS = 'id,name,slug,price_from,hero_image,location,area,source_id,published,status';

type DevRow = {
  id: string; name: string; slug: string; price_from: number | null;
  hero_image: string; location: string | null; area: string | null;
  source_id: string | null; published: boolean; status: string | null;
};
function devToSummary(d: DevRow): EntitySummary {
  return {
    id: d.id, name: d.name, slug: d.slug, price: d.price_from, price_on_request: false,
    hero_image: d.hero_image, location: d.location, area: d.area, source_id: d.source_id,
    published: d.published, status: d.status,
  };
}

// ---------- Featured-by-ref ----------
export async function getPropertyByRef(ref: string): Promise<EntitySummary | null> {
  const sb = await createServerSupabaseClient();
  await requireUser(sb);
  const r = sanitize(ref);
  if (!r) return null;
  const { data } = await sb.from('properties').select(PROP_COLS).eq('source_id', r).limit(1).maybeSingle();
  return (data as EntitySummary) ?? null;
}

// ---------- Featured set + ordering (kills the always-0 behaviour) ----------
export async function getFeaturedProperties(): Promise<FeaturedItem[]> {
  const sb = await createServerSupabaseClient();
  await requireUser(sb);
  const { data, error } = await sb
    .from('properties')
    .select(`${PROP_COLS},featured_order`)
    .eq('is_featured', true)
    .order('featured_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw new Error(`getFeaturedProperties: ${error.message}`);
  return (data ?? []) as unknown as FeaturedItem[];
}

export async function setFeaturedOrder(orderedIds: string[]) {
  const sb = await createServerSupabaseClient();
  await requireUser(sb);
  // Write featured_order = position. Small set (curated homepage picks).
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await sb.from('properties').update({ featured_order: i }).eq('id', orderedIds[i]);
    if (error) throw new Error(`setFeaturedOrder: ${error.message}`);
  }
  updateTag(PROPERTIES_TAG);
  revalidatePath('/');
  revalidatePath('/admin/curation');
  await logEvent({ entityType: 'property', entityId: null, action: 'featured_reordered', meta: { count: orderedIds.length } });
}

// ---------- Search (server-side, reaches beyond the 1000-row admin cap) ----------
export async function searchPropertiesForCuration(q: string): Promise<EntitySummary[]> {
  const sb = await createServerSupabaseClient();
  await requireUser(sb);
  const s = sanitize(q);
  if (!s) return [];
  const { data } = await sb.from('properties').select(PROP_COLS)
    .or(`name.ilike.%${s}%,location.ilike.%${s}%,area.ilike.%${s}%,source_id.ilike.%${s}%`)
    .order('price', { ascending: false, nullsFirst: false }).limit(20);
  return (data ?? []) as EntitySummary[];
}

export async function searchDevelopmentsForCuration(q: string): Promise<EntitySummary[]> {
  const sb = await createServerSupabaseClient();
  await requireUser(sb);
  const s = sanitize(q);
  if (!s) return [];
  const { data } = await sb.from('developments').select(DEV_COLS)
    .or(`name.ilike.%${s}%,location.ilike.%${s}%,area.ilike.%${s}%,source_id.ilike.%${s}%`)
    .order('price_from', { ascending: false, nullsFirst: false }).limit(20);
  return ((data ?? []) as DevRow[]).map(devToSummary);
}

// ---------- Top-20 curated lists ----------
async function listBySlug(sb: Sb, slug: string) {
  const { data, error } = await sb.from('curated_lists').select('id,slug,title,entity_type').eq('slug', slug).single();
  if (error || !data) throw new Error(`curated list not found: ${slug}`);
  return data as { id: string; slug: string; title: string; entity_type: EntityType };
}

export async function getCuratedList(slug: string): Promise<CuratedListData> {
  const sb = await createServerSupabaseClient();
  await requireUser(sb);
  const list = await listBySlug(sb, slug);
  const { data: items } = await sb.from('curated_list_items')
    .select('id,entity_id,rank,entity_type').eq('list_id', list.id).order('rank', { ascending: true });
  const rows = items ?? [];
  const ids = rows.map((r) => r.entity_id);
  const byId = new Map<string, EntitySummary>();
  if (ids.length) {
    if (list.entity_type === 'property') {
      const { data } = await sb.from('properties').select(PROP_COLS).in('id', ids);
      (data as EntitySummary[] | null ?? []).forEach((p) => byId.set(p.id, p));
    } else {
      const { data } = await sb.from('developments').select(DEV_COLS).in('id', ids);
      ((data as DevRow[] | null) ?? []).forEach((d) => byId.set(d.id, devToSummary(d)));
    }
  }
  const curatedItems: CuratedItem[] = rows.map((r) => ({
    itemId: r.id, entityId: r.entity_id, rank: r.rank, entityType: r.entity_type as EntityType,
    summary: byId.get(r.entity_id) ?? null,
  }));
  return { slug: list.slug, title: list.title, entityType: list.entity_type, items: curatedItems };
}

export async function addCuratedItem(slug: string, entityId: string) {
  const sb = await createServerSupabaseClient();
  await requireUser(sb);
  const list = await listBySlug(sb, slug);
  const { data: maxRow } = await sb.from('curated_list_items')
    .select('rank').eq('list_id', list.id).order('rank', { ascending: false }).limit(1).maybeSingle();
  const rank = ((maxRow?.rank as number | undefined) ?? -1) + 1;
  const { error } = await sb.from('curated_list_items')
    .insert({ list_id: list.id, entity_type: list.entity_type, entity_id: entityId, rank });
  if (error) {
    if (error.code === '23505') throw new Error('Already in this list.');
    throw new Error(`addCuratedItem: ${error.message}`);
  }
  revalidatePath('/admin/curation');
  await logEvent({ entityType: list.entity_type, entityId, action: 'curated_added', meta: { list: slug } });
}

export async function removeCuratedItem(itemId: string) {
  const sb = await createServerSupabaseClient();
  await requireUser(sb);
  const { error } = await sb.from('curated_list_items').delete().eq('id', itemId);
  if (error) throw new Error(`removeCuratedItem: ${error.message}`);
  revalidatePath('/admin/curation');
  await logEvent({ entityType: 'curated_list_item', entityId: itemId, action: 'curated_removed' });
}

export async function reorderCuratedList(orderedItemIds: string[]) {
  const sb = await createServerSupabaseClient();
  await requireUser(sb);
  for (let i = 0; i < orderedItemIds.length; i++) {
    const { error } = await sb.from('curated_list_items').update({ rank: i }).eq('id', orderedItemIds[i]);
    if (error) throw new Error(`reorderCuratedList: ${error.message}`);
  }
  revalidatePath('/admin/curation');
  await logEvent({ entityType: 'curated_list', entityId: null, action: 'curated_reordered', meta: { count: orderedItemIds.length } });
}
