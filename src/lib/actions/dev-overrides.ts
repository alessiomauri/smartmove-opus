'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { revalidatePath, updateTag } from 'next/cache';
import { DEVELOPMENTS_TAG } from '@/lib/cache';
import { logEvent } from '@/lib/events';
import { isOverridableDevField } from '@/lib/dev-overrides';

async function requireAdmin() {
  const sb = await createServerSupabaseClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data } = await sb.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
  if (data?.role !== 'admin') throw new Error('Admin only');
  return sb;
}

async function loadDev(sb: Awaited<ReturnType<typeof createServerSupabaseClient>>, id: string) {
  const { data, error } = await sb.from('developments').select('id, slug, source, overrides').eq('id', id).single();
  if (error || !data) throw new Error('Development not found');
  return data as { id: string; slug: string; source: string; overrides: Record<string, unknown> | null };
}

function invalidate(slug: string) {
  updateTag(DEVELOPMENTS_TAG);
  revalidatePath('/new-developments');
  revalidatePath(`/new-developments/${slug}`);
  revalidatePath('/admin/developments');
}

export async function setDevOverride(id: string, field: string, value: unknown) {
  if (!isOverridableDevField(field)) throw new Error(`Field "${field}" is not overridable`);
  const sb = await requireAdmin();
  const dev = await loadDev(sb, id);
  if (dev.source !== 'resales_online') throw new Error('Overrides apply to synced developments only.');
  const overrides = { ...(dev.overrides ?? {}), [field]: value };
  const { error } = await sb.from('developments').update({ overrides }).eq('id', id);
  if (error) throw new Error(error.message);
  invalidate(dev.slug);
  await logEvent({ entityType: 'development', entityId: id, action: 'override_set', meta: { field } });
}

export async function clearDevOverride(id: string, field: string) {
  const sb = await requireAdmin();
  const dev = await loadDev(sb, id);
  const overrides = { ...(dev.overrides ?? {}) };
  delete overrides[field];
  const { error } = await sb.from('developments').update({ overrides }).eq('id', id);
  if (error) throw new Error(error.message);
  invalidate(dev.slug);
  await logEvent({ entityType: 'development', entityId: id, action: 'override_cleared', meta: { field } });
}
