'use client';

import { useState, useEffect, useRef } from 'react';
import { Property } from '@/types/property';
import { createClient } from '@/lib/supabase';
import { PROPERTY_LIST_COLUMNS } from '@/lib/list-columns';

// Helper to check if a string is a valid UUID
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Fetch the favourited properties for the favourites / shared-favourites
 * pages. Client-side by necessity (the ids live in localStorage).
 *
 *  - Card columns only (shared PROPERTY_LIST_COLUMNS) — the previous
 *    `select('*')` shipped gallery arrays + JSONB blobs per card.
 *  - One `.or()` query covers both UUID ids and legacy slug ids.
 *  - When ids only SHRINK (user removes a favourite), the list is
 *    filtered locally — no refetch, no loading flash.
 */
export function usePropertiesByIds(ids: string[]) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ids we already have rows for — lets removals resolve locally.
  const fetchedIdsRef = useRef<Set<string>>(new Set());

  // Stable key prevents effect loops when callers pass a fresh array.
  const idsKey = ids.join(',');

  useEffect(() => {
    const currentIds = idsKey ? idsKey.split(',').filter((id) => id.trim()) : [];

    if (currentIds.length === 0) {
      fetchedIdsRef.current = new Set();
      setProperties([]);
      setLoading(false);
      return;
    }

    // Pure removal? Trim the local list and skip the network round-trip.
    const fetched = fetchedIdsRef.current;
    const isSubset = currentIds.every((id) => fetched.has(id));
    if (isSubset && fetched.size > 0) {
      const keep = new Set(currentIds);
      fetchedIdsRef.current = keep;
      setProperties((prev) => prev.filter((p) => keep.has(p.id) || keep.has(p.slug)));
      return;
    }

    let cancelled = false;
    async function fetchProperties() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();

        const validUUIDs = currentIds.filter((id) => isValidUUID(id));
        const potentialSlugs = currentIds.filter((id) => !isValidUUID(id));

        const orParts: string[] = [];
        if (validUUIDs.length > 0) orParts.push(`id.in.(${validUUIDs.join(',')})`);
        if (potentialSlugs.length > 0)
          orParts.push(`slug.in.(${potentialSlugs.map((s) => `"${s}"`).join(',')})`);

        const { data, error: fetchError } = await supabase
          .from('properties')
          .select(PROPERTY_LIST_COLUMNS)
          .or(orParts.join(','))
          .eq('published', true);

        if (fetchError) throw fetchError;
        if (!cancelled) {
          fetchedIdsRef.current = new Set(currentIds);
          setProperties((data as unknown as Property[]) || []);
        }
      } catch (err) {
        console.error('Error fetching properties by ids:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch properties');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProperties();
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return { properties, loading, error };
}
