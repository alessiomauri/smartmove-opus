import { unstable_cache } from 'next/cache';
import { createStaticSupabaseClient } from '@/lib/supabase-static';
import { Property, SortOption } from '@/types/property';
import { Development } from '@/types/development';
import { PROPERTY_LIST_COLUMNS, AREA_STAT_COLUMNS, type AreaStatRow } from '@/lib/list-columns';
import { withPriceDropFlag } from '@/lib/price-drop';

/**
 * Cache tags used across the app. When admin mutations occur, call
 * `updateTag(<TAG>)` so every page that reads that entity refreshes on
 * the next request. Tag-based invalidation works regardless of the
 * locale-prefixed URL tree (unlike revalidatePath('/blog/x'), which
 * never matches the real /[locale]/blog/x route).
 */
export const PROPERTIES_TAG = 'properties';
export const AREAS_TAG = 'areas';
export const SITE_SETTINGS_TAG = 'site_settings';
export const DEVELOPMENTS_TAG = 'developments';
export const BLOG_TAG = 'blog';
export const COLLECTIONS_TAG = 'collections';
export const QUIZZES_TAG = 'quizzes';

// Columns we need for listing / card rendering — shared with the client
// favourites hook via src/lib/list-columns.ts.
const LIST_COLUMNS = PROPERTY_LIST_COLUMNS;

/**
 * Cached fetch of the CURATED published universe — the grid source of
 * truth for `/` and `/areas/[slug]`: every non-Resales row plus any
 * Resales row an admin explicitly featured. The publish-gate bulk
 * inventory (thousands of auto-published MLS rows) is filtered OUT at
 * the SQL level: every consumer of this cache discards it anyway
 * (homepage curated gate, area pages' editorial filter), and including
 * it pushed the entry past unstable_cache's 2MB limit — which silently
 * disabled caching for every page reading it. A future full-search
 * surface must query SQL directly (filtered + paginated), not this.
 *
 * Rows carry the computed `price_drop` flag, double-gated by the
 * site-wide toggle and the per-listing opt-out (src/lib/price-drop.ts).
 * Tagged with SITE_SETTINGS_TAG too, so flipping the toggle in admin
 * re-gates every cached card immediately.
 */
export const getCachedPublishedProperties = unstable_cache(
  async (): Promise<Property[]> => {
    const supabase = createStaticSupabaseClient();
    const [{ data, error }, { data: settings }] = await Promise.all([
      supabase
        .from('properties')
        .select(LIST_COLUMNS)
        .eq('published', true)
        // Curated universe only — see the docblock.
        .or('source.neq.resales_online,is_featured.eq.true')
        .order('created_at', { ascending: false }),
      supabase
        .from('site_settings')
        .select('show_price_drop_badges')
        .eq('id', 1)
        .single(),
    ]);

    if (error) {
      console.error('getCachedPublishedProperties error:', error);
      return [];
    }
    return withPriceDropFlag(
      ((data as unknown as Property[]) ?? []),
      settings?.show_price_drop_badges ?? false
    );
  },
  ['published-properties'],
  { tags: [PROPERTIES_TAG, SITE_SETTINGS_TAG], revalidate: 600 }
);

/**
 * Lean per-area stats source for the /areas index. The index only needs
 * counts and min prices per area — fetching the full card payload for
 * every published property (then discarding 95% of it) was the single
 * largest over-fetch on the site. Four columns, editorial rows only.
 */
export const getCachedAreaPropertyStats = unstable_cache(
  async (): Promise<AreaStatRow[]> => {
    const supabase = createStaticSupabaseClient();
    // AREA_STAT_COLUMNS is compile-time-checked against the Property
    // type in src/lib/list-columns.ts — see the field-coverage notes
    // there before narrowing further.
    const { data, error } = await supabase
      .from('properties')
      .select(AREA_STAT_COLUMNS)
      .eq('published', true)
      .neq('source', 'resales_online');

    if (error) {
      console.error('getCachedAreaPropertyStats error:', error);
      return [];
    }
    return (data ?? []) as unknown as AreaStatRow[];
  },
  ['area-property-stats'],
  { tags: [PROPERTIES_TAG], revalidate: 600 }
);

/**
 * Filter the cached property list for an area page (server-side, in-memory).
 *
 * Area pages are an EDITORIAL surface — Smartmove's curated picks for that
 * neighbourhood. They show our own listings (`source='manual'`) and any
 * scraper-imported curated rows (`source='scraper'`). Resales bulk inventory
 * is intentionally excluded: it'd dilute the area page with hundreds of
 * unsorted MLS rows of varying quality. Bulk inventory has its own home
 * (the broader listings index, when that surface lands).
 *
 * If `includeResales: true` is passed, the source gate is dropped — but
 * note the underlying cache is now the CURATED universe (featured
 * Resales rows only). A surface that needs the full bulk inventory must
 * query SQL directly with filters/pagination; this helper can't serve it.
 */
export async function getPropertiesForArea(opts: {
  areaName?: string;
  childAreaNames?: string[];
  microLocationSlugs?: string[];
  includeResales?: boolean;
}): Promise<Property[]> {
  const all = await getCachedPublishedProperties();
  const { areaName, childAreaNames = [], microLocationSlugs = [] } = opts;

  return all.filter((p) => {
    // Source gate — editorial-only by default.
    if (!opts.includeResales && p.source === 'resales_online') return false;

    if (areaName && p.area === areaName) return true;
    if (childAreaNames.length && childAreaNames.includes(p.area)) return true;
    if (microLocationSlugs.length && p.micro_location) {
      return microLocationSlugs.includes(p.micro_location);
    }
    return false;
  });
}

