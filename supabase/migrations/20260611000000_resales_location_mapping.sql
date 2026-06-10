-- ─────────────────────────────────────────────────────────────────────
-- Location auto-mapping (SMARTMOVE_NEXT_PROMPTS "LOCATION NESTING")
--
-- Nests every distinct Resales (Location, SubLocation) pair under one
-- of our curated areas. Seeded by scripts/map-resales-locations.mjs
-- (name match → geo evidence); hand-tunable later in the Prompt 5
-- admin screen. Unmapped = no guide link, never an error.
--
-- Display switch (property-page eyebrow / guide cross-link) and the
-- admin editor come in Prompts 3/5 — nothing user-facing reads this
-- yet.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS resales_location_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Resales Location ("Marbella", "Calahonda", …). SubLocation is ''
  -- (not NULL) when absent so the UNIQUE pair key has no NULL quirks.
  location text NOT NULL,
  sublocation text NOT NULL DEFAULT '',
  -- Proposed parent area (areas.slug); NULL = unmapped.
  proposed_area_slug text REFERENCES areas(slug) ON UPDATE CASCADE ON DELETE SET NULL,
  -- high (name match or geo <2km), medium (geo 2–5km or coarse
  -- Location-name fallback), low (weak geo: >5km or <3 GPS fixes),
  -- unmapped (no usable evidence).
  confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low', 'unmapped')),
  -- 'name:sublocation' | 'name:location' | 'geo' | NULL (unmapped)
  match_method text,
  -- Evidence for review.
  listing_count int NOT NULL DEFAULT 0,
  gps_listing_count int NOT NULL DEFAULT 0,
  median_distance_km numeric,
  -- Admin approval. High-confidence proposals are approved by default;
  -- medium/low await manual review. Re-runs of the seeder never
  -- overwrite an approved row's proposal.
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location, sublocation)
);

ALTER TABLE resales_location_mapping ENABLE ROW LEVEL SECURITY;

-- Public data layer may join approved mappings (Prompt 3 display
-- switch); the queue itself stays admin-only.
DO $$ BEGIN
  CREATE POLICY "Anon read approved location mappings"
    ON resales_location_mapping FOR SELECT
    USING (approved = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated manage location mappings"
    ON resales_location_mapping FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
