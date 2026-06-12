/**
 * Canonical area resolution for SEARCH (fixes the raw-Location bug).
 *
 * An area filter means "everything mapped under this area" — the same
 * system the map and /areas pages use — never a raw string match on
 * the feed's Location column:
 *
 *   1. the area itself + ALL descendant areas (areas.parent_area —
 *      Marbella pulls Nueva Andalucía, Marbella East, their micros…);
 *   2. every approved resales_location_mapping pair under those slugs,
 *      projected to the EXACT `properties.location` strings the sync
 *      writes ('Location' bare, or 'Location, SubLocation');
 *   3. curated/manual rows, whose `area` column carries our area NAMES
 *      directly.
 *
 * Pure builder (testable with fixtures); the cached DB wrapper lives in
 * cache.ts. Slug/name lookups are diacritic- and case-insensitive
 * ("Benahavís" ≡ "benahavis").
 */

export interface AreaNode {
  slug: string;
  name: string;
  parent_area: string | null;
}

export interface MappingRow {
  location: string;
  sublocation: string;
  proposed_area_slug: string | null;
  approved: boolean;
}

export interface AreaFilterEntry {
  slug: string;
  /** This area + every descendant (slugs). */
  slugs: string[];
  /** Curated area NAMES under this node (manual rows' `area` values). */
  areaNames: string[];
  /** Exact `properties.location` strings mapped under this node. */
  locationStrings: string[];
}

export function normalizeAreaKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export interface AreaFilterIndex {
  /** normalized slug AND normalized name → entry */
  byKey: Map<string, AreaFilterEntry>;
  entries: AreaFilterEntry[];
}

export function buildAreaFilterIndex(
  areas: AreaNode[],
  mappings: MappingRow[]
): AreaFilterIndex {
  const children = new Map<string, string[]>();
  for (const a of areas) {
    if (!a.parent_area) continue;
    children.set(a.parent_area, [...(children.get(a.parent_area) ?? []), a.slug]);
  }
  const descendants = (slug: string): string[] => {
    const kids = children.get(slug) ?? [];
    return kids.flatMap((k) => [k, ...descendants(k)]);
  };

  const mappedBySlug = new Map<string, string[]>();
  for (const m of mappings) {
    if (!m.approved || !m.proposed_area_slug) continue;
    const str = m.sublocation ? `${m.location}, ${m.sublocation}` : m.location;
    mappedBySlug.set(m.proposed_area_slug, [
      ...(mappedBySlug.get(m.proposed_area_slug) ?? []),
      str,
    ]);
  }

  const bySlug = new Map(areas.map((a) => [a.slug, a]));
  const byKey = new Map<string, AreaFilterEntry>();
  const entries: AreaFilterEntry[] = [];

  for (const a of areas) {
    const slugs = [a.slug, ...descendants(a.slug)];
    const entry: AreaFilterEntry = {
      slug: a.slug,
      slugs,
      areaNames: slugs.map((s) => bySlug.get(s)?.name).filter((n): n is string => !!n),
      locationStrings: [...new Set(slugs.flatMap((s) => mappedBySlug.get(s) ?? []))],
    };
    entries.push(entry);
    byKey.set(normalizeAreaKey(a.slug), entry);
    byKey.set(normalizeAreaKey(a.name), entry);
  }

  return { byKey, entries };
}

/** Resolve a user-supplied area param (slug, name, accents optional). */
export function resolveAreaEntry(
  index: AreaFilterIndex,
  param: string
): AreaFilterEntry | null {
  return index.byKey.get(normalizeAreaKey(param)) ?? null;
}
