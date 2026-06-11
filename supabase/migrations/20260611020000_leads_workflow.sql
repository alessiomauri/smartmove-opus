-- ─────────────────────────────────────────────────────────────────────
-- Lead pipeline: call-first workflow statuses + form-view tracking
-- (SMARTMOVE_BRIEF §4.5; Monday stays disconnected — /admin/leads is
-- the interim CRM).
-- ─────────────────────────────────────────────────────────────────────

-- The dashboard workflow is new → called → selection_sent → closed.
-- Legacy values stay valid so nothing existing breaks.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status IN (
  'new', 'called', 'selection_sent', 'closed',
  -- legacy (brief's original enum) — still readable, not used by the UI
  'contacted', 'qualified', 'converted', 'lost'
));

-- Dashboard list is "newest first, filter by status/source/date".
CREATE INDEX IF NOT EXISTS idx_leads_status_submitted
  ON leads(status, submitted_at DESC);

-- Form views (impressions). Submissions are the `leads` rows themselves,
-- so conversion = leads / events WHERE event='view' per form+detail.
-- Written via service role from /api/leads/track only — no anon policies.
CREATE TABLE IF NOT EXISTS lead_form_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- e.g. 'viewing-request', 'brochure-request', 'contact-form',
  -- 'dev-intent' — mirrors the lead source it converts into.
  form text NOT NULL,
  event text NOT NULL CHECK (event IN ('view')),
  -- Page path the form rendered on (no query strings, no PII).
  path text,
  -- Property/development reference when the form is listing-scoped.
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_form_events_form_created
  ON lead_form_events(form, created_at DESC);

ALTER TABLE lead_form_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated read form events" ON lead_form_events
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
