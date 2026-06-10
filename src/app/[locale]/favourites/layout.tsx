import { Metadata } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';

export const metadata: Metadata = {
  title: 'Saved Properties | Your Luxury Property Collection',
  description:
    'View and manage your saved luxury properties in Marbella. Share your collection of villas, apartments, and penthouses with friends and family.',
  // Personal, localStorage-driven page (and the [shareId] share pages
  // beneath it): zero search value, and shared lists shouldn't be
  // indexable. follow stays on so link equity flows to the cards.
  robots: { index: false, follow: true },
  alternates: { canonical: `${baseUrl}/favourites` },
  openGraph: {
    title: 'Saved Properties | Smartmove Marbella',
    description:
      'Your personal collection of luxury properties in Marbella, Costa del Sol.',
    url: `${baseUrl}/favourites`,
    siteName: 'Smartmove Marbella',
    locale: 'en_US',
    type: 'website',
  },
};

export default function FavouritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
