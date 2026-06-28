'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getServiceRoleClient } from '@/lib/supabase-service';
import { revalidatePath, updateTag } from 'next/cache';
import { SITE_SETTINGS_TAG } from '@/lib/cache';
import { logEvent } from '@/lib/events';
import { notifyLeadAssigned } from '@/lib/integrations/notifications';
import type { TeamMember } from '@/app/admin/team/types';

async function requireAdminRole() {
  const sb = await createServerSupabaseClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data } = await sb.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
  if (data?.role !== 'admin') throw new Error('Admin only');
  return { sb, user };
}

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'agent';
}

export async function listTeam(): Promise<TeamMember[]> {
  const { sb } = await requireAdminRole();
  const { data } = await sb.from('agents')
    .select('id, name, email, slug, active, user_id, photo, phone, whatsapp, title, languages, bios')
    .order('created_at', { ascending: false });
  return (data ?? []).map((a) => ({
    id: a.id, name: a.name, email: a.email, slug: a.slug, active: a.active, userId: a.user_id,
    photo: a.photo, phone: a.phone, whatsapp: a.whatsapp, title: a.title,
    languages: a.languages, bios: a.bios,
  }));
}

export async function updateAgentProfile(agentId: string, profile: {
  photo?: string; phone?: string; whatsapp?: string; title?: string;
  languages?: string[]; bios?: Record<string, string>; active?: boolean;
}) {
  const { sb } = await requireAdminRole();
  const patch: Record<string, unknown> = {};
  if (profile.photo !== undefined) patch.photo = profile.photo.trim() || null;
  if (profile.phone !== undefined) patch.phone = profile.phone.trim() || null;
  if (profile.whatsapp !== undefined) patch.whatsapp = profile.whatsapp.trim() || null;
  if (profile.title !== undefined) patch.title = profile.title.trim() || null;
  if (profile.languages !== undefined) patch.languages = profile.languages;
  if (profile.bios !== undefined) patch.bios = profile.bios;
  if (profile.active !== undefined) patch.active = profile.active;
  const { error } = await sb.from('agents').update(patch).eq('id', agentId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/team');
  await logEvent({ entityType: 'agent', entityId: agentId, action: 'agent_profile_updated' });
}

/**
 * Create an agent account: auth user + agents profile + user_roles('agent').
 * Uses the service-role client (auth.admin.*). On the live cutover this becomes
 * an email invite once Resend/SMTP is wired (Phase D); for now it sets a password
 * the admin can hand over.
 */
export async function createAgentAccount(input: { name: string; email: string; password: string }) {
  await requireAdminRole();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || !email || (input.password ?? '').length < 8) throw new Error('Name, email, and a password of 8+ chars are required.');

  const svc = getServiceRoleClient();
  const { data: created, error: ce } = await svc.auth.admin.createUser({ email, password: input.password, email_confirm: true });
  if (ce) throw new Error(`Create user: ${ce.message}`);
  const userId = created.user.id;

  const slug = `${slugify(name)}-${userId.slice(0, 4)}`;
  const { data: agent, error: ae } = await svc.from('agents')
    .insert({ name, email, slug, active: true, user_id: userId }).select('id').single();
  if (ae) throw new Error(`Create agent profile: ${ae.message}`);

  const { error: re } = await svc.from('user_roles').insert({ user_id: userId, role: 'agent', agent_id: agent.id });
  if (re) throw new Error(`Assign role: ${re.message}`);

  revalidatePath('/admin/team');
  await logEvent({ entityType: 'agent', entityId: agent.id, action: 'agent_created', meta: { email } });
  return { agentId: agent.id, userId };
}

export async function assignLead(leadId: string, agentId: string | null) {
  const { sb } = await requireAdminRole();
  const { error } = await sb.from('leads').update({ assigned_agent_id: agentId, updated_at: new Date().toISOString() }).eq('id', leadId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/leads');
  await logEvent({ entityType: 'lead', entityId: leadId, action: 'assigned', meta: { agentId } });

  // Notify the assigned agent (env-gated no-op when Resend is unset; never throws).
  if (agentId) {
    const [{ data: agent }, { data: lead }] = await Promise.all([
      sb.from('agents').select('email').eq('id', agentId).maybeSingle(),
      sb.from('leads').select('id, name, email, phone, property_reference').eq('id', leadId).maybeSingle(),
    ]);
    if (lead) {
      await notifyLeadAssigned(
        { id: lead.id, name: lead.name, email: lead.email, phone: lead.phone, property_reference: lead.property_reference },
        (agent?.email as string | null) ?? null
      );
    }
  }
}

const SORTS = ['newest', 'price_asc', 'price_desc', 'name'];
export async function setDefaultSort(sort: string) {
  const { sb } = await requireAdminRole();
  if (!SORTS.includes(sort)) throw new Error('Invalid sort');
  const { error } = await sb.from('site_settings').update({ default_sort: sort }).eq('id', 1);
  if (error) throw new Error(error.message);
  updateTag(SITE_SETTINGS_TAG);
  revalidatePath('/');
  revalidatePath('/admin');
  await logEvent({ entityType: 'site_settings', entityId: '1', action: 'default_sort_changed', meta: { sort } });
}

export async function setNotificationEmail(email: string) {
  const { sb } = await requireAdminRole();
  const value = email.trim() || null;
  const { error } = await sb.from('site_settings').update({ notification_email: value }).eq('id', 1);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  await logEvent({ entityType: 'site_settings', entityId: '1', action: 'notification_email_changed', meta: { set: !!value } });
}
