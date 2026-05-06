'use client';

import { useState, useEffect } from 'react';
import { Property } from '@/types/property';
import { createClient } from '@/lib/supabase';

export function useAdminProperty(id: string) {
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProperty() {
      if (!id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();

        const { data, error: fetchError } = await supabase
          .from('properties')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            setProperty(null);
          } else {
            throw fetchError;
          }
        } else {
          setProperty(data as Property);
        }
      } catch (err) {
        console.error('Error fetching property:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch property');
      } finally {
        setLoading(false);
      }
    }

    fetchProperty();
  }, [id]);

  const updateProperty = async (data: Partial<Property>) => {
    const supabase = createClient();

    // Remove fields that shouldn't be updated
    const { id: _id, created_at, updated_at, ...dataToUpdate } = data as Property;

    const { data: updatedData, error: updateError } = await supabase
      .from('properties')
      .update(dataToUpdate)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    setProperty(updatedData as Property);
    return updatedData as Property;
  };

  return { property, loading, error, updateProperty };
}
