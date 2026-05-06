import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: '*.workers.dev',
      },
      {
        protocol: 'https',
        hostname: 'media-webapi.resales-online.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.resales-online.com',
      },
    ],
    // Optimize image formats for better performance
    formats: ['image/avif', 'image/webp'],
    // Enable image optimization for external images
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Compression for better performance (affects SEO Core Web Vitals)
  compress: true,

  // Powered by header removal for cleaner responses
  poweredByHeader: false,

  // Strict mode for better React practices
  reactStrictMode: true,

  // Generate ETags for caching
  generateEtags: true,

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
        // Cache static assets aggressively
        source: '/(.*)\\.(ico|png|jpg|jpeg|gif|webp|svg|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache JavaScript and CSS
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache Next.js optimized images
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },

  // Redirects for SEO (trailing slash normalization)
  async redirects() {
    return [
      // Redirect www to non-www (configure based on your preference)
      // {
      //   source: '/:path*',
      //   has: [{ type: 'host', value: 'www.marbella-live.com' }],
      //   destination: 'https://marbella-live.com/:path*',
      //   permanent: true,
      // },
    ];
  },

  // Experimental features for better performance
  experimental: {
    // Optimize package imports — tree-shake barrel exports
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      'date-fns',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
    ],
  },
};

export default withNextIntl(nextConfig);
