-- Prompt 5 — Phase D: configurable admin notification address (not hardcoded).
-- Additive + reversible. The new-lead notification emails this address.
alter table public.site_settings add column if not exists notification_email text;
