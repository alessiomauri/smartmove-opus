'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from '@/i18n/navigation';
import FilterBar from '@/components/FilterBar';
import PropertyGrid from '@/components/PropertyGrid';
import { useFavourites } from '@/hooks/useFavourites';
import { Property, PropertyFilters, SortOption, PropertyType } from '@/types/property';

type QuickPrice = 'under3' | '3to6' | '6plus' | null;

const PRICE_RANGES: Record<Exclude<QuickPrice, null>, { min?: number; max?: number }> = {
  under3: { max: 3000000 },
  '3to6': { min: 3000000, max: 6000000 },
  '6plus': { min: 6000000 },
};

interface HomeClientProps {
  initialProperties: Property[];
  defaultSort: SortOption;
  /**
   * When false, the embedded sticky header + hero band is hidden — used when
   * this component is composed below the new HomeHero (which has its own topbar).
   * Defaults to true to preserve the standalone listings page behaviour.
   */
  showHeader?: boolean;
}

export default function HomeClient({ initialProperties, defaultSort, showHeader = true }: HomeClientProps) {
  const [filters, setFilters] = useState<PropertyFilters>({});
  const [quickPrice, setQuickPrice] = useState<QuickPrice>(null);
  const [quickType, setQuickType] = useState<PropertyType | null>(null);
  const [sort, setSort] = useState<SortOption | null>(null);
  const { favouriteCount } = useFavourites();

  // Use admin default sort until user explicitly changes it
  const activeSort = sort ?? defaultSort;

  // Ensure page starts at top on mount (fixes mobile scroll restoration issue)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Handle quick price toggle
  const handleQuickPrice = useCallback((key: Exclude<QuickPrice, null>) => {
    if (quickPrice === key) {
      setQuickPrice(null);
      setFilters(f => ({ ...f, minPrice: undefined, maxPrice: undefined }));
    } else {
      setQuickPrice(key);
      const range = PRICE_RANGES[key];
      setFilters(f => ({ ...f, minPrice: range.min, maxPrice: range.max }));
    }
  }, [quickPrice]);

  // Handle quick type toggle
  const handleQuickType = useCallback((key: PropertyType) => {
    if (quickType === key) {
      setQuickType(null);
      setFilters(f => ({ ...f, propertyType: undefined }));
    } else {
      setQuickType(key);
      setFilters(f => ({ ...f, propertyType: key }));
    }
  }, [quickType]);

  // Sync: if user changes filters via FilterBar, clear quick buttons
  const handleFiltersChange = useCallback((newFilters: PropertyFilters) => {
    setFilters(newFilters);
    if (quickPrice) {
      const range = PRICE_RANGES[quickPrice];
      if (newFilters.minPrice !== range.min || newFilters.maxPrice !== range.max) {
        setQuickPrice(null);
      }
    }
    if (quickType && newFilters.propertyType !== quickType) {
      setQuickType(null);
    }
  }, [quickPrice, quickType]);

  const clearAllQuickFilters = useCallback(() => {
    setQuickPrice(null);
    setQuickType(null);
    setFilters({});
  }, []);

  const hasQuickFilters = quickPrice !== null || quickType !== null;

  // Apply filters & sort client-side over the initial server-rendered list.
  // No network calls — instant filtering, no Supabase round-trip per visitor.
  const properties = useMemo(() => {
    let result = [...initialProperties];

    if (filters.status && filters.status !== 'all') {
      result = result.filter((p) => p.status === filters.status);
    }
    if (filters.propertyType) {
      result = result.filter((p) => p.property_type === filters.propertyType);
    }
    if (filters.area || filters.childAreaNames?.length || filters.microLocationSlugs?.length) {
      result = result.filter((p) => {
        if (filters.area && p.area === filters.area) return true;
        if (filters.childAreaNames?.length && filters.childAreaNames.includes(p.area)) return true;
        if (filters.microLocationSlugs?.length && p.micro_location) {
          return filters.microLocationSlugs.includes(p.micro_location);
        }
        return false;
      });
    }
    if (filters.minPrice !== undefined) {
      result = result.filter((p) => p.price !== null && p.price >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined) {
      result = result.filter((p) => p.price !== null && p.price <= filters.maxPrice!);
    }
    if (filters.minBedrooms !== undefined) {
      result = result.filter((p) => p.bedrooms !== null && p.bedrooms >= filters.minBedrooms!);
    }
    if (filters.features && filters.features.length > 0) {
      result = result.filter((p) =>
        filters.features!.every((f) => p.features.includes(f))
      );
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          p.location.toLowerCase().includes(s) ||
          p.description.toLowerCase().includes(s)
      );
    }

    const applySortOrder = (a: Property, b: Property) => {
      switch (activeSort) {
        case 'price_asc':
          if (a.price === null) return 1;
          if (b.price === null) return -1;
          return a.price - b.price;
        case 'price_desc':
          if (a.price === null) return 1;
          if (b.price === null) return -1;
          return b.price - a.price;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    };

    // Featured properties always come first, sorted by featured_order
    result.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      if (a.is_featured && b.is_featured) {
        return (a.featured_order ?? 0) - (b.featured_order ?? 0);
      }
      return applySortOrder(a, b);
    });

    return result;
  }, [initialProperties, filters, activeSort]);

  return (
    <div className={showHeader ? "min-h-screen" : ""} style={{ background: 'var(--sm-paper)' }}>
      {showHeader && (
      <>
      {/* Premium Header - Ultra Modern Glass Design */}
      <header className="sticky top-0 z-50 header-glass">
        {/* Animated gradient border at top */}
        <div className="absolute top-0 left-0 right-0 h-[2px] header-gradient-border" />

        {/* Floating orb accents - decorative */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-gold/[0.08] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-10 right-1/4 w-32 h-32 bg-gold-soft/[0.06] rounded-full blur-2xl pointer-events-none animate-float-slow" />

        {/* Inner shimmer effect */}
        <div className="absolute inset-0 header-shimmer pointer-events-none" />

        {/* Single Row - Brand, Filters & Favorites */}
        <div className="hidden lg:block max-w-[1600px] mx-auto px-8 lg:px-12 relative">
          <div className="flex items-center gap-10 h-[72px]">
            {/* Logo */}
            <Link href="/" className="group relative shrink-0">
              <span className="text-[26px] tracking-[-0.02em] font-display text-gold transition-all duration-500 group-hover:text-gold-deep">
                Smartmove Marbella
              </span>
              <span className="absolute -bottom-0.5 left-0 h-[1px] w-0 bg-gradient-to-r from-gold to-gold-soft transition-all duration-500 ease-out group-hover:w-full" />
            </Link>

            {/* Divider */}
            <div className="w-[1px] h-7 bg-gradient-to-b from-transparent via-ink/10 to-transparent shrink-0" />

            {/* Filters - takes remaining space */}
            <div className="flex-1">
              <FilterBar
                filters={filters}
                onFiltersChange={handleFiltersChange}
                sort={activeSort}
                onSortChange={setSort}
                resultCount={properties.length}
                inline={true}
              />
            </div>

            {/* Divider */}
            <div className="w-[1px] h-7 bg-gradient-to-b from-transparent via-ink/10 to-transparent shrink-0" />

            {/* Favorites */}
            <Link
              href="/favourites"
              className="group flex items-center gap-2 px-4 py-2 rounded-full text-ink/60 transition-all duration-400 hover:text-gold hover:bg-gold/[0.06] hover:shadow-[0_2px_12px_-3px_rgba(60,155,167,0.15)] shrink-0"
            >
              <div className="relative">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="transition-transform duration-400 group-hover:scale-110"
                >
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                {favouriteCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] flex items-center justify-center text-[9px] font-bold text-white bg-gradient-to-br from-gold to-gold-deep rounded-full shadow-sm">
                    {favouriteCount}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase">Saved</span>
            </Link>
          </div>
        </div>

        {/* Mobile - Logo only */}
        <div className="lg:hidden max-w-[1600px] mx-auto px-6 relative">
          <div className="flex items-center justify-between h-[60px]">
            <Link href="/" className="group relative">
              <span className="text-[24px] tracking-[-0.02em] font-display text-gold">
                Smartmove Marbella
              </span>
            </Link>
            <Link
              href="/favourites"
              className="relative p-2.5 text-ink/60 rounded-full hover:bg-gold/[0.06] transition-colors duration-300"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              {favouriteCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[14px] h-[14px] flex items-center justify-center text-[8px] font-bold text-white bg-gradient-to-br from-gold to-gold-deep rounded-full shadow-sm">
                  {favouriteCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Sleek divider line */}
      <div className="header-divider" />
      </>
      )}

      {/* Quick Filter Buttons */}
      <div className="max-w-[1600px] mx-auto px-6 lg:px-10 pt-4 lg:pt-6">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => handleQuickType('villa')}
            className={`px-4 py-2 text-[12px] font-semibold tracking-[0.04em] rounded-full border transition-all duration-300 ${
              quickType === 'villa'
                ? 'bg-ink text-white border-ink'
                : 'bg-white text-ink/70 border-ink/[0.1] hover:border-ink/30 hover:text-ink'
            }`}
          >
            Villas
          </button>
          <button
            onClick={() => handleQuickType('apartment')}
            className={`px-4 py-2 text-[12px] font-semibold tracking-[0.04em] rounded-full border transition-all duration-300 ${
              quickType === 'apartment'
                ? 'bg-ink text-white border-ink'
                : 'bg-white text-ink/70 border-ink/[0.1] hover:border-ink/30 hover:text-ink'
            }`}
          >
            Apartments
          </button>

          <div className="w-[1px] h-5 bg-ink/[0.08] mx-1" />

          <button
            onClick={() => handleQuickPrice('under3')}
            className={`px-4 py-2 text-[12px] font-semibold tracking-[0.04em] rounded-full border transition-all duration-300 ${
              quickPrice === 'under3'
                ? 'bg-gold text-white border-gold'
                : 'bg-white text-ink/70 border-ink/[0.1] hover:border-gold/30 hover:text-gold'
            }`}
          >
            Under €3M
          </button>
          <button
            onClick={() => handleQuickPrice('3to6')}
            className={`px-4 py-2 text-[12px] font-semibold tracking-[0.04em] rounded-full border transition-all duration-300 ${
              quickPrice === '3to6'
                ? 'bg-gold text-white border-gold'
                : 'bg-white text-ink/70 border-ink/[0.1] hover:border-gold/30 hover:text-gold'
            }`}
          >
            €3M – €6M
          </button>
          <button
            onClick={() => handleQuickPrice('6plus')}
            className={`px-4 py-2 text-[12px] font-semibold tracking-[0.04em] rounded-full border transition-all duration-300 ${
              quickPrice === '6plus'
                ? 'bg-gold text-white border-gold'
                : 'bg-white text-ink/70 border-ink/[0.1] hover:border-gold/30 hover:text-gold'
            }`}
          >
            €6M+
          </button>

          {hasQuickFilters && (
            <button
              onClick={clearAllQuickFilters}
              className="ml-1 px-3 py-2 text-[11px] font-medium text-ink/40 hover:text-ink/70 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Mobile Filters (advanced) */}
      <div className="lg:hidden px-4 pt-2 pb-3">
        <FilterBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          sort={activeSort}
          onSortChange={setSort}
          resultCount={properties.length}
          inline={false}
        />
      </div>

      {/* Main Content with refined spacing */}
      <main className="max-w-[1600px] mx-auto px-6 lg:px-10 pt-4 lg:py-6 pb-10">
        <PropertyGrid properties={properties} loading={false} />
      </main>

      {/* Footer */}
      <footer className="py-20 mt-16 bg-paper overflow-hidden">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10 text-center">
          <h2 className="font-display text-[28px] md:text-[36px] lg:text-[44px] text-gold/90 leading-none mb-4 tracking-tight">
            Smartmove Marbella
          </h2>
          <p className="text-[13px] text-ink/40 tracking-widest uppercase">
            © {new Date().getFullYear()} All Rights Reserved
          </p>
        </div>
      </footer>
    </div>
  );
}
