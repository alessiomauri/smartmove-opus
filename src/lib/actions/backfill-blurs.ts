'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { generateBlurDataURL } from '@/lib/blur';
import { updateTag } from 'next/cache';
import { PROPERTIES_TAG, AREAS_TAG } from '@/lib/cache';

/**
 * One-shot backfill: generate `hero_image_blur` for any property / area row
 * that has a `hero_image` set but no blur. Safe to call repeatedly — only
 * touches rows that need it.
 *
 * Triggered manually from the admin /admin/seed page.
 */
export async function backfillHeroBlurs() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let propertyCount = 0;
  let areaCount = 0;

  // Properties
  const { data: properties } = await supabase
    .from('properties')
    .select('id,hero_image')
    .not('hero_image', 'is', null)
    .neq('hero_image', '')
    .is('hero_image_blur', null);

  for (const p of properties ?? []) {
    const blur = await generateBlurDataURL(p.hero_image);
    if (!blur) continue;
    await supabase.from('properties').update({ hero_image_blur: blur }).eq('id', p.id);
    propertyCount++;
  }

  // Areas
  const { data: areas } = await supabase
    .from('areas')
    .select('slug,hero_image')
    .not('hero_image', 'is', null)
    .neq('hero_image', '')
    .is('hero_image_blur', null);

  for (const a of areas ?? []) {
    const blur = await generateBlurDataURL(a.hero_image);
    if (!blur) continue;
    await supabase.from('areas').update({ hero_image_blur: blur }).eq('slug', a.slug);
    areaCount++;
  }

  updateTag(PROPERTIES_TAG);
  updateTag(AREAS_TAG);

  return { propertyCount, areaCount };
}
