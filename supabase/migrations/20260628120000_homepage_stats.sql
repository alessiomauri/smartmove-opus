-- Editorial homepage figures (admin-editable, one source of truth each):
-- sold volume, reviews count, rating, quiz starts, founded year. Stored as a
-- JSONB blob on the singleton site_settings row. Seeded EMPTY ({}) — unset
-- figures hide on the homepage; nothing fake is seeded. Additive + reversible.
alter table public.site_settings add column if not exists homepage_stats jsonb not null default '{}'::jsonb;
