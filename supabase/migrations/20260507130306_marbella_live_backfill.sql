-- ============================================================
-- Marbella Live → Smartmove backfill
-- ------------------------------------------------------------
-- Brings the Smartmove DB to parity with Marbella Live's mature
-- shape. Every operation is idempotent (IF NOT EXISTS / DO blocks)
-- so re-running is safe.
--
-- What this adds:
--   • Extra columns on `properties` that Marbella Live grew over
--     time (property_type, micro_location, is_featured, featured_order,
--     hero_image_blur)
--   • Tables: areas, blog_posts, collections, collection_properties,
--     developments, site_settings
--   • Enums: area_region, blog_category, development_status,
--     development_source
--   • Storage buckets: property-images, area-images, blog-images,
--     development-images
--   • RLS: anon SELECT only on published rows, authenticated full access
--
-- Smartmove-specific additions (locale JSONB, source/source_id, agents,
-- leads, email_selections) live in the next migration.
-- ============================================================

-- ─────────────────── ENUMS ───────────────────
DO $$ BEGIN
  CREATE TYPE area_region AS ENUM (
    'Marbella','Estepona','Benahavis','Mijas','Fuengirola',
    'Torremolinos','Malaga','Casares','Manilva','San Roque'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE blog_category AS ENUM (
    'buying-guide','selling-guide','area-guide',
    'market-report','lifestyle','investment'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE development_status AS ENUM (
    'off_plan','under_construction','key_ready','completed','sold_out'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE development_source AS ENUM ('manual','resales_online');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────── PROPERTIES backfill ───────────────────
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS property_type text DEFAULT 'villa'
    CHECK (property_type IN ('villa','apartment','plot_with_project','townhouse','penthouse')),
  ADD COLUMN IF NOT EXISTS micro_location text,
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_order int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hero_image_blur text;

CREATE INDEX IF NOT EXISTS idx_properties_featured ON properties(is_featured, featured_order);

-- ─────────────────── AREAS ───────────────────
CREATE TABLE IF NOT EXISTS areas (
  slug text PRIMARY KEY,
  name text NOT NULL,
  region area_region NOT NULL,
  pin_category text NOT NULL DEFAULT 'micro'
    CHECK (pin_category IN ('main','micro','resort','airport')),
  parent_area text,
  is_micro_location boolean DEFAULT false,
  title text,
  meta_description text DEFAULT '',
  heading text DEFAULT '',
  subheading text DEFAULT '',
  description text DEFAULT '',
  property_types text[] DEFAULT '{}',
  highlights text[] DEFAULT '{}',
  coordinates_lat numeric DEFAULT 0,
  coordinates_lng numeric DEFAULT 0,
  price_range text DEFAULT '',
  nearby_areas text[] DEFAULT '{}',
  keywords text[] DEFAULT '{}',
  hero_image text DEFAULT '',
  hero_image_alt text DEFAULT '',
  hero_image_blur text,
  display_order int DEFAULT 0,
  published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anon read areas" ON areas FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated full areas" ON areas FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────── BLOG POSTS ───────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  slug text PRIMARY KEY,
  title text NOT NULL,
  meta_description text DEFAULT '',
  category blog_category NOT NULL DEFAULT 'lifestyle',
  excerpt text DEFAULT '',
  content text DEFAULT '',
  keywords text[] DEFAULT '{}',
  published_at date DEFAULT CURRENT_DATE,
  updated_at_date date DEFAULT CURRENT_DATE,
  reading_time text DEFAULT '5 min read',
  featured boolean DEFAULT false,
  hero_image text DEFAULT '',
  hero_image_alt text DEFAULT '',
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anon read published blog" ON blog_posts FOR SELECT
    USING (published = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated full blog" ON blog_posts FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────── COLLECTIONS ───────────────────
CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  message text,
  type text NOT NULL DEFAULT 'community'
    CHECK (type IN ('community','personal')),
  cover_image text,
  recipient_name text,
  is_published boolean DEFAULT false,
  view_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anon read published collections" ON collections FOR SELECT
    USING (is_published = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated full collections" ON collections FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS collection_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (collection_id, property_id)
);

ALTER TABLE collection_properties ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anon read collection_properties" ON collection_properties
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated full collection_properties" ON collection_properties
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────── DEVELOPMENTS ───────────────────
CREATE TABLE IF NOT EXISTS developments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  developer text,
  status development_status NOT NULL DEFAULT 'off_plan',
  source development_source NOT NULL DEFAULT 'manual',
  source_id text,
  last_synced_at timestamptz,
  title text,
  meta_description text,
  subtitle text,
  short_description text,
  description text,
  price_from numeric,
  price_to numeric,
  price_on_request boolean DEFAULT false,
  bedrooms_from int,
  bedrooms_to int,
  bathrooms_from int,
  bathrooms_to int,
  size_from numeric,
  size_to numeric,
  terrace_size_from numeric,
  terrace_size_to numeric,
  total_units int,
  units_available int,
  unit_types text[] DEFAULT '{}',
  completion_date date,
  delivery_phases text,
  location text,
  area text,
  micro_location text,
  latitude numeric,
  longitude numeric,
  location_description text,
  hero_image text,
  hero_image_blur text,
  hero_image_alt text,
  gallery_images text[] DEFAULT '{}',
  masterplan_images text[] DEFAULT '{}',
  floor_plan_images text[] DEFAULT '{}',
  brochure_pdf text,
  amenities text[] DEFAULT '{}',
  keywords text[] DEFAULT '{}',
  is_featured boolean DEFAULT false,
  featured_order int DEFAULT 0,
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS developments_source_idx
  ON developments(source, source_id)
  WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_developments_published ON developments(published);
CREATE INDEX IF NOT EXISTS idx_developments_featured ON developments(is_featured, featured_order);

ALTER TABLE developments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anon read published developments" ON developments FOR SELECT
    USING (published = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated full developments" ON developments FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────── SITE SETTINGS ───────────────────
CREATE TABLE IF NOT EXISTS site_settings (
  id int PRIMARY KEY CHECK (id = 1),
  default_sort text NOT NULL DEFAULT 'newest'
    CHECK (default_sort IN ('newest','price_asc','price_desc','name')),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO site_settings (id, default_sort)
VALUES (1, 'newest')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anon read site_settings" ON site_settings FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated full site_settings" ON site_settings FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────── PROPERTIES RLS ───────────────────
-- (Initial seed migration didn't enable RLS on properties. Enabling
-- it now matches Marbella Live's posture and lets the app's
-- service-role + anon clients work as expected.)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anon read published properties" ON properties FOR SELECT
    USING (published = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated full properties" ON properties FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────── STORAGE BUCKETS ───────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('property-images', 'property-images', true),
  ('area-images', 'area-images', true),
  ('blog-images', 'blog-images', true),
  ('development-images', 'development-images', true)
ON CONFLICT (id) DO NOTHING;
