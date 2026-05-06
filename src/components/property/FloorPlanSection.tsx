'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Property } from '@/types/property';
import Lightbox from '@/components/ui/Lightbox';
import { Expand, Layers } from 'lucide-react';

interface FloorPlanSectionProps {
  property: Property;
}

export default function FloorPlanSection({ property }: FloorPlanSectionProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
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

  const floorPlans = property.floor_plan_images;

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  };

  const handlePrevious = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? floorPlans.length - 1 : prev - 1
    );
  };

  const handleNext = () => {
    setCurrentImageIndex((prev) =>
      prev === floorPlans.length - 1 ? 0 : prev + 1
    );
  };

  // Empty state
  if (floorPlans.length === 0) {
    return (
      <section ref={sectionRef} id="floor-plans" className="py-16 lg:py-20 bg-white">
        <div className={`max-w-[1400px] mx-auto px-8 lg:px-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-[1px] bg-gradient-to-r from-[#3c9ba7] to-transparent" />
            <span className="text-[11px] tracking-[0.25em] uppercase text-[#3c9ba7]">Architecture</span>
          </div>
          <h2 className="font-gloock text-[36px] md:text-[48px] lg:text-[56px] text-[#3c9ba7] leading-[1.05] mb-12">
            Floor Plans
          </h2>

          <div className="text-center py-20 border border-dashed border-[#2e2e2e]/10 rounded-lg">
            <div className="w-16 h-16 rounded-full bg-[#3c9ba7]/5 flex items-center justify-center mx-auto mb-6">
              <Layers className="w-7 h-7 text-[#3c9ba7]/40" />
            </div>
            <p className="text-[#2e2e2e]/40 text-base">
              Floor plans coming soon
            </p>
          </div>
        </div>

        {/* Section divider */}
        <div className="max-w-[1400px] mx-auto px-8 lg:px-16 mt-16">
          <div className="h-[1px] bg-gradient-to-r from-transparent via-[#3c9ba7]/15 to-transparent" />
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} id="floor-plans" className="py-16 lg:py-20 bg-white relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%233c9ba7' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }} />

      <div className="max-w-[1400px] mx-auto px-8 lg:px-16 relative">
        {/* Section Header */}
        <div className={`flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-[1px] bg-gradient-to-r from-[#3c9ba7] to-transparent" />
              <span className="text-[11px] tracking-[0.25em] uppercase text-[#3c9ba7]">Architecture</span>
            </div>
            <h2 className="font-gloock text-[36px] md:text-[48px] lg:text-[56px] text-[#3c9ba7] leading-[1.05]">
              Floor Plans
            </h2>
          </div>

          {/* Floor plan tabs if multiple */}
          {floorPlans.length > 1 && (
            <div className="flex gap-2">
              {floorPlans.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTab(index)}
                  className={`px-5 py-2.5 text-[12px] tracking-[0.15em] uppercase rounded-full transition-all duration-300 ${
                    activeTab === index
                      ? 'bg-[#3c9ba7] text-white'
                      : 'bg-[#faf9f8] text-[#2e2e2e]/60 hover:bg-[#f0ede9] hover:text-[#2e2e2e]'
                  }`}
                >
                  Level {index + 1}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Floor Plan Display */}
        <div className={`transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <button
            onClick={() => openLightbox(activeTab)}
            className="group relative w-full bg-[#faf9f8] rounded-lg overflow-hidden border border-[#2e2e2e]/5"
          >
            <div className="relative aspect-[16/10] md:aspect-[21/12]">
              <Image
                src={floorPlans[activeTab]}
                alt={`Floor Plan - Level ${activeTab + 1}`}
                fill
                className="object-contain p-8 md:p-12 lg:p-16 transition-transform duration-700 group-hover:scale-[1.02]"
                sizes="(max-width: 1400px) 100vw, 1400px"
              />

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-[#3c9ba7]/0 group-hover:bg-[#3c9ba7]/[0.02] transition-colors duration-500" />

              {/* Expand button */}
              <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0">
                <div className="flex items-center gap-3 px-5 py-2.5 bg-white shadow-lg rounded-full border border-[#2e2e2e]/5">
                  <Expand className="w-4 h-4 text-[#3c9ba7]" />
                  <span className="text-[12px] tracking-[0.1em] uppercase text-[#2e2e2e] font-medium">Enlarge</span>
                </div>
              </div>

              {/* Plan label */}
              <div className="absolute top-6 left-6">
                <div className="flex items-center gap-3 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full border border-[#2e2e2e]/5">
                  <Layers className="w-4 h-4 text-[#3c9ba7]" />
                  <span className="text-[11px] tracking-[0.15em] uppercase text-[#2e2e2e]/70">
                    {floorPlans.length > 1 ? `Level ${activeTab + 1}` : 'Floor Plan'}
                  </span>
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Thumbnail navigation for multiple plans */}
        {floorPlans.length > 1 && (
          <div className={`mt-6 flex gap-3 justify-center transition-all duration-1000 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {floorPlans.map((plan, index) => (
              <button
                key={index}
                onClick={() => setActiveTab(index)}
                className={`relative w-20 h-20 rounded-md overflow-hidden border-2 transition-all duration-300 ${
                  activeTab === index
                    ? 'border-[#3c9ba7] ring-2 ring-[#3c9ba7]/20'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <Image
                  src={plan}
                  alt={`Thumbnail - Level ${index + 1}`}
                  fill
                  className="object-contain p-1 bg-[#faf9f8]"
                  sizes="80px"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Section divider */}
      <div className="max-w-[1400px] mx-auto px-8 lg:px-16 mt-16">
        <div className="h-[1px] bg-gradient-to-r from-transparent via-[#3c9ba7]/15 to-transparent" />
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <Lightbox
          images={floorPlans}
          currentIndex={currentImageIndex}
          onClose={() => setLightboxOpen(false)}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )}
    </section>
  );
}
