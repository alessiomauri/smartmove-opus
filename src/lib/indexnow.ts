/**
 * IndexNow pings — tell Bing/Yandex/Seznam-class engines which URLs
 * changed the moment the sync writes them (insert, update, unpublish).
 * Google doesn't consume IndexNow; it gets the sitemap + ISR pages.
 *
 * Env-gated by INDEXNOW_KEY: unset (e.g. local dev) → silent no-op.
 * The key file is generated at build time into /public/{key}.txt by
 * scripts/generate-indexnow-key.mjs, satisfying the ownership check
 * (https://host/{key}.txt must contain the key).
 *
 * Consistent with the sync's zero-writes semantics: callers only invoke
 * this with the URLs of rows that were actually written, so a no-change
 * night sends zero pings.
 */

import { routing } from '@/i18n/routing';

const ENDPOINT = 'https://api.indexnow.org/indexnow';
/** Batch API hard limit per call. */
const MAX_URLS_PER_CALL = 10_000;

type EntityKind = 'p' | 'd';

const PATH_TEMPLATE: Record<EntityKind, string> = {
  p: '/property/[slug]',
  d: '/new-developments/[slug]',
};

/**
 * Localized public URLs for one entity — EN (no prefix) + ES
 * (localized path word), mirroring the sitemap's URL builder.
 */
export function entityUrls(kind: EntityKind, slug: string): string[] {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';
  const template = PATH_TEMPLATE[kind];
  const entry = (routing.pathnames as Record<string, string | Record<string, string>>)[template];

  return routing.locales.map((locale) => {
    let path: string;
    if (typeof entry === 'string') path = entry;
    else if (entry && entry[locale]) path = entry[locale];
    else path = template;
    path = path.replace('[slug]', slug);
    const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
    return `${baseUrl}${prefix}${path}`;
  });
}

/**
 * Fire the batch ping. Returns the number of URLs submitted (0 when
 * disabled or nothing to send). Never throws — indexing pings must not
 * fail a sync run.
 */
export async function pingIndexNow(urls: string[]): Promise<number> {
  const key = process.env.INDEXNOW_KEY;
  if (!key || urls.length === 0) return 0;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';
  const host = new URL(baseUrl).host;
  const unique = [...new Set(urls)];

  let submitted = 0;
  for (let i = 0; i < unique.length; i += MAX_URLS_PER_CALL) {
    const batch = unique.slice(i, i + MAX_URLS_PER_CALL);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host,
          key,
          keyLocation: `${baseUrl}/${key}.txt`,
          urlList: batch,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      // 200 = processed, 202 = accepted; anything else is logged, not fatal.
      if (res.ok || res.status === 202) {
        submitted += batch.length;
      } else {
        console.warn(`IndexNow ${res.status}: ${await res.text()}`);
      }
    } catch (e) {
      console.warn('IndexNow ping failed:', e instanceof Error ? e.message : e);
    }
  }
  return submitted;
}
