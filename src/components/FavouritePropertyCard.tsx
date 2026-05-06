'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, ArrowUpRight, MapPin } from 'lucide-react';
import { Property, STATUS_LABELS } from '@/types/property';
import { useFavourites } from '@/hooks/useFavourites';
import { formatNumber, cn } from '@/lib/utils';

interface FavouritePropertyCardProps {
  property: Property;
}

export default function FavouritePropertyCard({
  property,
}: FavouritePropertyCardProps) {
  const { removeFavourite } = useFavourites();
  const [isHovered, setIsHovered] = useState(false);

  const formatPrice = () => {
    if (property.price_on_request || property.price === null) {
      return 'Price on Request';
    }
    return `€${formatNumber(property.price)}`;
  };

  const statusText = STATUS_LABELS[property.status] || property.status;

  // Build specs array
  const specs: { value: string | number; label: string }[] = [];
  if (property.bedrooms) {
    specs.push({ value: property.bedrooms, label: 'Beds' });
  }
  if (property.bathrooms) {
    specs.push({ value: property.bathrooms, label: 'Baths' });
  }
  if (property.interior_size) {
    specs.push({ value: `${formatNumber(property.interior_size)}`, label: 'm²' });
  }
  if (property.plot_size) {
    specs.push({ value: `${formatNumber(property.plot_size)}`, label: 'Plot' });
  }

  return (
    <div
      className="group relative bg-white rounded-xl overflow-hidden transition-all duration-500 hover:shadow-xl hover:shadow-[#3c9ba7]/10"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Accent border on hover */}
      <div className={cn(
        "absolute inset-0 rounded-xl pointer-events-none transition-all duration-500 z-10",
        isHovered
          ? "ring-1 ring-[#3c9ba7]/20"
          : "ring-0 ring-transparent"
      )} />

      {/* Top accent line */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#3c9ba7] via-[#4aabb7] to-[#3c9ba7]/50 transition-all duration-500 origin-left z-10",
        isHovered ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
      )} />

      <div className="flex flex-col lg:flex-row">
        {/* Image Section */}
        <Link
          href={`/property/${property.slug}`}
          className="relative w-full lg:w-[320px] h-[220px] lg:h-auto lg:aspect-[4/3] flex-shrink-0 overflow-hidden"
        >
          <Image
            src={property.hero_image || '/placeholder-property.jpg'}
            alt={property.name}
            fill
            className={cn(
              "object-cover transition-all duration-700 ease-out",
              isHovered ? "scale-[1.05]" : "scale-100"
            )}
            sizes="(max-width: 1024px) 100vw, 340px"
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />

          {/* Teal accent on hover */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-br from-[#3c9ba7]/20 via-transparent to-transparent transition-opacity duration-700",
            isHovered ? "opacity-100" : "opacity-0"
          )} />

          {/* Status badge */}
          <div className="absolute top-4 left-4 z-10">
            <span className={cn(
              "inline-flex items-center px-3 py-1.5 text-[10px] font-medium tracking-[0.1em] uppercase text-white backdrop-blur-md rounded-full border transition-all duration-500",
              isHovered
                ? "bg-[#3c9ba7]/60 border-[#3c9ba7]/30"
                : "bg-black/25 border-white/10"
            )}>
              {statusText}
            </span>
          </div>

          {/* View property hint */}
          <div className={cn(
            "absolute bottom-4 left-4 flex items-center gap-2 text-white/90 transition-all duration-500",
            isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          )}>
            <div className="w-6 h-[1px] bg-gradient-to-r from-[#3c9ba7] to-white/50" />
            <span className="text-[11px] font-medium tracking-[0.15em] uppercase">View Property</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        {/* Content Section */}
        <div className="flex-1 p-5 lg:p-8 flex flex-col justify-between">
          <div>
            {/* Location */}
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-3.5 h-3.5 text-[#3c9ba7]" />
              <span className={cn(
                "text-[11px] uppercase tracking-[0.12em] transition-colors duration-400",
                isHovered ? "text-[#3c9ba7]" : "text-[#2e2e2e]/50"
              )}>
                {property.location}
              </span>
            </div>

            {/* Property Name */}
            <Link href={`/property/${property.slug}`}>
              <h3 className="font-gloock text-[24px] lg:text-[34px] text-[#3c9ba7] leading-tight mb-3 hover:text-[#2d8a95] transition-colors duration-300">
                {property.name}
              </h3>
            </Link>

            {/* Features */}
            {property.features.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {property.features.slice(0, 4).map((feature, index) => (
                  <span
                    key={index}
                    className={cn(
                      "inline-block px-2.5 py-1 text-[10px] text-[#2e2e2e]/60 border border-[#2e2e2e]/8 rounded-full bg-[#faf9f8] transition-all duration-300",
                      isHovered && "border-[#3c9ba7]/20 text-[#3c9ba7]/80"
                    )}
                  >
                    {feature}
                  </span>
                ))}
                {property.features.length > 4 && (
                  <span className="inline-block px-2.5 py-1 text-[10px] text-[#2e2e2e]/40">
                    +{property.features.length - 4} more
                  </span>
                )}
              </div>
            )}

            {/* Specs */}
            <div className="flex items-center gap-5 text-[14px] text-[#2e2e2e]/60">
              {specs.map((spec, index) => (
                <span key={index} className={cn(
                  "transition-colors duration-400",
                  isHovered && "text-[#3c9ba7]"
                )}>
                  <span className="font-semibold text-[#2e2e2e] text-[15px]">{spec.value}</span>
                  <span className="ml-1">{spec.label}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Price */}
          <div className="mt-4 pt-4 border-t border-[#2e2e2e]/[0.06]">
            <p className="text-[22px] lg:text-[28px] text-[#2e2e2e] font-light tracking-tight">
              {formatPrice()}
            </p>
          </div>
        </div>

        {/* Right Section - Actions */}
        <div className="hidden lg:flex flex-col items-end justify-between p-8 pl-0 w-[180px]">
          {/* Remove Button */}
          <button
            onClick={() => removeFavourite(property.id)}
            className="group/btn flex items-center gap-2 text-[#2e2e2e]/40 hover:text-red-400 transition-all duration-300"
          >
            <Heart className="w-4 h-4 fill-current transition-transform duration-300 group-hover/btn:scale-110" />
            <span className="text-[11px] tracking-[0.1em] uppercase">Remove</span>
          </button>

          {/* View Button */}
          <Link
            href={`/property/${property.slug}`}
            className={cn(
              "group/view flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-300",
              isHovered
                ? "bg-[#3c9ba7] text-white shadow-lg shadow-[#3c9ba7]/20"
                : "bg-[#faf9f8] text-[#2e2e2e]/60 hover:bg-[#3c9ba7] hover:text-white"
            )}
          >
            <span className="text-[11px] tracking-[0.1em] uppercase font-medium">View</span>
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover/view:translate-x-0.5 group-hover/view:-translate-y-0.5" />
          </Link>
        </div>
      </div>

      {/* Mobile Actions */}
      <div className="lg:hidden flex items-center justify-between px-5 pb-5">
        <button
          onClick={() => removeFavourite(property.id)}
          className="flex items-center gap-2 text-[#2e2e2e]/40 hover:text-red-400 transition-colors"
        >
          <Heart className="w-4 h-4 fill-current" />
          <span className="text-[11px] tracking-[0.1em] uppercase">Remove</span>
        </button>
        <Link
          href={`/property/${property.slug}`}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#3c9ba7] text-white rounded-full text-[11px] tracking-[0.1em] uppercase font-medium"
        >
          View Property
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
