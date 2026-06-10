import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPropertyBySlugCached } from '@/lib/queries';
import { createStaticSupabaseClient } from '@/lib/supabase-static';
import { localizedAlternates, localizedUrl } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';
import PropertyPageClient from './PropertyPageClient';
import { Property } from '@/types/property';

interface PropertyPageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

export const revalidate = 3600;

// Generate static params for all published properties (Static Site Generation).
export async function generateStaticParams() {
  const supabase = createStaticSupabaseClient();
  const { data: properties } = await supabase
    .from('properties')
    .select('slug')
    .eq('published', true);

  return (properties || []).map((property) => ({
    slug: property.slug,
  }));
}

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: PropertyPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  // Deduped with the page body via react.cache — one query per request.
  const property = await getPropertyBySlugCached(slug);

  if (!property) {
    return {
      title: 'Property Not Found | Smartmove Marbella',
      description: 'The property you are looking for could not be found.',
    };
  }

  const href = { pathname: '/property/[slug]', params: { slug: property.slug } } as const;
  const propertyUrl = localizedUrl(locale, href);

  // Build comprehensive title with location for local SEO
  const title = `${property.name} | Luxury Property in ${property.location}, Marbella`;

  // Build rich description with property details
  const descriptionParts = [];
  if (property.bedrooms) descriptionParts.push(`${property.bedrooms} bedrooms`);
  if (property.bathrooms) descriptionParts.push(`${property.bathrooms} bathrooms`);
  if (property.interior_size) descriptionParts.push(`${property.interior_size}m² interior`);
  if (property.plot_size) descriptionParts.push(`${property.plot_size}m² plot`);

  const priceText = property.price_on_request || !property.price
    ? 'Price on request'
    : `€${property.price.toLocaleString('en-US')}`;

  // Full description for SEO (Google uses <meta name="description">)
  const description = property.description
    ? `${property.description.slice(0, 120)}... ${descriptionParts.join(', ')}. ${priceText}. Luxury real estate in ${property.location}, Marbella, Costa del Sol.`
    : `Exclusive ${property.name} in ${property.location}, Marbella. ${descriptionParts.join(', ')}. ${priceText}. Discover luxury properties on the Costa del Sol.`;

  // Short description for OG/social cards (WhatsApp, Facebook, Twitter)
  // Keeps the preview card compact on mobile
  const ogDescription = `${descriptionParts.join(', ')}. ${priceText}.`;

  // Build keywords for this specific property — English + Spanish so we
  // capture searches from both audiences without a separate /es/ tree.
  const keywords = [
    property.name,
    `${property.location} property`,
    `${property.location} villa`,
    `${property.location} Marbella`,
    'luxury property Marbella',
    'Costa del Sol real estate',
    'Marbella luxury villa',
    property.area || property.location,
    ...property.features.slice(0, 5),
    // Spanish variants
    `villa en ${property.location}`,
    `casa en ${property.location}`,
    `propiedad en ${property.location}`,
    `comprar en ${property.location}`,
    `${property.location} venta`,
    'inmobiliaria Marbella',
    'propiedad de lujo Costa del Sol',
  ];

  // Collect all images for Open Graph
  const images = [
    {
      url: property.hero_image,
      width: 1200,
      height: 630,
      alt: `${property.name} - Luxury Property in ${property.location}, Marbella`,
    },
    ...(property.gallery_images || []).slice(0, 3).map((img, idx) => ({
      url: img,
      width: 1200,
      height: 800,
      alt: `${property.name} - Image ${idx + 2}`,
    })),
  ];

  return {
    title,
    description,
    keywords,
    authors: [{ name: 'Smartmove Marbella' }],
    creator: 'Smartmove Marbella',
    publisher: 'Smartmove Marbella',
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    // Locale-correct canonical + hreflang (EN ↔ ES localized paths).
    alternates: localizedAlternates(locale, href),
    openGraph: {
      title: `${property.name} | ${property.location}, Marbella`,
      description: ogDescription,
      url: propertyUrl,
      siteName: 'Smartmove Marbella',
      images,
      locale: 'en_US',
      alternateLocale: ['es_ES'],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${property.name} | Luxury Property Marbella`,
      description: ogDescription,
      images: [property.hero_image],
      creator: '',
    },
    other: {
      // Additional meta tags for real estate
      'og:price:amount': property.price?.toString() || '',
      'og:price:currency': 'EUR',
      'place:location:latitude': property.latitude?.toString() || '',
      'place:location:longitude': property.longitude?.toString() || '',
    },
  };
}

// Helper function to format price
function formatPrice(property: Property): string {
  if (property.price_on_request || property.price === null) {
    return 'Price on Request';
  }
  return `€${property.price.toLocaleString('en-US')}`;
}

// Generate JSON-LD structured data for the property
function generatePropertyJsonLd(property: Property, baseUrl: string) {
  const propertyUrl = `${baseUrl}/property/${property.slug}`;

  // RealEstateListing schema
  const realEstateListing = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': propertyUrl,
    name: property.name,
    description: property.description,
    url: propertyUrl,
    datePosted: property.created_at,
    dateModified: property.updated_at,
    image: [property.hero_image, ...(property.gallery_images || [])],
    offers: {
      '@type': 'Offer',
      price: property.price || undefined,
      priceCurrency: 'EUR',
      availability: property.status === 'available'
        ? 'https://schema.org/InStock'
        : property.status === 'under_offer'
          ? 'https://schema.org/LimitedAvailability'
          : 'https://schema.org/SoldOut',
    },
  };

  // Residence/House schema with more details
  const residence = {
    '@context': 'https://schema.org',
    '@type': 'Residence',
    '@id': `${propertyUrl}#residence`,
    name: property.name,
    description: property.description,
    url: propertyUrl,
    image: property.hero_image,
    numberOfRooms: property.bedrooms ? property.bedrooms + (property.bathrooms || 0) : undefined,
    numberOfBedrooms: property.bedrooms || undefined,
    numberOfBathroomsTotal: property.bathrooms || undefined,
    floorSize: property.interior_size ? {
      '@type': 'QuantitativeValue',
      value: property.interior_size,
      unitCode: 'MTK', // Square meters
    } : undefined,
    amenityFeature: property.features.map(feature => ({
      '@type': 'LocationFeatureSpecification',
      name: feature,
      value: true,
    })),
    geo: property.latitude && property.longitude ? {
      '@type': 'GeoCoordinates',
      latitude: property.latitude,
      longitude: property.longitude,
    } : undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: property.location,
      addressRegion: 'Marbella',
      addressCountry: 'ES',
    },
    containedInPlace: {
      '@type': 'Place',
      name: property.area || property.location,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Marbella',
        addressRegion: 'Andalusia',
        addressCountry: 'Spain',
      },
    },
  };

  // BreadcrumbList for navigation
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Properties',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: property.location,
        item: `${baseUrl}/?area=${encodeURIComponent(property.area || property.location)}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: property.name,
        item: propertyUrl,
      },
    ],
  };

  // ImageGallery for better image indexing
  const imageGallery = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: `${property.name} Photo Gallery`,
    description: `Photos of ${property.name}, luxury property in ${property.location}, Marbella`,
    image: [property.hero_image, ...(property.gallery_images || [])].map((img, idx) => ({
      '@type': 'ImageObject',
      url: img,
      name: `${property.name} - Photo ${idx + 1}`,
      description: `${property.name} in ${property.location}, Marbella - Image ${idx + 1}`,
    })),
  };

  return [realEstateListing, residence, breadcrumbs, imageGallery];
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { slug } = await params;
  const property = await getPropertyBySlugCached(slug);

  if (!property) {
    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';
  const jsonLdData = generatePropertyJsonLd(property, baseUrl);

  return (
    <>
      {/* JSON-LD Structured Data */}
      {jsonLdData.map((data, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}

      {/* Client Component for Interactive UI */}
      <PropertyPageClient property={property} />
    </>
  );
}
