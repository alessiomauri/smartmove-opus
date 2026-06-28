-- Prompt 5 — Phase C: roles + agent isolation.
--
-- ⚠️ CUTOVER REVIEW — this migration changes RLS on the `leads` table, which
-- also serves LIVE public lead capture. Exactly what changes:
--   PRESERVED (untouched): policy "Anon insert leads" (INSERT, TO anon+authenticated,
--                          WITH CHECK true) → public form capture keeps working.
--   PRESERVED: service-role bypass → /api/leads + sync writes are unaffected (RLS
--              does not apply to the service role).
--   DROPPED:   policy "Authenticated full leads" (FOR ALL, auth.role()='authenticated')
--              — the blanket "any logged-in user sees/edits every lead".
--   ADDED:     role-scoped SELECT / UPDATE / DELETE for authenticated users
--              (admin = all; agent = only leads assigned to them).
-- Net effect on INSERT: authenticated INSERT remains allowed via "Anon insert leads"
-- (its role list already includes `authenticated`), so dropping the FOR ALL policy
-- does not remove the ability to insert.

-- ---------- roles ----------
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','agent')),
  agent_id uuid references public.agents(id) on delete set null,
  created_at timestamptz not null default now()
);

-- SECURITY DEFINER resolvers — bypass RLS on user_roles so the leads policies
-- below never recurse. auth.uid() is still per-request (reads the JWT GUC).
create or replace function public.current_user_role() returns text
  language sql security definer stable set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid()
$$;

create or replace function public.current_user_agent_id() returns uuid
  language sql security definer stable set search_path = public as $$
  select agent_id from public.user_roles where user_id = auth.uid()
$$;

grant execute on function public.current_user_role() to authenticated, anon;
grant execute on function public.current_user_agent_id() to authenticated, anon;

alter table public.user_roles enable row level security;
-- a user may read ONLY their own role row (direct read; the resolvers above
-- bypass RLS via SECURITY DEFINER so this does not gate them).
drop policy if exists "user_roles self read" on public.user_roles;
create policy "user_roles self read" on public.user_roles for select to authenticated
  using (user_id = auth.uid());
-- admins manage all role rows.
drop policy if exists "user_roles admin all" on public.user_roles;
create policy "user_roles admin all" on public.user_roles for all to authenticated
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- Bootstrap: every account that existed BEFORE roles is a de-facto admin.
-- (On the clone: just the dev admin. On live cutover: the existing admin accounts.)
insert into public.user_roles (user_id, role)
  select id, 'admin' from auth.users
  on conflict (user_id) do nothing;

-- ---------- leads RLS swap (see CUTOVER REVIEW note above) ----------
drop policy if exists "Authenticated full leads" on public.leads;

drop policy if exists "leads select by role" on public.leads;
create policy "leads select by role" on public.leads for select to authenticated
  using (
    public.current_user_role() = 'admin'
    or (public.current_user_role() = 'agent' and assigned_agent_id = public.current_user_agent_id())
  );

drop policy if exists "leads update by role" on public.leads;
create policy "leads update by role" on public.leads for update to authenticated
  using (
    public.current_user_role() = 'admin'
    or (public.current_user_role() = 'agent' and assigned_agent_id = public.current_user_agent_id())
  )
  with check (
    public.current_user_role() = 'admin'
    or (public.current_user_role() = 'agent' and assigned_agent_id = public.current_user_agent_id())
  );

drop policy if exists "leads delete admin" on public.leads;
create policy "leads delete admin" on public.leads for delete to authenticated
  using (public.current_user_role() = 'admin');

-- NOTE: "Anon insert leads" (INSERT) is intentionally left in place — do not drop it.
