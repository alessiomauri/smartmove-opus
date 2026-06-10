-- Performance pass (2026-06-10)
--
-- 1. Composite indexes for the hot public list queries. The existing
--    single-column boolean indexes (idx_properties_published etc.) can't
--    satisfy `WHERE published = true ORDER BY created_at DESC` — as the
--    Resales sync grows the tables, Postgres falls back to seq-scan+sort.
-- 2. Atomic view counter for collections, replacing a read-modify-write
--    round-trip pair that lost updates under concurrency.

-- Properties: home grid / cached list (published, newest first).
CREATE INDEX IF NOT EXISTS idx_properties_published_created
  ON properties (published, created_at DESC);

-- Developments: same query shape.
CREATE INDEX IF NOT EXISTS idx_developments_published_created
  ON developments (published, created_at DESC);

-- Blog: published list is ordered featured-first, then newest.
CREATE INDEX IF NOT EXISTS idx_blog_published_featured_date
  ON blog_posts (published, featured DESC, published_at DESC);

-- Atomic, race-free view counter. SECURITY DEFINER because anon has no
-- UPDATE grant on collections (and shouldn't — this function constrains
-- the write to exactly one column on published rows).
CREATE OR REPLACE FUNCTION increment_collection_views(p_slug text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE collections
     SET view_count = COALESCE(view_count, 0) + 1
   WHERE slug = p_slug
     AND is_published = true;
$$;

REVOKE ALL ON FUNCTION increment_collection_views(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_collection_views(text) TO anon, authenticated;
