'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { revalidatePath, updateTag } from 'next/cache';
import { SITE_SETTINGS_TAG } from '@/lib/cache';
import type { HomepageStats } from '@/lib/home-stats';

async function requireAdmin() {
  const sb = await createServerSupabaseClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data } = await sb.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
  if (data?.role !== 'admin') throw new Error('Admin only');
  return sb;
}

/**
 * Save the editorial homepage figures. Empty fields are dropped (not stored as
 * ""), so an unset figure genuinely hides on the homepage. Nothing is seeded.
 */
export async function setHomepageStats(stats: HomepageStats) {
  const sb = await requireAdmin();
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(stats)) {
    const t = (v ?? '').toString().trim();
    if (t) clean[k] = t;
  }
  const { error } = await sb.from('site_settings').update({ homepage_stats: clean, updated_at: new Date().toISOString() }).eq('id', 1);
  if (error) throw new Error(error.message);
  updateTag(SITE_SETTINGS_TAG);
  revalidatePath('/');
  revalidatePath('/admin');
}
