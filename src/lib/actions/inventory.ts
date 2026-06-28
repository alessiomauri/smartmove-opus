'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { revalidatePath, updateTag } from 'next/cache';
import { PROPERTIES_TAG } from '@/lib/cache';
import { logEvent } from '@/lib/events';
import { PAGE_SIZE } from '@/app/admin/inventory/types';
import type {
  InventoryParams,
  InventoryRow,
  InventoryCounts,
  BulkAction,
} from '@/app/admin/inventory/types';

// /admin/inventory is the RESALES (synced) inventory. Own/manual stock lives
// on /admin/listings (Phase B). Scoping every query to this source keeps the
// two surfaces cleanly split and the counts meaningful.
const SOURCE = 'resales_online';

const INVENTORY_COLUMNS =
  'id,slug,name,location,area,price,price_on_request,status,property_type,bedrooms,source,source_id,is_featured,featured_order,published,pending_review,rejected,hide_price_drop,hero_image,created_at';

type Sb = Awaited<ReturnType<typeof createServerSupabaseClient>>;

async function requireUser(sb: Sb) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('You must be logged in.');
  return user;
}

// Invalidate the curated/public caches + the admin view after any mutation.
// updateTag (NOT revalidateTag) is the server-action variant — see §11.
function invalidate() {
  updateTag(PROPERTIES_TAG);
  revalidatePath('/');
  revalidatePath('/admin/inventory');
}

function sanitize(q: string) {
  return q.replace(/[%,()]/g, ' ').trim();
}

/** One page of inventory + the exact total for the active filter set. */
export async function getInventory(
  params: InventoryParams
): Promise<{ rows: InventoryRow[]; total: number; page: number; pageSize: number }> {
  const sb = await createServerSupabaseClient();
  await requireUser(sb);

  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = sb
    .from('properties')
    .select(INVENTORY_COLUMNS, { count: 'exact' })
    .eq('source', SOURCE);

  if (params.status && params.status !== 'all') query = query.eq('status', params.status);
  if (params.published === 'published') query = query.eq('published', true);
  else if (params.published === 'draft') query = query.eq('published', false);
  if (params.review === 'pending') query = query.eq('pending_review', true).eq('rejected', false);
  else if (params.review === 'rejected') query = query.eq('rejected', true);
  if (params.featured === 'featured') query = query.eq('is_featured', true);
  else if (params.featured === 'not') query = query.eq('is_featured', false);

  if (params.q) {
    const q = sanitize(params.q);
    if (q) query = query.or(`name.ilike.%${q}%,location.ilike.%${q}%,area.ilike.%${q}%,source_id.ilike.%${q}%`);
  }

  const sortCol = params.sort === 'price' ? 'price' : params.sort === 'name' ? 'name' : 'created_at';
  const ascending = params.dir === 'asc'; // default desc (newest / highest first)
  query = query.order(sortCol, { ascending, nullsFirst: false }).range(from, from + PAGE_SIZE - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(`getInventory: ${error.message}`);
  return { rows: (data ?? []) as unknown as InventoryRow[], total: count ?? 0, page, pageSize: PAGE_SIZE };
}

/** Aggregate counts via cheap head queries — never loads rows. */
export async function getInventoryCounts(): Promise<InventoryCounts> {
  const sb = await createServerSupabaseClient();
  await requireUser(sb);
  const base = () => sb.from('properties').select('*', { count: 'exact', head: true }).eq('source', SOURCE);
  const [total, pending, published, sold] = await Promise.all([
    base(),
    base().eq('pending_review', true).eq('rejected', false),
    base().eq('published', true),
    base().eq('status', 'sold'),
  ]);
  return {
    total: total.count ?? 0,
    pendingReview: pending.count ?? 0,
    published: published.count ?? 0,
    sold: sold.count ?? 0,
  };
}

async function mutate(id: string, patch: Record<string, unknown>, action: string, meta?: Record<string, unknown>) {
  const sb = await createServerSupabaseClient();
  await requireUser(sb);
  const { error } = await sb.from('properties').update(patch).eq('id', id);
  if (error) throw new Error(`${action}: ${error.message}`);
  invalidate();
  await logEvent({ entityType: 'property', entityId: id, action, meta });
}

export async function approveProperty(id: string) {
  return mutate(id, { pending_review: false, rejected: false, published: true, approved_at: new Date().toISOString() }, 'approved');
}
export async function rejectProperty(id: string) {
  return mutate(id, { rejected: true, pending_review: false, published: false }, 'rejected');
}
export async function setPropertyPublished(id: string, published: boolean) {
  return mutate(id, { published }, published ? 'published' : 'hidden');
}
export async function setPropertyFeatured(id: string, featured: boolean) {
  // featured_order:0 = top. THE FIX: this now invalidates PROPERTIES_TAG via
  // mutate()/invalidate() — the old admin/page.tsx toggle busted no cache, so
  // featuring never reached the public homepage until something else flushed.
  return mutate(id, { is_featured: featured, featured_order: 0 }, featured ? 'featured' : 'unfeatured');
}
export async function setPropertyHidePriceDrop(id: string, hide: boolean) {
  return mutate(id, { hide_price_drop: hide }, hide ? 'price_drop_hidden' : 'price_drop_shown');
}

const BULK_PATCH: Record<BulkAction, Record<string, unknown>> = {
  approve: { pending_review: false, rejected: false, published: true },
  reject: { rejected: true, pending_review: false, published: false },
  publish: { published: true },
  hide: { published: false },
  feature: { is_featured: true, featured_order: 0 },
  unfeature: { is_featured: false },
};

export async function bulkInventoryAction(ids: string[], action: BulkAction) {
  const sb = await createServerSupabaseClient();
  await requireUser(sb);
  if (!ids.length) return { count: 0 };
  if (!(action in BULK_PATCH)) throw new Error(`Unknown bulk action: ${action}`);
  const patch = { ...BULK_PATCH[action] };
  if (action === 'approve') (patch as Record<string, unknown>).approved_at = new Date().toISOString();
  const { error } = await sb.from('properties').update(patch).in('id', ids);
  if (error) throw new Error(`bulk ${action}: ${error.message}`);
  invalidate();
  await logEvent({ entityType: 'property', entityId: null, action: `bulk_${action}`, meta: { count: ids.length } });
  return { count: ids.length };
}
