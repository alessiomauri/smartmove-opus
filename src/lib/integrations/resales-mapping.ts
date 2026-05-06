/**
 * Resales → Smartmove DB mapping.
 *
 * Phase 4 work: parsers that convert ResalesProperty / ResalesPropertyFull
 * shapes into our `Property` and `Development` row inputs, branching on
 * `PropertyType.NameType === "New Development"`.
 *
 * For now this is a typed scaffold. Implement against the saved sample JSONs
 * in `~/Desktop/smartmove-web-briefs/resales-samples/` BEFORE hitting the
 * live API — the samples cover every shape we need (single-language,
 * multi-language, search default, search filtered, sold tail, new development,
 * property details).
 *
 * Notes from the brief that will inform parser design:
 *   - Numerics come as strings in SearchProperties, numbers in PropertyDetails
 *   - Range strings on new developments: "1 - 2", "115000 - 150000"
 *   - 0/1 numeric booleans for Pool/Parking/Garden
 *   - Multi-language: nested per-locale objects when P_Lang has commas
 *   - Image URLs: strip ?v= cache-buster before keying R2
 *   - 15-day sold-property tail returns limited shape (Status=Sold, no Price/Beds/Image)
 */

import type { ResalesProperty, ResalesPropertyFull } from './resales';

export type CanonicalPropertyType =
  | 'apartment'
  | 'ground-floor-apartment'
  | 'middle-floor-apartment'
  | 'penthouse'
  | 'townhouse'
  | 'detached-villa'
  | 'plot'
  | 'unknown';

const TYPE_ID_MAP: Record<string, CanonicalPropertyType> = {
  '1-1': 'apartment',
  '1-2': 'ground-floor-apartment',
  '1-4': 'middle-floor-apartment',
  '1-6': 'penthouse',
  '2-1': 'detached-villa',
  '2-2': 'detached-villa',
  '2-5': 'townhouse',
  '3-1': 'plot',
  '3-2': 'plot',
};

export function mapPropertyType(p: ResalesProperty): CanonicalPropertyType {
  return TYPE_ID_MAP[p.PropertyType.SubtypeId1] ?? TYPE_ID_MAP[p.PropertyType.TypeId] ?? 'unknown';
}

export function isNewDevelopment(p: ResalesProperty): boolean {
  return p.PropertyType.NameType === 'New Development';
}

/**
 * Detect the 15-day sold-property tail (limited shape returned by Resales
 * for properties removed from the feed). Strategy: sold-tail rows have
 * Status === 'Sold' and lack the Price field.
 */
export function isSoldTail(p: ResalesProperty): boolean {
  return p.Status?.system === 'Sold' && !p.Price;
}

/**
 * Parse a range string like "1 - 2" or "115000 - 150000" into {from, to}.
 * Returns {from: n, to: n} for single values.
 */
export function parseRange(value: string | number): { from: number; to: number } {
  if (typeof value === 'number') return { from: value, to: value };
  const parts = String(value).split('-').map((s) => Number(s.trim()));
  if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return { from: parts[0], to: parts[1] };
  }
  const n = Number(value);
  return { from: Number.isFinite(n) ? n : 0, to: Number.isFinite(n) ? n : 0 };
}

/**
 * Strip the cache-buster query param from a Resales image URL so R2 keys
 * stay stable across requests.
 */
export function stripCacheBuster(url: string): string {
  return url.replace(/[?&]z=\d+/, '').replace(/[?&]v=\d+/, '').replace(/[?&]$/, '');
}

// Property and Development row mappers — Phase 4.
// Signatures committed below so callers can typecheck against them now.
// Implementations follow once the DB schema additions land in Supabase.

// export function mapToPropertyRow(p: ResalesProperty | ResalesPropertyFull): PropertyInput { … }
// export function mapToDevelopmentRow(p: ResalesProperty | ResalesPropertyFull): DevelopmentInput { … }
