/**
 * Shared, TYPE-CHECKED column lists for narrowed queries.
 *
 * Plain module (no server-only imports) so both the server cache layer
 * and client hooks consume the same source of truth.
 *
 * Two compile-time guarantees (added after the 2026-06-10 missing-photos
 * incident put "narrowed query dropped a field" on the suspect list):
 *
 *   1. Every column name must exist on the entity type
 *      (`satisfies readonly (keyof T)[]` — typos and renames fail tsc).
 *   2. Every field the consuming components actually render must be
 *      present in the selection (the `_Covers…` assertions below — if
 *      someone trims a column that PropertyCard/FavouritePropertyCard
 *      depend on, the build fails instead of the UI silently rendering
 *      nothing).
 *
 * When a card starts consuming a new field: add it to the REQUIRED
 * union AND the column list — tsc forces them to stay in sync.
 */

import type { Property } from '@/types/property';
import type { BlogPost } from '@/types/blog';

/** Compile-time assertion helper: `type _X = Expect<A extends B>` */
type Expect<T extends true> = T;

/* ─────────────────────────────────────────────── properties */

export const PROPERTY_LIST_FIELDS = [
  'id',
  'slug',
  'name',
  'status',
  'property_type',
  'price',
  'price_on_request',
  'location',
  'area',
  'micro_location',
  'bedrooms',
  'bathrooms',
  'interior_size',
  'plot_size',
  'hero_image',
  'hero_image_blur',
  'is_featured',
  'featured_order',
  'features',
  // `description` rides along because the homepage search filter
  // matches against it; drop when search moves server-side.
  'description',
  'created_at',
  'source',
  'source_id',
  'price_drop_at',
  'hide_price_drop',
] as const satisfies readonly (keyof Property)[];

export const PROPERTY_LIST_COLUMNS = PROPERTY_LIST_FIELDS.join(',');

/** Row shape a list query actually returns. */
export type PropertyListRow = Pick<Property, (typeof PROPERTY_LIST_FIELDS)[number]>;

/**
 * Fields the card components render (PropertyCard,
 * FavouritePropertyCard, PinnedFeaturedCard) plus what the grid sort /
 * filter logic reads. Update alongside the components.
 */
type RequiredCardFields =
  | 'id'
  | 'slug'
  | 'name'
  | 'status'
  | 'property_type'
  | 'price'
  | 'price_on_request'
  | 'location'
  | 'area'
  | 'micro_location'
  | 'bedrooms'
  | 'bathrooms'
  | 'interior_size'
  | 'plot_size'
  | 'hero_image'
  | 'hero_image_blur'
  | 'is_featured'
  | 'featured_order'
  | 'features'
  | 'created_at'
  | 'source';

// If a required card field is missing from the selection, this line
// fails to compile: "Type 'false' does not satisfy constraint 'true'".
type _CoversCardFields = Expect<
  RequiredCardFields extends (typeof PROPERTY_LIST_FIELDS)[number] ? true : false
>;

/* ─────────────────────────────────────────────── area stats */

/**
 * Lean aggregate for the /areas index — counts + min price only.
 * The page derives listingCounts/minPrices from exactly these fields.
 */
export const AREA_STAT_FIELDS = [
  'source',
  'area',
  'micro_location',
  'price',
] as const satisfies readonly (keyof Property)[];

export const AREA_STAT_COLUMNS = AREA_STAT_FIELDS.join(',');

export type AreaStatRow = Pick<Property, (typeof AREA_STAT_FIELDS)[number]>;

/* ─────────────────────────────────────────────── blog */

export const BLOG_LIST_FIELDS = [
  'slug',
  'title',
  'meta_description',
  'category',
  'excerpt',
  'keywords',
  'published_at',
  'updated_at_date',
  'reading_time',
  'featured',
  'hero_image',
  'hero_image_alt',
  'published',
  'created_at',
  'updated_at',
] as const satisfies readonly (keyof BlogPost)[];

/** Blog list view — everything except `content` (the full article body). */
export const BLOG_LIST_COLUMNS = BLOG_LIST_FIELDS.join(',');

export type BlogListRow = Pick<BlogPost, (typeof BLOG_LIST_FIELDS)[number]>;

/** What the blog index + related-posts widgets render. */
type RequiredBlogPreviewFields =
  | 'slug'
  | 'title'
  | 'category'
  | 'excerpt'
  | 'published_at'
  | 'reading_time'
  | 'featured'
  | 'hero_image'
  | 'hero_image_alt';

type _CoversBlogPreviewFields = Expect<
  RequiredBlogPreviewFields extends (typeof BLOG_LIST_FIELDS)[number] ? true : false
>;
