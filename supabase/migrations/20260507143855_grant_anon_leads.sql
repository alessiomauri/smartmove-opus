-- Reset any leftover role state from a prior aborted migration.
RESET ROLE;
SET ROLE postgres;

GRANT INSERT ON TABLE leads TO anon;
GRANT SELECT(id) ON TABLE leads TO anon;  -- needed by .single() / return=representation

NOTIFY pgrst, 'reload schema';
