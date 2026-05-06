'use client';

import { Link } from '@/i18n/navigation';
import { Heart, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useFavourites } from '@/hooks/useFavourites';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { favouriteCount } = useFavourites();

  return (
    <header className="sticky top-0 z-50 glass border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-semibold tracking-tight">
              <span className="text-[#0f6c74]">Marbella</span>
              <span className="text-[#2E2E2E]"> Live</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className="text-sm font-medium text-gray-700 hover:text-[#0f6c74] transition-colors"
            >
              Properties
            </Link>
            <Link
              href="/favourites"
              className="relative flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#0f6c74] transition-colors"
            >
              <Heart className="w-4 h-4" />
              <span>Favourites</span>
              {favouriteCount > 0 && (
                <span className="absolute -top-2 -right-4 bg-[#0f6c74] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {favouriteCount}
                </span>
              )}
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-gray-700 hover:text-[#0f6c74]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100">
          <nav className="flex flex-col px-4 py-4 space-y-4">
            <Link
              href="/"
              className="text-sm font-medium text-gray-700 hover:text-[#0f6c74] transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Properties
            </Link>
            <Link
              href="/favourites"
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#0f6c74] transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Heart className="w-4 h-4" />
              <span>Favourites</span>
              {favouriteCount > 0 && (
                <span className="bg-[#0f6c74] text-white text-xs px-2 py-0.5 rounded-full ml-2">
                  {favouriteCount}
                </span>
              )}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
