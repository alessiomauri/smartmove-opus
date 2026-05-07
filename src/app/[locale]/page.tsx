import HomeHero from '@/components/HomeHero';
import HomeListingsClient from './HomeListingsClient';
import AwardsBlock from '@/components/AwardsBlock';
import SearchPill from '@/components/SearchPill';
import PinnedFeaturedCard from '@/components/PinnedFeaturedCard';
import { getCachedPublishedProperties, getCachedDefaultSort } from '@/lib/cache';

export const revalidate = 3600;

export default async function Home() {
  const [properties, defaultSort] = await Promise.all([
    getCachedPublishedProperties(),
    getCachedDefaultSort(),
  ]);

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
          showHeader={false}
        />
      </section>

      <AwardsBlock />
    </>
  );
}
