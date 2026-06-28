/**
 * Server-side search over the FULL published inventory (Prompt 3).
 * This is the surface the publish gate feeds: 8k+ rows, SQL-filtered
 * and paginated — listing grids never ship the whole inventory again.
 *
 * URL contract (short names, defaults omitted — tidy shareable URLs):
 *   ?area=&type=&beds=&minp=&maxp=&feat=&sort=&page=
 * sort: new (default) | price_asc | price_desc
 */
import { createStaticSupabaseClient } from '@/lib/supabase-static';
import { PROPERTY_LIST_COLUMNS } from '@/lib/list-columns';
import { getCachedAreaFilterIndex } from '@/lib/cache';
import { buildAreaFilterIndex, resolveAreaEntry, type AreaFilterEntry } from '@/lib/area-resolve';
import type { Property, PropertyType } from '@/types/property';
import type { Development } from '@/types/development';

export const PAGE_SIZE = 24;

export const SEARCH_SORTS = ['new', 'price_asc', 'price_desc'] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export interface SearchFilters {
  area?: string;
  type?: PropertyType;
  beds?: number;
  minp?: number;
  maxp?: number;
  /** Comma-separated feature slugs (see FEATURE_TOKENS) — AND semantics. */
  feat?: string;
  /** Free-text: name / location / reference. */
  q?: string;
  /** Listing status (omitted = all). */
  status?: 'available' | 'sold' | 'reserved' | 'under_offer' | 'coming_soon';
  sort: SearchSort;
  page: number;
}

/**
 * FEATURE_OPTIONS label → URL slug → substring tokens. Matching must
 * cover BOTH dialects in features_text: manual rows carry bare labels
 * ('Private Pool'), MLS rows carry 'Category: Value' strings
 * ('Pool: Private', 'Views: Sea', 'Features: Guest Apartment') —
 * vocabulary verified against the live DB. Each selected feature ORs
 * its tokens; multiple selected features AND together. Unknown slugs
 * fall back to a raw substring (keeps the broad golf facet working).
 */
export const FEATURE_TOKENS: Record<string, { label: string; tokens: string[] }> = {
  'sea-view': { label: 'Sea View', tokens: ['Sea View', 'Views: Sea'] },
  'mountain-view': { label: 'Mountain View', tokens: ['Mountain View', 'Views: Mountain'] },
  'golf-view': { label: 'Golf View', tokens: ['Golf View', 'Views: Golf'] },
  'private-pool': { label: 'Private Pool', tokens: ['Private Pool', 'Pool: Private', 'Pool: Heated'] },
  'communal-pool': { label: 'Communal Pool', tokens: ['Communal Pool', 'Pool: Communal'] },
  gym: { label: 'Gym', tokens: ['Gym'] },
  spa: { label: 'Spa', tokens: ['Spa', 'Sauna'] },
  'tennis-court': { label: 'Tennis Court', tokens: ['Tennis'] },
  'cinema-room': { label: 'Cinema Room', tokens: ['Cinema'] },
  'wine-cellar': { label: 'Wine Cellar', tokens: ['Wine Cellar'] },
  'guest-house': { label: 'Guest House', tokens: ['Guest House', 'Guest Apartment'] },
  'staff-quarters': { label: 'Staff Quarters', tokens: ['Staff Quarters', 'Staff Accommodation'] },
  lift: { label: 'Lift', tokens: ['Lift', 'Elevator'] },
  'smart-home': { label: 'Smart Home', tokens: ['Smart Home', 'Domotics'] },
  'underfloor-heating': { label: 'Underfloor Heating', tokens: ['Underfloor'] },
  'air-conditioning': { label: 'Air Conditioning', tokens: ['Air Conditioning', 'Climate Control'] },
  garden: { label: 'Garden', tokens: ['Garden'] },
  jacuzzi: { label: 'Jacuzzi', tokens: ['Jacuzzi'] },
};

export function featureLabelToSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
/** feat param → FilterBar labels (unknown slugs pass through raw). */
export function featSlugsToLabels(feat: string | undefined): string[] {
  if (!feat) return [];
  return feat
    .split(',')
    .filter(Boolean)
    .map((slug) => FEATURE_TOKENS[slug]?.label ?? slug);
}
export function featureLabelsToFeatParam(labels: string[] | undefined): string | undefined {
  if (!labels || labels.length === 0) return undefined;
  return labels.map(featureLabelToSlug).join(',');
}

