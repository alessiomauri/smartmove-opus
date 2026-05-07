/**
 * Resales → Smartmove DB row mapping.
 *
 * Two parser entry points:
 *   - mapToPropertyRow(p): for resale properties (SearchProperties or
 *     PropertyDetails shape, single-lang or multi-lang)
 *   - mapToDevelopmentRow(p): for new developments (same endpoints,
 *     discriminated by PropertyType.NameType === 'New Development')
 *
 * Each returns a `Partial<{ ... }>` keyed to our DB columns. The sync
 * orchestrator upserts these by (source = 'resales_online', source_id).
 *
 * Both shapes (SearchProperties' lighter row, PropertyDetails' richer
 * row with Pictures + EnergyRating + GPS) are accepted; missing fields
 * are simply omitted from the output.
 *
 * Multi-language responses are detected by inspecting the response shape:
 *   - Single-lang: `Description: "..."`, `PropertyType: { NameType, ... }`
 *   - Multi-lang:  `Description: { en, es, ... }`, `PropertyType: { en: {...}, es: {...} }`
 *
 * The parser is pure (no DB calls). Use the returned partial as the input
 * to a Supabase `.upsert(..., { onConflict: 'source,source_id' })`.
 *
 * Tested against all 10 saved sample JSONs in
 * `~/Desktop/smartmove-web-briefs/resales-samples/`.
 */

import { slugify } from '@/lib/utils';
import type { PropertyType, PropertyStatus } from '@/types/property';

// ────────────────────────────────────────────────── Resales raw shapes

type StringOrNumber = string | number;

interface ResalesPropertyTypeBlock {
  NameType: string;
  Type: string;
  TypeId: string;
  Subtype1?: string;
  SubtypeId1?: string;
}

interface ResalesPicture {
  Id: number | string;
  PictureURL: string;
}

interface ResalesEnergyRating {
  CO2Rated?: string;
  CO2Value?: string;
  EnergyRated?: string;
  EnergyValue?: string;
  Image?: string;
}

/** Locale-keyed object — `'en' | 'es' | 'de' | …` → T. */
type LocaleMap<T> = Partial<Record<string, T>>;

interface ResalesFeatureCategory {
  Type: string;          // e.g. 'Pool', 'Setting', 'Garden' (localised)
  Value: string[];       // e.g. ['Private'], ['Beachfront']
}

export interface ResalesPropertyRaw {
  Reference: string;
  AgencyRef?: string;
  LastUpdated?: string;
  Country?: string;
  Province?: string;
  Area?: string;
  Location?: string;
  SubLocation?: string;
  PropertyType: ResalesPropertyTypeBlock | LocaleMap<ResalesPropertyTypeBlock>;
  Status?: { system?: string } & LocaleMap<string>;
  Bedrooms?: StringOrNumber;
  Bathrooms?: StringOrNumber;
  Currency?: string;
  Price?: StringOrNumber;
  OriginalPrice?: number;
  Dimensions?: 'Metres' | 'Feet';
  Built?: StringOrNumber;
  Terrace?: StringOrNumber;
  GardenPlot?: StringOrNumber;
  CO2Rated?: string;
  EnergyRated?: string;
  OwnProperty?: '0' | '1';
  Pool?: 0 | 1;
  Parking?: 0 | 1;
  Garden?: 0 | 1;
  Description?: string | LocaleMap<string>;
  PropertyFeatures?:
    | { Category?: ResalesFeatureCategory[] }
    | LocaleMap<{ Category?: ResalesFeatureCategory[] }>;
  MainImage?: string;
  Pictures?: { Count?: string; Picture?: ResalesPicture[] };
  EnergyRating?: ResalesEnergyRating;
  GpsX?: string;
  GpsY?: string;
  Decree218?: '0' | '1';
  Community_Fees_Year?: string | number;
  Basura_Tax_Year?: string | number;
  IBI_Fees_Year?: string | number;
  CompletionDate?: string;
  BuiltYear?: string;
  PaymentTerms?: {
    ContractPercentage?: string;
    ConstructionPercentage?: string;
    CompletionPercentage?: string;
  };
  PublicDocuments?: {
    type?: string;
    order?: string;
    URL?: string;
    captions?: string[];
  };
}

// ────────────────────────────────────────────────── DB row shapes

