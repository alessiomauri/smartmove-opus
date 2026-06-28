import { unstable_cache } from 'next/cache';
import { createStaticSupabaseClient } from '@/lib/supabase-static';
import { SITE_SETTINGS_TAG } from '@/lib/cache';

/**
 * Editorial homepage figures — one source of truth each, admin-edited and
 * stored in site_settings.homepage_stats. Every field is OPTIONAL: an unset
 * (empty/absent) figure hides its token on the homepage; nothing is seeded
 * fake. Stored as the literal display strings (e.g. "€820M+", "210+", "4.9",
 * "2,000+", "2009") so the admin controls exactly how each reads.
 */
export interface HomepageStats {
  soldVolume?: string;   // "€820M+ placed across the coast"
  reviewsCount?: string; // "210+ verified buyer reviews"
  rating?: string;       // "4.9" (/ 5)
  quizStarts?: string;   // "2,000+ buyers started here this year"
  foundedYear?: string;  // "2009" → drives "Est. 2009" + "N years" + "since 2009"
}

export const getHomepageStats = unstable_cache(
  async (): Promise<HomepageStats> => {
    const sb = createStaticSupabaseClient();
    const { data } = await sb.from('site_settings').select('homepage_stats').eq('id', 1).single();
    return (data?.homepage_stats as HomepageStats) ?? {};
  },
  ['homepage-stats'],
  { tags: [SITE_SETTINGS_TAG], revalidate: 600 }
);

/** Years since the founded year (for the footer "N years"), or null if unset/invalid. */
export function yearsSince(foundedYear: string | undefined, now = 2026): number | null {
  const y = parseInt((foundedYear ?? '').trim(), 10);
  if (!Number.isFinite(y) || y < 1900 || y > now) return null;
  return now - y;
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Spell a count for an editorial headline (1–999), Capitalized; digits beyond. */
export function numberToWords(n: number): string {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (!Number.isFinite(n) || n < 0) return String(n);
  if (n < 20) return cap(ONES[n]);
  if (n < 100) { const o = n % 10; return cap(o ? `${TENS[Math.floor(n / 10)]}-${ONES[o]}` : TENS[Math.floor(n / 10)]); }
  if (n < 1000) { const r = n % 100; return cap(`${ONES[Math.floor(n / 100)]} hundred${r ? ' ' + numberToWords(r).toLowerCase() : ''}`); }
  return n.toLocaleString('en-US');
}
