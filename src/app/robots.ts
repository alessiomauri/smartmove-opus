import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';

  return {
    rules: [
      // Main crawlers - allow everything except admin/api
      {
        userAgent: '*',
        allow: [
          '/',
          '/property/',
          '/areas/',
          '/blog/',
          '/new-developments/',
          '/sitemap.xml',
          '/robots.txt',
        ],
        disallow: [
          '/admin/',
          '/admin/*',
          '/api/',
          '/api/*',
          // NOTE: /_next/ is deliberately NOT disallowed — rendering
          // crawlers need the JS/CSS to evaluate pages.
          '/favourites/', // personal page + share URLs (EN)
          '/favoritos/',  // …and the Spanish route
        ],
      },
      // Google - prioritize for main search
      {
        userAgent: 'Googlebot',
        allow: [
          '/',
          '/property/*',
          '/areas/*',
          '/blog/*',
          '/new-developments/*',
          '/*.jpg$',
          '/*.jpeg$',
          '/*.png$',
          '/*.webp$',
        ],
        disallow: ['/admin/', '/api/', '/favourites/', '/favoritos/'],
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
        allow: ['/', '/property/*', '/new-developments/*'],
        disallow: ['/admin/', '/api/', '/favourites/', '/favoritos/'],
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
      { userAgent: 'facebookexternalhit', allow: '/' },
      // Twitter crawler
      { userAgent: 'Twitterbot', allow: '/' },
      // LinkedIn crawler
      { userAgent: 'LinkedInBot', allow: '/' },
      // WhatsApp crawler
      { userAgent: 'WhatsApp', allow: '/' },
      // Pinterest
      { userAgent: 'Pinterest', allow: '/' },
      // Block bad bots
      { userAgent: 'AhrefsBot', disallow: '/' },
      { userAgent: 'SemrushBot', disallow: '/' },
      { userAgent: 'MJ12bot', disallow: '/' },
      { userAgent: 'DotBot', disallow: '/' },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
