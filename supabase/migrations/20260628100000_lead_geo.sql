-- Prompt 5 — Phase H: coarse client location captured from Vercel geo headers
-- at /api/leads (best-effort, never blocks the write). Additive + reversible.
-- Privacy: coarse-location disclosure goes in the privacy policy at cutover.
alter table public.leads add column if not exists geo_country text;
alter table public.leads add column if not exists geo_country_code text;
alter table public.leads add column if not exists geo_city text;
