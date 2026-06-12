/**
 * Similar properties (Prompt 3 + geo upgrade): same broad type, ±30%
 * price band, published only, exclude self, max 6. Ranking: when the
 * subject has GPS coords, geo-distance wins (coordless candidates rank
 * after, area-matched first); without coords, same-area first, then
 * recency. One indexed query (type + price partial index), candidates
 * ranked in process — no PostGIS dependency. Cached with the detail
 * page's ISR.
 */
import { createStaticSupabaseClient } from '@/lib/supabase-static';
import { PROPERTY_LIST_COLUMNS } from '@/lib/list-columns';
import type { Property } from '@/types/property';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

export async function getSimilarProperties(subject: Property, max = 6): Promise<Property[]> {
  const supabase = createStaticSupabaseClient();

  let q = supabase
    .from('properties')
    .select(`${PROPERTY_LIST_COLUMNS}, latitude, longitude`)
    .eq('published', true)
    .eq('property_type', subject.property_type)
    .neq('id', subject.id)
    .order('created_at', { ascending: false })
    .limit(150);

  if (subject.price && !subject.price_on_request) {
    q = q.gte('price', Math.round(subject.price * 0.7)).lte('price', Math.round(subject.price * 1.3));
  }

  const { data, error } = await q;
  if (error || !data) return [];
  const candidates = data as unknown as Array<Property & { latitude: number | null; longitude: number | null }>;

  const sLat = (subject as Property & { latitude?: number | null }).latitude ?? null;
  const sLng = (subject as Property & { longitude?: number | null }).longitude ?? null;

  if (sLat != null && sLng != null) {
    // Geo ranking: nearest first; coordless candidates after, with
    // same-area ones ahead of the rest (recency preserved within groups).
    const withGeo = candidates
      .filter((c) => c.latitude != null && c.longitude != null)
      .map((c) => ({ c, km: haversineKm(sLat, sLng, c.latitude!, c.longitude!) }))
      .sort((a, b) => a.km - b.km)
      .map((x) => x.c);
    const sameAreaNoGeo = candidates.filter((c) => c.latitude == null && c.area === subject.area);
    const restNoGeo = candidates.filter((c) => c.latitude == null && c.area !== subject.area);
    return [...withGeo, ...sameAreaNoGeo, ...restNoGeo].slice(0, max);
  }

  // No coords on the subject: same-area first, then everything else.
  const sameArea = candidates.filter((c) => c.area === subject.area);
  const rest = candidates.filter((c) => c.area !== subject.area);
  return [...sameArea, ...rest].slice(0, max);
}
