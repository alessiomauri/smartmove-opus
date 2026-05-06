'use client';

import { Link } from '@/i18n/navigation';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Menu, X } from 'lucide-react';
import ShareButton from './ShareButton';

interface PropertyHeaderProps {
  propertyName: string;
  propertyId?: string;
  propertySlug?: string;
}

// Custom icons to match marbella.live exactly
const GalleryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

const FloorplansIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 21V9" />
  </svg>
);

const LocationIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

const PropertiesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const FavoritesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
  </svg>
);

const navItems = [
  { id: 'gallery', label: 'Gallery', Icon: GalleryIcon },
  { id: 'floor-plans', label: 'Floorplans', Icon: FloorplansIcon },
  { id: 'location', label: 'Location', Icon: LocationIcon },
];

export default function PropertyHeader({ propertyName, propertyId, propertySlug }: PropertyHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!propertySlug || isDownloading) return;

    setIsDownloading(true);
    try {
      const response = await fetch(`/api/property/${propertySlug}/brochure`);
      if (!response.ok) throw new Error('Failed to generate brochure');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${propertySlug}-brochure.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu when scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobileMenuOpen]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]',
        isScrolled
          ? 'bg-white/95 backdrop-blur-xl border-b border-black/[0.03]'
          : 'bg-gradient-to-b from-black/50 via-black/20 to-transparent'
      )}
    >
      {/* Animated accent line - only visible when scrolled */}
      <div className={cn(
        'absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#3c9ba7]/50 to-transparent transition-opacity duration-500',
        isScrolled ? 'opacity-100' : 'opacity-0'
      )} />

      <div className="max-w-[1600px] mx-auto px-8 lg:px-12">
        <div className={cn(
          'flex items-center justify-between transition-all duration-700 ease-out',
          isScrolled ? 'h-[76px]' : 'h-[88px]'
        )}>
          {/* Logo with refined animation */}
          <Link href="/" className="flex items-center group relative">
            <span
              className={cn(
                'text-[26px] tracking-[-0.02em] font-gloock transition-all duration-500',
                isScrolled
                  ? 'text-[#3c9ba7] group-hover:text-[#2d8a95]'
                  : 'text-white group-hover:text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
              )}
            >
              Smartmove Marbella
            </span>
            {/* Elegant underline effect */}
            <span className={cn(
              'absolute -bottom-0.5 left-0 h-[1px] transition-all duration-500 ease-out',
              isScrolled
                ? 'w-0 bg-[#3c9ba7]/50 group-hover:w-full'
                : 'w-0 bg-white/40 group-hover:w-full'
            )} />
          </Link>

          {/* Desktop Navigation - refined with better spacing and hover states */}
          <nav className="hidden lg:flex items-center">
            {/* Section navigation with pill hover effect */}
            <div className="flex items-center gap-1 mr-6">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={cn(
                    'group relative flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-400',
                    isScrolled
                      ? 'text-[#2e2e2e]/60 hover:text-[#3c9ba7] hover:bg-[#3c9ba7]/[0.06]'
                      : 'text-white/80 hover:text-white hover:bg-white/[0.08]'
                  )}
                >
                  <span className="transition-transform duration-400 group-hover:scale-110 group-hover:-rotate-3">
                    <item.Icon />
                  </span>
                  <span className="text-[12px] font-semibold tracking-[0.1em] uppercase">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Elegant vertical divider */}
            <div className={cn(
              'w-[1px] h-6 mx-4 transition-all duration-500',
              isScrolled
                ? 'bg-gradient-to-b from-transparent via-[#2e2e2e]/12 to-transparent'
                : 'bg-gradient-to-b from-transparent via-white/25 to-transparent'
            )} />

            {/* Action buttons with refined styling */}
            <div className="flex items-center gap-1">
              {/* Download button */}
              <button
                onClick={handleDownload}
                disabled={isDownloading || !propertySlug}
                className={cn(
                  'group relative flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-400',
                  isScrolled
                    ? 'text-[#2e2e2e]/60 hover:text-[#3c9ba7] hover:bg-[#3c9ba7]/[0.06]'
                    : 'text-white/80 hover:text-white hover:bg-white/[0.08]',
                  (isDownloading || !propertySlug) && 'opacity-50 cursor-not-allowed'
                )}
              >
                <span className={cn(
                  "transition-all duration-400 group-hover:scale-110 group-hover:translate-y-0.5",
                  isDownloading && "animate-pulse"
                )}>
                  <DownloadIcon />
                </span>
                <span className="text-[12px] font-semibold tracking-[0.1em] uppercase">
                  {isDownloading ? 'Generating...' : 'Download'}
                </span>
              </button>

              {/* Share button */}
              {propertySlug && (
                <ShareButton
                  propertyName={propertyName}
                  propertySlug={propertySlug}
                  isScrolled={isScrolled}
                />
              )}

              {/* Properties link */}
              <Link
                href="/"
                className={cn(
                  'group relative flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-400',
                  isScrolled
                    ? 'text-[#2e2e2e]/60 hover:text-[#3c9ba7] hover:bg-[#3c9ba7]/[0.06]'
                    : 'text-white/80 hover:text-white hover:bg-white/[0.08]'
                )}
              >
                <span className="transition-transform duration-400 group-hover:scale-110">
                  <PropertiesIcon />
                </span>
                <span className="text-[12px] font-semibold tracking-[0.1em] uppercase">
                  Properties
                </span>
              </Link>

              {/* Favorites link */}
              <Link
                href="/favourites"
                className={cn(
                  'group relative flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-400',
                  isScrolled
                    ? 'text-[#2e2e2e]/60 hover:text-[#3c9ba7] hover:bg-[#3c9ba7]/[0.06]'
                    : 'text-white/80 hover:text-white hover:bg-white/[0.08]'
                )}
              >
                <span className="transition-transform duration-400 group-hover:scale-110">
                  <FavoritesIcon />
                </span>
                <span className="text-[12px] font-semibold tracking-[0.1em] uppercase">
                  Favorites
                </span>
              </Link>
            </div>
          </nav>

          {/* Mobile Menu Button - refined with better animation */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={cn(
              'lg:hidden relative w-10 h-10 flex items-center justify-center rounded-full transition-all duration-400',
              isScrolled
                ? 'text-[#2e2e2e] hover:bg-[#2e2e2e]/[0.06]'
                : 'text-white hover:bg-white/[0.1]'
            )}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            <span className={cn(
              'transition-transform duration-300',
              isMobileMenuOpen ? 'rotate-90 scale-90' : 'rotate-0 scale-100'
            )}>
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Menu - refined with elegant animations */}
      <div
        className={cn(
          'lg:hidden overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]',
          isMobileMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0',
          isScrolled ? 'bg-white/98 backdrop-blur-xl' : 'bg-black/95 backdrop-blur-xl'
        )}
      >
        <nav className="px-6 py-5 flex flex-col gap-0.5">
          {navItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              style={{ transitionDelay: isMobileMenuOpen ? `${index * 50}ms` : '0ms' }}
              className={cn(
                'flex items-center gap-4 py-3.5 px-3 rounded-xl transition-all duration-300',
                isMobileMenuOpen ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0',
                isScrolled
                  ? 'text-[#2e2e2e] hover:bg-[#3c9ba7]/[0.06] hover:text-[#3c9ba7]'
                  : 'text-white hover:bg-white/[0.08]'
              )}
            >
              <item.Icon />
              <span className="text-[14px] font-medium tracking-wide">
                {item.label}
              </span>
            </button>
          ))}

          {/* Elegant divider */}
          <div className={cn(
            'h-[1px] my-3 mx-3 transition-all duration-300',
            isScrolled
              ? 'bg-gradient-to-r from-transparent via-[#2e2e2e]/10 to-transparent'
              : 'bg-gradient-to-r from-transparent via-white/15 to-transparent'
          )} />

          {/* Additional links */}
          <button
            onClick={handleDownload}
            disabled={isDownloading || !propertySlug}
            style={{ transitionDelay: isMobileMenuOpen ? '150ms' : '0ms' }}
            className={cn(
              'flex items-center gap-4 py-3.5 px-3 rounded-xl transition-all duration-300',
              isMobileMenuOpen ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0',
              isScrolled
                ? 'text-[#2e2e2e] hover:bg-[#3c9ba7]/[0.06] hover:text-[#3c9ba7]'
                : 'text-white hover:bg-white/[0.08]',
              (isDownloading || !propertySlug) && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className={isDownloading ? 'animate-pulse' : ''}>
              <DownloadIcon />
            </span>
            <span className="text-[14px] font-medium tracking-wide">
              {isDownloading ? 'Generating...' : 'Download'}
            </span>
          </button>

          <Link
            href="/"
            onClick={() => setIsMobileMenuOpen(false)}
            style={{ transitionDelay: isMobileMenuOpen ? '200ms' : '0ms' }}
            className={cn(
              'flex items-center gap-4 py-3.5 px-3 rounded-xl transition-all duration-300',
              isMobileMenuOpen ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0',
              isScrolled
                ? 'text-[#2e2e2e] hover:bg-[#3c9ba7]/[0.06] hover:text-[#3c9ba7]'
                : 'text-white hover:bg-white/[0.08]'
            )}
          >
            <PropertiesIcon />
            <span className="text-[14px] font-medium tracking-wide">
              Properties
            </span>
          </Link>

          <Link
            href="/favourites"
            onClick={() => setIsMobileMenuOpen(false)}
            style={{ transitionDelay: isMobileMenuOpen ? '250ms' : '0ms' }}
            className={cn(
              'flex items-center gap-4 py-3.5 px-3 rounded-xl transition-all duration-300',
              isMobileMenuOpen ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0',
              isScrolled
                ? 'text-[#2e2e2e] hover:bg-[#3c9ba7]/[0.06] hover:text-[#3c9ba7]'
                : 'text-white hover:bg-white/[0.08]'
            )}
          >
            <FavoritesIcon />
            <span className="text-[14px] font-medium tracking-wide">
              Favorites
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