export interface PropertyInsertRow {
  source: 'resales_online';
  source_id: string;
  source_agency_ref?: string | null;
  source_image_urls: string[];
  last_synced_at: string;
  pending_review: boolean;
  // Slug + visible content
  name: string;
  slug: string;
  status: PropertyStatus;
  property_type: PropertyType;
  resales_type_id?: string | null;
  resales_subtype_id?: string | null;
  // Numerics
  price: number | null;
  price_on_request: boolean;
  bedrooms: number | null;
  bathrooms: number | null;
  interior_size: number | null;
  terrace_size: number | null;
  plot_size: number | null;
  has_pool: boolean;
  parking_spaces: number | null;
  // Location
  location: string;
  area: string;
  description: string;             // canonical English fallback
  descriptions: Record<string, string>;
  property_type_labels: Record<string, string>;
  feature_labels: Record<string, string[]>;
  features: string[];
  // Images
  hero_image: string;
  // Resales extras
  own_property: boolean;
  community_fees_year: number | null;
  basura_tax_year: number | null;
  ibi_fees_year: number | null;
  energy_rated: string | null;
  co2_rated: string | null;
  decree_218: boolean | null;
  built_year: string | null;
  completion_date: string | null;
  latitude: number | null;
  longitude: number | null;
  published: boolean;
}

export interface DevelopmentInsertRow {
  source: 'resales_online';
  source_id: string;
  last_synced_at: string;
  pending_review: boolean;
  name: string;
  slug: string;
  status: 'off_plan' | 'under_construction' | 'key_ready' | 'completed' | 'sold_out';
  description: string;
  descriptions: Record<string, string>;
  // Ranges
  price_from: number | null;
  price_to: number | null;
  price_on_request: boolean;
  bedrooms_from: number | null;
  bedrooms_to: number | null;
  bathrooms_from: number | null;
  bathrooms_to: number | null;
  size_from: number | null;
  size_to: number | null;
  terrace_size_from: number | null;
  terrace_size_to: number | null;
  // Location
  location: string;
  area: string;
  latitude: number | null;
  longitude: number | null;
  // Images
  hero_image: string;
  source_image_urls: string[];
  // Off-plan extras
  payment_terms: Record<string, string>;
  brochure_pdf: string | null;
  completion_date: string | null;
  own_property: boolean;
  published: boolean;
}

// ────────────────────────────────────────────────── Helpers

const RANGE_RE = /^\s*(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)\s*$/;

/** Parse a single number, range string, or numeric value. */
export function parseRange(value: StringOrNumber | undefined): { from: number | null; to: number | null } {
  if (value == null) return { from: null, to: null };
  if (typeof value === 'number') return { from: value, to: value };
  const trimmed = value.trim();
  if (!trimmed) return { from: null, to: null };
  const m = RANGE_RE.exec(trimmed);
  if (m) return { from: Number(m[1]), to: Number(m[2]) };
  const n = Number(trimmed);
  return { from: Number.isFinite(n) ? n : null, to: Number.isFinite(n) ? n : null };
}

/** Coerce a Resales numeric (string|number) to number or null. */
function num(value: StringOrNumber | undefined | null): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** 0/1 boolean number → boolean. */
function bool(value: 0 | 1 | undefined | null): boolean {
  return value === 1;
}

/** Strip Resales image cache-buster (`?v=…` or `?z=…`). Stable R2 keys. */
export function stripCacheBuster(url: string): string {
  return url.replace(/[?&](v|z)=\d+/g, '').replace(/[?&]$/, '').replace(/\?$/, '');
}

/** Map TypeId/SubtypeId1 → our internal PropertyType enum. */
const TYPE_ID_MAP: Record<string, PropertyType> = {
  '1-1': 'apartment',
  '1-2': 'apartment',         // Ground Floor
  '1-3': 'apartment',
  '1-4': 'apartment',         // Middle Floor
  '1-5': 'apartment',         // Top Floor
  '1-6': 'penthouse',
  '1-7': 'apartment',
  '2-1': 'villa',
  '2-2': 'villa',             // Detached Villa
  '2-3': 'villa',
  '2-4': 'villa',             // Semi-Detached
  '2-5': 'townhouse',
  '2-6': 'villa',
  '3-1': 'plot_with_project',
  '3-2': 'plot_with_project',
};

