-- Public lead capture: anon needs to be able to INSERT into `leads`.
-- The original policy in Phase 4a was created without an explicit role,
-- which Supabase resolves restrictively. Recreate it with TO anon and
-- a permissive WITH CHECK so contact forms on the public site work.

DROP POLICY IF EXISTS "Anon insert leads" ON leads;

CREATE POLICY "Anon insert leads" ON leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
