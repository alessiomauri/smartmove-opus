/**
 * Server-side helpers for the resales property detail re-skin.
 *
 * These only RESHAPE existing data for the ported design — they never
 * invent values. Photo URLs come from the image proxy; feature groups
 * come from the feed's `feature_labels` ("Category: Item" strings, the
 * existing grouping + dual-dialect dedup); the description is the feed's
 * per-locale copy.
 */
import type { Property, PropertyStatus } from '@/types/property';
import { STATUS_LABELS } from '@/types/property';

/**
 * The ordered photo set for the carousel. Resales rows store raw URLs in
 * `source_image_urls` and serve them through the image proxy at
 * `/p/{ref}/{index}` (gallery_images is empty for feed rows). photoCount
 * is therefore the real array length — no phantom "+N".
 */
export function resalesPhotoUrls(p: Property): string[] {
  if (p.gallery_images?.length) return p.gallery_images;
  const proxy = process.env.NEXT_PUBLIC_IMAGE_PROXY_URL?.replace(/\/$/, '');
  const ref = p.source_id;
  const n = p.source_image_urls?.length ?? 0;
  if (proxy && ref && n > 0) {
    return Array.from({ length: n }, (_, i) => `${proxy}/p/${ref}/${i}`);
  }
  if (p.source_image_urls?.length) return p.source_image_urls;
  return p.hero_image ? [p.hero_image] : [];
}

export interface FeatureGroup {
  label: string;
  items: string[];
}

/**
 * Group the feed's features by category for the design's 3-column block.
 * Prefers the page locale's labels, falls back to English, then to the
 * flat `features` array. Items are deduped within a group (dual-dialect
 * feeds can repeat the same amenity).
 */
export function resalesFeatureGroups(p: Property, locale: string): FeatureGroup[] {
  const labelled =
    (p.feature_labels?.[locale]?.length ? p.feature_labels[locale] : null) ??
    (p.feature_labels?.en?.length ? p.feature_labels.en : null) ??
    (p.features ?? []);
  const map = new Map<string, string[]>();
  for (const raw of labelled) {
    if (!raw) continue;
    const idx = raw.indexOf(': ');
    const cat = idx > 0 ? raw.slice(0, idx).trim() : 'Features';
    const item = (idx > 0 ? raw.slice(idx + 2) : raw).trim();
    if (!item) continue;
    const arr = map.get(cat) ?? [];
    if (!arr.includes(item)) arr.push(item);
    map.set(cat, arr);
  }
  return [...map.entries()].map(([label, items]) => ({ label, items }));
}

/** Per-locale description, split into paragraphs (EN fallback). */
export function resalesDescriptionParas(p: Property, locale: string): string[] {
  const text = (
    p.descriptions?.[locale] ||
    p.descriptions?.en ||
    p.description ||
    ''
  ).trim();
  if (!text) return [];
  const parts = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [text];
}

export interface StatusBadge {
  cls: 'status-available' | 'status-offer' | 'status-agreed';
  label: string;
}

/** Map our status → the design's three badge groups + label. */
export function resalesStatusBadge(status: PropertyStatus): StatusBadge {
  const label = STATUS_LABELS[status] ?? 'Available';
  switch (status) {
    case 'under_offer':
    case 'reserved':
      return { cls: 'status-offer', label };
    case 'sold':
    case 'coming_soon':
      return { cls: 'status-agreed', label };
    default:
      return { cls: 'status-available', label };
  }
}

/** Collapse repeated place tokens, e.g. "Estepona, Estepona" → "Estepona". */
export function dedupePlace(place: string | null | undefined): string {
  if (!place) return '';
  const seen = new Set<string>();
  return place
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
    .join(', ');
}

/** EUR price label (en-GB grouping), matching the design. */
export function resalesPriceLabel(p: Property): string | null {
  if (p.price_on_request || !p.price || p.price <= 0) return null;
  return `€${p.price.toLocaleString('en-GB')}`;
}

/** Energy-rating chip colours (from the design's ENERGY_COLORS). */
export const ENERGY_COLORS: Record<string, string> = {
  A: '#3a8a4f', B: '#5aa14a', C: '#9bbf3a', D: '#e3c52e',
  E: '#e39a2e', F: '#df6f2c', G: '#cf3b2c',
};

/** True when an energy letter is real (not the feed's "X"/blank). */
export function energyLetter(v: string | null | undefined): string | null {
  const s = (v ?? '').trim().toUpperCase();
  return s && s !== 'X' && ENERGY_COLORS[s] ? s : null;
}
