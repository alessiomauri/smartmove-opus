import { cache as dedupePerRequest } from 'react';
import { unstable_cache } from 'next/cache';
import { createStaticSupabaseClient } from '@/lib/supabase-static';
import { getServiceRoleClient } from '@/lib/supabase-service';
import {
  PROPERTIES_TAG,
  AREAS_TAG,
  BLOG_TAG,
  COLLECTIONS_TAG,
  DEVELOPMENTS_TAG,
  SITE_SETTINGS_TAG,
} from '@/lib/cache';
import { PROPERTY_LIST_COLUMNS, BLOG_LIST_COLUMNS } from '@/lib/list-columns';
import { isPriceDropVisible } from '@/lib/price-drop';
import { Property } from '@/types/property';
import { Area } from '@/types/area';
import { BlogPost } from '@/types/blog';
import { Development } from '@/types/development';
import { Collection, CollectionWithProperties } from '@/types/collection';

/**
 * PUBLIC read layer — every query here is:
 *
 *   1. Anon/static Supabase client (NO `cookies()`). The cookie-bound
 *      client opts the whole route out of static generation, which was
 *      silently turning every "ISR" detail page into a per-request
 *      render. RLS already scopes anon to published rows, so the result
 *      set is identical for public visitors.
 *   2. `unstable_cache` with entity tags — admin mutations call
 *      `updateTag(<TAG>)` and the next request re-fetches. This also
 *      fixes the locale problem with `revalidatePath('/blog/x')`, which
 *      never matched the real `/[locale]/blog/x` tree.
 *   3. `react.cache()` — generateMetadata and the page body share one
 *      query per request instead of fetching twice.
 *
 * Admin reads (unpublished rows, auth-scoped) stay in `src/lib/actions/*`
 * on the cookie client — do not route them through here.
 */

/** Blog row without the full article body — list/related views only. */
export type BlogPostPreview = Omit<BlogPost, 'content'>;

const REVALIDATE = 600;

/* ---------------------------------------------------------- properties */

export const getPropertyBySlugCached = dedupePerRequest(
  unstable_cache(
    async (slug: string): Promise<Property | null> => {
      const supabase = createStaticSupabaseClient();
      const [{ data, error }, { data: settings }] = await Promise.all([
        supabase
          .from('properties')
          .select('*')
          .eq('slug', slug)
          .eq('published', true)
          .single(),
        supabase
          .from('site_settings')
          .select('show_price_drop_badges')
          .eq('id', 1)
          .single(),
      ]);
      if (error) {
        if (error.code !== 'PGRST116') console.error('getPropertyBySlugCached:', error);
        return null;
      }
      const row = data as Property;
      // Computed, double-gated badge flag — see src/lib/price-drop.ts.
      row.price_drop = isPriceDropVisible(row, settings?.show_price_drop_badges ?? false);
      return row;
    },
    ['property-by-slug'],
    { tags: [PROPERTIES_TAG, SITE_SETTINGS_TAG], revalidate: REVALIDATE }
  )
);

/**
 * The previous ("was") price for a reduced listing — the `old_price` of the
 * most recent recorded DROP in `property_price_history`. Returns null when
 * there's no drop row (caller then shows the badge alone — never invents a
 * price). Only the price-box reads this, and only when the Reduced marker is
 * already gated-on, so it's a cheap extra read on a rare path.
 */
export const getLatestDropOldPriceCached = dedupePerRequest(
  unstable_cache(
    async (propertyId: string): Promise<number | null> => {
      // Service-role: property_price_history is internal sync data with no
      // anon RLS read policy (the public anon client returns 0 rows). The
      // result is cached + only the gated Reduced path reads it.
      const supabase = getServiceRoleClient();
      const { data } = await supabase
        .from('property_price_history')
        .select('old_price, new_price, changed_at')
        .eq('property_id', propertyId)
        .order('changed_at', { ascending: false })
        .limit(10);
      const drop = (data ?? []).find(
        (r) => r.old_price != null && r.new_price != null && Number(r.old_price) > Number(r.new_price)
      );
      return drop ? Number(drop.old_price) : null;
    },
    ['latest-drop-old-price'],
    { tags: [PROPERTIES_TAG], revalidate: REVALIDATE }
  )
);

/* ---------------------------------------------------------- areas */

export const getPublishedAreasCached = dedupePerRequest(
  unstable_cache(
    async (): Promise<Area[]> => {
      const supabase = createStaticSupabaseClient();
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .eq('published', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) {
        console.error('getPublishedAreasCached:', error);
        return [];
      }
      return (data || []) as Area[];
    },
    ['published-areas'],
    { tags: [AREAS_TAG], revalidate: REVALIDATE }
  )
);

