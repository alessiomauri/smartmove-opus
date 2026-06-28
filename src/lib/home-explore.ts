import { createStaticSupabaseClient } from '@/lib/supabase-static';

/**
 * Per-slot resolution for the homepage "Explore — if you already know" cards.
 * The villa slot and development slot resolve INDEPENDENTLY through a fallback
 * chain so the section never collapses during the build:
 *   1. admin `homepage-explore-*` curated list — valid published picks (rotates daily);
 *   2. else the top published `is_featured` listing of that kind (by `featured_order`);
 *   3. else null → the page renders the DESIGN PLACEHOLDER card.
 *
 * TODO(go-live): step 3 is a BUILD-TIME stand-in ONLY. Before public launch the
 * homepage-explore lists (or featured villa/development items) MUST hold real
 * listings, so no placeholder card ever ships to real visitors. See CUTOVER.md §6.
 */
export interface ExploreCard {
  kind: 'villa' | 'development';
  name: string;
  href: string;
  image: string | null;
  priceLabel: string | null;
  beds: string | null;
  location: string | null;
}

type Sb = ReturnType<typeof createStaticSupabaseClient>;

function dayIndex(): number {
  return Math.floor(Date.now() / 86_400_000); // server-TZ day, deterministic
}

function priceLabel(price: number | null, onRequest: boolean | null): string | null {
  if (onRequest || !price || price <= 0) return onRequest ? 'Price on request' : null;
  if (price >= 1_000_000) return `€${(price / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (price >= 1_000) return `€${Math.round(price / 1_000)}k`;
  return `€${price.toLocaleString('en-US')}`;
}

async function orderedIds(sb: Sb, slug: string): Promise<string[]> {
  const { data: list } = await sb.from('curated_lists').select('id').eq('slug', slug).maybeSingle();
  if (!list) return [];
  const { data: items } = await sb.from('curated_list_items').select('entity_id, rank').eq('list_id', list.id).order('rank', { ascending: true });
  return (items ?? []).map((i) => i.entity_id as string);
}

const VILLA_COLS = 'id, name, slug, price, price_on_request, bedrooms, location, area, hero_image, featured_order';
const DEV_COLS = 'id, name, slug, price_from, price_on_request, bedrooms_from, bedrooms_to, location, area, hero_image, featured_order';

interface VillaRow { name: string; slug: string; price: number | null; price_on_request: boolean | null; bedrooms: number | null; location: string | null; area: string | null; hero_image: string | null }
interface DevRow { name: string; slug: string; price_from: number | null; price_on_request: boolean | null; bedrooms_from: number | null; bedrooms_to: number | null; location: string | null; area: string | null; hero_image: string | null }

const villaCard = (r: VillaRow): ExploreCard => ({
  kind: 'villa', name: r.name, href: `/property/${r.slug}`, image: r.hero_image || null,
  priceLabel: priceLabel(r.price, r.price_on_request), beds: r.bedrooms ? `${r.bedrooms} beds` : null, location: r.location || r.area || null,
});
const devCard = (r: DevRow): ExploreCard => ({
  kind: 'development', name: r.name, href: `/new-developments/${r.slug}`, image: r.hero_image || null,
  priceLabel: priceLabel(r.price_from, r.price_on_request),
  beds: r.bedrooms_from ? (r.bedrooms_to && r.bedrooms_to !== r.bedrooms_from ? `${r.bedrooms_from}–${r.bedrooms_to} beds` : `${r.bedrooms_from} beds`) : null,
  location: r.location || r.area || null,
});

async function resolveVilla(sb: Sb): Promise<ExploreCard | null> {
  // 1. curated picks (rotate daily across valid published ones)
  const ids = await orderedIds(sb, 'homepage-explore-villas');
  if (ids.length) {
    const { data } = await sb.from('properties').select(VILLA_COLS).in('id', ids).eq('published', true);
    const rows = (data ?? []) as unknown as (VillaRow & { id: string })[];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as (VillaRow & { id: string })[];
    if (ordered.length) return villaCard(ordered[dayIndex() % ordered.length]);
  }
  // 2. top featured villa
  const { data: feat } = await sb.from('properties').select(VILLA_COLS)
    .eq('published', true).eq('is_featured', true).eq('property_type', 'villa')
    .order('featured_order', { ascending: true, nullsFirst: false }).limit(1);
  const featRows = (feat ?? []) as unknown as VillaRow[];
  if (featRows.length) return villaCard(featRows[0]);
  // 3. design placeholder (rendered by the page)
  return null;
}

async function resolveDev(sb: Sb): Promise<ExploreCard | null> {
  const ids = await orderedIds(sb, 'homepage-explore-developments');
  if (ids.length) {
    const { data } = await sb.from('developments').select(DEV_COLS).in('id', ids).eq('published', true);
    const rows = (data ?? []) as unknown as (DevRow & { id: string })[];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as (DevRow & { id: string })[];
    if (ordered.length) return devCard(ordered[dayIndex() % ordered.length]);
  }
  const { data: feat } = await sb.from('developments').select(DEV_COLS)
    .eq('published', true).eq('is_featured', true)
    .order('featured_order', { ascending: true, nullsFirst: false }).limit(1);
  const featRows = (feat ?? []) as unknown as DevRow[];
  if (featRows.length) return devCard(featRows[0]);
  return null;
}

export async function getExplorePicks(): Promise<{ villa: ExploreCard | null; dev: ExploreCard | null }> {
  const sb = createStaticSupabaseClient();
  const [villa, dev] = await Promise.all([resolveVilla(sb), resolveDev(sb)]);
  return { villa, dev };
}
