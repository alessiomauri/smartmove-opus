import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { shouldShowListings } from '@/lib/visibility';
import { PROPERTIES_PUBLIC } from '@/lib/feature-flags';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://marbella.live';

// Auth-dependent — must run per request
export const dynamic = 'force-dynamic';

// Standard SEO metadata when properties are public; noindex placeholder
// while listings are dark.
export const metadata: Metadata = PROPERTIES_PUBLIC
  ? {
      title: 'Saved Properties | Your Luxury Property Collection',
      description:
        'View and manage your saved luxury properties in Marbella. Share your collection of villas, apartments, and penthouses with friends and family.',
      robots: { index: true, follow: true },
      alternates: { canonical: `${baseUrl}/favourites` },
      openGraph: {
        title: 'Saved Properties | Marbella Live',
        description:
          'Your personal collection of luxury properties in Marbella, Costa del Sol.',
        url: `${baseUrl}/favourites`,
        siteName: 'Marbella Live',
        locale: 'en_US',
        type: 'website',
      },
    }
  : {
      title: 'Marbella Live',
      robots: { index: false, follow: false, nocache: true },
    };

/**
 * Gate the entire /favourites/* subtree behind the property visibility flag.
 * Public visitors get a 404 while listings are dark; logged-in admins see the
 * pages as a live preview of the post-launch experience.
 */
export default async function FavouritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await shouldShowListings())) {
    notFound();
  }
  return <>{children}</>;
}
