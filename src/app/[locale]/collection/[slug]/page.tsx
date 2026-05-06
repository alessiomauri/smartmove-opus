import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCollectionBySlug, incrementCollectionViews } from '@/lib/actions/collections';
import { createStaticSupabaseClient } from '@/lib/supabase-static';
import CollectionPageClient from './CollectionPageClient';

interface CollectionPageProps {
  params: Promise<{ slug: string }>;
}

// Generate static params for published collections
export async function generateStaticParams() {
  const supabase = createStaticSupabaseClient();
  const { data: collections } = await supabase
    .from('collections')
    .select('slug')
    .eq('is_published', true);

  return (collections || []).map((c) => ({ slug: c.slug }));
}

// Dynamic metadata for SEO + OG
export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);

  if (!collection) {
    return {
      title: 'Collection Not Found | Smartmove Marbella',
      description: 'This collection could not be found.',
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';
  const collectionUrl = `${baseUrl}/collection/${collection.slug}`;

  const isPersonal = collection.type === 'personal';
  const propertyCount = collection.properties.length;

  const title = isPersonal
    ? `${collection.title} | Selected for ${collection.recipient_name}`
    : `${collection.title} | Curated by Smartmove Marbella`;

  const description = isPersonal
    ? `${propertyCount} hand-picked ${propertyCount === 1 ? 'property' : 'properties'} selected for ${collection.recipient_name} by Smartmove Marbella.`
    : `${propertyCount} curated ${propertyCount === 1 ? 'property' : 'properties'} in Marbella, Costa del Sol. ${collection.message?.slice(0, 100) || 'Discover our expert selection of luxury homes.'}`;

  // Use first property's hero image or collection cover
  const ogImage = collection.cover_image
    || (collection.properties[0]?.hero_image)
    || `${baseUrl}/og-image.jpg`;

  return {
    title,
    description,
    robots: {
      index: isPersonal ? false : true, // Don't index personal collections
      follow: true,
    },
    alternates: { canonical: collectionUrl },
    openGraph: {
      title: isPersonal
        ? `Properties Selected for ${collection.recipient_name}`
        : collection.title,
      description: `${propertyCount} curated ${propertyCount === 1 ? 'property' : 'properties'} by Smartmove Marbella`,
      url: collectionUrl,
      siteName: 'Smartmove Marbella',
      images: [{ url: ogImage, width: 1200, height: 630 }],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: isPersonal
        ? `Properties Selected for ${collection.recipient_name}`
        : collection.title,
      description: `${propertyCount} curated ${propertyCount === 1 ? 'property' : 'properties'} by Smartmove Marbella`,
      images: [ogImage],
    },
  };
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);

  if (!collection) {
    notFound();
  }

  // Increment views
  incrementCollectionViews(slug);

  return <CollectionPageClient collection={collection} />;
}
