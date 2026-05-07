'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { Property } from '@/types/property';
import { formatNumber, cn } from '@/lib/utils';

interface FeaturesSectionProps {
  property: Property;
}

// Refined icons with thinner strokes for elegance
const BedroomIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2">
    <rect x="6" y="24" width="36" height="12" rx="1" />
    <path d="M6 24V16a2 2 0 012-2h32a2 2 0 012 2v8" />
    <rect x="10" y="18" width="10" height="6" rx="1" />
    <rect x="28" y="18" width="10" height="6" rx="1" />
    <path d="M10 36v3M38 36v3" />
  </svg>
);

const BathIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M4 22h40v12a4 4 0 01-4 4H8a4 4 0 01-4-4V22z" />
    <path d="M10 22V12a4 4 0 014-4h3" />
    <circle cx="19" cy="10" r="2.5" />
    <path d="M10 38v3M38 38v3" />
  </svg>
);

const InternalIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2">
    <rect x="8" y="12" width="32" height="28" rx="1" />
    <path d="M8 12l16-5 16 5" />
    <rect x="14" y="18" width="8" height="7" />
    <rect x="26" y="18" width="8" height="7" />
    <rect x="18" y="28" width="12" height="12" />
    <circle cx="27" cy="34" r="1" fill="currentColor" />
  </svg>
);

const PlotIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M8 14v26M8 14l0-3M16 14v26M16 14l0-3M24 14v26M24 14l0-3M32 14v26M32 14l0-3M40 14v26M40 14l0-3" />
    <path d="M6 20h36M6 30h36" />
  </svg>
);

const TerraceIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M8 20c0-10 7-14 16-14s16 4 16 14" />
    <path d="M8 20h32" />
    <path d="M16 20c0-8 4-12 8-12M24 20c0-8-4-12-8-12M32 20c0-8-4-12-8-12M24 20c0-8 4-12 8-12" />
    <path d="M24 20v20" />
    <ellipse cx="24" cy="40" rx="5" ry="2" />
  </svg>
);

const ParkingIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2">
    <rect x="6" y="12" width="16" height="24" rx="1" />
    <rect x="26" y="12" width="16" height="24" rx="1" />
    <path d="M10 18h8M10 24h8M10 30h8" />
    <path d="M30 18h8M30 24h8M30 30h8" />
  </svg>
);

const OrientationIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2">
    <circle cx="24" cy="24" r="18" />
    <circle cx="24" cy="24" r="4" />
    <path d="M24 6v6M24 36v6M6 24h6M36 24h6" />
    <path d="M24 3l2.5 5h-5l2.5-5z" fill="currentColor" />
  </svg>
);

const PoolIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M14 8v20M22 8v20" />
    <path d="M14 12h8M14 18h8M14 24h8" />
    <path d="M14 8c0-2.5 1.5-4 4-4s4 1.5 4 4" />
    <path d="M4 34c2.5 0 4-2.5 6.5-2.5s4 2.5 6.5 2.5 4-2.5 6.5-2.5 4 2.5 6.5 2.5 4-2.5 6.5-2.5 4 2.5 6.5 2.5" />
    <path d="M4 42c2.5 0 4-2.5 6.5-2.5s4 2.5 6.5 2.5 4-2.5 6.5-2.5 4 2.5 6.5 2.5 4-2.5 6.5-2.5 4 2.5 6.5 2.5" />
  </svg>
);

