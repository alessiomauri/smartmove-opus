'use client';

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { Heart, Share2, Trash2, ArrowLeft } from 'lucide-react';
import FavouritePropertyCard from '@/components/FavouritePropertyCard';
import ShareModal from '@/components/ShareModal';
import { useFavourites } from '@/hooks/useFavourites';
import { usePropertiesByIds } from '@/hooks/useProperties';
import { cn } from '@/lib/utils';

export default function FavouritesPage() {
  const { favourites, isLoaded, generateShareLink, clearFavourites } = useFavourites();
  const { properties, loading, error } = usePropertiesByIds(favourites);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const shareUrl = generateShareLink() || '';

  return (
    <div className="min-h-screen bg-[#faf9f8] relative overflow-hidden">
      {/* Subtle background orbs */}
      <div className="fixed top-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-[#3c9ba7]/[0.03] to-transparent rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-gradient-radial from-[#3c9ba7]/[0.02] to-transparent rounded-full blur-3xl pointer-events-none translate-y-1/2 -translate-x-1/3" />

      {/* Header - Glass effect */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/[0.04]">
        {/* Animated accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#3c9ba7]/40 to-transparent" />

        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between h-[60px] sm:h-[76px]">
            {/* Logo */}
            <Link href="/" className="group relative flex-shrink-0">
              <span className="text-[20px] sm:text-[26px] tracking-[-0.02em] font-gloock text-[#3c9ba7] transition-all duration-500 group-hover:text-[#2d8a95]">
                Smartmove Marbella
              </span>
              <span className="absolute -bottom-0.5 left-0 h-[1px] w-0 bg-gradient-to-r from-[#3c9ba7] to-[#4aabb7] transition-all duration-500 ease-out group-hover:w-full" />
            </Link>

            {/* Navigation - Desktop */}
            <nav className="hidden sm:flex items-center gap-1">
              <Link
                href="/"
                className="group flex items-center gap-2 px-4 py-2 rounded-full text-[#2e2e2e]/60 hover:text-[#3c9ba7] hover:bg-[#3c9ba7]/[0.06] transition-all duration-400"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="transition-transform duration-400 group-hover:scale-110">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                <span className="text-[11px] font-semibold tracking-[0.08em] uppercase">Properties</span>
              </Link>

              {/* Divider */}
              <div className="w-[1px] h-5 bg-gradient-to-b from-transparent via-[#2e2e2e]/10 to-transparent mx-2" />

              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#3c9ba7]/[0.08] text-[#3c9ba7]">
                <Heart className="w-4 h-4" strokeWidth="1.5" />
                <span className="text-[11px] font-semibold tracking-[0.08em] uppercase">Favorites</span>
                {favourites.length > 0 && (
                  <span className="ml-1 min-w-[18px] h-[18px] flex items-center justify-center text-[9px] font-bold text-white bg-[#3c9ba7] rounded-full">
                    {favourites.length}
                  </span>
                )}
              </div>
            </nav>

            {/* Navigation - Mobile */}
            <nav className="flex sm:hidden items-center gap-2">
              <Link
                href="/"
                className="p-2 rounded-full text-[#2e2e2e]/60 hover:text-[#3c9ba7] hover:bg-[#3c9ba7]/[0.06] transition-all"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </Link>

              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#3c9ba7]/[0.08] text-[#3c9ba7]">
                <Heart className="w-4 h-4" strokeWidth="1.5" />
                {favourites.length > 0 && (
                  <span className="min-w-[16px] h-[16px] flex items-center justify-center text-[9px] font-bold text-white bg-[#3c9ba7] rounded-full">
                    {favourites.length}
                  </span>
                )}
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section - Compact */}
      <section className={cn(
        "relative py-6 sm:py-8 lg:py-10 transition-all duration-1000",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16">
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Title Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="hidden sm:flex items-center gap-3">
                  <div className="w-8 h-[1px] bg-gradient-to-r from-[#3c9ba7] to-transparent" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-[#3c9ba7]">Collection</span>
                </div>
                <h1 className="font-gloock text-[28px] sm:text-[32px] md:text-[40px] lg:text-[48px] text-[#3c9ba7] leading-[1.1] tracking-tight">
                  Saved Properties
                </h1>
                {favourites.length > 0 && (
                  <span className="hidden md:inline-block text-[13px] text-[#2e2e2e]/40">
                    {properties.length} {properties.length === 1 ? 'property' : 'properties'}
                  </span>
                )}
              </div>

              {/* Action Buttons - Desktop */}
              {favourites.length > 0 && (
                <div className={cn(
                  "hidden sm:flex items-center gap-3 transition-all duration-700 delay-300",
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                )}>
                  <button
                    onClick={() => clearFavourites()}
                    className="group flex items-center gap-2 px-4 py-2 border border-[#2e2e2e]/10 rounded-full text-[#2e2e2e]/50 hover:border-red-200 hover:text-red-400 hover:bg-red-50/50 transition-all duration-300"
                  >
                    <Trash2 className="w-3.5 h-3.5 transition-transform duration-300 group-hover:scale-110" />
                    <span className="text-[10px] tracking-[0.1em] uppercase font-medium">Clear</span>
                  </button>
                  <button
                    onClick={() => setIsShareModalOpen(true)}
                    className="group flex items-center gap-2 px-4 py-2 rounded-full bg-[#3c9ba7] text-white hover:bg-[#358d98] hover:shadow-lg hover:shadow-[#3c9ba7]/20 transition-all duration-300"
                  >
                    <Share2 className="w-3.5 h-3.5 transition-transform duration-300 group-hover:scale-110" />
                    <span className="text-[10px] tracking-[0.1em] uppercase font-medium">Share</span>
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons - Mobile */}
            {favourites.length > 0 && (
              <div className={cn(
                "flex sm:hidden items-center gap-2 transition-all duration-700 delay-300",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}>
                <button
                  onClick={() => clearFavourites()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-[#2e2e2e]/10 rounded-full text-[#2e2e2e]/50 hover:border-red-200 hover:text-red-400 transition-all duration-300"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-[11px] tracking-[0.08em] uppercase font-medium">Clear All</span>
                </button>
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#3c9ba7] text-white hover:bg-[#358d98] transition-all duration-300"
                >
                  <Share2 className="w-4 h-4" />
                  <span className="text-[11px] tracking-[0.08em] uppercase font-medium">Share</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 mt-6">
          <div className="h-[1px] bg-gradient-to-r from-transparent via-[#3c9ba7]/15 to-transparent" />
        </div>
      </section>

      {/* Content */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-20">
        {!isLoaded || loading ? (
          // Elegant Loading skeleton
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl overflow-hidden shadow-sm"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex flex-col lg:flex-row">
                  <div className="w-full lg:w-[340px] h-[240px] bg-gradient-to-br from-[#f5f3f0] to-[#ebe8e4] animate-pulse" />
                  <div className="flex-1 p-8">
                    <div className="h-8 w-48 bg-[#f0ebe4] rounded animate-pulse mb-4" />
                    <div className="h-4 w-full bg-[#f0ebe4] rounded animate-pulse mb-2" />
                    <div className="h-4 w-3/4 bg-[#f0ebe4] rounded animate-pulse mb-6" />
                    <div className="h-6 w-32 bg-[#f0ebe4] rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : favourites.length === 0 ? (
          // Empty State - Elegant design
          <div className={cn(
            "text-center py-16 sm:py-20 transition-all duration-1000 delay-200",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <div className="relative inline-block mb-8">
              {/* Decorative rings */}
              <div className="absolute inset-0 w-28 h-28 rounded-full border border-[#3c9ba7]/10 animate-ping" style={{ animationDuration: '3s' }} />
              <div className="absolute inset-2 w-24 h-24 rounded-full border border-[#3c9ba7]/5" />
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#3c9ba7]/10 to-[#3c9ba7]/5 flex items-center justify-center">
                <Heart className="w-10 h-10 text-[#3c9ba7]/40" strokeWidth={1} />
              </div>
            </div>

            <h2 className="font-gloock text-[28px] sm:text-[32px] md:text-[40px] text-[#3c9ba7] mb-4">
              Start Your Collection
            </h2>
            <p className="text-[14px] sm:text-[15px] text-[#2e2e2e]/50 mb-10 max-w-md mx-auto leading-relaxed px-4">
              Explore our exclusive properties and save your favorites by clicking the heart icon. Your curated collection will appear here.
            </p>
            <Link
              href="/"
              className="group inline-flex items-center gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-[#3c9ba7] text-white rounded-full hover:bg-[#358d98] hover:shadow-xl hover:shadow-[#3c9ba7]/20 transition-all duration-500"
            >
              <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
              <span className="text-[11px] sm:text-[12px] tracking-[0.15em] uppercase font-medium">Explore Properties</span>
            </Link>
          </div>
        ) : properties.length === 0 ? (
          // Error State
          <div className={cn(
            "text-center py-16 sm:py-20 transition-all duration-1000 delay-200",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <div className="w-20 h-20 rounded-full bg-[#3c9ba7]/5 flex items-center justify-center mx-auto mb-6">
              <Heart className="w-8 h-8 text-[#3c9ba7]/30" strokeWidth={1} />
            </div>
            <h2 className="font-gloock text-[24px] sm:text-[28px] text-[#3c9ba7] mb-3">
              Properties Unavailable
            </h2>
            <p className="text-[14px] sm:text-[15px] text-[#2e2e2e]/50 mb-8 max-w-md mx-auto px-4">
              {error ? `Error: ${error}` : `Your saved properties may have been removed or are temporarily unavailable.`}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
              <button
                onClick={() => clearFavourites()}
                className="w-full sm:w-auto px-6 py-3 border border-[#2e2e2e]/10 rounded-full text-[#2e2e2e]/60 hover:border-[#3c9ba7]/30 hover:text-[#3c9ba7] transition-all duration-300 text-[12px] tracking-[0.1em] uppercase"
              >
                Clear List
              </button>
              <Link
                href="/"
                className="w-full sm:w-auto px-6 py-3 bg-[#3c9ba7] text-white rounded-full hover:bg-[#358d98] transition-all duration-300 text-[12px] tracking-[0.1em] uppercase text-center"
              >
                Browse Properties
              </Link>
            </div>
          </div>
        ) : (
          // Properties List
          <div className="space-y-6">
            {properties.map((property, index) => (
              <div
                key={property.id}
                className={cn(
                  "transition-all duration-700",
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
                style={{ transitionDelay: `${200 + index * 100}ms` }}
              >
                <FavouritePropertyCard property={property} />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-16 lg:py-20 bg-[#faf9f8] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-[#3c9ba7]/[0.02] rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 text-center relative">
          <h2 className="font-gloock text-[28px] md:text-[36px] lg:text-[44px] text-[#3c9ba7] leading-none mb-3 tracking-tight">
            Smartmove Marbella
          </h2>
          <p className="text-[12px] text-[#2e2e2e]/40 tracking-[0.2em] uppercase">
            © {new Date().getFullYear()} All Rights Reserved
          </p>
        </div>
      </footer>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        shareUrl={shareUrl}
        title="My Saved Properties - Smartmove Marbella"
        description="Check out these luxury properties I found in Marbella!"
      />
    </div>
  );
}
