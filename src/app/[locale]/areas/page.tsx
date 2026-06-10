import { Metadata } from 'next';
import { localizedAlternates, localizedUrl } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';
import { getPublishedAreasCached } from '@/lib/queries';
import { getCachedAreaPropertyStats } from '@/lib/cache';
import SiteHeader from '@/components/SiteHeader';
import AreasIndexClient from './AreasIndexClient';

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
  title: 'Costa del Sol Areas Guide | Property by Location',
  description:
    'Explore 44 distinct neighbourhoods across the Costa del Sol. Map view, regional clusters, advisor-led orientation calls for buyers.',
  keywords: [
    'Costa del Sol areas',
    'Marbella areas',
    'where to buy property Costa del Sol',
    'Marbella neighbourhoods',
    'best areas Marbella',
    'Costa del Sol locations',
    'property by area Marbella',
    'Costa del Sol property guide',
  ],
  alternates: localizedAlternates(locale, '/areas'),
  openGraph: {
    title: 'Costa del Sol Areas Guide | Smartmove Marbella',
    description:
      'Explore 44 distinct neighbourhoods across the Costa del Sol with advisor-led orientation.',
    url: localizedUrl(locale, '/areas'),
    siteName: 'Smartmove Marbella',
    type: 'website',
  },
  };
}

export default async function AreasIndexPage() {
  const [areas, stats] = await Promise.all([
    getPublishedAreasCached(),
    // Lean aggregate source: 4 columns, editorial rows only (the SQL
    // query already excludes Resales bulk inventory — same filter the
    // per-area pages apply).
    getCachedAreaPropertyStats(),
  ]);

  // Counts both direct area matches and micro_location matches against
  // the slug.
  const countsByName = new Map<string, number>();
  const countsBySlug = new Map<string, number>();
  for (const p of stats) {
    if (p.area) countsByName.set(p.area, (countsByName.get(p.area) ?? 0) + 1);
    if (p.micro_location)
      countsBySlug.set(p.micro_location, (countsBySlug.get(p.micro_location) ?? 0) + 1);
  }
  const listingCounts: Record<string, number> = {};
  const minPriceByName = new Map<string, number>();
  for (const a of areas) {
    listingCounts[a.slug] =
      (countsByName.get(a.name) ?? 0) + (countsBySlug.get(a.slug) ?? 0);
  }
  for (const p of stats) {
    if (p.price && p.area) {
      const cur = minPriceByName.get(p.area);
      if (cur === undefined || p.price < cur) minPriceByName.set(p.area, p.price);
    }
  }
  const minPrices: Record<string, number> = {};
  for (const a of areas) {
    const v = minPriceByName.get(a.name);
    if (v !== undefined) minPrices[a.slug] = v;
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Areas', item: `${baseUrl}/areas` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="min-h-screen bg-paper">
        <SiteHeader />

        <AreasIndexClient
          areas={areas}
          listingCounts={listingCounts}
          minPrices={minPrices}
        />
      </div>
    </>
  );
}