/**
 * Same shape as getPropertiesForArea but for new developments. Always
 * includes Resales-sourced developments because new developments are
 * editorial-class even when sourced — they carry investment context
 * (developer, completion phases, payment terms) the user wants visible.
 */
export async function getDevelopmentsForArea(opts: {
  areaName?: string;
  childAreaNames?: string[];
  microLocationSlugs?: string[];
}): Promise<Development[]> {
  const all = await getCachedPublishedDevelopments();
  const { areaName, childAreaNames = [], microLocationSlugs = [] } = opts;

  return all.filter((d) => {
    if (areaName && d.area === areaName) return true;
    if (childAreaNames.length && d.area && childAreaNames.includes(d.area)) return true;
    if (microLocationSlugs.length && d.micro_location) {
      return microLocationSlugs.includes(d.micro_location);
    }
    return false;
  });
}

// Columns we need for development listing / card rendering.
const DEVELOPMENT_LIST_COLUMNS =
  'id,slug,name,developer,status,source,price_from,price_to,price_on_request,bedrooms_from,bedrooms_to,size_from,size_to,total_units,units_available,unit_types,completion_date,location,area,micro_location,hero_image,hero_image_blur,is_featured,featured_order,short_description,created_at';

/**
 * Cached fetch for every published development. Same tag-based invalidation
 * pattern as properties: admin saves → updateTag(DEVELOPMENTS_TAG) → next
 * public render gets fresh data.
 */
export const getCachedPublishedDevelopments = unstable_cache(
  async (): Promise<Development[]> => {
    const supabase = createStaticSupabaseClient();
    const { data, error } = await supabase
      .from('developments')
      .select(DEVELOPMENT_LIST_COLUMNS)
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('getCachedPublishedDevelopments error:', error);
      return [];
    }
    return (data as Development[]) ?? [];
  },
  ['published-developments'],
  { tags: [DEVELOPMENTS_TAG], revalidate: 600 }
);

/**
 * Cached fetch for the admin-chosen default sort. Rarely changes, so we
 * can safely cache for an hour — admin can tag-invalidate via SITE_SETTINGS_TAG.
 */
export const getCachedDefaultSort = unstable_cache(
  async (): Promise<SortOption> => {
    const supabase = createStaticSupabaseClient();
    const { data } = await supabase
      .from('site_settings')
      .select('default_sort')
      .eq('id', 1)
      .single();

    return (data?.default_sort as SortOption) ?? 'newest';
  },
  ['site-default-sort'],
  { tags: [SITE_SETTINGS_TAG], revalidate: 3600 }
);

/**
 * Live quizzes (Prompt 6). Definitions are data — the renderer consumes
 * whatever's here; the homepage entry cards render one per live row.
 */
export const getCachedLiveQuizzes = unstable_cache(
  async (): Promise<Array<{ slug: string; title: string; intro: Record<string, unknown>; result: Record<string, unknown> }>> => {
    const supabase = createStaticSupabaseClient();
    const { data, error } = await supabase
      .from('quizzes')
      .select('slug, title, intro, result')
      .eq('status', 'live')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('getCachedLiveQuizzes error:', error);
      return [];
    }
    return data ?? [];
  },
  ['live-quizzes'],
  { tags: [QUIZZES_TAG], revalidate: 600 }
);

export const getCachedQuizBySlug = unstable_cache(
  async (slug: string) => {
    const supabase = createStaticSupabaseClient();
    // Anon RLS only exposes live rows — drafts come back null here
    // (admin preview re-fetches with the cookie client in the page).
    const { data } = await supabase.from('quizzes').select('*').eq('slug', slug).maybeSingle();
    return data;
  },
  ['quiz-by-slug'],
  { tags: [QUIZZES_TAG], revalidate: 600 }
);

/**
 * Area filter index for search (area-resolve.ts): the area tree +
 * approved location mappings, projected to exact `location` strings.
 * AREAS_TAG-invalidated; mapping edits land within revalidate.
 */
export const getCachedAreaFilterIndex = unstable_cache(
  async () => {
    const supabase = createStaticSupabaseClient();
    const [{ data: areas }, { data: mappings }] = await Promise.all([
      supabase.from('areas').select('slug, name, parent_area'),
      supabase
        .from('resales_location_mapping')
        .select('location, sublocation, proposed_area_slug, approved')
        .eq('approved', true)
        .not('proposed_area_slug', 'is', null),
    ]);
    const { buildAreaFilterIndex } = await import('@/lib/area-resolve');
    // Serialize as plain data (unstable_cache can't hold a Map) — the
    // search layer rebuilds the index from these rows.
    return {
      areas: (areas ?? []) as Array<{ slug: string; name: string; parent_area: string | null }>,
      mappings: (mappings ?? []) as Array<{ location: string; sublocation: string; proposed_area_slug: string | null; approved: boolean }>,
      // entries computed here purely so callers can also use them directly
      entries: buildAreaFilterIndex(
        (areas ?? []) as never,
        (mappings ?? []) as never
      ).entries,
    };
  },
  ['area-filter-index'],
  { tags: [AREAS_TAG], revalidate: 600 }
);
