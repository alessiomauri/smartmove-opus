'use client';

import { useState } from 'react';
import { ChevronDown, X, SlidersHorizontal } from 'lucide-react';
import { PropertyFilters, SortOption, AREAS, STATUS_LABELS, PropertyStatus, FEATURE_OPTIONS } from '@/types/property';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  filters: PropertyFilters;
  onFiltersChange: (filters: PropertyFilters) => void;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  resultCount: number;
  inline?: boolean;
}

const MAX_PRICE = 15000000;

export default function FilterBar({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  resultCount,
  inline = false,
}: FilterBarProps) {
  const [showFeatures, setShowFeatures] = useState(false);
  const [showPriceDropdown, setShowPriceDropdown] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([
    filters.minPrice || 0,
    filters.maxPrice || MAX_PRICE
  ]);

  const updateFilter = <K extends keyof PropertyFilters>(
    key: K,
    value: PropertyFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({});
    setPriceRange([0, MAX_PRICE]);
  };

  const hasActiveFilters =
    filters.status ||
    filters.area ||
    filters.minPrice ||
    filters.maxPrice ||
    (filters.features && filters.features.length > 0);

  const toggleFeature = (feature: string) => {
    const currentFeatures = filters.features || [];
    const newFeatures = currentFeatures.includes(feature)
      ? currentFeatures.filter((f) => f !== feature)
      : [...currentFeatures, feature];
    updateFilter('features', newFeatures.length > 0 ? newFeatures : undefined);
  };

  const formatPriceDisplay = (value: number, isMax: boolean = false) => {
    if (isMax && value >= MAX_PRICE) {
      return '€15M+';
    }
    if (value >= 1000000) {
      return `€${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
    }
    return `€${(value / 1000).toFixed(0)}K`;
  };

  const handlePriceChange = (min: number, max: number) => {
    setPriceRange([min, max]);
    updateFilter('minPrice', min > 0 ? min : undefined);
    updateFilter('maxPrice', max < MAX_PRICE ? max : undefined);
  };

  // Inline mode for header - clean underline design, no outlines
  if (inline) {
    return (
      <div className="flex items-start w-full gap-8">
        {/* Search */}
        <div className="flex flex-col flex-1 group">
          <label className="text-[10px] font-semibold text-gold tracking-[0.12em] uppercase mb-2 opacity-80">
            Search
          </label>
          <input
            type="text"
            placeholder="Property name..."
            value={filters.search || ''}
            onChange={(e) => updateFilter('search', e.target.value || undefined)}
            className="w-full bg-transparent text-[14px] text-ink placeholder-ink/35 border-b border-ink/10 pb-2 focus:border-gold/50 transition-colors duration-300"
          />
        </div>

        {/* Location */}
        <div className="flex flex-col flex-1 group">
          <label className="text-[10px] font-semibold text-gold tracking-[0.12em] uppercase mb-2 opacity-80">
            Location
          </label>
          <div className="relative">
            <select
              value={filters.area || ''}
              onChange={(e) => updateFilter('area', e.target.value || undefined)}
              className="w-full appearance-none bg-transparent text-[14px] text-ink border-b border-ink/10 pb-2 pr-6 focus:border-gold/50 cursor-pointer transition-colors duration-300"
            >
              <option value="">All locations</option>
              {AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-0 bottom-2.5 w-4 h-4 text-gold/50 pointer-events-none" />
          </div>
        </div>

        {/* Status */}
        <div className="flex flex-col flex-1 group">
          <label className="text-[10px] font-semibold text-gold tracking-[0.12em] uppercase mb-2 opacity-80">
            Status
          </label>
          <div className="relative">
            <select
              value={filters.status || 'all'}
              onChange={(e) =>
                updateFilter(
                  'status',
                  e.target.value === 'all' ? undefined : (e.target.value as PropertyStatus | 'all')
                )
              }
              className="w-full appearance-none bg-transparent text-[14px] text-ink border-b border-ink/10 pb-2 pr-6 focus:border-gold/50 cursor-pointer transition-colors duration-300"
            >
              <option value="all">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-0 bottom-2.5 w-4 h-4 text-gold/50 pointer-events-none" />
          </div>
        </div>

        {/* Price - Dropdown with slider */}
        <div className="flex flex-col flex-1 relative group">
          <label className="text-[10px] font-semibold text-gold tracking-[0.12em] uppercase mb-2 opacity-80">
            Price
          </label>
          <button
            onClick={() => setShowPriceDropdown(!showPriceDropdown)}
            className="flex items-center justify-between w-full bg-transparent text-[14px] text-ink border-b border-ink/10 pb-2 transition-colors duration-300 hover:border-gold/30"
          >
            <span>
              {priceRange[0] === 0 && priceRange[1] >= MAX_PRICE
                ? 'Any price'
                : `${formatPriceDisplay(priceRange[0])} to ${formatPriceDisplay(priceRange[1], true)}`}
            </span>
            <ChevronDown className={cn("w-4 h-4 text-gold/50 transition-transform duration-300", showPriceDropdown && "rotate-180")} />
          </button>

          {/* Price dropdown */}
          {showPriceDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowPriceDropdown(false)} />
              <div className="absolute top-full left-0 mt-3 bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] rounded-xl p-5 z-50 w-[280px] border border-black/5">
                <div className="space-y-4">
                  {/* Min price */}
                  <div>
                    <label className="text-[10px] font-semibold text-ink/50 tracking-[0.1em] uppercase mb-1.5 block">
                      Min Price
                    </label>
                    <select
                      value={priceRange[0]}
                      onChange={(e) => handlePriceChange(Number(e.target.value), priceRange[1])}
                      className="w-full px-3 py-2 bg-[#f8f6f3] rounded-lg text-[14px] text-ink border-0"
                    >
                      <option value="0">No minimum</option>
                      <option value="500000">€500K</option>
                      <option value="1000000">€1M</option>
                      <option value="2000000">€2M</option>
                      <option value="3000000">€3M</option>
                      <option value="5000000">€5M</option>
                      <option value="7500000">€7.5M</option>
                      <option value="10000000">€10M</option>
                    </select>
                  </div>
                  {/* Max price */}
                  <div>
                    <label className="text-[10px] font-semibold text-ink/50 tracking-[0.1em] uppercase mb-1.5 block">
                      Max Price
                    </label>
                    <select
                      value={priceRange[1]}
                      onChange={(e) => handlePriceChange(priceRange[0], Number(e.target.value))}
                      className="w-full px-3 py-2 bg-[#f8f6f3] rounded-lg text-[14px] text-ink border-0"
                    >
                      <option value="1000000">€1M</option>
                      <option value="2000000">€2M</option>
                      <option value="3000000">€3M</option>
                      <option value="5000000">€5M</option>
                      <option value="7500000">€7.5M</option>
                      <option value="10000000">€10M</option>
                      <option value="15000000">€15M+</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Features */}
        <div className="flex flex-col flex-1 relative group">
          <label className="text-[10px] font-semibold text-gold tracking-[0.12em] uppercase mb-2 opacity-80">
            Features
          </label>
          <button
            onClick={() => setShowFeatures(!showFeatures)}
            className="flex items-center justify-between w-full bg-transparent text-[14px] text-ink border-b border-ink/10 pb-2 transition-colors duration-300 hover:border-gold/30"
          >
            <span>{filters.features?.length ? `${filters.features.length} selected` : 'Any'}</span>
            <ChevronDown className={cn("w-4 h-4 text-gold/50 transition-transform duration-300", showFeatures && "rotate-180")} />
          </button>

          {/* Features dropdown */}
          {showFeatures && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowFeatures(false)} />
              <div className="absolute top-full left-0 mt-3 bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] rounded-xl p-4 z-50 w-[280px] border border-black/5">
                <div className="flex flex-wrap gap-2">
                  {FEATURE_OPTIONS.map((feature) => (
                    <button
                      key={feature}
                      onClick={() => toggleFeature(feature)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200',
                        filters.features?.includes(feature)
                          ? 'bg-gold text-white'
                          : 'bg-[#f5f2ef] text-ink/70 hover:bg-gold/10 hover:text-gold'
                      )}
                    >
                      {feature}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sort */}
        <div className="flex flex-col w-[130px] shrink-0 group">
          <label className="text-[10px] font-semibold text-gold tracking-[0.12em] uppercase mb-2 opacity-80">
            Sort
          </label>
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="w-full appearance-none bg-transparent text-[14px] text-ink border-b border-ink/10 pb-2 pr-6 focus:border-gold/50 cursor-pointer transition-colors duration-300"
            >
              <option value="newest">Newest</option>
              <option value="price_desc">Price: High</option>
              <option value="price_asc">Price: Low</option>
              <option value="name">Name: A-Z</option>
            </select>
            <ChevronDown className="absolute right-0 bottom-2.5 w-4 h-4 text-gold/50 pointer-events-none" />
          </div>
        </div>
      </div>
    );
  }

  // Non-inline mode (mobile or standalone)
  return (
    <div>
      {/* Mobile Filter Bar - refined */}
      <button
        onClick={() => setShowMobileFilters(!showMobileFilters)}
        className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 bg-white rounded-xl text-[14px] font-medium text-ink shadow-luxury transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
      >
        <SlidersHorizontal className="w-4 h-4" />
        Filters & Sort
        {hasActiveFilters && (
          <span className="bg-gold text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
            Active
          </span>
        )}
      </button>

      {/* Mobile Filters Panel */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Filters</h2>
            <button
              onClick={() => setShowMobileFilters(false)}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-6">
            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Location
              </label>
              <select
                value={filters.area || ''}
                onChange={(e) => updateFilter('area', e.target.value || undefined)}
                className="w-full px-4 py-3 border border-gray-300 rounded text-sm bg-white"
              >
                <option value="">All Locations</option>
                {AREAS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>

            {/* Availability */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Availability
              </label>
              <select
                value={filters.status || 'all'}
                onChange={(e) =>
                  updateFilter(
                    'status',
                    e.target.value === 'all' ? undefined : (e.target.value as PropertyStatus | 'all')
                  )
                }
                className="w-full px-4 py-3 border border-gray-300 rounded text-sm bg-white"
              >
                <option value="all">All</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Price Range
              </label>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={filters.minPrice || ''}
                  onChange={(e) =>
                    updateFilter('minPrice', e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="px-4 py-3 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value="">Min</option>
                  <option value="500000">€500K</option>
                  <option value="1000000">€1M</option>
                  <option value="2000000">€2M</option>
                  <option value="5000000">€5M</option>
                </select>
                <select
                  value={filters.maxPrice || ''}
                  onChange={(e) =>
                    updateFilter('maxPrice', e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="px-4 py-3 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value="">Max</option>
                  <option value="1000000">€1M</option>
                  <option value="2000000">€2M</option>
                  <option value="5000000">€5M</option>
                  <option value="10000000">€10M+</option>
                </select>
              </div>
            </div>

            {/* Features */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Features
              </label>
              <div className="flex flex-wrap gap-2">
                {FEATURE_OPTIONS.map((feature) => (
                  <button
                    key={feature}
                    onClick={() => toggleFeature(feature)}
                    className={cn(
                      'px-3 py-2 rounded text-sm font-medium transition-colors',
                      filters.features?.includes(feature)
                        ? 'bg-gold text-white'
                        : 'bg-paper text-ink'
                    )}
                  >
                    {feature}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Sort By
              </label>
              <select
                value={sort}
                onChange={(e) => onSortChange(e.target.value as SortOption)}
                className="w-full px-4 py-3 border border-gray-300 rounded text-sm bg-white"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="name">Name: A-Z</option>
              </select>
            </div>
          </div>

          {/* Apply / Clear buttons */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex gap-3">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex-1 py-3 border border-gray-300 rounded text-sm font-medium text-ink"
              >
                Clear All
              </button>
            )}
            <button
              onClick={() => setShowMobileFilters(false)}
              className="flex-1 py-3 bg-gold text-white rounded text-sm font-medium"
            >
              Show {resultCount} {resultCount === 1 ? 'Property' : 'Properties'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
