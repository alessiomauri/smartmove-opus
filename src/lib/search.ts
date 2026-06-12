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
  feat?: string;
  sort: SearchSort;
  page: number;
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
    feat: one(sp.feat)?.slice(0, 40) || undefined,
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

async function runPropertyQuery(f: Partial<SearchFilters>, page: number, pageSize = PAGE_SIZE) {
  const supabase = createStaticSupabaseClient();
  let q = supabase
    .from('properties')
    .select(PROPERTY_LIST_COLUMNS, { count: 'exact' })
    .eq('published', true);

  if (f.area) q = q.ilike('area', `%${f.area.replaceAll('%', '')}%`);
  if (f.type) q = q.eq('property_type', f.type);
  if (f.beds) q = q.gte('bedrooms', f.beds);
  if (f.minp) q = q.gte('price', f.minp);
  if (f.maxp) q = q.lte('price', f.maxp);
  // features_text: generated flat projection of the features text[].
  if (f.feat) q = q.ilike('features_text', `%${f.feat.replaceAll('%', '')}%`);

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
