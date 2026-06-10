-- ─────────────────────────────────────────────────────────────────────
-- Publish gate (review-by-exception for MLS rows)
--
-- Policy: at ~8k+ MLS rows, per-row manual review is replaced by a
-- rule-driven gate. The gate controls `published` ONLY — ingestion is
-- never filtered (unpublished rows still feed history/market data and
-- reconciliation). Failers stay pending_review with the failing rule
-- keys recorded on the row so the admin queue can show WHY each was
-- held. Admin reject stays permanent and overrides everything; the
-- gate never touches is_featured / featured_order (curation).
-- ─────────────────────────────────────────────────────────────────────

-- Rule thresholds — editable without a deploy (single-row settings
-- table, id=1). Keys mirror PublishGateConfig in
-- src/lib/integrations/resales-publish-gate.ts; missing keys fall back
-- to code defaults, unknown keys are ignored.
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS publish_gate jsonb NOT NULL DEFAULT '{
  "enabled": true,
  "min_photos": 4,
  "min_price": 150000,
  "require_description": true,
  "min_reference_number": 4000000,
  "require_location": true
}'::jsonb;

-- Why a held row was held: array of failing rule keys (e.g.
-- {min_photos,min_price}). NULL = passed, or never evaluated (manual
-- rows, own rows, gate disabled). Sync-owned (NOT admin-owned): the
-- sync refreshes it whenever it re-evaluates an untouched held row.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS publish_gate_failures text[];
ALTER TABLE properties ADD COLUMN IF NOT EXISTS publish_gate_checked_at timestamptz;

-- Admin queue filters/groups by failing rule.
CREATE INDEX IF NOT EXISTS idx_properties_gate_failures
  ON properties USING gin (publish_gate_failures)
  WHERE publish_gate_failures IS NOT NULL;

-- Held-by-rule breakdown for the admin dashboard (a row failing two
-- rules counts toward both). SECURITY INVOKER — rides the caller's RLS.
CREATE OR REPLACE FUNCTION publish_gate_breakdown()
RETURNS TABLE(rule text, held bigint)
LANGUAGE sql STABLE AS $$
  SELECT unnest(publish_gate_failures) AS rule, count(*) AS held
  FROM properties
  WHERE source = 'resales_online'
    AND pending_review = true
    AND published = false
    AND COALESCE(rejected, false) = false
    AND removed_at IS NULL
    AND publish_gate_failures IS NOT NULL
  GROUP BY 1
  ORDER BY 2 DESC;
$$;
