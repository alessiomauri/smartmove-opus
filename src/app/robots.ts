import { MetadataRoute } from 'next';
import { PROPERTIES_PUBLIC } from '@/lib/feature-flags';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://marbella.live';

  // While listings are dark, additionally disallow property + favourites URLs.
  // These rules clear automatically when PROPERTIES_PUBLIC flips to true.
  const propertyDisallows = PROPERTIES_PUBLIC
    ? []
    : ['/property', '/property/*', '/favourites', '/favourites/*'];

  return {
    rules: [
      // Main crawlers - allow everything except admin/api
      {
        userAgent: '*',
        allow: [
          '/',
          ...(PROPERTIES_PUBLIC ? ['/property/'] : []),
          '/areas/',
          '/blog/',
          '/sitemap.xml',
          '/robots.txt',
        ],
        disallow: [
          '/admin/',
          '/admin/*',
          '/api/',
          '/api/*',
          '/_next/',
          '/_next/*',
          ...(PROPERTIES_PUBLIC ? ['/favourites/*'] : []), // share pages only
          ...propertyDisallows,
          // /new-developments is built but unlaunched. Remove these two lines
          // when you flip NEW_DEVELOPMENTS_PUBLIC = true in
          // src/app/new-developments/feature-flag.ts
          '/new-developments',
          '/new-developments/*',
        ],
      },
      // Google - prioritize for main search
      {
        userAgent: 'Googlebot',
        allow: [
          '/',
          ...(PROPERTIES_PUBLIC ? ['/property/*'] : []),
          '/areas/*',
          '/blog/*',
          '/*.jpg$',
          '/*.jpeg$',
          '/*.png$',
          '/*.webp$',
        ],
        disallow: [
          '/admin/',
          '/api/',
          ...propertyDisallows,
        ],
      },
      // Google Images - allow all images
      {
        userAgent: 'Googlebot-Image',
        allow: '/',
        disallow: ['/admin/'],
      },
      // Google AdsBot
      {
        userAgent: 'AdsBot-Google',
        allow: '/',
        disallow: ['/admin/', '/api/'],
      },
      // Bing
      {
        userAgent: 'Bingbot',
        allow: [
          '/',
          ...(PROPERTIES_PUBLIC ? ['/property/*'] : []),
        ],
        disallow: ['/admin/', '/api/', ...propertyDisallows],
      },
      // DuckDuckGo
      {
        userAgent: 'DuckDuckBot',
        allow: '/',
        disallow: ['/admin/', '/api/'],
      },
      // Yandex (for Russian market)
      {
        userAgent: 'Yandex',
        allow: '/',
        disallow: ['/admin/', '/api/'],
      },
      // Baidu (for Chinese market)
      {
        userAgent: 'Baiduspider',
        allow: '/',
        disallow: ['/admin/', '/api/'],
      },
      // Facebook crawler for Open Graph
      {
        userAgent: 'facebookexternalhit',
        allow: '/',
      },
      // Twitter crawler
      {
        userAgent: 'Twitterbot',
        allow: '/',
      },
      // LinkedIn crawler
      {
        userAgent: 'LinkedInBot',
        allow: '/',
      },
      // WhatsApp crawler
      {
        userAgent: 'WhatsApp',
        allow: '/',
      },
      // Pinterest
      {
        userAgent: 'Pinterest',
        allow: '/',
      },
      // Block bad bots
      {
        userAgent: 'AhrefsBot',
        disallow: '/',
      },
      {
        userAgent: 'SemrushBot',
        disallow: '/',
      },
      {
        userAgent: 'MJ12bot',
        disallow: '/',
      },
      {
        userAgent: 'DotBot',
        disallow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
