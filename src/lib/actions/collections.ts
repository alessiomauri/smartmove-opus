'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { Collection, CollectionWithProperties } from '@/types/collection';
import { Property } from '@/types/property';
import { revalidatePath, updateTag } from 'next/cache';
import { COLLECTIONS_TAG } from '@/lib/cache';

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

  // One query for all membership rows, counted in memory — the previous
  // version issued a COUNT round-trip per collection (N+1).
  const { data: links } = await supabase
    .from('collection_properties')
    .select('collection_id');

  const counts = new Map<string, number>();
  for (const l of links ?? []) {
    counts.set(l.collection_id, (counts.get(l.collection_id) ?? 0) + 1);
  }

  return (data as Collection[]).map((c) => ({
    ...c,
    property_count: counts.get(c.id) ?? 0,
  }));
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

    // Restore curated order via Map (O(n), was O(n²) .find per id)
    if (props) {
      const byId = new Map((props as Property[]).map((p) => [p.id, p]));
      properties = propertyIds
        .map((id) => byId.get(id))
        .filter((p): p is Property => Boolean(p));
    }
  }

  return { ...(collection as Collection), properties } as CollectionWithProperties;
}

// Public read (getCollectionBySlug) lives in src/lib/queries.ts.

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
  updateTag(COLLECTIONS_TAG);
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
  updateTag(COLLECTIONS_TAG);
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
  updateTag(COLLECTIONS_TAG);
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
  updateTag(COLLECTIONS_TAG);
  return data as Collection;
}
