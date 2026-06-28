-- Prompt 5 — Phase H: agents may see/build/copy selections ONLY for leads
-- assigned to them.
--
-- ⚠️ CUTOVER REVIEW — RLS change on email_selections + email_selection_properties:
--   DROPPED: "Authenticated full email_selections" / "Authenticated full esp"
--            (any logged-in user had full access).
--   ADDED:   role-scoped FOR ALL policies — admin = all; agent = rows whose
--            selection's lead_id is assigned to that agent
--            (lead.assigned_agent_id = current_user_agent_id()).
--   Service role bypasses RLS (unaffected). Resolver fns are SECURITY DEFINER
--   (no recursion). Mirrors the Phase C leads-RLS pattern.

drop policy if exists "Authenticated full email_selections" on public.email_selections;
create policy "email_selections by role" on public.email_selections for all to authenticated
  using (
    public.current_user_role() = 'admin'
    or lead_id in (select id from public.leads where assigned_agent_id = public.current_user_agent_id())
  )
  with check (
    public.current_user_role() = 'admin'
    or lead_id in (select id from public.leads where assigned_agent_id = public.current_user_agent_id())
  );

drop policy if exists "Authenticated full esp" on public.email_selection_properties;
create policy "esp by role" on public.email_selection_properties for all to authenticated
  using (
    public.current_user_role() = 'admin'
    or selection_id in (
      select es.id from public.email_selections es
      join public.leads l on l.id = es.lead_id
      where l.assigned_agent_id = public.current_user_agent_id())
  )
  with check (
    public.current_user_role() = 'admin'
    or selection_id in (
      select es.id from public.email_selections es
      join public.leads l on l.id = es.lead_id
      where l.assigned_agent_id = public.current_user_agent_id())
  );
