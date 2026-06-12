/**
 * Quiz ENGINE (Prompt 6) — pure types + scoring. Definitions live in
 * the `quizzes` table (JSONB, shape documented in docs/QUIZZES.md); one
 * renderer consumes any definition; adding a quiz is an INSERT.
 *
 * CURATION RULE (hard): result cards may only surface curated content —
 * published areas from the guide, published developments, and listings
 * from the curated universe (non-Resales or admin-featured). The
 * resolvers below enforce it by construction: they match weights
 * against pools the caller fetched through the curated fetchers, so an
 * unpublished target in a weight map simply never surfaces.
 */

export type QuizStatus = 'live' | 'draft';
export type QuestionKind = 'photo' | 'cards' | 'slider';
/** Shared-core fields recorded onto the lead for cross-quiz comparability. */
export type CoreField = 'budget' | 'timeline' | 'purpose' | 'party' | 'area_pref';

export interface QuizOption {
  id: string;
  label: string;
  sublabel?: string;
  /** `area:<slug>` token (resolved to that area's hero image) or a URL. */
  photo?: string;
  /** target → score. Area quizzes target area slugs; dev quizzes target
   * `crit:<dimension>:<value>` tokens (see resolveDevelopmentMatches). */
  weights: Record<string, number>;
  /** Human-readable answer recorded on the lead (defaults to label). */
  record?: string;
  /** One line of reactive feedback shown right after picking this. */
  feedback?: string;
}

export interface QuizQuestion {
  id: string;
  kind: QuestionKind;
  text: string;
  sub?: string;
  core?: CoreField | null;
  options: QuizOption[];
}

export interface QuizIntro {
  eyebrow?: string;
  heading: string;
  sub?: string;
  cta?: string;
  estimate?: string;
}

export interface QuizResultConfig {
  kind: 'area' | 'development';
  count: number;
  headline: string;
  sub?: string;
  guideNote?: string;
  cta?: { label: string; sub?: string };
}

export interface QuizDefinition {
  slug: string;
  title: string;
  status: QuizStatus;
  intro: QuizIntro;
  questions: QuizQuestion[];
  result: QuizResultConfig;
}

// ── Pools (already curated by the fetchers that build them) ──

export interface AreaPoolItem {
  slug: string;
  name: string;
  hero_image: string | null;
  hero_image_blur?: string | null;
  subheading?: string | null;
}

export interface ListingPoolItem {
  slug: string;
  name: string;
  area: string;
  location: string;
  hero_image: string | null;
  price: number | null;
  price_on_request: boolean | null;
  bedrooms: number | null;
}

export interface DevPoolItem {
  id: string;
  slug: string;
  name: string;
  area: string | null;
  location: string | null;
  hero_image: string | null;
  status: string;
  price_from: number | null;
  completion_date: string | null;
}

/** Resolve a `area:<slug>` photo token (or pass a URL through). */
export function resolvePhoto(ref: string | undefined, areas: AreaPoolItem[]): string | null {
  if (!ref) return null;
  if (ref.startsWith('area:')) {
    return areas.find((a) => a.slug === ref.slice(5))?.hero_image ?? null;
  }
  return ref;
}

/** Sum weights across the chosen options. */
export function scoreAnswers(
  questions: QuizQuestion[],
  answers: Record<string, string>
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const q of questions) {
    const opt = q.options.find((o) => o.id === answers[q.id]);
    if (!opt) continue;
    for (const [target, w] of Object.entries(opt.weights ?? {})) {
      totals.set(target, (totals.get(target) ?? 0) + w);
    }
  }
  return totals;
}

/** Top-N published areas by score (ties broken stably by score order). */
export function resolveAreaMatches(
  totals: Map<string, number>,
  areas: AreaPoolItem[],
  count: number
): AreaPoolItem[] {
  const bySlug = new Map(areas.map((a) => [a.slug, a]));
  const ranked = [...totals.entries()]
    .filter(([slug]) => bySlug.has(slug)) // curation: published areas only
    .sort((a, b) => b[1] - a[1])
    .map(([slug]) => bySlug.get(slug)!);
  // Pad with editorially-safe defaults if scoring was too sparse.
  for (const fallback of ['marbella', 'estepona', 'nueva-andalucia', 'la-cala-de-mijas']) {
    if (ranked.length >= count) break;
    const a = bySlug.get(fallback);
    if (a && !ranked.includes(a)) ranked.push(a);
  }
  return ranked.slice(0, count);
}

const BUDGET_RANGES: Record<string, [number, number]> = {
  b1: [0, 350_000],
  b2: [350_000, 700_000],
  b3: [700_000, 1_500_000],
  b4: [1_500_000, 3_000_000],
  b5: [3_000_000, Number.MAX_SAFE_INTEGER],
};

/** West/centre/east clusters by area name keywords (coarse on purpose). */
const CLUSTERS: Record<string, RegExp> = {
  west: /estepona|casares|manilva|sotogrande|duquesa|cancelada|paraiso|chaparral|selwo|valle/i,
  centre: /marbella|banus|banús|golden|nueva andaluc|benahav|san pedro|guadalmina|sierra|quinta|elviria|cabopino|monteros|rosario|aloha|padierna|zagaleta|madroñal|flamingos|alquer/i,
  east: /mijas|fuengirola|benalmad|torremolinos|malaga|málaga|cala|calahonda|riviera|carvajal|higuer/i,
};

/**
 * Dev quizzes score CRITERIA tokens (`crit:<dim>:<val>`), not slugs —
 * developments churn, criteria don't. Each published dev is scored by
 * how its real fields satisfy the visitor's criteria totals.
 */
export function resolveDevelopmentMatches(
  totals: Map<string, number>,
  devs: DevPoolItem[],
  count: number
): DevPoolItem[] {
  const crit = (dim: string, val: string) => totals.get(`crit:${dim}:${val}`) ?? 0;

  const scored = devs.map((d) => {
    let score = 0;
    // Completion / status appetite
    score += crit('status', d.status) * 2;
    // Budget band on price_from
    if (d.price_from != null) {
      for (const [band, [lo, hi]] of Object.entries(BUDGET_RANGES)) {
        if (d.price_from >= lo && d.price_from < hi) score += crit('budget', band) * 2;
      }
    }
    // Location cluster
    const place = `${d.area ?? ''} ${d.location ?? ''}`;
    for (const [cluster, re] of Object.entries(CLUSTERS)) {
      if (re.test(place)) score += crit('cluster', cluster);
    }
    // Yield vs growth — coarse heuristic: east/coastal apartments rent
    // hardest (yield); centre/hillside hold value (growth).
    if (crit('goal', 'yield') && CLUSTERS.east.test(place)) score += crit('goal', 'yield');
    if (crit('goal', 'growth') && CLUSTERS.centre.test(place)) score += crit('goal', 'growth');
    return { d, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((s) => s.d);
}

/** Curated listings for an area card (already-curated pool, name match). */
export function listingsForArea(
  area: AreaPoolItem,
  pool: ListingPoolItem[],
  max = 3
): ListingPoolItem[] {
  return pool
    .filter((p) => p.area === area.name || p.location?.includes(area.name))
    .slice(0, max);
}
