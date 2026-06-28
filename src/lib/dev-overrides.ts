/**
 * Dev-content overrides (Phase E). Synced developments carry an admin-owned
 * `overrides` JSONB the sync never writes. Public rendering uses
 * overrides[field] ?? feed_column; a missing/empty key falls back to the feed.
 *
 * Only fields the CURRENT public dev page actually renders are listed here.
 * Developer / architect / interior-designer CREDITS are deliberately NOT
 * overridable and never surfaced (brand-leak rule).
 */
export const OVERRIDABLE_DEV_FIELDS = [
  'name',
  'subtitle',
  'title',
  'meta_description',
  'short_description',
  'description',
  'hero_image',
  'gallery_images',
  'amenities',
] as const;

export type OverridableDevField = (typeof OVERRIDABLE_DEV_FIELDS)[number];
const SET = new Set<string>(OVERRIDABLE_DEV_FIELDS);
export function isOverridableDevField(f: string): f is OverridableDevField {
  return SET.has(f);
}

/** Merge overrides over a development for the renderable fields. */
export function resolveDevOverrides<T extends object>(dev: T): T {
  const rec = dev as unknown as Record<string, unknown>;
  const ov = (rec.overrides ?? null) as Record<string, unknown> | null;
  if (!ov || typeof ov !== 'object') return dev;
  const merged: Record<string, unknown> = { ...rec };
  for (const f of OVERRIDABLE_DEV_FIELDS) {
    const v = ov[f];
    if (v !== undefined && v !== null && !(typeof v === 'string' && v === '')) {
      merged[f] = v;
    }
  }
  return merged as unknown as T;
}
