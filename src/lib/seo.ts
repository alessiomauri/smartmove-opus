import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

/**
 * Locale-correct canonical + hreflang builder.
 *
 * Before this helper, every page hardcoded the EN URL as canonical AND
 * as both hreflang targets — so `/es/propiedad/villa-x` told Google
 * "the canonical version of me is /property/villa-x", canonicalizing
 * the entire Spanish tree out of the index, while the sitemap emitted
 * the opposite signal.
 *
 * Usage in generateMetadata:
 *   alternates: localizedAlternates(locale, {
 *     pathname: '/property/[slug]', params: { slug },
 *   })
 */

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';

type Href = Parameters<typeof getPathname>[0]['href'];

export function localizedUrl(locale: Locale, href: Href): string {
  // getPathname applies the localized path words AND the as-needed
  // prefix (en → no prefix, es → /es/...).
  return `${baseUrl}${getPathname({ locale, href })}`;
}

export function localizedAlternates(locale: Locale, href: Href) {
  const en = localizedUrl('en', href);
  const es = localizedUrl('es', href);
  return {
    canonical: locale === 'es' ? es : en,
    languages: {
      en,
      es,
      'x-default': en,
    },
  };
}
