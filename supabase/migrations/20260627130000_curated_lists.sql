-- Prompt 5 — Phase B: dedicated curated Top-20 lists.
-- Kept SEPARATE from the public collections / collection_properties feature
-- (which stays untouched) and from the sync path. A typed entity ref
-- (property|development) + rank gives ordered, admin-only curated lists.

create table if not exists public.curated_lists (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  entity_type text not null check (entity_type in ('property','development')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.curated_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.curated_lists(id) on delete cascade,
  entity_type text not null check (entity_type in ('property','development')),
  entity_id uuid not null,
  rank int not null default 0,
  created_at timestamptz not null default now(),
  unique (list_id, entity_id)
);
create index if not exists idx_curated_items_list_rank on public.curated_list_items (list_id, rank);

alter table public.curated_lists enable row level security;
alter table public.curated_list_items enable row level security;

-- Public read (for the future public Top-20 pages) + authenticated full.
drop policy if exists "Anon read curated_lists" on public.curated_lists;
create policy "Anon read curated_lists" on public.curated_lists for select using (true);
drop policy if exists "Authenticated full curated_lists" on public.curated_lists;
create policy "Authenticated full curated_lists" on public.curated_lists for all to authenticated using (true) with check (true);

drop policy if exists "Anon read curated_list_items" on public.curated_list_items;
create policy "Anon read curated_list_items" on public.curated_list_items for select using (true);
drop policy if exists "Authenticated full curated_list_items" on public.curated_list_items;
create policy "Authenticated full curated_list_items" on public.curated_list_items for all to authenticated using (true) with check (true);

-- Seed the two launch lists.
insert into public.curated_lists (slug, title, entity_type) values
  ('top-20-investment-properties', 'Top 20 Investment Properties', 'property'),
  ('top-20-investment-developments', 'Top 20 Investment Developments', 'development')
on conflict (slug) do nothing;
