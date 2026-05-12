import { Metadata } from 'next';
import { getPublishedAreas } from '@/lib/actions/areas';
import { getCachedPublishedProperties } from '@/lib/cache';
import SiteHeader from '@/components/SiteHeader';
import AreasIndexClient from './AreasIndexClient';

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';

export const metadata: Metadata = {
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
  alternates: { canonical: `${baseUrl}/areas` },
  openGraph: {
    title: 'Costa del Sol Areas Guide | Smartmove Marbella',
    description:
      'Explore 44 distinct neighbourhoods across the Costa del Sol with advisor-led orientation.',
    url: `${baseUrl}/areas`,
    siteName: 'Smartmove Marbella',
    type: 'website',
  },
};

export default async function AreasIndexPage() {
  const [areas, properties] = await Promise.all([
    getPublishedAreas(),
    getCachedPublishedProperties(),
  ]);

  // Compute editorial counts per area: only manual + scraper rows, no Resales
  // bulk inventory (matches the filter we use on the per-area pages). Counts
  // both direct area matches and micro_location matches against the slug.
  const editorial = properties.filter((p) => p.source !== 'resales_online');
  const countsByName = new Map<string, number>();
  const countsBySlug = new Map<string, number>();
  for (const p of editorial) {
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
  for (const p of editorial) {
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
