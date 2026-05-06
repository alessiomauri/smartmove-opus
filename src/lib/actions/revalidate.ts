'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { PROPERTIES_TAG, AREAS_TAG, SITE_SETTINGS_TAG } from '@/lib/cache';

/**
 * Tiny server-action helpers for client-side admin hooks that mutate
 * Supabase directly. Call these after any client-side mutation so the
 * public-side ISR cache invalidates immediately.
 *
 * `updateTag` (Next 16) gives us read-your-own-writes semantics from inside
 * server actions — the next render after this returns will see fresh data.
 */

export async function revalidateProperties() {
  updateTag(PROPERTIES_TAG);
  revalidatePath('/');
  revalidatePath('/admin');
}

export async function revalidateAreas() {
  updateTag(AREAS_TAG);
  revalidatePath('/areas');
}

export async function revalidateSiteSettings() {
  updateTag(SITE_SETTINGS_TAG);
  revalidatePath('/');
}
