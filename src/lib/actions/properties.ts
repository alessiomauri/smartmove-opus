'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { Property } from '@/types/property';
import { revalidatePath, updateTag } from 'next/cache';
import { PROPERTIES_TAG } from '@/lib/cache';
import { generateBlurDataURL } from '@/lib/blur';

// Fetch all properties (for admin - includes unpublished)
export async function getAllProperties() {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching properties:', error);
    throw new Error('Failed to fetch properties');
  }

  return data as Property[];
}

// Fetch single property by ID
export async function getPropertyById(id: string) {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching property:', error);
    throw new Error('Failed to fetch property');
  }

  return data as Property;
}

// Public reads live in src/lib/queries.ts (static client + cache tags).
// This file keeps admin-only reads and the mutations.

// Create new property
export async function createProperty(propertyData: Partial<Property>) {
  const supabase = await createServerSupabaseClient();

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to create a property');
  }

  // Remove id if present (let database generate it)
  const { id, created_at, updated_at, ...dataToInsert } = propertyData as Property;

  // Generate hero blur placeholder if a hero image is set
  if (dataToInsert.hero_image) {
    dataToInsert.hero_image_blur = await generateBlurDataURL(dataToInsert.hero_image);
  }

  const { data, error } = await supabase
    .from('properties')
    .insert(dataToInsert)
    .select()
    .single();

  if (error) {
    console.error('Error creating property:', error);
    throw new Error(`Failed to create property: ${error.message}`);
  }

  revalidatePath('/admin');
  revalidatePath('/');
  updateTag(PROPERTIES_TAG);

  return data as Property;
}

// Update existing property
export async function updateProperty(id: string, propertyData: Partial<Property>) {
  const supabase = await createServerSupabaseClient();

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to update a property');
  }

  // Remove fields that shouldn't be updated
  const { id: _id, created_at, updated_at, ...dataToUpdate } = propertyData as Property;

  // If hero image changed, regenerate the blur placeholder.
  // We compare against the existing row to avoid a needless 20px-fetch on every save.
  if (dataToUpdate.hero_image) {
    const { data: existing } = await supabase
      .from('properties')
      .select('hero_image,hero_image_blur')
      .eq('id', id)
      .single();
    if (!existing || existing.hero_image !== dataToUpdate.hero_image || !existing.hero_image_blur) {
      dataToUpdate.hero_image_blur = await generateBlurDataURL(dataToUpdate.hero_image);
    }
  }

  const { data, error } = await supabase
    .from('properties')
    .update(dataToUpdate)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating property:', error);
    throw new Error(`Failed to update property: ${error.message}`);
  }

  revalidatePath('/admin');
  revalidatePath('/');
  updateTag(PROPERTIES_TAG);
  revalidatePath(`/property/${data.slug}`);

  return data as Property;
}

// Delete property
export async function deleteProperty(id: string) {
  const supabase = await createServerSupabaseClient();

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to delete a property');
  }

  const { error } = await supabase
    .from('properties')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting property:', error);
    throw new Error(`Failed to delete property: ${error.message}`);
  }

  revalidatePath('/admin');
  revalidatePath('/');
  updateTag(PROPERTIES_TAG);

  return { success: true };
}

// Toggle publish status
export async function togglePropertyPublished(id: string, published: boolean) {
  const supabase = await createServerSupabaseClient();

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to update a property');
  }

  const { data, error } = await supabase
    .from('properties')
    .update({ published })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error toggling publish status:', error);
    throw new Error(`Failed to update property: ${error.message}`);
  }

  revalidatePath('/admin');
  revalidatePath('/');
  updateTag(PROPERTIES_TAG);

  return data as Property;
}
