'use client';

import { useState, useEffect, useCallback } from 'react';
import { Property } from '@/types/property';
import { createClient } from '@/lib/supabase';
import { revalidateProperties } from '@/lib/actions/revalidate';

export function useAdminProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data, error: fetchError } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setProperties(data as Property[]);
    } catch (err) {
      console.error('Error fetching properties:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch properties');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const deleteProperty = async (id: string) => {
    const supabase = createClient();

    const { error: deleteError } = await supabase
      .from('properties')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    // Remove from local state
    setProperties((prev) => prev.filter((p) => p.id !== id));
    // Invalidate ISR cache so public site reflects deletion immediately
    await revalidateProperties();
  };

  const togglePublished = async (id: string, published: boolean) => {
    const supabase = createClient();

    const { data, error: updateError } = await supabase
      .from('properties')
      .update({ published })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Update local state
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? (data as Property) : p))
    );
    // Invalidate ISR cache
    await revalidateProperties();

    return data as Property;
  };

  return {
    properties,
    loading,
    error,
    refetch: fetchProperties,
    deleteProperty,
    togglePublished,
  };
}
