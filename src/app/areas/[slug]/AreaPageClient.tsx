'use client';

import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Home, ChevronRight, ArrowRight, Sparkles } from 'lucide-react';
import { Area } from '@/types/area';
import { Property } from '@/types/property';
import PropertyGrid from '@/components/PropertyGrid';
import SiteFooter from '@/components/SiteFooter';
import NewsletterForm from '@/components/NewsletterForm';
import { useFavourites } from '@/hooks/useFavourites';

interface AreaPageClientProps {
  area: Area;
  nearbyAreas: Area[];
  childAreas: Area[];
  allDescendantAreas: Area[];
  parentArea: Area | null;
  properties: Property[];
  /**
   * When false, the "Properties in {area}" section renders a "coming soon"
   * placeholder instead of the property grid. Decided server-side based on
   * the PROPERTIES_PUBLIC feature flag + admin auth state.
   */
  showProperties: boolean;
}

export default function AreaPageClient({ area, nearbyAreas, childAreas, allDescendantAreas, parentArea, properties, showProperties }: AreaPageClientProps) {
  const { favouriteCount } = useFavourites();

  const paragraphs = area.description.split('\n\n').filter(p => p.trim());

  return (
    <div className="min-h-screen bg-[#faf9f8]">
      {/* Header */}
      <header className="sticky top-0 z-50 header-glass">
        <div className="absolute top-0 left-0 right-0 h-[2px] header-gradient-border" />
        <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between h-[60px] lg:h-[72px]">
            <Link href="/" className="group relative shrink-0 inline-block">
              <span className="text-[24px] lg:text-[26px] tracking-[-0.02em] font-gloock text-[#3c9ba7] transition-all duration-500 group-hover:text-[#2d8a95]">
                Marbella Live
              </span>
              <span className="absolute -bottom-0.5 left-0 h-[1px] w-0 bg-[#3c9ba7] transition-all duration-500 ease-out group-hover:w-full" />
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#2e2e2e]/60 hover:text-[#3c9ba7] transition-colors"
              >
                All Properties
              </Link>
              <Link
                href="/favourites"
                className="relative p-2.5 text-[#2e2e2e]/60 rounded-full hover:bg-[#3c9ba7]/[0.06] transition-colors duration-300"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                {favouriteCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[14px] h-[14px] flex items-center justify-center text-[8px] font-bold text-white bg-gradient-to-br from-[#3c9ba7] to-[#2d8a95] rounded-full shadow-sm">
                    {favouriteCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="header-divider" />

      {/* Breadcrumbs */}
      <nav className="max-w-[1600px] mx-auto px-6 lg:px-12 pt-6" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-[12px] text-[#2e2e2e]/50">
          <li><Link href="/" className="hover:text-[#3c9ba7] transition-colors">Home</Link></li>
          <ChevronRight className="w-3 h-3" />
          <li><Link href="/areas" className="hover:text-[#3c9ba7] transition-colors">Areas</Link></li>
          {parentArea && (
            <>
              <ChevronRight className="w-3 h-3" />
              <li>
                <Link href={`/areas/${parentArea.slug}`} className="hover:text-[#3c9ba7] transition-colors">
                  {parentArea.name}
                </Link>
              </li>
            </>
          )}
          <ChevronRight className="w-3 h-3" />
          <li className="text-[#2e2e2e]/80 font-medium">{area.name}</li>
        </ol>
      </nav>

      {/* Hero — image + text side by side */}
      <section className="max-w-[1600px] mx-auto px-6 lg:px-12 pt-8 pb-12">
        <div className={`grid gap-8 lg:gap-12 ${area.hero_image ? 'lg:grid-cols-2' : ''}`}>
          {/* Image */}
          {area.hero_image && (
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#f0ede9]">
              <Image
                src={area.hero_image}
                alt={area.hero_image_alt || area.name}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
                {...(area.hero_image_blur
                  ? { placeholder: 'blur' as const, blurDataURL: area.hero_image_blur }
                  : {})}
                />
            </div>
          )}

          {/* Text content */}
          <div className="flex flex-col justify-center">
            {/* Region tag */}
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-[#3c9ba7]" />
              <span className="text-[12px] font-semibold tracking-[0.12em] uppercase text-[#3c9ba7]">
                {area.region} · Costa del Sol
              </span>
            </div>

            <h1 className="font-gloock text-[32px] md:text-[40px] lg:text-[48px] text-[#2e2e2e] leading-[1.1] tracking-tight mb-4">
              {area.heading}
            </h1>
            <p className="text-[16px] md:text-[18px] text-[#2e2e2e]/60 leading-relaxed mb-8">
              {area.subheading}
            </p>

            {/* Description */}
            <div className="space-y-4 text-[15px] text-[#2e2e2e]/65 leading-relaxed mb-8">
              {paragraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>

            {/* Highlights */}
            {area.highlights.length > 0 && (
              <div className="mb-8">
                <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#2e2e2e]/40 mb-3">
                  Key Highlights
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                  {area.highlights.map((highlight) => (
                    <div key={highlight} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#3c9ba7] shrink-0" />
                      <span className="text-[14px] text-[#2e2e2e]/70">{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Property types */}
            {area.property_types.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#2e2e2e]/40 mb-3">
                  Property Types Available
                </h3>
                <div className="flex flex-wrap gap-2">
                  {area.property_types.map((type) => (
                    <span
                      key={type}
                      className="inline-flex items-center px-3 py-1 text-[12px] font-medium text-[#3c9ba7] bg-[#3c9ba7]/[0.06] rounded-full border border-[#3c9ba7]/10"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Properties in this area — listings mode */}
      {showProperties && (
        <section className="max-w-[1600px] mx-auto px-6 lg:px-12 pb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-gloock text-[24px] md:text-[28px] text-[#2e2e2e]">
              Properties in {area.name}
            </h2>
            {properties.length > 0 && (
              <p className="text-[13px] font-medium text-[#2e2e2e]/40">
                {`${properties.length} available`}
              </p>
            )}
          </div>
          <PropertyGrid properties={properties} loading={false} />
          {properties.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border border-[#2e2e2e]/[0.06]">
              <Home className="w-10 h-10 text-[#3c9ba7]/40 mx-auto mb-3" />
              <p className="text-[#2e2e2e]/60 mb-4">
                No properties currently listed in {area.name}.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#3c9ba7] hover:text-[#2d8a95] transition-colors"
              >
                Browse all properties <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Area insight — info mode (replaces property grid while listings are dark).
          Uses existing area data — highlights, property_types, price_range, region —
          to give the page substance until properties go live. Auto-reverts to the
          property grid above when PROPERTIES_PUBLIC=true. */}
      {!showProperties && (
        <>
          {/* At a glance — quick stats strip */}
          <section className="max-w-[1600px] mx-auto px-6 lg:px-12 pb-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
              <StatCard
                label="Region"
                value={area.region}
              />
              {area.price_range && (
                <StatCard
                  label="Price range"
                  value={area.price_range}
                />
              )}
              {childAreas.length > 0 && (
                <StatCard
                  label="Neighbourhoods"
                  value={String(childAreas.length)}
                />
              )}
              {area.property_types.length > 0 && (
                <StatCard
                  label="Property types"
                  value={String(area.property_types.length)}
                />
              )}
            </div>
          </section>

          {/* What makes this area special — highlights as visual cards */}
          {area.highlights.length > 0 && (
            <section className="max-w-[1600px] mx-auto px-6 lg:px-12 py-16">
              <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#3c9ba7] mb-3">
                What to know
              </p>
              <h2 className="font-gloock text-[28px] md:text-[36px] text-[#2e2e2e] leading-tight mb-10">
                What makes {area.name} special.
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                {area.highlights.map((highlight, i) => (
                  <div
                    key={i}
                    className="bg-white border border-[#2e2e2e]/[0.06] rounded-[6px] p-5 lg:p-6"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#3c9ba7]/10 text-[#3c9ba7] flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-[14px] md:text-[15px] text-[#2e2e2e]/80 leading-relaxed">
                        {highlight}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Property types you'll find — pills */}
          {area.property_types.length > 0 && (
            <section className="max-w-[1600px] mx-auto px-6 lg:px-12 pb-16">
              <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#3c9ba7] mb-3">
                Available in {area.name}
              </p>
              <h3 className="font-gloock text-[22px] md:text-[28px] text-[#2e2e2e] leading-tight mb-6">
                Property types you&apos;ll find here.
              </h3>
              <div className="flex flex-wrap gap-2">
                {area.property_types.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center px-4 py-2 text-[13px] font-medium text-[#2e2e2e]/75 bg-white border border-[#2e2e2e]/10 rounded-full"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Notify me — subtle email capture */}
          <section className="max-w-[1600px] mx-auto px-6 lg:px-12 pb-16">
            <NewsletterForm
              variant="card"
              label={`Get notified about ${area.name} property listings.`}
              helperText={`We'll let you know when our ${area.name} property collection goes live, plus include the next quarterly market report. No spam.`}
            />
          </section>
        </>
      )}

      {/* Child areas (micro-locations) */}
      {childAreas.length > 0 && (
        <section className="max-w-[1600px] mx-auto px-6 lg:px-12 py-16">
          <h2 className="font-gloock text-[24px] md:text-[28px] text-[#2e2e2e] mb-2">
            Neighbourhoods in {area.name}
          </h2>
          <p className="text-[15px] text-[#2e2e2e]/50 mb-8">
            Explore specific areas within {area.name}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {childAreas.map((child) => (
              <Link
                key={child.slug}
                href={`/areas/${child.slug}`}
                className="group bg-white rounded-xl overflow-hidden border border-[#2e2e2e]/[0.06] hover:border-[#3c9ba7]/20 hover:shadow-lg transition-all duration-300"
              >
                {child.hero_image ? (
                  <div className="relative aspect-[16/9] bg-[#f0ede9] overflow-hidden">
                    <Image
                      src={child.hero_image}
                      alt={child.hero_image_alt || child.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/9] bg-gradient-to-br from-[#3c9ba7]/10 to-[#3c9ba7]/[0.03] flex items-center justify-center">
                    <MapPin className="w-8 h-8 text-[#3c9ba7]/30" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-gloock text-[18px] text-[#2e2e2e] group-hover:text-[#3c9ba7] transition-colors">
                      {child.name}
                    </h3>
                    <ArrowRight className="w-4 h-4 text-[#2e2e2e]/20 group-hover:text-[#3c9ba7] group-hover:translate-x-0.5 transition-all mt-1" />
                  </div>
                  <p className="text-[13px] text-[#2e2e2e]/50 mb-3 line-clamp-2">
                    {child.subheading}
                  </p>
                  <p className="text-[12px] font-semibold text-[#2e2e2e]/40">{child.price_range}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Nearby areas */}
      {nearbyAreas.length > 0 && (
        <section className="bg-white border-t border-[#2e2e2e]/[0.06]">
          <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-16">
            <h2 className="font-gloock text-[24px] md:text-[28px] text-[#2e2e2e] mb-2">
              Nearby Areas
            </h2>
            <p className="text-[15px] text-[#2e2e2e]/50 mb-8">
              Explore neighbouring locations on the Costa del Sol
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {nearbyAreas.map((nearby) => (
                <Link
                  key={nearby.slug}
                  href={`/areas/${nearby.slug}`}
                  className="group flex items-center gap-3 bg-[#faf9f8] rounded-lg p-4 border border-[#2e2e2e]/[0.04] hover:border-[#3c9ba7]/20 hover:bg-white transition-all duration-300"
                >
                  <MapPin className="w-4 h-4 text-[#3c9ba7]/60 group-hover:text-[#3c9ba7] transition-colors shrink-0" />
                  <div>
                    <p className="text-[14px] font-medium text-[#2e2e2e] group-hover:text-[#3c9ba7] transition-colors">
                      {nearby.name}
                    </p>
                    <p className="text-[11px] text-[#2e2e2e]/40">{nearby.region}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="max-w-[1600px] mx-auto px-6 lg:px-12 py-16">
        <div className="bg-gradient-to-br from-[#3c9ba7]/[0.06] to-[#3c9ba7]/[0.02] rounded-2xl p-8 md:p-12 text-center border border-[#3c9ba7]/10">
          <h2 className="font-gloock text-[28px] md:text-[36px] text-[#2e2e2e] mb-3">
            Looking for property in {area.name}?
          </h2>
          <p className="text-[16px] text-[#2e2e2e]/60 mb-8 max-w-2xl mx-auto">
            Our team of experts specialises in {area.name} and the wider Costa del Sol. Let us help you find your perfect property.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/?area=${encodeURIComponent(area.name)}`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#3c9ba7] text-white text-[13px] font-semibold tracking-[0.05em] uppercase rounded-lg hover:bg-[#2d8a95] transition-colors"
            >
              Browse Properties <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/areas"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#2e2e2e] text-[13px] font-semibold tracking-[0.05em] uppercase rounded-lg border border-[#2e2e2e]/10 hover:border-[#3c9ba7]/30 transition-colors"
            >
              View All Areas
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ───────── Sub-components ───────── */

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-[#2e2e2e]/[0.06] rounded-[6px] px-5 py-5">
      <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#2e2e2e]/40 mb-2">
        {label}
      </p>
      <p className="font-gloock text-[20px] md:text-[22px] text-[#2e2e2e] leading-tight">
        {value}
      </p>
    </div>
  );
}
