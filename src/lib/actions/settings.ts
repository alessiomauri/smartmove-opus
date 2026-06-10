'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { updateTag } from 'next/cache';
import { SITE_SETTINGS_TAG } from '@/lib/cache';

/**
 * Site-wide toggle for "Price Reduced" badges (and future price-drop
 * alert emails). Default OFF — flipping it on is a deliberate launch
 * decision, made from /admin/resales.
 *
 * Invalidation: the cached property reads are tagged with
 * SITE_SETTINGS_TAG, so the gate re-evaluates on the next request —
 * no property rows are touched.
 */
export async function setShowPriceDropBadges(enabled: boolean) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('site_settings')
    .update({ show_price_drop_badges: enabled, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) throw new Error(`Failed to update setting: ${error.message}`);

  updateTag(SITE_SETTINGS_TAG);
  return { success: true, enabled };
}
