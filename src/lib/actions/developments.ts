'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { Development, DevelopmentInput } from '@/types/development';
import { revalidatePath, updateTag } from 'next/cache';
import { DEVELOPMENTS_TAG } from '@/lib/cache';
import { generateBlurDataURL } from '@/lib/blur';

/* ---------------------------------------------------------- READ */

export async function getAllDevelopments(): Promise<Development[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('developments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching developments:', error);
    throw new Error('Failed to fetch developments');
  }
  return (data || []) as Development[];
}

/** Server-paginated + searchable dev list for the admin (counts grow with sync). */
export async function getDevelopmentsPage(params: { page?: string; q?: string }): Promise<{ rows: Development[]; total: number; page: number; pageSize: number }> {
  const supabase = await createServerSupabaseClient();
  const PAGE = 50;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE;
  let query = supabase.from('developments').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (params.q) {
    const s = params.q.replace(/[%,()]/g, ' ').trim();
    if (s) query = query.or(`name.ilike.%${s}%,area.ilike.%${s}%,source_id.ilike.%${s}%`);
  }
  query = query.range(from, from + PAGE - 1);
  const { data, count, error } = await query;
  if (error) throw new Error('Failed to fetch developments');
  return { rows: (data || []) as Development[], total: count ?? 0, page, pageSize: PAGE };
}

// Public reads live in src/lib/queries.ts (static client + DEVELOPMENTS_TAG).

export async function getDevelopmentById(id: string): Promise<Development | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('developments')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching development:', error);
    return null;
  }
  return data as Development;
}

/* ---------------------------------------------------------- WRITE */

export async function createDevelopment(input: DevelopmentInput): Promise<Development> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to create a development');

  const { id: _id, ...dataToInsert } = input as DevelopmentInput & { id?: string };

  // Generate hero blur if a hero image was provided
  const insertPayload: Partial<Development> & { hero_image_blur?: string | null } = {
    ...dataToInsert,
  };
  if (insertPayload.hero_image) {
    insertPayload.hero_image_blur = await generateBlurDataURL(insertPayload.hero_image);
  }

  const { data, error } = await supabase
    .from('developments')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error('Error creating development:', error);
    throw new Error(`Failed to create development: ${error.message}`);
  }

  revalidatePath('/admin/developments');
  revalidatePath('/new-developments');
  updateTag(DEVELOPMENTS_TAG);

  return data as Development;
}

export async function updateDevelopment(
  id: string,
  input: Partial<DevelopmentInput>
): Promise<Development> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to update a development');

  const dataToUpdate: Partial<Development> & { hero_image_blur?: string | null } = {
    ...input,
  };

  // Regenerate blur only when hero image actually changed (or is missing one)
  if (dataToUpdate.hero_image) {
    const { data: existing } = await supabase
      .from('developments')
      .select('hero_image,hero_image_blur')
      .eq('id', id)
      .single();
    if (
      !existing ||
      existing.hero_image !== dataToUpdate.hero_image ||
      !existing.hero_image_blur
    ) {
      dataToUpdate.hero_image_blur = await generateBlurDataURL(dataToUpdate.hero_image);
    }
  }

  const { data, error } = await supabase
    .from('developments')
    .update(dataToUpdate)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating development:', error);
    throw new Error(`Failed to update development: ${error.message}`);
  }

  revalidatePath('/admin/developments');
  revalidatePath('/new-developments');
  revalidatePath(`/new-developments/${data.slug}`);
  updateTag(DEVELOPMENTS_TAG);

  return data as Development;
}

export async function deleteDevelopment(id: string): Promise<{ success: true }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to delete a development');

  const { error } = await supabase.from('developments').delete().eq('id', id);

  if (error) {
    console.error('Error deleting development:', error);
    throw new Error(`Failed to delete development: ${error.message}`);
  }

  revalidatePath('/admin/developments');
  revalidatePath('/new-developments');
  updateTag(DEVELOPMENTS_TAG);

  return { success: true };
}

export async function toggleDevelopmentPublished(
  id: string,
  published: boolean
): Promise<Development> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to update a development');

  const { data, error } = await supabase
    .from('developments')
    .update({ published })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update development: ${error.message}`);

  revalidatePath('/admin/developments');
  revalidatePath('/new-developments');
  updateTag(DEVELOPMENTS_TAG);

  return data as Development;
}
