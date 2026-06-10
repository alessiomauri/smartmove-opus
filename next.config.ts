import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Image optimization
  images: {
    // Pinned to the exact hosts we serve from. Wildcards like
    // `*.workers.dev` / `*.supabase.co` would let ANYONE's worker or
    // Supabase project be optimized through our /_next/image endpoint
    // (billing abuse + cache pollution).
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vhsttqejskvofqxgddho.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'smartmove-image-proxy.alessio-mauri030702.workers.dev',
      },
      {
        protocol: 'https',
        hostname: 'media-webapi.resales-online.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.resales-online.com',
      },
      // Dev-only placeholder sources
      ...(process.env.NODE_ENV !== 'production'
        ? [
            { protocol: 'https' as const, hostname: 'picsum.photos' },
            { protocol: 'https' as const, hostname: 'images.unsplash.com' },
          ]
        : []),
    ],
    // Optimize image formats for better performance
    formats: ['image/avif', 'image/webp'],
    // Source images are immutable per URL (R2-keyed, content never changes
    // under the same path) — cache optimized variants for 31 days instead
    // of the 4h default to cut re-optimization cost.
    minimumCacheTTL: 2678400,
    // Enable image optimization for external images
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Powered by header removal for cleaner responses
  poweredByHeader: false,

  // Strict mode for better React practices
  reactStrictMode: true,

  // Headers for SEO and security
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          // Security headers
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Performance headers
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
      {
        // public/ assets are NOT content-hashed (replacing hero/brand
        // files keeps the same URL), so a 1-year immutable here served
        // stale assets indefinitely. A day + a week of SWR is plenty.
        source: '/(.*)\\.(ico|png|jpg|jpeg|gif|webp|svg|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      // NOTE: no custom headers for /_next/static (Next serves it
      // immutable already) or /_next/image (controlled by
      // images.minimumCacheTTL) — the previous blocks were no-ops.
    ];
  },

  // Experimental features for better performance
  experimental: {
    // Optimize package imports — tree-shake barrel exports.
    // (lucide-react and the dnd-kit family are the only barrel-heavy
    // packages actually in the dependency tree.)
    optimizePackageImports: [
      'lucide-react',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
    ],
  },
};

export default withNextIntl(nextConfig);
