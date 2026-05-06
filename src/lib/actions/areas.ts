'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { Area, PinCategory } from '@/types/area';
import { COSTA_DEL_SOL_AREAS } from '@/lib/areas-data';
import { revalidatePath, updateTag } from 'next/cache';
import { AREAS_TAG } from '@/lib/cache';
import { generateBlurDataURL } from '@/lib/blur';

/**
 * Classification of area slugs into map-pin categories.
 * Keeps the static seed data free of presentation concerns while ensuring
 * re-seeds preserve the DB's pin_category column.
 */
const PIN_CATEGORY_BY_SLUG: Record<string, PinCategory> = {
  // Main towns / headline areas
  'marbella': 'main',
  'estepona': 'main',
  'benahavis': 'main',
  'mijas': 'main',
  'sotogrande': 'main',
  'nueva-andalucia': 'main',
  'marbella-east': 'main',
  'torremolinos': 'main',
  'manilva': 'main',
  'fuengirola': 'main',
  'casares': 'main',
  'malaga': 'main',
  // Resorts
  'puente-romano': 'resort',
  'finca-cortesin': 'resort',
  'la-zagaleta': 'resort',
  'villa-padierna': 'resort',
  'higueron-resort': 'resort',
  // Airport (transit reference)
  'malaga-airport': 'airport',
  // Every other slug defaults to 'micro' below
};

export async function getAllAreas(): Promise<Area[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching areas:', error);
    throw new Error('Failed to fetch areas');
  }
  return (data || []) as Area[];
}

export async function getPublishedAreas(): Promise<Area[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .eq('published', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching areas:', error);
    return [];
  }
  return (data || []) as Area[];
}

export async function getAreaBySlug(slug: string): Promise<Area | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching area:', error);
    return null;
  }
  return data as Area;
}

export async function updateArea(slug: string, area: Partial<Area>) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { created_at, updated_at, ...dataToUpdate } = area as Area;

  // Regenerate the blur placeholder if the hero image has changed
  if (dataToUpdate.hero_image) {
    const { data: existing } = await supabase
      .from('areas')
      .select('hero_image,hero_image_blur')
      .eq('slug', slug)
      .single();
    if (!existing || existing.hero_image !== dataToUpdate.hero_image || !existing.hero_image_blur) {
      dataToUpdate.hero_image_blur = await generateBlurDataURL(dataToUpdate.hero_image);
    }
  }

  const { data, error } = await supabase
    .from('areas')
    .update(dataToUpdate)
    .eq('slug', slug)
    .select()
    .single();

  if (error) {
    console.error('Error updating area:', error);
    throw new Error(`Failed to update area: ${error.message}`);
  }

  revalidatePath('/admin/areas');
  revalidatePath('/areas');
  revalidatePath(`/areas/${slug}`);
  if (data.slug !== slug) revalidatePath(`/areas/${data.slug}`);
  updateTag(AREAS_TAG);

  return data as Area;
}

export async function toggleAreaPublished(slug: string, published: boolean) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('areas')
    .update({ published })
    .eq('slug', slug);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/areas');
  revalidatePath('/areas');
  updateTag(AREAS_TAG);
  return { success: true };
}

/**
 * One-time seed from the static TS data. Idempotent via upsert on slug.
 */
export async function seedAreasFromStatic() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const rows = COSTA_DEL_SOL_AREAS.map((a, i) => ({
    slug: a.slug,
    name: a.name,
    region: a.region,
    title: a.title,
    meta_description: a.metaDescription,
    heading: a.heading,
    subheading: a.subheading,
    description: a.description,
    property_types: a.propertyTypes,
    highlights: a.highlights,
    coordinates_lat: a.coordinates.lat,
    coordinates_lng: a.coordinates.lng,
    price_range: a.priceRange,
    nearby_areas: a.nearbyAreas,
    keywords: a.keywords,
    is_micro_location: a.isMicroLocation,
    parent_area: a.parentArea ?? null,
    hero_image: '',
    hero_image_alt: `${a.name} property for sale on the Costa del Sol`,
    display_order: i,
    published: true,
    pin_category: PIN_CATEGORY_BY_SLUG[a.slug] ?? 'micro',
  }));

  const { error } = await supabase
    .from('areas')
    .upsert(rows, { onConflict: 'slug' });

  if (error) {
    console.error('Seed error:', error);
    throw new Error(`Seed failed: ${error.message}`);
  }

  revalidatePath('/admin/areas');
  revalidatePath('/areas');
  return { count: rows.length };
}
