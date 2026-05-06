'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { Collection, CollectionWithProperties } from '@/types/collection';
import { Property } from '@/types/property';
import { revalidatePath } from 'next/cache';

// Fetch all collections (admin)
export async function getAllCollections() {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching collections:', error);
    throw new Error('Failed to fetch collections');
  }

  // Get property counts for each collection
  const collectionsWithCounts = await Promise.all(
    (data as Collection[]).map(async (collection) => {
      const { count } = await supabase
        .from('collection_properties')
        .select('*', { count: 'exact', head: true })
        .eq('collection_id', collection.id);

      return { ...collection, property_count: count || 0 };
    })
  );

  return collectionsWithCounts;
}

// Fetch collection by ID with properties (admin edit)
export async function getCollectionById(id: string) {
  const supabase = await createServerSupabaseClient();

  const { data: collection, error } = await supabase
    .from('collections')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching collection:', error);
    throw new Error('Failed to fetch collection');
  }

  // Get ordered property IDs
  const { data: collectionProperties } = await supabase
    .from('collection_properties')
    .select('property_id, sort_order')
    .eq('collection_id', id)
    .order('sort_order', { ascending: true });

  const propertyIds = (collectionProperties || []).map((cp) => cp.property_id);

  // Fetch the actual properties
  let properties: Property[] = [];
  if (propertyIds.length > 0) {
    const { data: props } = await supabase
      .from('properties')
      .select('*')
      .in('id', propertyIds);

    // Sort them in the correct order
    if (props) {
      properties = propertyIds
        .map((id) => props.find((p) => p.id === id))
        .filter(Boolean) as Property[];
    }
  }

  return { ...(collection as Collection), properties } as CollectionWithProperties;
}

// Fetch collection by slug with properties (public)
export async function getCollectionBySlug(slug: string) {
  const supabase = await createServerSupabaseClient();

  const { data: collection, error } = await supabase
    .from('collections')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching collection:', error);
    throw new Error('Failed to fetch collection');
  }

  // Get ordered property IDs
  const { data: collectionProperties } = await supabase
    .from('collection_properties')
    .select('property_id, sort_order')
    .eq('collection_id', collection.id)
    .order('sort_order', { ascending: true });

  const propertyIds = (collectionProperties || []).map((cp) => cp.property_id);

  // Fetch published properties only
  let properties: Property[] = [];
  if (propertyIds.length > 0) {
    const { data: props } = await supabase
      .from('properties')
      .select('*')
      .in('id', propertyIds)
      .eq('published', true);

    if (props) {
      properties = propertyIds
        .map((id) => props.find((p) => p.id === id))
        .filter(Boolean) as Property[];
    }
  }

  return { ...(collection as Collection), properties } as CollectionWithProperties;
}

// Create collection
export async function createCollection(data: {
  title: string;
  slug: string;
  type: 'community' | 'personal';
  message?: string;
  cover_image?: string;
  recipient_name?: string;
  is_published?: boolean;
  property_ids: string[];
}) {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in');

  const { property_ids, ...collectionData } = data;

  // Create collection
  const { data: collection, error } = await supabase
    .from('collections')
    .insert({
      ...collectionData,
      message: collectionData.message || null,
      cover_image: collectionData.cover_image || null,
      recipient_name: collectionData.recipient_name || null,
      is_published: collectionData.is_published ?? false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating collection:', error);
    throw new Error(`Failed to create collection: ${error.message}`);
  }

  // Insert property associations
  if (property_ids.length > 0) {
    const propertyRows = property_ids.map((property_id, index) => ({
      collection_id: collection.id,
      property_id,
      sort_order: index,
    }));

    const { error: propError } = await supabase
      .from('collection_properties')
      .insert(propertyRows);

    if (propError) {
      console.error('Error adding properties to collection:', propError);
    }
  }

  revalidatePath('/admin/collections');
  return collection as Collection;
}

// Update collection
export async function updateCollection(id: string, data: {
  title: string;
  slug: string;
  type: 'community' | 'personal';
  message?: string;
  cover_image?: string;
  recipient_name?: string;
  is_published?: boolean;
  property_ids: string[];
}) {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in');

  const { property_ids, ...collectionData } = data;

  // Update collection
  const { data: collection, error } = await supabase
    .from('collections')
    .update({
      ...collectionData,
      message: collectionData.message || null,
      cover_image: collectionData.cover_image || null,
      recipient_name: collectionData.recipient_name || null,
      is_published: collectionData.is_published ?? false,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating collection:', error);
    throw new Error(`Failed to update collection: ${error.message}`);
  }

  // Re-sync properties: delete all, re-insert in order
  await supabase
    .from('collection_properties')
    .delete()
    .eq('collection_id', id);

  if (property_ids.length > 0) {
    const propertyRows = property_ids.map((property_id, index) => ({
      collection_id: id,
      property_id,
      sort_order: index,
    }));

    await supabase.from('collection_properties').insert(propertyRows);
  }

  revalidatePath('/admin/collections');
  revalidatePath(`/collection/${collection.slug}`);
  return collection as Collection;
}

// Delete collection
export async function deleteCollection(id: string) {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in');

  const { error } = await supabase
    .from('collections')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting collection:', error);
    throw new Error(`Failed to delete collection: ${error.message}`);
  }

  revalidatePath('/admin/collections');
  return { success: true };
}

// Toggle publish
export async function toggleCollectionPublished(id: string, is_published: boolean) {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in');

  const { data, error } = await supabase
    .from('collections')
    .update({ is_published })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error toggling collection publish:', error);
    throw new Error(`Failed to update collection: ${error.message}`);
  }

  revalidatePath('/admin/collections');
  return data as Collection;
}

// Increment view count (public, called on page load)
export async function incrementCollectionViews(slug: string) {
  const supabase = await createServerSupabaseClient();

  // Get current count and increment
  const { data } = await supabase
    .from('collections')
    .select('id, view_count')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (data) {
    await supabase
      .from('collections')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('id', data.id);
  }
}
