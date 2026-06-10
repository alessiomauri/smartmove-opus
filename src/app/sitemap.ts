import { MetadataRoute } from 'next';
import { createStaticSupabaseClient } from '@/lib/supabase-static';
import { routing } from '@/i18n/routing';
import { NEW_DEVELOPMENTS_PUBLIC } from '@/app/[locale]/new-developments/feature-flag';

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
  // One round of parallel queries covers every indexable content type.
  const [
    { data: properties },
    { data: areas },
    { data: posts },
    { data: developments },
    { data: collections },
  ] = await Promise.all([
    supabase
      .from('properties')
      .select('slug, updated_at, hero_image, gallery_images, status')
      .eq('published', true)
      .order('updated_at', { ascending: false }),
    // Areas come from the DB (not the static TS file) so unpublishing an
    // area in admin actually removes it from the sitemap.
    supabase
      .from('areas')
      .select('slug, is_micro_location, updated_at')
      .eq('published', true),
    supabase
      .from('blog_posts')
      .select('slug, updated_at')
      .eq('published', true),
    supabase
      .from('developments')
      .select('slug, updated_at')
      .eq('published', true),
    // Community collections are public marketing pages; personal ones
    // are private shares and stay out.
    supabase
      .from('collections')
      .select('slug, updated_at')
      .eq('is_published', true)
      .eq('type', 'community'),
  ]);

  const now = new Date();
  const result: MetadataRoute.Sitemap = [];

  // Static top-level pages. /favourites is a personal localStorage page
  // (noindexed) — advertising it in the sitemap contradicted that.
  result.push(...withAlternates('/', undefined, baseUrl, now, 'daily', 1.0));
  result.push(...withAlternates('/areas', undefined, baseUrl, now, 'weekly', 0.9));
  result.push(...withAlternates('/blog', undefined, baseUrl, now, 'daily', 0.9));
  if (NEW_DEVELOPMENTS_PUBLIC) {
    result.push(...withAlternates('/new-developments', undefined, baseUrl, now, 'daily', 0.9));
  }

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
  for (const a of areas ?? []) {
    result.push(
      ...withAlternates(
        '/areas/[slug]',
        { slug: a.slug },
        baseUrl,
        a.updated_at ? new Date(a.updated_at) : now,
        'weekly',
        a.is_micro_location ? 0.7 : 0.85
      )
    );
  }

  // Blog posts
  for (const post of posts ?? []) {
    result.push(
      ...withAlternates(
        '/blog/[slug]',
        { slug: post.slug },
        baseUrl,
        post.updated_at ? new Date(post.updated_at) : now,
        'monthly',
        0.7
      )
    );
  }

  // New developments (feature-flagged — pages 404 while the flag is off,
  // so the sitemap must not advertise them)
  for (const d of NEW_DEVELOPMENTS_PUBLIC ? developments ?? [] : []) {
    result.push(
      ...withAlternates(
        '/new-developments/[slug]',
        { slug: d.slug },
        baseUrl,
        d.updated_at ? new Date(d.updated_at) : now,
        'weekly',
        0.8
      )
    );
  }

  // Community collections
  for (const c of collections ?? []) {
    result.push(
      ...withAlternates(
        '/collection/[slug]',
        { slug: c.slug },
        baseUrl,
        c.updated_at ? new Date(c.updated_at) : now,
        'weekly',
        0.6
      )
    );
  }

  return result;
}
