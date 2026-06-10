import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { localizedAlternates, localizedUrl } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';
import { getAreaBySlugCached, getPublishedAreasCached } from '@/lib/queries';
import { createStaticSupabaseClient } from '@/lib/supabase-static';
import { getPropertiesForArea, getDevelopmentsForArea } from '@/lib/cache';
import AreaPageClient from './AreaPageClient';

export const revalidate = 3600; // ISR: regenerate every hour

export async function generateStaticParams() {
  const supabase = createStaticSupabaseClient();
  const { data } = await supabase
    .from('areas')
    .select('slug')
    .eq('published', true);
  return (data || []).map((a) => ({ slug: a.slug }));
}

interface Props {
  params: Promise<{ locale: Locale; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const area = await getAreaBySlugCached(slug);

  if (!area) {
    return { title: 'Area Not Found' };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';
  const href = { pathname: '/areas/[slug]', params: { slug: area.slug } } as const;

  // Auto-generate Spanish keyword variants for this area so we capture
  // Spanish-language searches without maintaining a separate /es/ tree.
  const spanishKeywords = [
    `villas en ${area.name}`,
    `casas en ${area.name}`,
    `pisos en ${area.name}`,
    `propiedades en ${area.name}`,
    `comprar en ${area.name}`,
    `inmobiliaria ${area.name}`,
    `${area.name} venta`,
  ];

  return {
    title: area.title,
    description: area.meta_description,
    keywords: [...area.keywords, ...spanishKeywords],
    alternates: localizedAlternates(locale, href),
    openGraph: {
      title: area.title,
      description: area.meta_description,
      url: localizedUrl(locale, href),
      siteName: 'Smartmove Marbella',
      locale: 'en_US',
      alternateLocale: ['es_ES'],
      type: 'website',
      images: [
        {
          url: area.hero_image || `${baseUrl}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: area.hero_image_alt || `${area.name} - Luxury Properties for Sale | Smartmove Marbella`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: area.title,
      description: area.meta_description,
    },
    other: {
      'geo.region': 'ES-AN',
      'geo.placename': `${area.name}, Costa del Sol, Spain`,
      'geo.position': `${area.coordinates_lat};${area.coordinates_lng}`,
      ICBM: `${area.coordinates_lat}, ${area.coordinates_lng}`,
    },
  };
}

export default async function AreaPage({ params }: Props) {
  const { slug } = await params;
  const area = await getAreaBySlugCached(slug);

  if (!area || !area.published) {
    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';

  // Load all published areas to resolve nearby, child, and descendant areas
  const allAreas = await getPublishedAreasCached();
  const nearbyAreas = allAreas.filter(a => area.nearby_areas.includes(a.slug));
  const childAreas = allAreas.filter(a => a.parent_area === area.slug);
  const parentArea = area.parent_area ? (allAreas.find(a => a.slug === area.parent_area) ?? null) : null;

  // Recursively collect ALL descendant areas (children, grandchildren, etc.)
  function collectDescendants(parentSlug: string): typeof allAreas {
    const children = allAreas.filter(a => a.parent_area === parentSlug);
    return children.flatMap(c => [c, ...collectDescendants(c.slug)]);
  }

  // Each area collects only its own descendants.
  // - Marbella (parent) naturally pulls Nueva Andalucia, Marbella East, and their micros
  //   because they're its direct/indirect children.
  // - Nueva Andalucia and Marbella East each show only their own listings.
  const allDescendantAreas = collectDescendants(area.slug);

  // Server-fetch the filtered property list so the initial HTML contains
  // the property grid (fast LCP + indexable). Matches the same logic the
  // old `useProperties` hook applied client-side.
  const descendantSlugs = allDescendantAreas.map((a) => a.slug);
  const microLocationSlugs = [area.slug, ...descendantSlugs];
  const childAreaNames = allDescendantAreas
    .filter((a) => a.pin_category === 'main')
    .map((a) => a.name);

  const [properties, developments] = await Promise.all([
    // Editorial filter: manual + scraper rows only. Resales bulk
    // inventory is excluded from area pages.
    getPropertiesForArea({
      areaName: area.pin_category === 'main' ? area.name : undefined,
      childAreaNames,
      microLocationSlugs,
    }),
    // New developments: include both manual + Resales-sourced (off-plan
    // is editorial-class even when sourced, per user direction).
    getDevelopmentsForArea({
      areaName: area.pin_category === 'main' ? area.name : undefined,
      childAreaNames,
      microLocationSlugs,
    }),
  ]);

  // Keep the same featured-first, newest-next ordering used on the homepage.
  properties.sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    if (a.is_featured && b.is_featured) {
      return (a.featured_order ?? 0) - (b.featured_order ?? 0);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  developments.sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    if (a.is_featured && b.is_featured) {
      return (a.featured_order ?? 0) - (b.featured_order ?? 0);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Place schema
  const areaJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: area.name,
    description: area.meta_description,
    url: `${baseUrl}/areas/${area.slug}`,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: area.coordinates_lat,
      longitude: area.coordinates_lng,
    },
    containedInPlace: {
      '@type': 'AdministrativeArea',
      name: 'Costa del Sol',
      containedInPlace: {
        '@type': 'AdministrativeArea',
        name: 'Andalusia, Spain',
      },
    },
  };

  // BreadcrumbList schema
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Areas', item: `${baseUrl}/areas` },
      ...(parentArea
        ? [
            {
              '@type': 'ListItem',
              position: 3,
              name: parentArea.name,
              item: `${baseUrl}/areas/${parentArea.slug}`,
            },
            {
              '@type': 'ListItem',
              position: 4,
              name: area.name,
              item: `${baseUrl}/areas/${area.slug}`,
            },
          ]
        : [
            {
              '@type': 'ListItem',
              position: 3,
              name: area.name,
              item: `${baseUrl}/areas/${area.slug}`,
            },
          ]),
    ],
  };

  // FAQPage schema
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What are property prices like in ${area.name}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Properties in ${area.name} range ${area.price_range}. The area offers ${area.property_types.slice(0, 3).join(', ').toLowerCase()} among other property types.`,
        },
      },
      {
        '@type': 'Question',
        name: `Why buy property in ${area.name}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${area.name} is known for: ${area.highlights.join(', ')}. It is located in the ${area.region} area of the Costa del Sol.`,
        },
      },
      {
        '@type': 'Question',
        name: `What types of properties are available in ${area.name}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${area.name} offers a range of property types including ${area.property_types.join(', ').toLowerCase()}.`,
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(areaJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <AreaPageClient
        key={area.slug}
        area={area}
        nearbyAreas={nearbyAreas}
        childAreas={childAreas}
        allDescendantAreas={allDescendantAreas}
        parentArea={parentArea}
        properties={properties}
        developments={developments}
        showProperties={true}
      />
    </>
  );
}
