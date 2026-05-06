import { unstable_cache } from 'next/cache';
import { createStaticSupabaseClient } from '@/lib/supabase-static';
import { Property, SortOption } from '@/types/property';
import { Development } from '@/types/development';

/**
 * Cache tags used across the app. When admin mutations occur, call
 * `revalidateTag(PROPERTIES_TAG)` so every page that reads properties
 * refreshes on the next request.
 */
export const PROPERTIES_TAG = 'properties';
export const AREAS_TAG = 'areas';
export const SITE_SETTINGS_TAG = 'site_settings';
export const DEVELOPMENTS_TAG = 'developments';

// Columns we need for listing / card rendering. Keeping this narrow keeps
// payload small and bandwidth cost low.
const LIST_COLUMNS =
  'id,slug,name,status,property_type,price,price_on_request,location,area,micro_location,bedrooms,bathrooms,interior_size,plot_size,hero_image,hero_image_blur,is_featured,featured_order,features,description,created_at';

/**
 * Cached fetch for every published property — the grid source of truth
 * for `/` and `/areas/[slug]`. Deduplicated per build/revalidate window
 * (10 min) AND invalidated instantly when admin edits via `revalidateTag`.
 */
export const getCachedPublishedProperties = unstable_cache(
  async (): Promise<Property[]> => {
    const supabase = createStaticSupabaseClient();
    const { data, error } = await supabase
      .from('properties')
      .select(LIST_COLUMNS)
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('getCachedPublishedProperties error:', error);
      return [];
    }
    return (data as Property[]) ?? [];
  },
  ['published-properties'],
  { tags: [PROPERTIES_TAG], revalidate: 600 }
);

/**
 * Filter the cached property list for an area page (server-side, in-memory).
 * Uses the same logic as the old `useProperties` filter so area pages render
 * the same set without a second Supabase round-trip.
 */
export async function getPropertiesForArea(opts: {
  areaName?: string;
  childAreaNames?: string[];
  microLocationSlugs?: string[];
}): Promise<Property[]> {
  const all = await getCachedPublishedProperties();
  const { areaName, childAreaNames = [], microLocationSlugs = [] } = opts;

  return all.filter((p) => {
    if (areaName && p.area === areaName) return true;
    if (childAreaNames.length && childAreaNames.includes(p.area)) return true;
    if (microLocationSlugs.length && p.micro_location) {
      return microLocationSlugs.includes(p.micro_location);
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
