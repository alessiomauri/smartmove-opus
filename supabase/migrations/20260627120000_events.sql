-- Prompt 5 — Phase A foundation: append-only events log.
-- Cross-entity audit trail (curation, lead assignment, notifications, selections)
-- and the trigger layer the future selection engine will consume.
-- RLS is admin-wide for now; Phase C refines it per role.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,                       -- auth.uid() of the actor (null = system)
  entity_type text not null,                -- 'property' | 'lead' | 'selection' | 'development' | 'notification' | ...
  entity_id text,                           -- uuid or external ref, as text
  action text not null,                     -- 'approved' | 'rejected' | 'published' | 'featured' | 'assigned' | ...
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

drop policy if exists "Authenticated full events" on public.events;
create policy "Authenticated full events" on public.events
  for all to authenticated using (true) with check (true);

create index if not exists idx_events_entity  on public.events (entity_type, entity_id, created_at desc);
create index if not exists idx_events_created on public.events (created_at desc);
create index if not exists idx_events_actor   on public.events (actor_user_id, created_at desc);
