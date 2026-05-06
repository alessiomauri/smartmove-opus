'use client';

import { useState, useEffect, useCallback } from 'react';
import { Collection } from '@/types/collection';
import { createClient } from '@/lib/supabase';

export interface CollectionWithCount extends Collection {
  property_count: number;
}

export function useAdminCollections() {
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data, error: fetchError } = await supabase
        .from('collections')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Get property counts
      const withCounts = await Promise.all(
        (data as Collection[]).map(async (collection) => {
          const { count } = await supabase
            .from('collection_properties')
            .select('*', { count: 'exact', head: true })
            .eq('collection_id', collection.id);

          return { ...collection, property_count: count || 0 };
        })
      );

      setCollections(withCounts);
    } catch (err) {
      console.error('Error fetching collections:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch collections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const removeCollection = async (id: string) => {
    const supabase = createClient();

    const { error: deleteError } = await supabase
      .from('collections')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    setCollections((prev) => prev.filter((c) => c.id !== id));
  };

  const togglePublished = async (id: string, is_published: boolean) => {
    const supabase = createClient();

    const { data, error: updateError } = await supabase
      .from('collections')
      .update({ is_published })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...(data as Collection) } : c))
    );

    return data as Collection;
  };

  return {
    collections,
    loading,
    error,
    refetch: fetchCollections,
    deleteCollection: removeCollection,
    togglePublished,
  };
}