export function mapPropertyType(typeId: string | undefined, subtypeId: string | undefined): PropertyType {
  return TYPE_ID_MAP[subtypeId ?? ''] ?? TYPE_ID_MAP[typeId ?? ''] ?? 'villa';
}

/** Resales status string → our property_status enum. */
export function mapStatus(systemStatus: string | undefined): PropertyStatus {
  switch ((systemStatus ?? '').toLowerCase()) {
    case 'available': return 'available';
    case 'sold':      return 'sold';
    case 'reserved': return 'reserved';
    case 'under offer':
    case 'underoffer': return 'under_offer';
    case 'coming soon':
    case 'comingsoon': return 'coming_soon';
    default:          return 'available';
  }
}

/** Detect whether a PropertyType block is locale-nested or flat. */
function isLocaleNested<T>(block: T | LocaleMap<T>): block is LocaleMap<T> {
  if (!block || typeof block !== 'object') return false;
  const keys = Object.keys(block);
  // Locale-nested has 2-letter keys ('en', 'es', 'de', 'fr', ...)
  return keys.length > 0 && keys.every((k) => /^[a-z]{2}$/.test(k));
}

/** Extract the canonical English (or default) PropertyType block. */
function getCanonicalTypeBlock(
  pt: ResalesPropertyTypeBlock | LocaleMap<ResalesPropertyTypeBlock>
): ResalesPropertyTypeBlock {
  if (isLocaleNested(pt)) {
    return pt.en ?? pt.es ?? Object.values(pt)[0] ?? ({} as ResalesPropertyTypeBlock);
  }
  return pt;
}

/** Detect the new-development discriminator across both shapes. */
export function isNewDevelopment(p: ResalesPropertyRaw): boolean {
  const block = getCanonicalTypeBlock(p.PropertyType);
  return block.NameType === 'New Development';
}

/** Detect the 15-day sold-property tail (limited shape, no Price). */
export function isSoldTail(p: ResalesPropertyRaw): boolean {
  return p.Status?.system === 'Sold' && p.Price == null;
}

/** Build a {locale: NameType} map from PropertyType. */
function pickPropertyTypeLabels(
  pt: ResalesPropertyTypeBlock | LocaleMap<ResalesPropertyTypeBlock>
): Record<string, string> {
  if (isLocaleNested(pt)) {
    const out: Record<string, string> = {};
    for (const [locale, block] of Object.entries(pt)) {
      if (block?.NameType) out[locale] = block.NameType;
    }
    return out;
  }
  return pt.NameType ? { en: pt.NameType } : {};
}

/** Build a {locale: description} map from Description. */
function pickDescriptions(d: string | LocaleMap<string> | undefined): Record<string, string> {
  if (!d) return {};
  if (typeof d === 'string') return { en: d };
  const out: Record<string, string> = {};
  for (const [locale, val] of Object.entries(d)) {
    if (val) out[locale] = val;
  }
  return out;
}

/** Flatten PropertyFeatures into a string[] (English by default). */
function flattenFeatures(
  pf: ResalesPropertyRaw['PropertyFeatures']
): string[] {
  if (!pf) return [];
  // Multi-lang: prefer English, then any other locale, else first
  if (isLocaleNested(pf)) {
    const cats = pf.en?.Category ?? pf.es?.Category ?? Object.values(pf)[0]?.Category ?? [];
    return cats.flatMap((c) => c.Value.map((v) => `${c.Type}: ${v}`));
  }
  // Single-lang
  return (pf.Category ?? []).flatMap((c) =>
    c.Value.map((v) => `${c.Type}: ${v}`)
  );
}

/** Build {locale: ['Pool: Private', 'Garden: Communal', …]} from PropertyFeatures. */
function pickFeatureLabels(
  pf: ResalesPropertyRaw['PropertyFeatures']
): Record<string, string[]> {
  if (!pf) return {};
  if (isLocaleNested(pf)) {
    const out: Record<string, string[]> = {};
    for (const [locale, block] of Object.entries(pf)) {
      const cats = block?.Category ?? [];
      out[locale] = cats.flatMap((c) => c.Value.map((v) => `${c.Type}: ${v}`));
    }
    return out;
  }
  return { en: flattenFeatures(pf) };
}

/** Pick the canonical Description string (EN preferred). */
function pickCanonicalDescription(d: string | LocaleMap<string> | undefined): string {
  if (!d) return '';
  if (typeof d === 'string') return d;
  return d.en ?? d.es ?? Object.values(d).find(Boolean) ?? '';
}

