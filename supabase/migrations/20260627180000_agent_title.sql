-- Prompt 5 — Phase G: agent profile "title" (e.g. "Senior Advisor"). Additive.
alter table public.agents add column if not exists title text;
