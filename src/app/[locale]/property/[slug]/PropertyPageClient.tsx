// Server component (no hooks here): the interactive pieces are the child
// components, which each carry their own 'use client'. Keeping the
// composition + footer on the server trims the hydration payload.
import PropertyHeader from '@/components/property/PropertyHeader';
import HeroSection from '@/components/property/HeroSection';
import FeaturesSection from '@/components/property/FeaturesSection';
import GallerySection from '@/components/property/GallerySection';
import FloorPlanSection from '@/components/property/FloorPlanSection';
import LocationSection from '@/components/property/LocationSection';
import LeadCaptureSection from '@/components/property/LeadCaptureSection';
import SimilarProperties from '@/components/property/SimilarProperties';
import ResalesPropertyTemplate from '@/components/property/resales/ResalesPropertyTemplate';
import { Property } from '@/types/property';
import type { Locale } from '@/i18n/routing';

interface PropertyPageClientProps {
  property: Property;
  locale: Locale;
}

/**
 * Property detail page composition.
 *
 * Source-aware: Resales-sourced (partner) listings render the dedicated
 * design-ported `ResalesPropertyTemplate` (re-skin only — same leads
 * pipeline, brochure, favourites, geo-ranked similar). Smartmove's own
 * (manual / scraper) rows keep their EXACT existing composition below —
 * the Property v2 own-template port is a later task.
 */
export default function PropertyPageClient({ property, locale }: PropertyPageClientProps) {
  const isPartnerListing = property.source === 'resales_online';

  if (isPartnerListing) {
    return <ResalesPropertyTemplate property={property} locale={locale} />;
  }

  return (
    <div className="min-h-screen bg-paper">
      <PropertyHeader propertyName={property.name} propertyId={property.id} propertySlug={property.slug} />
      <HeroSection property={property} />
      <FeaturesSection property={property} />
      <GallerySection property={property} />
      {/* Lead capture directly after the gallery (mobile reads it under
          the photos; desktop gets the sticky form column). */}
      <LeadCaptureSection property={property} />
      {/* Floor plans only for our own / scraper-imported curated listings —
          Resales bulk inventory doesn't carry plans. */}
      {!isPartnerListing && <FloorPlanSection property={property} />}
      {/* Location: full pin for our own listings, generalised area-only for
          partner listings (Resales properties shouldn't expose exact pins). */}
      <LocationSection property={property} />

      {/* Similar properties — geo-ranked when coords exist (Prompt 3). */}
      <SimilarProperties property={property} />

      <footer className="py-16 lg:py-20 bg-paper relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-gold/[0.02] rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-[1400px] mx-auto px-8 lg:px-16 text-center relative">
          <h2 className="font-display text-[28px] md:text-[36px] lg:text-[44px] text-gold leading-none mb-3 tracking-tight">
            Smartmove Marbella
          </h2>
          <p className="text-[12px] text-ink/40 tracking-[0.2em] uppercase">
            © {new Date().getFullYear()} All Rights Reserved
          </p>
          {isPartnerListing && (
            <p className="text-[10px] tracking-[0.18em] uppercase text-ink/30 mt-4">
              Listed via partner network · Reference {property.source_id}
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
