import { MetadataRoute } from 'next';
import { createStaticSupabaseClient } from '@/lib/supabase-static';
import { COSTA_DEL_SOL_AREAS } from '@/lib/areas-data';
import { routing } from '@/i18n/routing';

/**
 * Per-route localized URL builder. Resolves the localized path word for each
 * locale (e.g. EN `/property/villa-x` ↔ ES `/propiedad/villa-x`) using the
 * routing.pathnames mapping.
 */
function localizedPaths(template: string, params?: Record<string, string>): Array<{ locale: string; href: string }> {
  const entry = (routing.pathnames as Record<string, unknown>)[template];
  return routing.locales.map((locale) => {
    let path: string;
    if (typeof entry === 'string') {
      path = entry;
    } else if (entry && typeof entry === 'object' && (entry as Record<string, string>)[locale]) {
      path = (entry as Record<string, string>)[locale];
    } else {
      path = template;
    }
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        path = path.replace(`[${k}]`, v);
      }
    }
    const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
    return { locale, href: `${prefix}${path === '/' ? '' : path}` || '/' };
  });
}

function withAlternates(
  template: string,
  params: Record<string, string> | undefined,
  baseUrl: string,
  lastModified: Date,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number,
  images?: string[]
): MetadataRoute.Sitemap {
  const variants = localizedPaths(template, params);
  const alternates = Object.fromEntries(
    variants.map((v) => [v.locale, `${baseUrl}${v.href}`])
  );
  return variants.map((v) => ({
    url: `${baseUrl}${v.href}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: { languages: alternates },
    ...(images && images.length ? { images } : {}),
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';

  const supabase = createStaticSupabaseClient();
  const { data: properties } = await supabase
    .from('properties')
    .select('slug, updated_at, hero_image, gallery_images, status')
    .eq('published', true)
    .order('updated_at', { ascending: false });

  const now = new Date();
  const result: MetadataRoute.Sitemap = [];

  // Static top-level pages
  result.push(...withAlternates('/', undefined, baseUrl, now, 'daily', 1.0));
  result.push(...withAlternates('/areas', undefined, baseUrl, now, 'weekly', 0.9));
  result.push(...withAlternates('/blog', undefined, baseUrl, now, 'daily', 0.9));
  result.push(...withAlternates('/new-developments', undefined, baseUrl, now, 'daily', 0.9));
  result.push(...withAlternates('/favourites', undefined, baseUrl, now, 'monthly', 0.3));

  // Property detail pages
  for (const p of properties ?? []) {
    const images = [p.hero_image, ...(p.gallery_images || [])].filter(Boolean);
    result.push(
      ...withAlternates(
        '/property/[slug]',
        { slug: p.slug },
        baseUrl,
        new Date(p.updated_at),
        'weekly',
        p.status === 'available' ? 0.9 : 0.7,
        images
      )
    );
  }

  // Area detail pages
  for (const a of COSTA_DEL_SOL_AREAS) {
    result.push(
      ...withAlternates(
        '/areas/[slug]',
        { slug: a.slug },
        baseUrl,
        now,
        'weekly',
        a.isMicroLocation ? 0.7 : 0.85
      )
    );
  }

  return result;
}
