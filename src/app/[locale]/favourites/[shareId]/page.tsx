'use client';

import { use, useMemo } from 'react';
import { Link } from '@/i18n/navigation';
import { Heart, Share2 } from 'lucide-react';
import PropertyGrid from '@/components/PropertyGrid';
import { usePropertiesByIds } from '@/hooks/useProperties';
import { decodeSharedFavourites } from '@/hooks/useFavourites';

interface SharedFavouritesPageProps {
  params: Promise<{ shareId: string }>;
}

export default function SharedFavouritesPage({
  params,
}: SharedFavouritesPageProps) {
  const { shareId } = use(params);
  const propertyIds = useMemo(() => decodeSharedFavourites(shareId), [shareId]);
  const { properties, loading, error } = usePropertiesByIds(propertyIds);

  const isInvalid = propertyIds.length === 0 || error;

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link href="/" className="group relative flex-shrink-0 inline-block">
              <span className="text-[28px] tracking-tight font-display text-gold transition-colors group-hover:text-gold-deep">
                Smartmove Marbella
              </span>
              <span className="absolute -bottom-0.5 left-0 h-[1px] w-0 bg-gold transition-all duration-500 ease-out group-hover:w-full" />
            </Link>

            {/* Navigation */}
            <nav className="flex items-center gap-6">
              <Link
                href="/"
                className="flex items-center gap-2 text-ink hover:text-gold transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                <span className="text-sm uppercase tracking-wider">Properties</span>
              </Link>
              <Link
                href="/favourites"
                className="flex items-center gap-2 text-ink hover:text-gold transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                </svg>
                <span className="text-sm uppercase tracking-wider">Favorites</span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Page Title Section */}
      <section className="py-12 bg-paper">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Share2 className="w-8 h-8 text-gold" strokeWidth={1.5} />
                <h1 className="font-display text-[48px] md:text-[64px] text-gold leading-none">
                  Shared Favorites
                </h1>
              </div>
              {!isInvalid && (
                <p className="text-[15px] text-ink/60">
                  {properties.length} {properties.length === 1 ? 'property' : 'properties'} shared with you
                </p>
              )}
            </div>

            <Link
              href="/favourites"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-white text-[13px] uppercase tracking-wider hover:bg-gold-deep transition-colors"
            >
              <Heart className="w-4 h-4" />
              View My Favorites
            </Link>
          </div>
        </div>
      </section>

      {/* Content */}
      <main className="max-w-[1600px] mx-auto px-6 lg:px-10 pb-16">
        {isInvalid ? (
          <div className="text-center py-20">
            <Share2 className="w-16 h-16 text-gold/30 mx-auto mb-6" strokeWidth={1} />
            <h2 className="font-display text-[28px] text-gold mb-3">
              Invalid or Expired Link
            </h2>
            <p className="text-[15px] text-ink/60 mb-8 max-w-md mx-auto">
              This shared favorites link is invalid or has expired. The
              properties may have been removed.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gold text-white text-[13px] uppercase tracking-wider hover:bg-gold-deep transition-colors"
            >
              Browse All Properties
            </Link>
          </div>
        ) : (
          <PropertyGrid properties={properties} loading={loading} />
        )}
      </main>

      {/* Footer */}
      <footer className="py-16 bg-paper">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10 text-center">
          <h2 className="font-display text-[28px] md:text-[36px] lg:text-[44px] text-gold leading-none mb-3 tracking-tight">
            Smartmove Marbella
          </h2>
          <p className="text-sm text-ink/60">
            © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