/** Image URL list: prefer Pictures[] (PropertyDetails), fall back to MainImage (SearchProperties). */
function pickImageUrls(p: ResalesPropertyRaw): string[] {
  if (p.Pictures?.Picture?.length) {
    return p.Pictures.Picture.map((pic) => stripCacheBuster(pic.PictureURL));
  }
  if (p.MainImage) return [stripCacheBuster(p.MainImage)];
  return [];
}

/** Resales GpsX/GpsY are sometimes "0" or empty. Treat both as null. */
function parseGps(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}

/**
 * Build the public hero URL for a property/development. Routes through
 * the Cloudflare image proxy when configured (lazy-fills R2, edge-cached);
 * falls back to the canonical Resales URL when the proxy isn't set.
 */
function buildHeroUrl(
  kind: 'p' | 'd',
  reference: string,
  fallbackSourceUrl: string | undefined
): string {
  const proxy = process.env.NEXT_PUBLIC_IMAGE_PROXY_URL;
  if (proxy && reference) {
    return `${proxy.replace(/\/$/, '')}/${kind}/${reference}/0`;
  }
  return fallbackSourceUrl ?? '';
}

// ────────────────────────────────────────────────── Public mappers

/**
 * Convert a Resales property row → Smartmove `properties` Insert row.
 * Caller decides the upsert key (`source = 'resales_online', source_id`).
 *
 * @param p           The raw Resales property
 * @param ownProperty Override for the OwnProperty flag if known from
 *                    another field (otherwise reads `p.OwnProperty`)
 */
export function mapToPropertyRow(
  p: ResalesPropertyRaw,
  opts: { autoApprove?: boolean } = {}
): PropertyInsertRow {
  const canonicalType = getCanonicalTypeBlock(p.PropertyType);
  const descriptions = pickDescriptions(p.Description);
  const description = pickCanonicalDescription(p.Description);
  const propertyTypeLabels = pickPropertyTypeLabels(p.PropertyType);
  const featureLabels = pickFeatureLabels(p.PropertyFeatures);
  const features = featureLabels.en ?? flattenFeatures(p.PropertyFeatures);
  const sourceImageUrls = pickImageUrls(p);
  const isOwn = p.OwnProperty === '1';
  const status = mapStatus(p.Status?.system);

  // Slug: prefer description-derived if we have a sensible "Property in Location",
  // otherwise fall back to the Reference. Stable across syncs.
  const fallbackName = `${canonicalType.NameType ?? 'Property'} in ${p.Location ?? p.Area ?? 'Marbella'}`;
  const slug = slugify(`${fallbackName}-${p.Reference}`).slice(0, 80);

  return {
    source: 'resales_online',
    source_id: p.Reference,
    source_agency_ref: p.AgencyRef ?? null,
    source_image_urls: sourceImageUrls,
    last_synced_at: new Date().toISOString(),
    pending_review: !(opts.autoApprove ?? isOwn),
    // Visible content
    name: fallbackName,
    slug,
    status,
    property_type: mapPropertyType(canonicalType.TypeId, canonicalType.SubtypeId1),
    resales_type_id: canonicalType.TypeId ?? null,
    resales_subtype_id: canonicalType.SubtypeId1 ?? null,
    // Numerics
    price: num(p.Price),
    price_on_request: p.Price == null || p.Price === '' || p.Price === 0,
    bedrooms: num(p.Bedrooms),
    bathrooms: num(p.Bathrooms),
    interior_size: num(p.Built),
    terrace_size: num(p.Terrace),
    plot_size: num(p.GardenPlot),
    has_pool: bool(p.Pool),
    parking_spaces: bool(p.Parking) ? 1 : null,
    // Location
    location: [p.Location, p.SubLocation].filter(Boolean).join(', ') || (p.Area ?? ''),
    area: p.Location ?? p.Area ?? '',
    description,
    descriptions,
    property_type_labels: propertyTypeLabels,
    feature_labels: featureLabels,
    features,
    // Images
    hero_image: buildHeroUrl('p', p.Reference, sourceImageUrls[0]),
    // Resales extras
    own_property: isOwn,
    community_fees_year: num(p.Community_Fees_Year),
    basura_tax_year: num(p.Basura_Tax_Year),
    ibi_fees_year: num(p.IBI_Fees_Year),
    energy_rated: p.EnergyRating?.EnergyRated || p.EnergyRated || null,
    co2_rated: p.EnergyRating?.CO2Rated || p.CO2Rated || null,
    decree_218: p.Decree218 === '1' ? true : p.Decree218 === '0' ? false : null,
    built_year:
      p.BuiltYear && p.BuiltYear !== 'Unknown' ? p.BuiltYear : null,
    completion_date:
      p.CompletionDate && p.CompletionDate !== '1970-01-01' ? p.CompletionDate : null,
    latitude: parseGps(p.GpsY),  // Resales puts lat in GpsY (Y-axis)
    longitude: parseGps(p.GpsX),
    // Approval-driven publication: pending → not public; auto-approved own → public
    published: opts.autoApprove ?? isOwn ? status !== 'sold' : false,
  };
}

