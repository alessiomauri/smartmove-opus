'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Property } from '@/types/property';
import { ChevronDown } from 'lucide-react';

interface HeroSectionProps {
  property: Property;
}

export default function HeroSection({ property }: HeroSectionProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const parallaxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLButtonElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastScrollY = useRef(0);

  const updateParallax = useCallback(() => {
    // Skip parallax entirely on mobile - causes jank due to browser scroll handling
    if (isMobile) return;

    const scrollY = window.scrollY;

    // Skip if scroll hasn't changed significantly (debounce micro-movements)
    if (Math.abs(scrollY - lastScrollY.current) < 1) return;
    lastScrollY.current = scrollY;

    // Only update if scroll is within hero section
    if (scrollY > 1200) return;

    // Simpler transform - just translate, no scale (scale causes jank)
    const parallaxOffset = scrollY * 0.3;
    const opacityFade = Math.max(0, 1 - scrollY / 600);

    if (parallaxRef.current) {
      parallaxRef.current.style.transform = `translate3d(0, ${parallaxOffset}px, 0)`;
    }
    if (contentRef.current) {
      contentRef.current.style.opacity = String(opacityFade);
    }
    if (scrollIndicatorRef.current) {
      scrollIndicatorRef.current.style.opacity = String(opacityFade);
    }
  }, [isMobile]);

  useEffect(() => {
    // Detect mobile on mount
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    checkMobile();

    setIsLoaded(true);

    const handleScroll = () => {
      // Cancel any pending animation frame
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      // Schedule update on next animation frame for smooth 60fps
      rafRef.current = requestAnimationFrame(updateParallax);
    };

    // Only add scroll listener on desktop
    if (!isMobile) {
      window.addEventListener('scroll', handleScroll, { passive: true });
      // Initial update
      updateParallax();
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [updateParallax, isMobile]);

  return (
    <section className="relative h-screen min-h-[700px] max-h-[1000px] overflow-hidden">
      {/* Background Image with parallax and cinematic zoom */}
      <div
        ref={parallaxRef}
        className="absolute inset-0 will-change-transform"
        style={{ transform: 'translate3d(0, 0, 0) scale(1)' }}
      >
        <Image
          src={property.hero_image}
          alt={property.name}
          fill
          className={`object-cover transition-all duration-[1.5s] ease-out ${isLoaded ? 'scale-100 blur-0' : 'scale-110 blur-sm'}`}
          priority
          fetchPriority="high"
          sizes="100vw"
          quality={75}
          onLoad={() => setIsLoaded(true)}
          {...(property.hero_image_blur
            ? { placeholder: 'blur' as const, blurDataURL: property.hero_image_blur }
            : {})}
        />

        {/* Sophisticated multi-layer gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1a1c]/40 via-transparent to-transparent" />

        {/* Subtle vignette effect */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.3) 100%)'
        }} />

        {/* Cinematic grain overlay for texture */}
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }}
        />
      </div>

      {/* Content container with fade on scroll */}
      <div
        ref={contentRef}
        className="relative h-full flex flex-col justify-end pb-20 lg:pb-28"
        style={{ opacity: 1 }}
      >
        {/* Property info - bottom left positioning for modern asymmetry */}
        <div className="max-w-[1600px] mx-auto w-full px-8 lg:px-16">
          <div className={`max-w-3xl transition-all duration-1000 delay-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Status badge */}
            {property.status && property.status !== 'available' && (
              <div className={`inline-block mb-6 transition-all duration-700 delay-500 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <span className="px-4 py-1.5 text-[10px] tracking-[0.25em] uppercase font-medium bg-white/10 backdrop-blur-md text-white/90 border border-white/20 rounded-full">
                  {property.status.replace('_', ' ')}
                </span>
              </div>
            )}

            {/* Location - subtle above title */}
            <p className={`text-white/60 text-sm md:text-base tracking-[0.3em] uppercase mb-4 transition-all duration-700 delay-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              {property.location}
            </p>

            {/* Property Name - hero typography */}
            <h1 className={`font-gloock text-5xl md:text-7xl lg:text-8xl xl:text-[110px] text-white leading-[0.9] tracking-tight transition-all duration-1000 delay-500 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              {property.name}
            </h1>

            {/* Decorative accent line */}
            <div className={`mt-8 flex items-center gap-4 transition-all duration-1000 delay-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
              <div className="h-[1px] w-16 bg-gradient-to-r from-[#3c9ba7] to-[#3c9ba7]/0" />
              <span className="text-white/40 text-[11px] tracking-[0.2em] uppercase">
                Exclusive Property
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator - centered bottom with refined animation */}
      <button
        ref={scrollIndicatorRef}
        onClick={() => {
          const element = document.getElementById('overview');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        }}
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center transition-all duration-1000 delay-[1.2s] cursor-pointer group ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        style={{ opacity: 1 }}
        aria-label="Scroll to property details"
      >
        <span className="text-white/40 text-[10px] tracking-[0.4em] uppercase mb-3 group-hover:text-white/70 transition-colors duration-300">Discover</span>
        <div className="flex flex-col items-center">
          <div className="w-[1px] h-10 bg-gradient-to-b from-white/40 to-transparent group-hover:from-white/70 transition-colors duration-300" />
          <ChevronDown className="w-4 h-4 text-white/40 -mt-1 animate-bounce group-hover:text-white/70 transition-colors duration-300" />
        </div>
      </button>

      {/* Refined corner accents - more subtle and modern */}
      <div className={`absolute top-20 left-8 lg:left-16 transition-all duration-1000 delay-[1.4s] ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-20 h-20 border-l border-t border-white/10" />
      </div>
      <div className={`absolute bottom-20 right-8 lg:right-16 transition-all duration-1000 delay-[1.6s] ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-20 h-20 border-r border-b border-[#3c9ba7]/30" />
      </div>
    </section>
  );
}
