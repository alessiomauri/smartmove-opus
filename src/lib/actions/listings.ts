'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { PAGE_SIZE } from '@/app/admin/inventory/types';
import type { InventoryParams, InventoryRow } from '@/app/admin/inventory/types';

// /admin/listings = OWN / manual stock (everything NOT synced from Resales).
const COLUMNS =
  'id,slug,name,location,area,price,price_on_request,status,property_type,bedrooms,source,source_id,is_featured,featured_order,published,pending_review,rejected,hide_price_drop,hero_image,created_at';

type Sb = Awaited<ReturnType<typeof createServerSupabaseClient>>;
async function requireUser(sb: Sb) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('You must be logged in.');
}
const sanitize = (q: string) => q.replace(/[%,()]/g, ' ').trim();

export async function getListings(
  params: InventoryParams
): Promise<{ rows: InventoryRow[]; total: number; page: number; pageSize: number }> {
  const sb = await createServerSupabaseClient();
  await requireUser(sb);
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = sb.from('properties').select(COLUMNS, { count: 'exact' }).neq('source', 'resales_online');
  if (params.status && params.status !== 'all') query = query.eq('status', params.status);
  if (params.published === 'published') query = query.eq('published', true);
  else if (params.published === 'draft') query = query.eq('published', false);
  if (params.featured === 'featured') query = query.eq('is_featured', true);
  else if (params.featured === 'not') query = query.eq('is_featured', false);
  if (params.q) {
    const q = sanitize(params.q);
    if (q) query = query.or(`name.ilike.%${q}%,location.ilike.%${q}%,area.ilike.%${q}%,source_id.ilike.%${q}%`);
  }
  const sortCol = params.sort === 'price' ? 'price' : params.sort === 'name' ? 'name' : 'created_at';
  const ascending = params.dir === 'asc';
  query = query.order(sortCol, { ascending, nullsFirst: false }).range(from, from + PAGE_SIZE - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(`getListings: ${error.message}`);
  return { rows: (data ?? []) as unknown as InventoryRow[], total: count ?? 0, page, pageSize: PAGE_SIZE };
}

export async function getListingsCounts(): Promise<{ total: number; published: number; featured: number; sold: number }> {
  const sb = await createServerSupabaseClient();
  await requireUser(sb);
  const base = () => sb.from('properties').select('*', { count: 'exact', head: true }).neq('source', 'resales_online');
  const [total, published, featured, sold] = await Promise.all([
    base(),
    base().eq('published', true),
    base().eq('is_featured', true),
    base().eq('status', 'sold'),
  ]);
  return {
    total: total.count ?? 0,
    published: published.count ?? 0,
    featured: featured.count ?? 0,
    sold: sold.count ?? 0,
  };
}
