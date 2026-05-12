import { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { getPublishedAreas } from '@/lib/actions/areas';
import { getCachedPublishedProperties } from '@/lib/cache';
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
        {/* Compact non-hero header — the v3 design assumes a real header
            is slotted in elsewhere; this is the inherited Marbella Live
            top bar, re-coloured. */}
        <header className="sticky top-0 z-50 header-glass">
          <div className="absolute top-0 left-0 right-0 h-[2px] header-gradient-border" />
          <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
            <div className="flex items-center justify-between h-[60px] lg:h-[72px]">
              <Link href="/" className="group relative shrink-0 inline-block">
                <span className="text-[24px] lg:text-[26px] tracking-[-0.02em] font-display text-gold transition-colors group-hover:text-gold-deep">
                  Smartmove Marbella
                </span>
                <span className="absolute -bottom-0.5 left-0 h-[1px] w-0 bg-gold transition-all duration-500 ease-out group-hover:w-full" />
              </Link>
              <Link
                href="/blog"
                className="text-[11px] font-semibold tracking-[0.08em] uppercase text-ink/60 hover:text-gold transition-colors"
              >
                Blog
              </Link>
            </div>
          </div>
        </header>
        <div className="header-divider" />

        <AreasIndexClient
          areas={areas}
          listingCounts={listingCounts}
          minPrices={minPrices}
        />
      </div>
    </>
  );
}
