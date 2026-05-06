import { MetadataRoute } from 'next';
import { createStaticSupabaseClient } from '@/lib/supabase-static';
import { AREAS } from '@/types/property';
import { COSTA_DEL_SOL_AREAS } from '@/lib/areas-data';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';

  const supabase = createStaticSupabaseClient();
  const { data: properties } = await supabase
    .from('properties')
    .select('slug, updated_at, hero_image, gallery_images, location, status')
    .eq('published', true)
    .order('updated_at', { ascending: false });

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/areas`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/new-developments`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/favourites`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // Dynamic property pages - high priority with images
  const propertyPages: MetadataRoute.Sitemap = (properties || []).map((property) => {
    const allImages = [
      property.hero_image,
      ...(property.gallery_images || []),
    ].filter(Boolean);

    return {
      url: `${baseUrl}/property/${property.slug}`,
      lastModified: new Date(property.updated_at),
      changeFrequency: 'weekly' as const,
      priority: property.status === 'available' ? 0.9 : 0.7,
      images: allImages.length > 0 ? allImages : undefined,
    };
  });

  // Dedicated area pages - very high priority for local SEO
  const areaPages: MetadataRoute.Sitemap = COSTA_DEL_SOL_AREAS.map((area) => ({
    url: `${baseUrl}/areas/${area.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: area.isMicroLocation ? 0.7 : 0.85,
  }));

  // Area filter pages on homepage (supplementary to dedicated pages)
  const areaFilterPages: MetadataRoute.Sitemap = AREAS.map((area) => ({
    url: `${baseUrl}/?area=${encodeURIComponent(area)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }));

  // Property type filter pages
  const propertyTypePages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/?minBeds=3`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${baseUrl}/?minBeds=4`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${baseUrl}/?minBeds=5`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${baseUrl}/?minBeds=6`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${baseUrl}/?maxPrice=2000000`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.5 },
    { url: `${baseUrl}/?minPrice=2000000&maxPrice=5000000`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.5 },
    { url: `${baseUrl}/?minPrice=5000000`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.5 },
    { url: `${baseUrl}/?status=available`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.7 },
  ];

  // Popular area + bedroom combinations (long-tail keywords)
  const popularCombinations: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/?area=Golden%20Mile&minBeds=4`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${baseUrl}/?area=Golden%20Mile&minBeds=5`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${baseUrl}/?area=Puerto%20Banus&minBeds=3`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${baseUrl}/?area=Puerto%20Banus&minBeds=4`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${baseUrl}/?area=Nueva%20Andalucia&minBeds=4`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${baseUrl}/?area=Nueva%20Andalucia&minBeds=5`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${baseUrl}/?area=Sierra%20Blanca&minBeds=5`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${baseUrl}/?area=Benahavis&minBeds=4`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${baseUrl}/?area=Benahavis&minBeds=5`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${baseUrl}/?area=Estepona&minBeds=3`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${baseUrl}/?area=Estepona&minBeds=4`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${baseUrl}/?area=Mijas&minBeds=3`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.5 },
  ];

  // Sort order variations
  const sortPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/?sort=price_asc`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.4 },
    { url: `${baseUrl}/?sort=price_desc`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.4 },
    { url: `${baseUrl}/?sort=newest`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.5 },
  ];

  return [
    ...staticPages,
    ...propertyPages,
    ...areaPages,
    ...areaFilterPages,
    ...propertyTypePages,
    ...popularCombinations,
    ...sortPages,
  ];
}
