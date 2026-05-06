'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Property } from '@/types/property';
import Lightbox from '@/components/ui/Lightbox';
import { Expand, Grid } from 'lucide-react';

interface GallerySectionProps {
  property: Property;
}

export default function GallerySection({ property }: GallerySectionProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [showAll, setShowAll] = useState(false);
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

  const images = property.gallery_images;

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  };

  const handlePrevious = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  if (images.length === 0) {
    return null;
  }

  // Show only first 6 images unless "show all" is clicked
  const displayedImages = showAll ? images : images.slice(0, 6);
  const hasMoreImages = images.length > 6;

  return (
    <section ref={sectionRef} id="gallery" className="py-16 lg:py-20 bg-[#faf9f8]">
      {/* Section Header */}
      <div className={`max-w-[1400px] mx-auto px-8 lg:px-16 mb-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-[1px] bg-gradient-to-r from-[#3c9ba7] to-transparent" />
              <span className="text-[11px] tracking-[0.25em] uppercase text-[#3c9ba7]">Gallery</span>
            </div>
            <h2 className="font-gloock text-[36px] md:text-[48px] lg:text-[56px] text-[#3c9ba7] leading-[1.05]">
              Gallery
            </h2>
          </div>
          <p className="text-[#2e2e2e]/50 text-sm tracking-wide">
            {images.length} images
          </p>
        </div>
      </div>

      {/* Gallery Grid - Uniform sizes */}
      <div className="max-w-[1600px] mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
          {displayedImages.map((image, index) => (
            <div
              key={index}
              className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${100 + index * 80}ms` }}
            >
              <button
                onClick={() => openLightbox(index)}
                className="group relative w-full aspect-[4/3] overflow-hidden rounded-sm"
              >
                <Image
                  src={image}
                  alt={`${property.name} - Image ${index + 1}`}
                  fill
                  className="object-cover transition-all duration-500 ease-out group-hover:scale-105"
                  sizes="(max-width: 768px) 50vw, 33vw"
                />

                {/* Overlay with gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a1a1c]/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-400" />

                {/* Image number indicator */}
                <div className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-all duration-400 transform translate-y-2 group-hover:translate-y-0">
                  <span className="text-white/90 text-[11px] tracking-[0.15em] font-medium">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>

                {/* Expand icon */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-400">
                  <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-400">
                    <Expand className="w-4 h-4 text-[#3c9ba7]" />
                  </div>
                </div>
              </button>
            </div>
          ))}
        </div>

        {/* See More Button */}
        {hasMoreImages && !showAll && (
          <div className={`mt-10 text-center transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <button
              onClick={() => setShowAll(true)}
              className="group inline-flex items-center gap-3 px-8 py-4 border border-[#3c9ba7]/30 rounded-full text-[#3c9ba7] hover:bg-[#3c9ba7] hover:text-white hover:border-[#3c9ba7] transition-all duration-300"
            >
              <Grid className="w-4 h-4" />
              <span className="text-[13px] tracking-[0.1em] uppercase font-medium">
                See All {images.length} Images
              </span>
            </button>
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
          images={images}
          currentIndex={currentImageIndex}
          onClose={() => setLightboxOpen(false)}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )}
    </section>
  );
}
