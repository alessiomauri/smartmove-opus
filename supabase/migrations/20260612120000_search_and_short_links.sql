-- ─────────────────────────────────────────────────────────────────────
-- Prompt 3: server-side search + short links.
-- ─────────────────────────────────────────────────────────────────────

-- Search hits these predicates: published + type + price (+ area/beds).
-- The (published, created_at DESC) index from the perf pass covers the
-- default sort; these cover the filtered paths over 8k+ rows.
CREATE INDEX IF NOT EXISTS idx_properties_search_type_price
  ON properties(property_type, price) WHERE published = true;
CREATE INDEX IF NOT EXISTS idx_properties_search_area
  ON properties(area) WHERE published = true;
CREATE INDEX IF NOT EXISTS idx_developments_search
  ON developments(price_from) WHERE published = true;

-- Feature filtering ("golf", "sea view", …): features is text[] with
-- values like 'Setting: Frontline Golf' — substring matching needs a
-- flat text projection. array_to_string isn't IMMUTABLE (generated
-- columns require it), so wrap it: for text[] the join genuinely is
-- immutable.
CREATE OR REPLACE FUNCTION immutable_join_text(arr text[])
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT array_to_string(arr, ' · ');
$$;

ALTER TABLE properties ADD COLUMN IF NOT EXISTS features_text text
  GENERATED ALWAYS AS (immutable_join_text(features)) STORED;

-- ── Short links (/s/{code} searches, /c/{code} collections, future
-- selections/saved-searches — one table, one code style) ──
CREATE TABLE IF NOT EXISTS short_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 6–8 char random base36, or an admin-chosen slug (lowercase/digits/
  -- hyphens). Random and custom coexist.
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9-]{3,40}$'),
  -- Same-origin path only ('/properties?type=villa…', '/collection/x').
  target text NOT NULL CHECK (target LIKE '/%'),
  -- 'search' | 'collection' | future kinds — drives the /c/ vs /s/ route.
  kind text NOT NULL DEFAULT 'search',
  context jsonb,
  hits int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_short_links_code ON short_links(code);

ALTER TABLE short_links ENABLE ROW LEVEL SECURITY;
-- Resolution + minting go through service-role routes (rate-limited,
-- target-validated); admins can manage rows directly.
DO $$ BEGIN
  CREATE POLICY "Authenticated manage short links" ON short_links
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Atomic hit counter for redirects.
CREATE OR REPLACE FUNCTION bump_short_link(p_code text)
RETURNS text LANGUAGE sql AS $$
  UPDATE short_links SET hits = hits + 1 WHERE code = p_code
  RETURNING target;
$$;
