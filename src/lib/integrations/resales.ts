/**
 * Resales Online V6 API client.
 *
 * Goes through a Cloudflare Worker proxy (`RESALES_PROXY_URL`) which holds
 * the `p1` + `p2` credentials and the `P_sandbox` toggle. The proxy keeps
 * credentials out of browsers, server logs, and referrer headers — see
 * RESALES_API_REFERENCE.md §2 for the why.
 *
 * Endpoints exposed (all read-only):
 *   - searchProperties       — paginated property + development listing
 *   - propertyDetails        — full single-property fetch (multi-language)
 *   - searchFeatures         — feature taxonomy (cached)
 *   - searchLocations        — location taxonomy (cached)
 *   - searchPropertyTypes    — property type taxonomy (cached)
 *
 * NOT exposed: `registerLead`. Smartmove's lead pipeline is local DB +
 * Monday CRM only (SMARTMOVE_BRIEF §4.5). Do not add a registerLead wrapper.
 *
 * Pagination is session-based: the first response's `QueryInfo.QueryId` must
 * be passed back as `P_QueryId` on subsequent page calls. See
 * RESALES_API_REFERENCE.md §8.
 *
 * Types are based on the confirmed sample responses in
 * `~/Desktop/smartmove-web-briefs/resales-samples/`.
 */

// ─────────────────────────────────────────────────────────────── Types

export interface ResalesEnvelope<T> {
  transaction: {
    status: 'success' | 'error';
    incomingIp: string;
    version: string;
    service: string;
    datetime: string;
  };
  QueryInfo: {
    ApiId: string;
    QueryId: string;
    SearchType: string;
    PropertyCount: number;
    CurrentPage: number;
    PropertiesPerPage: number;
  };
  Property: T[];
}

export interface ResalesProperty {
  Reference: string;
  AgencyRef: string;
  LastUpdated?: string; // present when p_ShowLastUpdateDate=true
  Country: string;
  Province: string;
  Area: string;
  Location: string;
  SubLocation: string;
  PropertyType: {
    NameType: string;
    Type: string;
    TypeId: string;
    Subtype1: string;
    SubtypeId1: string;
  };
  Status: { system: string; en?: string; es?: string; [locale: string]: string | undefined };
  Bedrooms: string;
  Bathrooms: string;
  Currency: string;
  Price: string;
  OriginalPrice: number;
  Dimensions: 'Metres' | 'Feet';
  Built: number | string;
  Terrace: number | string;
  GardenPlot: number | string;
  CO2Rated: string;
  EnergyRated: string;
  OwnProperty: '0' | '1';
  Pool: 0 | 1;
  Parking: 0 | 1;
  Garden: 0 | 1;
  Description: string;
  PropertyFeatures: {
    Category: Array<{ Type: string; Value: string[] }>;
  };
  MainImage: string;
}

export interface ResalesPropertyFull extends ResalesProperty {
  Pictures: { Count: string; Picture: Array<{ Id: string; PictureURL: string }> };
  EnergyRating?: { CO2Rated?: string; CO2Value?: string; EnergyRated?: string; EnergyValue?: string; Image?: string };
  GpsX?: string;
  GpsY?: string;
  Decree218?: '0' | '1';
  Community_Fees_Year?: string;
  Basura_Tax_Year?: string;
  IBI_Fees_Year?: string;
  CompletionDate?: string;
  BuiltYear?: string;
}

export type ResalesLang = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 13 | 14;
export const RESALES_LANG = {
  en: 1, es: 2, de: 3, fr: 4, nl: 5, da: 6, ru: 7, sv: 8, pl: 9, no: 10, tr: 11, fi: 13, hu: 14,
} as const satisfies Record<string, ResalesLang>;

// ────────────────────────────────────────────────────────────── Client

function proxyUrl(): string {
  const url = process.env.RESALES_PROXY_URL;
  if (!url) {
    throw new Error(
      'RESALES_PROXY_URL is not set. The Cloudflare Worker proxy must be deployed and ' +
      'its public URL added to .env.local. See workers/resales-proxy/README.md.'
    );
  }
  return url.replace(/\/$/, '');
}

async function call<T>(endpoint: string, params: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(`${proxyUrl()}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }
  // 20s ceiling — one stuck upstream call must not hold a sync request
  // (or its serverless function) open indefinitely.
  const res = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`Resales ${endpoint} ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// ───────────────────────────────────────────────────────────── Endpoints

export interface SearchPropertiesOpts {
  agencyFilterId?: number;
  page?: number;
  pageSize?: number;
  queryId?: string;
  lang?: ResalesLang;
  showLastUpdateDate?: boolean;
  sortType?: number;
  beds?: number | string;
  propertyTypes?: string;
  location?: string;
  newDevs?: boolean;
  mustHaveFeatures?: boolean;
  features?: string[];
}

export async function searchProperties(opts: SearchPropertiesOpts = {}): Promise<ResalesEnvelope<ResalesProperty>> {
  const params: Record<string, string | number | boolean | undefined> = {
    p_agency_filterid: opts.agencyFilterId ?? 1,
    P_PageNo: opts.page,
    P_PageSize: opts.pageSize ?? 50,
    P_QueryId: opts.queryId,
    P_Lang: opts.lang,
    p_ShowLastUpdateDate: opts.showLastUpdateDate,
    p_SortType: opts.sortType,
    P_Beds: opts.beds,
    P_PropertyTypes: opts.propertyTypes,
    P_Location: opts.location,
    P_New_Devs: opts.newDevs,
    P_MustHaveFeatures: opts.mustHaveFeatures ? 1 : undefined,
  };
  for (const f of opts.features ?? []) params[f] = 1;
  return call<ResalesEnvelope<ResalesProperty>>('SearchProperties', params);
}

export interface PropertyDetailsOpts {
  reference: string;
  langs?: ResalesLang[];
  showGPSCoords?: boolean;
  showDecree218?: boolean;
}

export async function propertyDetails(opts: PropertyDetailsOpts): Promise<ResalesEnvelope<ResalesPropertyFull>> {
  return call<ResalesEnvelope<ResalesPropertyFull>>('PropertyDetails', {
    p_agency_filterid: 1,
    P_RefId: opts.reference,
    P_Lang: (opts.langs ?? [RESALES_LANG.en, RESALES_LANG.es]).join(','),
    P_ShowGPSCoords: opts.showGPSCoords ? 'TRUE' : undefined,
    P_showdecree218: opts.showDecree218 ? 'YES' : undefined,
  });
}

export async function searchFeatures(opts: { lang?: ResalesLang } = {}): Promise<unknown> {
  return call('SearchFeatures', { p_agency_filterid: 1, P_Lang: opts.lang ?? RESALES_LANG.en });
}

export async function searchLocations(opts: { lang?: ResalesLang; all?: boolean } = {}): Promise<unknown> {
  return call('SearchLocations', { p_agency_filterid: 1, P_Lang: opts.lang ?? RESALES_LANG.en, P_All: opts.all ? 'TRUE' : undefined });
}

export async function searchPropertyTypes(opts: { lang?: ResalesLang } = {}): Promise<unknown> {
  return call('SearchPropertyTypes', { p_agency_filterid: 1, P_Lang: opts.lang ?? RESALES_LANG.en });
}
