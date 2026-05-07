-- Replace the partial unique indexes on (source, source_id) with full
-- unique indexes. ON CONFLICT in Supabase upserts can't target partial
-- indexes — the catch-on-write only fires for non-NULL source_id rows.
-- Postgres treats NULL as distinct in unique constraints, so dropping
-- the WHERE clause is safe (manual rows with source_id IS NULL still
-- coexist freely).

DROP INDEX IF EXISTS properties_source_idx;
CREATE UNIQUE INDEX IF NOT EXISTS properties_source_idx
  ON properties(source, source_id);

DROP INDEX IF EXISTS developments_source_idx;
CREATE UNIQUE INDEX IF NOT EXISTS developments_source_idx
  ON developments(source, source_id);

NOTIFY pgrst, 'reload schema';
