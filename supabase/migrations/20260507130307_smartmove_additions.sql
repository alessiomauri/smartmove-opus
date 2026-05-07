-- ============================================================
-- Smartmove additions (on top of Marbella Live parity)
-- ------------------------------------------------------------
-- Adds the schema pieces that are net-new for Smartmove vs the
-- inherited Marbella Live shape:
--   • Locale-aware content fields (JSONB) on properties, areas,
--     blog_posts so EN+ES (and future locales) coexist
--   • Resales sync columns on properties: source / source_id /
--     last_synced_at, source_image_urls, plus the approval
--     workflow fields (pending_review / approved_at / rejected)
--   • New tables: agents, leads, email_selections,
--     email_selection_properties
--   • Reference tables synced from Resales API: resales_features,
--     resales_locations, resales_property_types
--
-- Idempotent. RLS policies follow Marbella Live's conventions.
-- ============================================================

-- ─────────────────── PROPERTIES: locale + sync ───────────────────
ALTER TABLE properties
  -- Locale-aware fields. Shape: {"en": "...", "es": "...", "de": "..."}
  -- Application falls back to the canonical English `description` /
  -- `name` columns when a locale key is missing.
  ADD COLUMN IF NOT EXISTS descriptions jsonb DEFAULT '{}'::jsonb,
  -- Resales sync metadata
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual'
    CHECK (source IN ('manual','resales_online','scraper')),
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS source_agency_ref text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_image_urls text[] DEFAULT '{}',
  -- Approval workflow (auto-approve own, review-required MLS)
  ADD COLUMN IF NOT EXISTS pending_review boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected boolean DEFAULT false,
  -- Resales-specific fields
  ADD COLUMN IF NOT EXISTS own_property boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS resales_type_id text,
  ADD COLUMN IF NOT EXISTS resales_subtype_id text,
  ADD COLUMN IF NOT EXISTS community_fees_year numeric,
  ADD COLUMN IF NOT EXISTS basura_tax_year numeric,
  ADD COLUMN IF NOT EXISTS ibi_fees_year numeric,
  ADD COLUMN IF NOT EXISTS energy_rated text,
  ADD COLUMN IF NOT EXISTS co2_rated text,
  ADD COLUMN IF NOT EXISTS decree_218 boolean,
  ADD COLUMN IF NOT EXISTS built_year text,
  ADD COLUMN IF NOT EXISTS completion_date date,
  -- Per-locale property feature labels: {"en": [...], "es": [...]}
  ADD COLUMN IF NOT EXISTS feature_labels jsonb DEFAULT '{}'::jsonb,
  -- Per-locale property type display: {"en": "Townhouse", "es": "Adosada"}
  ADD COLUMN IF NOT EXISTS property_type_labels jsonb DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS properties_source_idx
  ON properties(source, source_id)
  WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_pending_review
  ON properties(pending_review) WHERE pending_review = true;
CREATE INDEX IF NOT EXISTS idx_properties_last_synced ON properties(last_synced_at);

-- ─────────────────── AREAS: locale ───────────────────
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS descriptions jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS subheadings jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS headings jsonb DEFAULT '{}'::jsonb;

-- ─────────────────── BLOG POSTS: locale ───────────────────
ALTER TABLE blog_posts
  -- Each locale carries its own title / excerpt / content. Shape:
  -- {"en": {"title": "...", "excerpt": "...", "content": "..."}, "es": {...}}
  ADD COLUMN IF NOT EXISTS localised jsonb DEFAULT '{}'::jsonb;

-- ─────────────────── DEVELOPMENTS: locale + sync ───────────────────
ALTER TABLE developments
  ADD COLUMN IF NOT EXISTS descriptions jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_image_urls text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pending_review boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS own_property boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_terms jsonb DEFAULT '{}'::jsonb;

