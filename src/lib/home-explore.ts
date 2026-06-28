import { createStaticSupabaseClient } from '@/lib/supabase-static';

/**
 * Admin-controlled homepage "Explore" picks. Two curated lists
 * (homepage-explore-villas / -developments) drive the design's two cards.
 * Picks are referenced by listing ID; unpublished picks are skipped. With
 * more than one valid pick, rotation is deterministic by server-day so it
 * cycles "every so often". If a slot has no valid pick, that card hides.
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

function dayIndex(): number {
  return Math.floor(Date.now() / 86_400_000); // server-TZ day, deterministic
}

function priceLabel(price: number | null, onRequest: boolean | null): string | null {
  if (onRequest || !price || price <= 0) return onRequest ? 'Price on request' : null;
  if (price >= 1_000_000) return `€${(price / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (price >= 1_000) return `€${Math.round(price / 1_000)}k`;
  return `€${price.toLocaleString('en-US')}`;
}

async function orderedIds(sb: ReturnType<typeof createStaticSupabaseClient>, slug: string): Promise<string[]> {
  const { data: list } = await sb.from('curated_lists').select('id').eq('slug', slug).maybeSingle();
  if (!list) return [];
  const { data: items } = await sb.from('curated_list_items').select('entity_id, rank').eq('list_id', list.id).order('rank', { ascending: true });
  return (items ?? []).map((i) => i.entity_id as string);
}

export async function getExplorePicks(): Promise<{ villa: ExploreCard | null; dev: ExploreCard | null }> {
  const sb = createStaticSupabaseClient();
  const [villaIds, devIds] = await Promise.all([
    orderedIds(sb, 'homepage-explore-villas'),
    orderedIds(sb, 'homepage-explore-developments'),
  ]);

  let villa: ExploreCard | null = null;
  if (villaIds.length) {
    const { data } = await sb.from('properties')
      .select('id, name, slug, price, price_on_request, bedrooms, location, area, hero_image, published')
      .in('id', villaIds).eq('published', true);
    const byId = new Map((data ?? []).map((r) => [r.id, r]));
    const ordered = villaIds.map((id) => byId.get(id)).filter(Boolean) as NonNullable<typeof data>;
    if (ordered.length) {
      const r = ordered[dayIndex() % ordered.length];
      villa = { kind: 'villa', name: r.name, href: `/property/${r.slug}`, image: r.hero_image || null,
        priceLabel: priceLabel(r.price, r.price_on_request), beds: r.bedrooms ? `${r.bedrooms} beds` : null, location: r.location || r.area || null };
    }
  }

  let dev: ExploreCard | null = null;
  if (devIds.length) {
    const { data } = await sb.from('developments')
      .select('id, name, slug, price_from, price_on_request, bedrooms_from, bedrooms_to, location, area, hero_image, published')
      .in('id', devIds).eq('published', true);
    const byId = new Map((data ?? []).map((r) => [r.id, r]));
    const ordered = devIds.map((id) => byId.get(id)).filter(Boolean) as NonNullable<typeof data>;
    if (ordered.length) {
      const r = ordered[dayIndex() % ordered.length];
      const beds = r.bedrooms_from
        ? (r.bedrooms_to && r.bedrooms_to !== r.bedrooms_from ? `${r.bedrooms_from}–${r.bedrooms_to} beds` : `${r.bedrooms_from} beds`)
        : null;
      dev = { kind: 'development', name: r.name, href: `/new-developments/${r.slug}`, image: r.hero_image || null,
        priceLabel: priceLabel(r.price_from, r.price_on_request), beds, location: r.location || r.area || null };
    }
  }
  return { villa, dev };
}
