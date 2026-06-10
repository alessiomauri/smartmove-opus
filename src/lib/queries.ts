import { cache as dedupePerRequest } from 'react';
import { unstable_cache } from 'next/cache';
import { createStaticSupabaseClient } from '@/lib/supabase-static';
import {
  PROPERTIES_TAG,
  AREAS_TAG,
  BLOG_TAG,
  COLLECTIONS_TAG,
  DEVELOPMENTS_TAG,
} from '@/lib/cache';
import { PROPERTY_LIST_COLUMNS, BLOG_LIST_COLUMNS } from '@/lib/list-columns';
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
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .single();
      if (error) {
        if (error.code !== 'PGRST116') console.error('getPropertyBySlugCached:', error);
        return null;
      }
      return data as Property;
    },
    ['property-by-slug'],
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
