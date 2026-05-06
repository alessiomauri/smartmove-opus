'use client';

import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { Property, STATUS_LABELS } from '@/types/property';
import { formatPrice, formatNumber, cn } from '@/lib/utils';
import FavouriteButton from './FavouriteButton';
import { ArrowUpRight } from 'lucide-react';

interface PropertyCardProps {
  property: Property;
  index?: number;
  priority?: boolean;
}

export default function PropertyCard({ property, index = 0, priority = false }: PropertyCardProps) {
  const animationDelay = Math.min(index, 5);
  const isUnavailable = property.status === 'sold' || property.status === 'under_offer' || property.status === 'reserved';

  // Warm the browser cache for the property's hero image when the user
  // hovers/touches the card. By the time they click in, the detail-page
  // hero is already in cache → instant render. Cheap (no extra requests
  // for users who never click) and works in dev + prod.
  const preloadHero = () => {
    if (typeof window === 'undefined' || !property.hero_image) return;
    const img = new window.Image();
    img.src = property.hero_image;
  };

  return (
    <Link
      href={{ pathname: '/property/[slug]', params: { slug: property.slug } }}
      onMouseEnter={preloadHero}
      onTouchStart={preloadHero}
      className={cn(
        'group block opacity-0 animate-fade-in',
        `stagger-${animationDelay + 1}`
      )}
    >
      {/* Card container with subtle lift effect */}
      <div className={cn(
        "relative transition-all duration-500 ease-out group-hover:-translate-y-1.5 rounded-[6px] overflow-hidden",
        property.is_featured && !isUnavailable && "ring-1 ring-[#3c9ba7]/20"
      )}>
        {/* Featured accent line */}
        {property.is_featured && !isUnavailable && (
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-[#3c9ba7] via-[#4aabb7] to-[#3c9ba7]/40 z-10" />
        )}

        {/* Image container */}
        <div className="relative aspect-[4/3] overflow-hidden bg-[#f0ede9]">
          {/* Main image with parallax-like zoom */}
          <Image
            src={property.hero_image}
            alt={`${property.name} - Luxury property for sale in ${property.location}, Marbella, Costa del Sol`}
            fill
            className={cn(
              "object-cover transition-all duration-700 ease-out scale-100 group-hover:scale-[1.05]",
              isUnavailable && "saturate-[0.3] brightness-[0.85]"
            )}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={priority}
            {...(property.hero_image_blur
              ? { placeholder: 'blur' as const, blurDataURL: property.hero_image_blur }
              : {})}
          />

          {/* Elegant gradient overlays */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent transition-opacity duration-500",
            isUnavailable ? "opacity-70" : "opacity-60 group-hover:opacity-40"
          )} />

          {/* Teal accent glow on hover */}
          {!isUnavailable && (
            <div className="absolute inset-0 bg-gradient-to-br from-[#3c9ba7]/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          )}

          {/* Top-left cluster: Favourite + Featured badge */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <FavouriteButton propertyId={property.id} size="sm" />
            {property.is_featured && !isUnavailable && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] uppercase text-white bg-[#3c9ba7]/80 backdrop-blur-md rounded-full border border-white/15">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Featured
              </span>
            )}
          </div>

          {/* Status Badge - refined pill design */}
          <div className="absolute top-4 right-4 z-10">
            <span className={cn(
              "inline-flex items-center px-3 py-1.5 text-[11px] font-medium tracking-[0.1em] uppercase text-white backdrop-blur-md rounded-full border transition-all duration-500",
              isUnavailable
                ? "bg-black/40 border-white/15"
                : "bg-black/25 border-white/10 group-hover:bg-[#3c9ba7]/60 group-hover:border-[#3c9ba7]/30"
            )}>
              {STATUS_LABELS[property.status]}
            </span>
          </div>

          {/* Bottom info overlay - slides up on hover */}
          <div className="absolute bottom-0 left-0 right-0 p-5 transition-all duration-500 ease-out translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100">
            <div className="flex items-center gap-2 text-white/90">
              <div className="w-0 group-hover:w-6 h-[1px] bg-gradient-to-r from-[#3c9ba7] to-white/50 transition-all duration-500" />
              <span className="text-[11px] font-medium tracking-[0.15em] uppercase">View Property</span>
              <ArrowUpRight className="w-3.5 h-3.5 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </div>

          {/* Corner accent - subtle teal triangle */}
          <div className="absolute bottom-0 right-0 w-16 h-16 opacity-0 group-hover:opacity-100 transition-all duration-500">
            <div className="absolute bottom-0 right-0 w-full h-full bg-gradient-to-tl from-[#3c9ba7]/30 to-transparent" />
          </div>
        </div>

        {/* Content section - clean white with refined details */}
        <div className="relative bg-white p-5 transition-all duration-500 overflow-hidden">
          {/* Accent line that animates on hover */}
          <div className={cn(
            "absolute top-0 left-0 right-0 h-[2px] transition-all duration-500 origin-left",
            isUnavailable
              ? "bg-[#2e2e2e]/20 scale-x-100 opacity-100"
              : "bg-gradient-to-r from-[#3c9ba7] via-[#4aabb7] to-[#3c9ba7]/50 scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100"
          )} />

          {/* Property name and location - inline */}
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h3 className="font-gloock text-[22px] md:text-[26px] leading-tight tracking-tight transition-all duration-400">
              <span className={cn(
                isUnavailable ? "text-[#2e2e2e]/40" : "text-[#3c9ba7] group-hover:text-[#2d8a95]"
              )}>{property.name}</span>
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <span className="text-[11px] uppercase tracking-[0.12em] font-medium text-[#2e2e2e]/50 group-hover:text-[#3c9ba7] transition-all duration-400">
                  {property.location}
                </span>
                {/* Animated underline */}
                <div className="absolute -bottom-0.5 left-0 h-[1px] bg-[#3c9ba7]/50 w-0 group-hover:w-full transition-all duration-400" />
              </div>
            </div>
          </div>

          {/* Price and Specs row */}
          <div className="flex items-center justify-between pt-3 border-t border-[#2e2e2e]/[0.06]">
            {/* Price */}
            <p className="text-[18px] md:text-[20px] text-[#2e2e2e] font-semibold tracking-tight">
              {formatPrice(property.price, property.price_on_request)}
            </p>

            {/* Specs - stacked layout on mobile, inline on desktop */}
            {/* Mobile: numbers with labels below */}
            <div className="flex sm:hidden items-center gap-3">
              {property.bedrooms && (
                <div className="flex flex-col items-center transition-colors duration-400 group-hover:text-[#3c9ba7]">
                  <span className="font-semibold text-[#2e2e2e] text-[15px] leading-none">{property.bedrooms}</span>
                  <span className="text-[9px] uppercase tracking-wider text-[#2e2e2e]/40 mt-0.5">beds</span>
                </div>
              )}
              {property.bathrooms && (
                <div className="flex flex-col items-center transition-colors duration-400 group-hover:text-[#3c9ba7]">
                  <span className="font-semibold text-[#2e2e2e] text-[15px] leading-none">{property.bathrooms}</span>
                  <span className="text-[9px] uppercase tracking-wider text-[#2e2e2e]/40 mt-0.5">baths</span>
                </div>
              )}
              {property.interior_size && (
                <div className="flex flex-col items-center transition-colors duration-400 group-hover:text-[#3c9ba7]">
                  <span className="font-semibold text-[#2e2e2e] text-[15px] leading-none">{formatNumber(property.interior_size)}</span>
                  <span className="text-[9px] uppercase tracking-wider text-[#2e2e2e]/40 mt-0.5">m²</span>
                </div>
              )}
              {property.plot_size && (
                <div className="flex flex-col items-center transition-colors duration-400 group-hover:text-[#3c9ba7]">
                  <span className="font-semibold text-[#2e2e2e] text-[15px] leading-none">{formatNumber(property.plot_size)}</span>
                  <span className="text-[9px] uppercase tracking-wider text-[#2e2e2e]/40 mt-0.5">plot</span>
                </div>
              )}
            </div>

            {/* Desktop: inline format */}
            <div className="hidden sm:flex items-center gap-4 text-[14px] text-[#2e2e2e]/60">
              {property.bedrooms && (
                <span className="transition-colors duration-400 group-hover:text-[#3c9ba7]">
                  <span className="font-semibold text-[#2e2e2e] text-[15px]">{property.bedrooms}</span> bed
                </span>
              )}
              {property.bathrooms && (
                <span className="transition-colors duration-400 group-hover:text-[#3c9ba7]">
                  <span className="font-semibold text-[#2e2e2e] text-[15px]">{property.bathrooms}</span> bath
                </span>
              )}
              {property.interior_size && (
                <span className="transition-colors duration-400 group-hover:text-[#3c9ba7]">
                  <span className="font-semibold text-[#2e2e2e] text-[15px]">{formatNumber(property.interior_size)}</span> m²
                </span>
              )}
              {property.plot_size && (
                <span className="hidden md:inline transition-colors duration-400 group-hover:text-[#3c9ba7]">
                  <span className="font-semibold text-[#2e2e2e] text-[15px]">{formatNumber(property.plot_size)}</span> plot
                </span>
              )}
            </div>
          </div>

        </div>

        {/* Rounded border glow on hover - matches card radius */}
        <div className="absolute inset-0 rounded-[6px] pointer-events-none transition-all duration-500 shadow-none ring-0 ring-transparent group-hover:shadow-[inset_0_0_0_1.5px_rgba(60,155,167,0.25)] group-hover:ring-1 group-hover:ring-[#3c9ba7]/10" />

        {/* Subtle shadow that grows on hover */}
        <div className="absolute -inset-2 -z-10 rounded-xl transition-all duration-500 bg-transparent shadow-none group-hover:bg-gradient-to-b group-hover:from-[#3c9ba7]/[0.02] group-hover:to-black/[0.04] group-hover:shadow-[0_20px_50px_-15px_rgba(60,155,167,0.2)]" />
      </div>
    </Link>
  );
}

// Skeleton component for loading state
export function PropertyCardSkeleton() {
  return (
    <div className="rounded-[6px] overflow-hidden">
      {/* Image skeleton */}
      <div className="relative aspect-[4/3] bg-[#f0ede9] overflow-hidden">
        <div className="absolute inset-0 skeleton" />
      </div>
      {/* Content skeleton */}
      <div className="bg-white p-5">
        {/* Name and location */}
        <div className="mb-3">
          <div className="h-7 w-48 bg-[#f0ebe4] rounded skeleton mb-2" />
          <div className="flex items-center gap-2">
            <div className="w-4 h-[1px] bg-[#3c9ba7]/20" />
            <div className="h-3 w-20 bg-[#f0ebe4] rounded skeleton" />
          </div>
        </div>
        {/* Price and Specs */}
        <div className="flex items-center justify-between pt-3 border-t border-[#2e2e2e]/[0.06]">
          <div className="h-6 w-32 bg-[#f0ebe4] rounded skeleton" />
          {/* Mobile skeleton */}
          <div className="flex sm:hidden items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="h-4 w-6 bg-[#f0ebe4] rounded skeleton" />
              <div className="h-2 w-8 bg-[#f0ebe4] rounded skeleton" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="h-4 w-6 bg-[#f0ebe4] rounded skeleton" />
              <div className="h-2 w-8 bg-[#f0ebe4] rounded skeleton" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="h-4 w-10 bg-[#f0ebe4] rounded skeleton" />
              <div className="h-2 w-6 bg-[#f0ebe4] rounded skeleton" />
            </div>
          </div>
          {/* Desktop skeleton */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="h-4 w-12 bg-[#f0ebe4] rounded skeleton" />
            <div className="h-4 w-14 bg-[#f0ebe4] rounded skeleton" />
            <div className="h-4 w-14 bg-[#f0ebe4] rounded skeleton" />
          </div>
        </div>
      </div>
    </div>
  );
}
