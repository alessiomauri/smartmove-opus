'use client';

import { useState, useEffect, useMemo } from 'react';
import { Property, PropertyFilters, SortOption } from '@/types/property';
import { createClient } from '@/lib/supabase';

// Hook to fetch site default sort setting
export function useDefaultSort() {
  const [defaultSort, setDefaultSort] = useState<SortOption>('newest');

  useEffect(() => {
    async function fetchSettings() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('site_settings')
          .select('default_sort')
          .eq('id', 1)
          .single();

        if (data?.default_sort) {
          setDefaultSort(data.default_sort as SortOption);
        }
      } catch {
        // Silently fallback to 'newest'
      }
    }
    fetchSettings();
  }, []);

  return defaultSort;
}

export function useProperties(
  filters: PropertyFilters = {},
  sort: SortOption = 'newest'
) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProperties() {
      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('properties')
          .select('id,slug,name,status,property_type,price,price_on_request,location,area,micro_location,bedrooms,bathrooms,interior_size,plot_size,hero_image,is_featured,featured_order,features,description,created_at')
          .eq('published', true);

        if (fetchError) {
          throw fetchError;
        }

        setProperties((data as Property[]) || []);
      } catch (err) {
        console.error('Error fetching properties:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch properties');
      } finally {
        setLoading(false);
      }
    }

    fetchProperties();
  }, []);

  // Apply filters and sorting
  const filteredProperties = useMemo(() => {
    let result = [...properties];

    // Filter by status
    if (filters.status && filters.status !== 'all') {
      result = result.filter((p) => p.status === filters.status);
    }

    // Filter by property type
    if (filters.propertyType) {
      result = result.filter((p) => p.property_type === filters.propertyType);
    }

    // Filter by area — matches main area name, child area names, OR micro_location slug
    if (filters.area || filters.childAreaNames?.length || filters.microLocationSlugs?.length) {
      result = result.filter((p) => {
        if (filters.area && p.area === filters.area) return true;
        if (filters.childAreaNames?.length && filters.childAreaNames.includes(p.area)) return true;
        if (filters.microLocationSlugs?.length && p.micro_location) {
          return filters.microLocationSlugs.includes(p.micro_location);
        }
        return false;
      });
    }

    // Filter by price range
    if (filters.minPrice !== undefined) {
      result = result.filter(
        (p) => p.price !== null && p.price >= filters.minPrice!
      );
    }
    if (filters.maxPrice !== undefined) {
      result = result.filter(
        (p) => p.price !== null && p.price <= filters.maxPrice!
      );
    }

    // Filter by minimum bedrooms
    if (filters.minBedrooms !== undefined) {
      result = result.filter(
        (p) => p.bedrooms !== null && p.bedrooms >= filters.minBedrooms!
      );
    }

    // Filter by features
    if (filters.features && filters.features.length > 0) {
      result = result.filter((p) =>
        filters.features!.every((f) => p.features.includes(f))
      );
    }

    // Search by name
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.location.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower)
      );
    }

    // Sort helper for non-featured properties
    const applySortOrder = (a: Property, b: Property) => {
      switch (sort) {
        case 'price_asc':
          if (a.price === null) return 1;
          if (b.price === null) return -1;
          return a.price - b.price;
        case 'price_desc':
          if (a.price === null) return 1;
          if (b.price === null) return -1;
          return b.price - a.price;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    };

    // Featured properties always come first, sorted by featured_order
    // Then non-featured properties follow the selected sort
    result.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      if (a.is_featured && b.is_featured) {
        return (a.featured_order ?? 0) - (b.featured_order ?? 0);
      }
      return applySortOrder(a, b);
    });

    return result;
  }, [properties, filters, sort]);

  return { properties: filteredProperties, loading, error };
}

export function useProperty(slug: string) {
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProperty() {
      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('properties')
          .select('*')
          .eq('slug', slug)
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            setError('Property not found');
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

    if (slug) {
      fetchProperty();
    }
  }, [slug]);

  return { property, loading, error };
}

// Helper to check if a string is a valid UUID
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export function usePropertiesByIds(ids: string[]) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create a stable string key for the ids array to prevent infinite loops
  const idsKey = ids.join(',');

  useEffect(() => {
    async function fetchProperties() {
      // Parse ids from the key to ensure we have the current values
      const currentIds = idsKey ? idsKey.split(',').filter(id => id.trim()) : [];

      if (currentIds.length === 0) {
        setProperties([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();

        // Separate valid UUIDs from potential slugs (invalid UUIDs like "6", "2" won't work)
        const validUUIDs = currentIds.filter(id => isValidUUID(id));
        const potentialSlugs = currentIds.filter(id => !isValidUUID(id));

        let allData: Property[] = [];

        // Fetch by UUID if we have valid UUIDs
        if (validUUIDs.length > 0) {
          const { data: uuidData, error: uuidError } = await supabase
            .from('properties')
            .select('*')
            .in('id', validUUIDs);

          if (!uuidError && uuidData) {
            allData = [...allData, ...uuidData];
          }
        }

        // Fetch by slug if we have potential slugs
        if (potentialSlugs.length > 0) {
          const { data: slugData, error: slugError } = await supabase
            .from('properties')
            .select('*')
            .in('slug', potentialSlugs);

          if (!slugError && slugData) {
            allData = [...allData, ...slugData];
          }
        }

        setProperties(allData);
      } catch (err) {
        console.error('Error fetching properties by ids:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch properties');
      } finally {
        setLoading(false);
      }
    }

    fetchProperties();
  }, [idsKey]);

  return { properties, loading, error };
}
