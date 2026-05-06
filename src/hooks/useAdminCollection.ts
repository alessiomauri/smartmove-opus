'use client';

import { useState, useEffect } from 'react';
import { Collection, CollectionWithProperties } from '@/types/collection';
import { Property } from '@/types/property';
import { createClient } from '@/lib/supabase';

export function useAdminCollection(id: string) {
  const [collection, setCollection] = useState<CollectionWithProperties | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCollection() {
      if (!id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();

        // Fetch collection
        const { data, error: fetchError } = await supabase
          .from('collections')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            setCollection(null);
          } else {
            throw fetchError;
          }
          return;
        }

        // Fetch ordered property IDs
        const { data: collectionProperties } = await supabase
          .from('collection_properties')
          .select('property_id, sort_order')
          .eq('collection_id', id)
          .order('sort_order', { ascending: true });

        const propertyIds = (collectionProperties || []).map((cp) => cp.property_id);

        // Fetch properties
        let properties: Property[] = [];
        if (propertyIds.length > 0) {
          const { data: props } = await supabase
            .from('properties')
            .select('*')
            .in('id', propertyIds);

          if (props) {
            properties = propertyIds
              .map((pid) => props.find((p) => p.id === pid))
              .filter(Boolean) as Property[];
          }
        }

        setCollection({ ...(data as Collection), properties });
      } catch (err) {
        console.error('Error fetching collection:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch collection');
      } finally {
        setLoading(false);
      }
    }

    fetchCollection();
  }, [id]);

  return { collection, loading, error };
}
