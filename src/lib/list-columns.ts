/**
 * Shared column lists for property queries.
 *
 * Plain module (no server-only imports) so BOTH the server cache layer
 * (src/lib/cache.ts, src/lib/queries.ts) and the client favourites hook
 * (src/hooks/useProperties.ts) consume the same source of truth — the
 * two lists previously drifted (the hook was missing hero_image_blur
 * and source, silently disabling blur placeholders on favourites).
 *
 * Keep this narrow: it's the payload every visitor downloads per card.
 * `description` is included because the homepage search filter matches
 * against it; if search ever moves server-side, drop it here.
 */
export const PROPERTY_LIST_COLUMNS =
  'id,slug,name,status,property_type,price,price_on_request,location,area,micro_location,bedrooms,bathrooms,interior_size,plot_size,hero_image,hero_image_blur,is_featured,featured_order,features,description,created_at,source,source_id,price_drop_at,hide_price_drop';

/** Blog list view — everything except `content` (the full article body). */
export const BLOG_LIST_COLUMNS =
  'slug,title,meta_description,category,excerpt,keywords,published_at,updated_at_date,reading_time,featured,hero_image,hero_image_alt,published,created_at,updated_at';