export default function FeaturesSection({ property }: FeaturesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const features = [
    {
      Icon: BedroomIcon,
      label: 'Bedrooms',
      value: property.bedrooms,
      show: property.bedrooms !== null,
    },
    {
      Icon: BathIcon,
      label: 'Bathrooms',
      value: property.bathrooms,
      show: property.bathrooms !== null,
    },
    {
      Icon: InternalIcon,
      label: 'Interior',
      value: property.interior_size ? `${formatNumber(property.interior_size)} m²` : null,
      show: property.interior_size !== null,
    },
    {
      Icon: PlotIcon,
      label: 'Plot',
      value: property.plot_size ? `${formatNumber(property.plot_size)} m²` : null,
      show: property.plot_size !== null,
    },
    {
      Icon: TerraceIcon,
      label: 'Terrace',
      value: property.terrace_size ? `${formatNumber(property.terrace_size)} m²` : null,
      show: property.terrace_size !== null,
    },
    {
      Icon: ParkingIcon,
      label: 'Parking',
      value: property.parking_spaces,
      show: property.parking_spaces !== null,
    },
    {
      Icon: OrientationIcon,
      label: 'Orientation',
      value: property.orientation,
      show: property.orientation !== null,
    },
    {
      Icon: PoolIcon,
      label: 'Pool',
      value: property.has_pool ? 'Private' : 'No',
      show: true,
    },
  ].filter((f) => f.show);

  const formatPriceDisplay = () => {
    if (property.price_on_request || property.price === null) {
      return <span className="text-[32px] md:text-[40px]">Price on Request</span>;
    }
    const formatted = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(property.price);
    return (
      <>
        <span className="text-[28px] md:text-[32px] font-light">€</span>
        <span className="ml-2">{formatted}</span>
      </>
    );
  };

  return (
    <section ref={sectionRef} id="overview" className="py-16 lg:py-20 bg-paper relative overflow-hidden">
      {/* Subtle background elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-gold/[0.03] to-transparent rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-radial from-gold/[0.02] to-transparent rounded-full blur-3xl pointer-events-none translate-y-1/2 -translate-x-1/3" />

      <div className="max-w-[1400px] mx-auto px-8 lg:px-16 relative">
        {/* Top row: Title and Price */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 mb-12 lg:mb-14 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Property Name */}
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-[1px] bg-gradient-to-r from-gold to-transparent" />
              <span className="text-[11px] tracking-[0.25em] uppercase text-gold">Overview</span>
            </div>
            <h2 className="font-display text-[36px] md:text-[48px] lg:text-[56px] text-gold leading-[1.05]">
              {property.name}
            </h2>
          </div>

          {/* Price */}
          <div className="lg:text-right lg:self-end">
            <p className="text-[36px] md:text-[48px] text-ink font-light leading-none tracking-tight">
              {formatPriceDisplay()}
            </p>
            <p className="text-[11px] uppercase tracking-[0.2em] text-ink/50 mt-3">
              Starting Price
            </p>
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-16 lg:gap-24">
          {/* Left: Features Grid */}
          <div className={`transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-10">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="group flex flex-col items-center text-center cursor-default"
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div className="relative mb-4">
                    {/* Subtle background glow on hover */}
                    <div className="absolute inset-0 rounded-full bg-gold/0 group-hover:bg-gold/5 scale-150 transition-all duration-500" />
                    <div className="relative text-ink/70 group-hover:text-gold transition-colors duration-400">
                      <feature.Icon />
                    </div>
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-ink/50 mb-1.5">
                    {feature.label}
                  </p>
                  <p className="text-[15px] text-ink font-medium">
                    {feature.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Amenity Tags - compact inline */}
            {property.features.length > 0 && (
              <div className="mt-8 pt-6 border-t border-ink/5">
                <div className="flex flex-wrap gap-1.5">
                  {property.features.map((feature, index) => (
                    <span
                      key={index}
                      className="inline-block px-3 py-1 text-[11px] text-ink/60 border border-ink/8 rounded-full bg-white/50 hover:border-gold/30 hover:text-gold transition-all duration-300 cursor-default"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Description */}
          <div className={`transition-all duration-1000 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="relative">
              {/* Decorative quote mark */}
              <div className="absolute -top-6 -left-4 text-[120px] font-display text-gold/[0.06] leading-none select-none pointer-events-none">
                "
              </div>

              {/* Description - instant expand/collapse */}
              <div className="relative">
                <div
                  className={cn(
                    'text-[15px] md:text-[16px] text-ink/75 leading-[2]',
                    !isExpanded && 'line-clamp-[10]'
                  )}
                >
                  {property.description}
                </div>

                {/* Fade overlay when collapsed */}
                {!isExpanded && (
                  <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-paper to-transparent pointer-events-none" />
                )}
              </div>

              {/* Read More Button */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="group mt-8 flex items-center gap-3 text-gold text-[13px] tracking-[0.1em] uppercase hover:text-gold-deep transition-colors duration-300"
              >
                <span className="relative font-medium">
                  {isExpanded ? 'Read Less' : 'Continue Reading'}
                  {/* Use scaleX transform instead of width for smooth GPU-accelerated animation */}
                  <span className="absolute -bottom-1 left-0 w-full h-[1px] bg-current origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100" />
                </span>
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform duration-300 ease-out",
                  isExpanded && "rotate-180"
                )} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section divider */}
      <div className="absolute bottom-0 left-0 right-0">
        <div className="max-w-[1400px] mx-auto px-8 lg:px-16">
          <div className="h-[1px] bg-gradient-to-r from-transparent via-gold/15 to-transparent" />
        </div>
      </div>
    </section>
  );
}