/**
 * Convert a Resales new-development row → Smartmove `developments` Insert row.
 * Range fields (Bedrooms/Bathrooms/Price/Built/Terrace/GardenPlot) are parsed
 * via parseRange so single values become {from, to}.
 */
export function mapToDevelopmentRow(
  p: ResalesPropertyRaw,
  opts: { autoApprove?: boolean } = {}
): DevelopmentInsertRow {
  const canonicalType = getCanonicalTypeBlock(p.PropertyType);
  const descriptions = pickDescriptions(p.Description);
  const description = pickCanonicalDescription(p.Description);
  const sourceImageUrls = pickImageUrls(p);
  const isOwn = p.OwnProperty === '1';

  const beds = parseRange(p.Bedrooms);
  const baths = parseRange(p.Bathrooms);
  const price = parseRange(p.Price);
  const built = parseRange(p.Built);
  const terrace = parseRange(p.Terrace);

  const fallbackName = `New Development in ${p.Location ?? p.Area ?? 'Marbella'}`;
  const slug = slugify(`${fallbackName}-${p.Reference}`).slice(0, 80);

  const paymentTerms: Record<string, string> = {};
  if (p.PaymentTerms?.ContractPercentage) paymentTerms.contract = p.PaymentTerms.ContractPercentage;
  if (p.PaymentTerms?.ConstructionPercentage) paymentTerms.construction = p.PaymentTerms.ConstructionPercentage;
  if (p.PaymentTerms?.CompletionPercentage) paymentTerms.completion = p.PaymentTerms.CompletionPercentage;

  return {
    source: 'resales_online',
    source_id: p.Reference,
    last_synced_at: new Date().toISOString(),
    pending_review: !(opts.autoApprove ?? isOwn),
    name: fallbackName,
    slug,
    status: 'off_plan',
    description,
    descriptions,
    price_from: price.from,
    price_to: price.to,
    price_on_request: price.from == null,
    bedrooms_from: beds.from,
    bedrooms_to: beds.to,
    bathrooms_from: baths.from,
    bathrooms_to: baths.to,
    size_from: built.from,
    size_to: built.to,
    terrace_size_from: terrace.from,
    terrace_size_to: terrace.to,
    location: [p.Location, p.SubLocation].filter(Boolean).join(', ') || (p.Area ?? ''),
    area: p.Location ?? p.Area ?? '',
    latitude: parseGps(p.GpsY),
    longitude: parseGps(p.GpsX),
    hero_image: buildHeroUrl('d', p.Reference, sourceImageUrls[0]),
    source_image_urls: sourceImageUrls,
    payment_terms: paymentTerms,
    brochure_pdf: p.PublicDocuments?.URL || null,
    completion_date:
      p.CompletionDate && p.CompletionDate !== '1970-01-01' ? p.CompletionDate : null,
    own_property: isOwn,
    published: opts.autoApprove ?? isOwn,
  };
}

/** Top-level convenience: branch by NameType and return the right row type. */
export type AnyInsertRow =
  | { kind: 'property'; row: PropertyInsertRow }
  | { kind: 'development'; row: DevelopmentInsertRow };

export function mapToRow(
  p: ResalesPropertyRaw,
  opts: { autoApprove?: boolean } = {}
): AnyInsertRow {
  return isNewDevelopment(p)
    ? { kind: 'development', row: mapToDevelopmentRow(p, opts) }
    : { kind: 'property', row: mapToPropertyRow(p, opts) };
}
