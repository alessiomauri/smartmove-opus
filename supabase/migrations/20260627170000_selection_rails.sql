-- Prompt 5 — Phase F: selection rails. EXTEND the existing email_selections
-- (and reuse the ordered email_selection_properties junction) — do NOT create
-- a parallel "selections" table. Additive + reversible.
alter table public.email_selections add column if not exists lead_id uuid references public.leads(id) on delete set null;
alter table public.email_selections add column if not exists status text not null default 'draft' check (status in ('draft','approved','sent'));
alter table public.email_selections add column if not exists sent_at timestamptz;
create index if not exists idx_email_selections_lead on public.email_selections(lead_id);
