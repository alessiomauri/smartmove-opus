-- ─────────────────────────────────────────────────────────────────────
-- Quiz ENGINE (SMARTMOVE_NEXT_PROMPTS Prompt 6, decided 10 Jun).
-- Quizzes are DATA: the definition (questions, options, photos, weights,
-- result config) lives in JSONB; one renderer consumes any row. The two
-- launch quizzes are seed rows below, not special cases — adding a
-- third quiz is an INSERT. Definition shape: docs/QUIZZES.md.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('live', 'draft')),
  intro jsonb NOT NULL DEFAULT '{}'::jsonb,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anon read live quizzes" ON quizzes
    FOR SELECT USING (status = 'live');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated manage quizzes" ON quizzes
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Funnel events (start / per-question answer / contact screen / complete)
-- — first-party, no PII, no cookies. Powers the admin completion stats
-- and per-question drop-off; PostHog mirrors the same events client-side
-- when its key is configured. Written via service role only.
CREATE TABLE IF NOT EXISTS quiz_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_slug text NOT NULL,
  event text NOT NULL CHECK (event IN ('start', 'answer', 'contact_view', 'complete')),
  step int,
  question_id text,
  answer_id text,
  -- random per-run id so drop-off is computable; not a user identifier
  run_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_events_slug_event
  ON quiz_events(quiz_slug, event, created_at DESC);

ALTER TABLE quiz_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated read quiz events" ON quiz_events
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Quiz completions are leads: extend the source enum.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK (source IN (
  'contact-form', 'viewing-request', 'brochure-request',
  'email-selection-click', 'newsletter', 'two-step-landing',
  'quiz-area', 'quiz-dev', 'other'
));