-- ─────────────────── AGENTS ───────────────────
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  photo text,
  email text,
  phone text,
  whatsapp text,
  languages text[] DEFAULT '{}',
  bios jsonb DEFAULT '{}'::jsonb,  -- {"en": "...", "es": "..."}
  active boolean DEFAULT true,
  display_order int DEFAULT 0,
  user_id uuid,  -- optional link to auth.users when the agent has a login
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anon read active agents" ON agents FOR SELECT
    USING (active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated full agents" ON agents FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Properties + developments link to assigned agent (nullable).
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS assigned_agent_id uuid REFERENCES agents(id) ON DELETE SET NULL;

ALTER TABLE developments
  ADD COLUMN IF NOT EXISTS assigned_agent_id uuid REFERENCES agents(id) ON DELETE SET NULL;

-- ─────────────────── LEADS ───────────────────
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Origin
  source text NOT NULL CHECK (source IN (
    'contact-form','viewing-request','brochure-request',
    'email-selection-click','newsletter','two-step-landing','other'
  )),
  source_detail text,  -- e.g. 'villas-up-to-2m', 'property-detail-villa-amara'
  -- Contact
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  -- Funnel fields
  bedrooms text,
  budget_tier text,
  purchase_timeline text,
  contact_method text,
  message text,
  -- Property + agent context
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  property_reference text,  -- when not yet linked to a local row (Resales ref)
  development_id uuid REFERENCES developments(id) ON DELETE SET NULL,
  assigned_agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  -- Tracking
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_id text,
  language text,  -- 'en' | 'es' | 'de' | ...
  -- CRM sync
  monday_item_id text,
  monday_synced_at timestamptz,
  monday_sync_skipped boolean DEFAULT false,
  -- Status
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','qualified','converted','lost')),
  notes text,
  -- Audit
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_submitted_at ON leads(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_agent ON leads(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_monday_pending
  ON leads(monday_synced_at) WHERE monday_item_id IS NULL AND monday_sync_skipped = false;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Public can INSERT (lead capture from contact forms). Reads/updates
-- are admin-only. Service role bypasses RLS regardless.
DO $$ BEGIN
  CREATE POLICY "Anon insert leads" ON leads FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated full leads" ON leads FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────── EMAIL SELECTIONS ───────────────────
CREATE TABLE IF NOT EXISTS email_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  name text NOT NULL,
  intro_text text,
  layout text DEFAULT 'single-column'
    CHECK (layout IN ('single-column','two-up-grid','hero-grid')),
  property_ids uuid[] DEFAULT '{}',
  send_count int DEFAULT 0,
  last_sent_at timestamptz,
  recipient_summary text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_selections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated full email_selections" ON email_selections
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Optional junction table for ordered property selection (future use)
CREATE TABLE IF NOT EXISTS email_selection_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id uuid NOT NULL REFERENCES email_selections(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (selection_id, property_id)
);

ALTER TABLE email_selection_properties ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated full esp" ON email_selection_properties
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────── RESALES REFERENCE TABLES ───────────────────
-- Synced from Resales API on a weekly cadence. Used to drive the
-- filter UI (location dropdown, type checkboxes, feature chips)
-- without per-request API calls.

CREATE TABLE IF NOT EXISTS resales_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,           -- 'Pool', 'Garden', 'Setting', etc.
  name text NOT NULL,               -- 'Communal', 'Private', 'Beachfront', ...
  parameter_name text NOT NULL,     -- '1Pool1' (for SearchProperties query string)
  display_order int DEFAULT 0,
  labels jsonb DEFAULT '{}'::jsonb, -- {"en": "Private Pool", "es": "Piscina privada"}
  active boolean DEFAULT true,
  synced_at timestamptz DEFAULT now(),
  UNIQUE (category, name)
);

CREATE TABLE IF NOT EXISTS resales_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,        -- 'Marbella', 'Estepona', etc.
  province text,
  area text,
  parent_name text,
  display_order int DEFAULT 0,
  synced_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resales_property_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id text NOT NULL UNIQUE,     -- '1-1', '1-2', '2-2', '3-1' ...
  parent_type_id text,
  labels jsonb DEFAULT '{}'::jsonb, -- {"en": "Penthouse", "es": "Ático"}
  active boolean DEFAULT true,
  synced_at timestamptz DEFAULT now()
);

ALTER TABLE resales_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE resales_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE resales_property_types ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anon read features" ON resales_features FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Anon read locations" ON resales_locations FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Anon read types" ON resales_property_types FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated features" ON resales_features FOR ALL
    USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated locations" ON resales_locations FOR ALL
    USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated types" ON resales_property_types FOR ALL
    USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────── RESALES SYNC RUNS (audit log) ───────────────────
-- Captures every sync attempt for the admin dashboard + debugging.
CREATE TABLE IF NOT EXISTS resales_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL CHECK (trigger IN ('cron','manual','single-ref','probe')),
  reference text,                    -- single-ref mode only
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','success','partial','failed')),
  pages_walked int DEFAULT 0,
  upserted int DEFAULT 0,
  pending int DEFAULT 0,
  approved int DEFAULT 0,
  soft_deleted int DEFAULT 0,
  errors_count int DEFAULT 0,
  error_summary text,
  query_id text,                     -- Resales' P_QueryId for the run
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_resales_runs_started ON resales_sync_runs(started_at DESC);

ALTER TABLE resales_sync_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated read runs" ON resales_sync_runs FOR SELECT
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated insert runs" ON resales_sync_runs FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────── PostgREST schema reload ───────────────────
NOTIFY pgrst, 'reload schema';
