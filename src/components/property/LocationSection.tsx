'use client';

import { useEffect, useRef, useState } from 'react';
import { Property } from '@/types/property';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';

interface LocationSectionProps {
  property: Property;
}

export default function LocationSection({ property }: LocationSectionProps) {
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

  // Source-aware: partner listings (Resales) must NOT expose exact pins
  // even when the source provides coordinates. We show the general area
  // only — see SMARTMOVE_BRIEF §4.x: bulk inventory gets fuzzed location.
  const isPartnerListing = property.source === 'resales_online';
  const hasCoordinates =
    !isPartnerListing &&
    property.latitude !== null &&
    property.longitude !== null;

  // Convert decimal degrees to DMS format
  const formatCoordinate = (decimal: number, isLat: boolean) => {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
    const direction = isLat
      ? decimal >= 0 ? 'N' : 'S'
      : decimal >= 0 ? 'E' : 'W';
    return `${degrees}°${minutes}'${seconds}"${direction}`;
  };

  const coordinatesString = hasCoordinates
    ? `${formatCoordinate(property.latitude!, true)} ${formatCoordinate(property.longitude!, false)}`
    : '';

  const mapUrl = hasCoordinates
    ? `https://maps.google.com/maps?q=${property.latitude},${property.longitude}&z=15&output=embed`
    : null;

  return (
    <section ref={sectionRef} id="location" className="py-16 lg:py-20 bg-[#faf9f8]">
      {/* Section Header */}
      <div className={`max-w-[1400px] mx-auto px-8 lg:px-16 mb-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-[1px] bg-gradient-to-r from-[#3c9ba7] to-transparent" />
              <span className="text-[11px] tracking-[0.25em] uppercase text-[#3c9ba7]">Location</span>
            </div>
            <h2 className="font-gloock text-[36px] md:text-[48px] lg:text-[56px] text-[#3c9ba7] leading-[1.05]">
              Location
            </h2>
          </div>
          <p className="text-[#2e2e2e]/50 text-sm tracking-wide max-w-xs">
            {property.area || property.location}
          </p>
        </div>
      </div>

      {/* Map and Info Container */}
      <div className="max-w-[1600px] mx-auto px-4 lg:px-8">
        <div className={`relative transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {hasCoordinates ? (
            <div className="relative rounded-lg overflow-hidden">
              {/* Map */}
              <div className="relative w-full h-[400px] md:h-[500px] lg:h-[550px]">
                <iframe
                  src={mapUrl || ''}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`Map of ${property.name}`}
                  className="grayscale-[30%] contrast-[1.05]"
                />
              </div>

              {/* Location Info Card - Floating (compact on mobile, full on desktop) */}
              <div className="absolute bottom-3 left-3 right-3 md:bottom-auto md:right-auto md:top-6 md:left-6 z-10 md:max-w-sm">
                <div className="bg-white/95 backdrop-blur-md p-3 md:p-5 rounded-xl shadow-xl border border-white/50">
                  {/* Mobile: Compact single row with location + buttons */}
                  <div className="flex md:hidden items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-4 h-4 text-[#3c9ba7] flex-shrink-0" />
                      <span className="text-[12px] font-medium text-[#2e2e2e] truncate">
                        {property.area || property.location}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#3c9ba7] text-white rounded-lg"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span className="text-[10px] tracking-[0.05em] uppercase font-medium">Directions</span>
                      </a>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${property.latitude},${property.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center px-2.5 py-2 bg-white border border-[#2e2e2e]/10 rounded-lg"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#2e2e2e]/60" />
                      </a>
                    </div>
                  </div>

                  {/* Desktop: Full layout */}
                  <div className="hidden md:block">
                    {/* Coordinates */}
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-9 h-9 rounded-full bg-[#3c9ba7]/10 flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-4 h-4 text-[#3c9ba7]" />
                      </div>
                      <div>
                        <p className="text-[10px] tracking-[0.15em] uppercase text-[#2e2e2e]/50 mb-0.5">Coordinates</p>
                        <p className="text-[13px] font-medium text-[#2e2e2e] tracking-wide">
                          {coordinatesString}
                        </p>
                      </div>
                    </div>

                    {/* Location Name */}
                    <div className="mb-5">
                      <p className="text-[10px] tracking-[0.15em] uppercase text-[#2e2e2e]/50 mb-0.5">Area</p>
                      <p className="text-[15px] text-[#2e2e2e]">
                        {property.area || property.location}
                      </p>
                    </div>

                    {/* Location description if available */}
                    {property.location_description && (
                      <p className="text-[13px] text-[#2e2e2e]/70 leading-relaxed mb-5 pb-5 border-b border-[#2e2e2e]/5">
                        {property.location_description}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3c9ba7] text-white rounded-lg hover:bg-[#358d98] transition-all duration-300"
                      >
                        <Navigation className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        <span className="text-[11px] tracking-[0.1em] uppercase font-medium">Directions</span>
                      </a>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${property.latitude},${property.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-[#2e2e2e]/10 rounded-lg hover:border-[#3c9ba7]/30 hover:bg-[#faf9f8] transition-all duration-300"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#2e2e2e]/60 group-hover:text-[#3c9ba7] transition-colors" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // No coordinates state
            <div className="w-full h-[400px] bg-gradient-to-br from-[#f5f3f0] to-[#ebe8e4] rounded-lg flex items-center justify-center relative overflow-hidden">
              {/* Decorative pattern */}
              <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%233c9ba7' fill-opacity='1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
              }} />

              <div className="text-center relative">
                <div className="w-20 h-20 rounded-full bg-[#3c9ba7]/5 flex items-center justify-center mx-auto mb-6">
                  <MapPin className="w-8 h-8 text-[#3c9ba7]/30" />
                </div>
                <p className="text-[#2e2e2e]/40 text-base mb-2">
                  Precise location available upon request
                </p>
                <p className="text-[#2e2e2e]/30 text-sm">
                  {property.area || property.location}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
