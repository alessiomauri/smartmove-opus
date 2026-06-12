import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import SearchClient from '@/components/search/SearchClient';
import { parseSearchParams, searchPropertiesPaged } from '@/lib/search';
import { nearestFacet } from '@/lib/facets';
import { localizedAlternates, localizedUrl } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

/**
 * The FULL-inventory search surface (Prompt 3) — the only place all 8k+
 * published rows are browsable. Server-paginated 24/page; state lives in
 * the URL. Param URLs are Tier-2: noindex,follow with a canonical to the
 * nearest curated facet (or this base page) — facets are the indexed
 * wrappers that capture the long-tail.
 */

interface Props {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const f = parseSearchParams(sp);
  const hasParams = Object.keys(sp).length > 0;

  // Canonical: nearest curated facet when one covers this filter set.
  const facet = hasParams ? nearestFacet(f) : null;
  const canonical = facet
    ? localizedUrl(locale, { pathname: '/properties/[facet]', params: { facet: facet.slug } })
    : localizedUrl(locale, '/properties');

  return {
    title: 'Property Search — Costa del Sol | Smartmove Marbella',
    description:
      'Search every published property on the Costa del Sol — villas, apartments, penthouses and townhouses from Sotogrande to Málaga. Live MLS inventory, updated nightly.',
    robots: hasParams
      ? { index: false, follow: true } // Tier-2: param URLs never indexed
      : { index: true, follow: true },
    alternates: hasParams ? { canonical } : localizedAlternates(locale, '/properties'),
  };
}

export default async function PropertiesSearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const filters = parseSearchParams(sp);
  const result = await searchPropertiesPaged(filters);
  const t = await getTranslations('nav');

  const basePath = locale === 'es' ? '/es/propiedades' : '/properties';

  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <main className="max-w-[1600px] mx-auto px-6 lg:px-12 py-10 lg:py-14">
        <header className="mb-8">
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-gold mb-3">
            {t('properties')}
          </p>
          <h1 className="font-display text-[34px] md:text-[48px] leading-[1.03] tracking-tight text-ink">
            Search the full inventory
          </h1>
          <p className="text-[14.5px] text-ink/60 mt-3 max-w-xl">
            Every published listing on the coast — synced nightly with the local MLS. Filters live
            in the URL: refresh, share or send it, the results reproduce exactly.
          </p>
        </header>
        <SearchClient filters={filters} result={result} basePath={basePath} />
      </main>
      <SiteFooter />
    </div>
  );
}
