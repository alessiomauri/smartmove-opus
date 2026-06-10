-- Resales sync hardening (2026-06-10) — RESALES_SYNC_PROMPT phases 1-7 schema
--
-- 1. sync_state         : key/value store for the watermark + import cursors
-- 2. content_hash       : SHA-256 of the normalized mapped row → zero writes
--                         for unchanged rows
-- 3. price/status history: capture every transition from day one (cheap now,
--                         impossible to backfill later)
-- 4. price-drop gating  : site-wide toggle (default OFF) + per-listing
--                         hide_price_drop that the sync never overwrites
-- 5. sync_runs metrics  : per-run observability columns + the triggers the
--                         code already uses ('samples' was violating the old
--                         CHECK, silently dropping the run row)

-- ─────────────────────────────────────────────── 1. sync_state

CREATE TABLE IF NOT EXISTS sync_state (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;

-- Admin dashboard reads the watermark / import progress with the cookie
-- client; the cron path uses the service role (bypasses RLS).
DO $$ BEGIN
  CREATE POLICY "Authenticated full sync_state" ON sync_state FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────── 2. content hashes

ALTER TABLE properties   ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE developments ADD COLUMN IF NOT EXISTS content_hash text;

-- ─────────────────────────────────────────────── 3. history tables

CREATE TABLE IF NOT EXISTS property_price_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  old_price numeric,
  new_price numeric,
  currency text NOT NULL DEFAULT 'EUR',
  changed_at timestamptz NOT NULL DEFAULT now(),
  sync_run_id uuid REFERENCES resales_sync_runs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_price_history_property
  ON property_price_history (property_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS property_status_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  sync_run_id uuid REFERENCES resales_sync_runs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_status_history_property
  ON property_status_history (property_id, changed_at DESC);

ALTER TABLE property_price_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_status_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated full price history" ON property_price_history FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated full status history" ON property_status_history FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────── 4. price-drop gating

-- Per-listing opt-out, ADMIN-OWNED: the sync's update path must never
-- write this column (enforced in code via SYNC_PROTECTED_FIELDS).
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hide_price_drop boolean NOT NULL DEFAULT false;

-- Timestamp of the most recent price DECREASE (cleared on increase).
-- The public `price_drop` flag is computed: price_drop_at within 30 days
-- AND site_settings.show_price_drop_badges AND NOT hide_price_drop.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_drop_at timestamptz;

-- Reconciliation marker: set when the weekly sweep determines the
-- reference has left the Resales feed (past the 15-day sold tail).
ALTER TABLE properties   ADD COLUMN IF NOT EXISTS removed_at timestamptz;
ALTER TABLE developments ADD COLUMN IF NOT EXISTS removed_at timestamptz;

-- Site-wide kill switch for the badge surface. Default OFF until enabled.
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS show_price_drop_badges boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────── 5. sync_runs metrics

ALTER TABLE resales_sync_runs ADD COLUMN IF NOT EXISTS rows_seen int DEFAULT 0;
ALTER TABLE resales_sync_runs ADD COLUMN IF NOT EXISTS rows_skipped_unchanged int DEFAULT 0;
ALTER TABLE resales_sync_runs ADD COLUMN IF NOT EXISTS rows_updated int DEFAULT 0;
ALTER TABLE resales_sync_runs ADD COLUMN IF NOT EXISTS rows_inserted int DEFAULT 0;
ALTER TABLE resales_sync_runs ADD COLUMN IF NOT EXISTS price_changes int DEFAULT 0;
ALTER TABLE resales_sync_runs ADD COLUMN IF NOT EXISTS status_changes int DEFAULT 0;
ALTER TABLE resales_sync_runs ADD COLUMN IF NOT EXISTS images_purged int DEFAULT 0;
ALTER TABLE resales_sync_runs ADD COLUMN IF NOT EXISTS api_calls int DEFAULT 0;
ALTER TABLE resales_sync_runs ADD COLUMN IF NOT EXISTS duration_ms int;
ALTER TABLE resales_sync_runs ADD COLUMN IF NOT EXISTS watermark_before text;
ALTER TABLE resales_sync_runs ADD COLUMN IF NOT EXISTS watermark_after text;

-- The code's SyncTrigger union already included 'samples' (used by the
-- dev seed route) — inserts with it violated the old CHECK and the run
-- row was silently dropped. Recreate with the full set.
ALTER TABLE resales_sync_runs DROP CONSTRAINT IF EXISTS resales_sync_runs_trigger_check;
ALTER TABLE resales_sync_runs ADD CONSTRAINT resales_sync_runs_trigger_check
  CHECK (trigger IN ('cron','manual','single-ref','probe','samples','reconcile','full-import'));

-- ─────────────────── PostgREST schema reload ───────────────────
NOTIFY pgrst, 'reload schema';
