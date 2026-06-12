import HomeHero from '@/components/HomeHero';
import HomeListingsClient from './HomeListingsClient';
import AwardsBlock from '@/components/AwardsBlock';
import SearchPill from '@/components/SearchPill';
import PinnedFeaturedCard from '@/components/PinnedFeaturedCard';
import QuizEntryCards from '@/components/QuizEntryCards';
import { Link } from '@/i18n/navigation';
import { getCachedPublishedProperties, getCachedDefaultSort } from '@/lib/cache';
import { createStaticSupabaseClient } from '@/lib/supabase-static';

export const revalidate = 3600;

export default async function Home() {
  const [allPublished, defaultSort, { count: inventoryCount }] = await Promise.all([
    getCachedPublishedProperties(),
    getCachedDefaultSort(),
    // Full-inventory size for the search CTA — the grid itself stays
    // curated; the whole inventory lives on /properties (Prompt 3).
    createStaticSupabaseClient()
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('published', true),
  ]);

  // CURATED-SURFACE GATE (Alessio's rule): Resales-sourced rows never
  // appear on the homepage — auto-publish only makes them part of the
  // full-search inventory — UNLESS an admin explicitly whitelists one
  // by featuring it. Without this gate the full import would flood the
  // "Featured this week" grid with thousands of MLS rows.
  const properties = allPublished.filter(
    (p) => p.source !== 'resales_online' || p.is_featured
  );

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';

  // Sort properties featured-first, then newest, so the SSR HTML matches
  // the hydrated state of HomeListingsClient.
  const sorted = [...properties].sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    if (a.is_featured && b.is_featured) {
      return (a.featured_order ?? 0) - (b.featured_order ?? 0);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Pin the top featured property as the "Now Featured" tag in the hero.
  const heroFeatured = sorted[0];
  const featuredTag = heroFeatured
    ? {
        name: `${heroFeatured.name}, ${heroFeatured.location}`,
        location: heroFeatured.area || heroFeatured.location,
        beds: heroFeatured.bedrooms ?? '—',
        interior: heroFeatured.interior_size ?? '—',
        priceFrom:
          heroFeatured.price_on_request || !heroFeatured.price
            ? 'Price on request'
            : `From €${(heroFeatured.price / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`,
        href: `/property/${heroFeatured.slug}`,
      }
    : undefined;

  // ItemList JSON-LD (homepage only)
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: sorted.slice(0, 10).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${baseUrl}/property/${p.slug}`,
      name: p.name,
      ...(p.price && !p.price_on_request
        ? {
            offers: {
              '@type': 'Offer',
              price: p.price,
              priceCurrency: 'EUR',
              availability:
                p.status === 'available'
                  ? 'https://schema.org/InStock'
                  : 'https://schema.org/OutOfStock',
            },
          }
        : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <HomeHero featured={featuredTag} />

      {/* Mobile-only widgets (hidden on desktop via CSS): collapsed search pill
          overlapping the hero, then the pinned featured card. */}
      <SearchPill />
      {heroFeatured && (
        <PinnedFeaturedCard
          property={{
            slug: heroFeatured.slug,
            name: heroFeatured.name,
            location: heroFeatured.location,
            area: heroFeatured.area,
            hero_image: heroFeatured.hero_image,
            price: heroFeatured.price,
            price_on_request: heroFeatured.price_on_request,
          }}
        />
      )}

      <section className="sm-section">
        <header className="sm-section__head">
          <h2 className="sm-section__title">
            <span className="sm-section__num">i.&nbsp;</span>
            Featured <em>this week</em>
          </h2>
          <span className="sm-section__num">Hand-picked from current inventory</span>
        </header>
        <HomeListingsClient
          initialProperties={sorted}
          defaultSort={defaultSort}
        />

        {/* The grid above is the curated showcase; the FULL inventory
            lives on the server-paginated search (Prompt 3). */}
        {(inventoryCount ?? 0) > sorted.length && (
          <div className="text-center mt-10">
            <Link
              href={'/properties' as never}
              className="inline-block px-8 py-4 text-[12.5px] font-semibold tracking-[0.1em] uppercase bg-white text-ink border border-ink/15 rounded-full hover:border-gold hover:text-gold transition-colors"
            >
              Search all {Number(inventoryCount).toLocaleString('en-US')} properties →
            </Link>
          </div>
        )}
      </section>

      <QuizEntryCards />

      <AwardsBlock />
    </>
  );
}