export const getAreaBySlugCached = dedupePerRequest(
  unstable_cache(
    async (slug: string): Promise<Area | null> => {
      const supabase = createStaticSupabaseClient();
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .single();
      if (error) {
        if (error.code !== 'PGRST116') console.error('getAreaBySlugCached:', error);
        return null;
      }
      return data as Area;
    },
    ['area-by-slug'],
    { tags: [AREAS_TAG], revalidate: REVALIDATE }
  )
);

/* ---------------------------------------------------------- blog */

export const getPublishedBlogPostsCached = dedupePerRequest(
  unstable_cache(
    async (): Promise<BlogPostPreview[]> => {
      const supabase = createStaticSupabaseClient();
      // List view skips `content` — full article bodies are the bulk of
      // the table and the index/related widgets never render them.
      const { data, error } = await supabase
        .from('blog_posts')
        .select(BLOG_LIST_COLUMNS)
        .eq('published', true)
        .order('featured', { ascending: false })
        .order('published_at', { ascending: false });
      if (error) {
        console.error('getPublishedBlogPostsCached:', error);
        return [];
      }
      return (data ?? []) as unknown as BlogPostPreview[];
    },
    ['published-blog-posts'],
    { tags: [BLOG_TAG], revalidate: REVALIDATE }
  )
);

export const getBlogPostBySlugCached = dedupePerRequest(
  unstable_cache(
    async (slug: string): Promise<BlogPost | null> => {
      const supabase = createStaticSupabaseClient();
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .single();
      if (error) {
        if (error.code !== 'PGRST116') console.error('getBlogPostBySlugCached:', error);
        return null;
      }
      return data as BlogPost;
    },
    ['blog-post-by-slug'],
    { tags: [BLOG_TAG], revalidate: REVALIDATE }
  )
);

/* ---------------------------------------------------------- developments */

export const getDevelopmentBySlugCached = dedupePerRequest(
  unstable_cache(
    async (slug: string): Promise<Development | null> => {
      const supabase = createStaticSupabaseClient();
      const { data, error } = await supabase
        .from('developments')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .single();
      if (error) {
        if (error.code !== 'PGRST116') console.error('getDevelopmentBySlugCached:', error);
        return null;
      }
      return data as Development;
    },
    ['development-by-slug'],
    { tags: [DEVELOPMENTS_TAG], revalidate: REVALIDATE }
  )
);

/* ---------------------------------------------------------- collections */

export const getCollectionBySlugCached = dedupePerRequest(
  unstable_cache(
    async (slug: string): Promise<CollectionWithProperties | null> => {
      const supabase = createStaticSupabaseClient();
      const { data: collection, error } = await supabase
        .from('collections')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();
      if (error) {
        if (error.code !== 'PGRST116') console.error('getCollectionBySlugCached:', error);
        return null;
      }

      const { data: links } = await supabase
        .from('collection_properties')
        .select('property_id, sort_order')
        .eq('collection_id', collection.id)
        .order('sort_order', { ascending: true });

      const propertyIds = (links || []).map((l) => l.property_id);
      let properties: Property[] = [];
      if (propertyIds.length > 0) {
        // Card fields only — the collection page renders PropertyCard /
        // FavouritePropertyCard, neither of which needs gallery arrays
        // or the multi-language JSONB blobs.
        const { data: props } = await supabase
          .from('properties')
          .select(PROPERTY_LIST_COLUMNS)
          .in('id', propertyIds)
          .eq('published', true);
        if (props) {
          const byId = new Map(
            (props as unknown as Property[]).map((p) => [p.id, p])
          );
          properties = propertyIds
            .map((id) => byId.get(id))
            .filter((p): p is Property => Boolean(p));
        }
      }

      return { ...(collection as Collection), properties };
    },
    ['collection-by-slug'],
    // Tag with PROPERTIES_TAG too: editing a property should refresh the
    // collections that embed its card.
    { tags: [COLLECTIONS_TAG, PROPERTIES_TAG], revalidate: REVALIDATE }
  )
);

/**
 * Atomic view-counter bump via the `increment_collection_views` RPC —
 * single round-trip, no read-modify-write race. Call from `after()` so
 * it never blocks the page render.
 */
export async function bumpCollectionViews(slug: string): Promise<void> {
  try {
    const supabase = createStaticSupabaseClient();
    await supabase.rpc('increment_collection_views', { p_slug: slug });
  } catch (e) {
    console.error('bumpCollectionViews failed:', e);
  }
}