const TYPES: PropertyType[] = ['villa', 'apartment', 'townhouse', 'penthouse', 'plot_with_project'];

type RawParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
function posInt(v: string | undefined): number | undefined {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** Canonicalize raw searchParams — junk in, defaults out. */
export function parseSearchParams(sp: RawParams): SearchFilters {
  const type = one(sp.type) as PropertyType | undefined;
  const sort = one(sp.sort) as SearchSort | undefined;
  return {
    area: one(sp.area)?.slice(0, 60) || undefined,
    type: type && TYPES.includes(type) ? type : undefined,
    beds: posInt(one(sp.beds)),
    minp: posInt(one(sp.minp)),
    maxp: posInt(one(sp.maxp)),
    feat: one(sp.feat)?.slice(0, 200) || undefined,
    q: one(sp.q)?.slice(0, 60) || undefined,
    status: (['available','sold','reserved','under_offer','coming_soon'] as const).find(
      (v) => v === one(sp.status)
    ),
    sort: sort && SEARCH_SORTS.includes(sort) ? sort : 'new',
    page: posInt(one(sp.page)) ?? 1,
  };
}

/** Filters → tidy query string (defaults omitted; '' when none). */
export function searchParamsString(f: Partial<SearchFilters>): string {
  const p = new URLSearchParams();
  if (f.area) p.set('area', f.area);
  if (f.type) p.set('type', f.type);
  if (f.beds) p.set('beds', String(f.beds));
  if (f.minp) p.set('minp', String(f.minp));
  if (f.maxp) p.set('maxp', String(f.maxp));
  if (f.feat) p.set('feat', f.feat);
  if (f.q) p.set('q', f.q);
  if (f.status) p.set('status', f.status);
  if (f.sort && f.sort !== 'new') p.set('sort', f.sort);
  if (f.page && f.page > 1) p.set('page', String(f.page));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export interface SearchResult {
  rows: Property[];
  total: number;
  page: number;
  pages: number;
  /** Set when the real query was empty and these are relaxed matches. */
  closest?: { dropped: string[] };
}

/** PostgREST `or=` value quoting (values may contain commas/spaces). */
function pgQuoted(values: string[]): string {
  return values.map((v) => `"${v.replaceAll('"', '')}"`).join(',');
}

/**
 * CANONICAL AREA FILTERING — an area param means "everything mapped
 * under this area" via the location-nesting system (the same one the
 * map and /areas pages use), never a raw match on the feed's Location:
 *  - resales rows match when their exact `location` string is in the
 *    area's approved mapping set (incl. all descendant areas);
 *  - curated/manual rows match when their `area` carries one of the
 *    nested curated area NAMES.
 * Unrecognized params (free text that is no area) fall back to ilike
 * so exploratory searches still work.
 */
async function resolveAreaFilter(param: string): Promise<AreaFilterEntry | null> {
  const { areas, mappings } = await getCachedAreaFilterIndex();
  const index = buildAreaFilterIndex(areas, mappings);
  return resolveAreaEntry(index, param);
}

async function runPropertyQuery(f: Partial<SearchFilters>, page: number, pageSize = PAGE_SIZE) {
  const supabase = createStaticSupabaseClient();
  let q = supabase
    .from('properties')
    .select(PROPERTY_LIST_COLUMNS, { count: 'exact' })
    .eq('published', true);

  if (f.area) {
    const entry = await resolveAreaFilter(f.area);
    if (entry) {
      const ors: string[] = [];
      if (entry.locationStrings.length > 0) {
        ors.push(`location.in.(${pgQuoted(entry.locationStrings)})`);
      }
      if (entry.areaNames.length > 0) {
        ors.push(`area.in.(${pgQuoted(entry.areaNames)})`);
      }
      if (ors.length > 0) q = q.or(ors.join(','));
      else q = q.eq('id', '00000000-0000-0000-0000-000000000000'); // mapped to nothing yet
    } else {
      q = q.ilike('area', `%${f.area.replaceAll('%', '')}%`);
    }
  }
  if (f.type) q = q.eq('property_type', f.type);
  if (f.status) q = q.eq('status', f.status);
  if (f.beds) q = q.gte('bedrooms', f.beds);
  if (f.minp) q = q.gte('price', f.minp);
  if (f.maxp) q = q.lte('price', f.maxp);
  // Features: each selected slug ORs its dialect tokens over the
  // generated features_text projection; multiple selections AND
  // (chained .or() calls AND together in PostgREST).
  if (f.feat) {
    for (const slug of f.feat.split(',').filter(Boolean).slice(0, 8)) {
      const tokens = FEATURE_TOKENS[slug]?.tokens ?? [slug.replaceAll('-', ' ')];
      q = q.or(
        tokens
          .map((t) => `features_text.ilike.%${t.replaceAll('%', '').replaceAll(',', '')}%`)
          .join(',')
      );
    }
  }
  // Free-text: name / location / area / reference — and when the text
  // IS one of our areas (any accents), expand through the canonical
  // resolver so "benahavis" matches 'Benahavís' rows.
  if (f.q) {
    const safe = f.q.replaceAll('%', '').replaceAll(',', '');
    const ors = [
      `name.ilike.%${safe}%`,
      `location.ilike.%${safe}%`,
      `area.ilike.%${safe}%`,
      `source_id.ilike.%${safe}%`,
    ];
    const entry = await resolveAreaFilter(f.q);
    if (entry) {
      if (entry.locationStrings.length > 0) ors.push(`location.in.(${pgQuoted(entry.locationStrings)})`);
      if (entry.areaNames.length > 0) ors.push(`area.in.(${pgQuoted(entry.areaNames)})`);
    }
    q = q.or(ors.join(','));
  }

  const sort = f.sort ?? 'new';
  if (sort === 'price_asc') q = q.order('price', { ascending: true, nullsFirst: false });
  else if (sort === 'price_desc') q = q.order('price', { ascending: false, nullsFirst: false });
  else q = q.order('created_at', { ascending: false });

  const from = (page - 1) * pageSize;
  const { data, count, error } = await q.range(from, from + pageSize - 1);
  if (error) {
    console.error('searchProperties:', error.message);
    return { rows: [] as Property[], total: 0 };
  }
  return { rows: (data ?? []) as unknown as Property[], total: count ?? 0 };
}

/**
 * Count published properties for an area param — the SAME area-resolve +
 * published filter as `/properties?area=…` (no price/type/beds), so a homepage
 * region-tile number EQUALS the click-through result count. Descendants are
 * included by the resolver (Marbella pulls Nueva Andalucía etc. → overlap).
 */
export async function countPublishedInArea(areaParam: string): Promise<number> {
  const supabase = createStaticSupabaseClient();
  let q = supabase.from('properties').select('id', { count: 'exact', head: true }).eq('published', true);
  const entry = await resolveAreaFilter(areaParam);
  if (entry) {
    const ors: string[] = [];
    if (entry.locationStrings.length > 0) ors.push(`location.in.(${pgQuoted(entry.locationStrings)})`);
    if (entry.areaNames.length > 0) ors.push(`area.in.(${pgQuoted(entry.areaNames)})`);
    if (ors.length > 0) q = q.or(ors.join(',')); else return 0;
  } else {
    q = q.ilike('area', `%${areaParam.replaceAll('%', '')}%`);
  }
  const { count, error } = await q;
  if (error) { console.error('countPublishedInArea:', error.message); return 0; }
  return count ?? 0;
}

/**
 * Main search. Zero results never dead-ends: progressively relax
 * (features → beds → price → type) and surface 3 "closest matches",
 * reporting which constraints were dropped.
 */
export async function searchPropertiesPaged(f: SearchFilters): Promise<SearchResult> {
  const { rows, total } = await runPropertyQuery(f, f.page);
  if (total > 0) {
    return { rows, total, page: f.page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  }

  // Closest-matches ladder — most-specific constraint dropped first.
  const ladder: Array<{ drop: string[]; f: Partial<SearchFilters> }> = [
    { drop: ['feature'], f: { ...f, feat: undefined } },
    { drop: ['feature', 'bedrooms'], f: { ...f, feat: undefined, beds: undefined } },
    {
      drop: ['feature', 'bedrooms', 'price'],
      f: { ...f, feat: undefined, beds: undefined, minp: undefined, maxp: undefined },
    },
    {
      drop: ['feature', 'bedrooms', 'price', 'type'],
      f: { area: f.area, sort: f.sort },
    },
  ];
  for (const step of ladder) {
    const { rows: close, total: closeTotal } = await runPropertyQuery(step.f, 1, 3);
    if (closeTotal > 0) {
      return { rows: close.slice(0, 3), total: 0, page: 1, pages: 1, closest: { dropped: step.drop } };
    }
  }
  return { rows: [], total: 0, page: 1, pages: 1, closest: { dropped: [] } };
}

// ───────────────────────── developments ─────────────────────────

export interface DevSearchFilters {
  location?: string;
  beds?: number;
  minp?: number;
  maxp?: number;
  sort: SearchSort;
  page: number;
}

export function parseDevSearchParams(sp: RawParams): DevSearchFilters {
  const sort = one(sp.sort) as SearchSort | undefined;
  return {
    location: one(sp.location)?.slice(0, 60) || undefined,
    beds: posInt(one(sp.beds)),
    minp: posInt(one(sp.minp)),
    maxp: posInt(one(sp.maxp)),
    sort: sort && SEARCH_SORTS.includes(sort) ? sort : 'new',
    page: posInt(one(sp.page)) ?? 1,
  };
}

export interface DevSearchResult {
  rows: Development[];
  total: number;
  page: number;
  pages: number;
  closest?: { dropped: string[] };
}

const DEV_COLUMNS =
  'id,slug,name,developer,status,price_from,price_to,price_on_request,bedrooms_from,bedrooms_to,size_from,size_to,total_units,completion_date,location,area,hero_image,hero_image_blur,is_featured,short_description,created_at';

async function runDevQuery(f: Partial<DevSearchFilters>, page: number, pageSize = PAGE_SIZE) {
  const supabase = createStaticSupabaseClient();
  let q = supabase.from('developments').select(DEV_COLUMNS, { count: 'exact' }).eq('published', true);
  if (f.location) {
    const safe = f.location.replaceAll('%', '');
    q = q.or(`area.ilike.%${safe}%,location.ilike.%${safe}%`) as typeof q;
  }
  if (f.beds) q = q.gte('bedrooms_to', f.beds) as typeof q;
  if (f.minp) q = q.gte('price_from', f.minp) as typeof q;
  if (f.maxp) q = q.lte('price_from', f.maxp) as typeof q;
  if (f.sort === 'price_asc') q = q.order('price_from', { ascending: true, nullsFirst: false }) as typeof q;
  else if (f.sort === 'price_desc') q = q.order('price_from', { ascending: false, nullsFirst: false }) as typeof q;
  else q = q.order('created_at', { ascending: false }) as typeof q;
  const from = (page - 1) * pageSize;
  const { data, count, error } = await q.range(from, from + pageSize - 1);
  if (error) {
    console.error('searchDevelopments:', error.message);
    return { rows: [] as Development[], total: 0 };
  }
  return { rows: (data ?? []) as unknown as Development[], total: count ?? 0 };
}

export async function searchDevelopmentsPaged(f: DevSearchFilters): Promise<DevSearchResult> {
  const { rows, total } = await runDevQuery(f, f.page);
  if (total > 0) {
    return { rows, total, page: f.page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  }
  const ladder: Array<{ drop: string[]; f: Partial<DevSearchFilters> }> = [
    { drop: ['bedrooms'], f: { ...f, beds: undefined } },
    { drop: ['bedrooms', 'price'], f: { ...f, beds: undefined, minp: undefined, maxp: undefined } },
    { drop: ['bedrooms', 'price', 'location'], f: { sort: f.sort } },
  ];
  for (const step of ladder) {
    const { rows: close, total: closeTotal } = await runDevQuery(step.f, 1, 3);
    if (closeTotal > 0) {
      return { rows: close.slice(0, 3), total: 0, page: 1, pages: 1, closest: { dropped: step.drop } };
    }
  }
  return { rows: [], total: 0, page: 1, pages: 1, closest: { dropped: [] } };
}
