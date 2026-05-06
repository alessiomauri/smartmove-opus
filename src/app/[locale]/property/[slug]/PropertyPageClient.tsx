'use client';

import PropertyHeader from '@/components/property/PropertyHeader';
import HeroSection from '@/components/property/HeroSection';
import FeaturesSection from '@/components/property/FeaturesSection';
import GallerySection from '@/components/property/GallerySection';
import FloorPlanSection from '@/components/property/FloorPlanSection';
import LocationSection from '@/components/property/LocationSection';
import { Property } from '@/types/property';

interface PropertyPageClientProps {
  property: Property;
}

export default function PropertyPageClient({ property }: PropertyPageClientProps) {
  return (
    <div className="min-h-screen bg-[#faf9f8]">
      <PropertyHeader propertyName={property.name} propertyId={property.id} propertySlug={property.slug} />
      <HeroSection property={property} />
      <FeaturesSection property={property} />
      <GallerySection property={property} />
      <FloorPlanSection property={property} />
      <LocationSection property={property} />

      {/* Footer - compact elegant design */}
      <footer className="py-16 lg:py-20 bg-[#faf9f8] relative overflow-hidden">
        {/* Decorative background orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-[#3c9ba7]/[0.02] rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-[1400px] mx-auto px-8 lg:px-16 text-center relative">
          <h2 className="font-gloock text-[28px] md:text-[36px] lg:text-[44px] text-[#3c9ba7] leading-none mb-3 tracking-tight">
            Smartmove Marbella
          </h2>
          <p className="text-[12px] text-[#2e2e2e]/40 tracking-[0.2em] uppercase">
            © {new Date().getFullYear()} All Rights Reserved
          </p>
        </div>
      </footer>
    </div>
  );
}
