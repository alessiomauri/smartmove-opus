-- Prompt 5 — Phase E: editable OVERRIDES on synced developments.
-- A single admin-owned JSONB the sync NEVER writes. Public rendering uses
-- overrides[field] ?? feed_column; clearing a key falls back to the feed.
-- Additive + reversible.
alter table public.developments add column if not exists overrides jsonb not null default '{}'::jsonb;
