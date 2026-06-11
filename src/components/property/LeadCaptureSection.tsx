import { getTranslations } from 'next-intl/server';
import LeadForm from '@/components/leads/LeadForm';
import type { Property } from '@/types/property';

/**
 * Property-page lead capture (§4.5): a "Request a viewing" form plus a
 * "Download brochure" email-gate, both posting to /api/leads with
 * source_detail = the listing reference.
 *
 * Placement per spec: sits AFTER the gallery in document order
 * (mobile reads it right below the photos); on desktop the section is
 * a two-column layout whose form column is sticky — the sidebar
 * pattern without restructuring the whole page.
 *
 * Server component — only LeadForm hydrates.
 */
export default async function LeadCaptureSection({ property }: { property: Property }) {
  const t = await getTranslations('leadForm');
  const reference = property.source_id || property.slug;

  return (
    <section className="py-16 lg:py-24 bg-white border-y border-ink/[0.06] relative overflow-hidden">
      <div className="absolute -top-24 right-[10%] w-72 h-72 bg-gold/[0.04] rounded-full blur-3xl pointer-events-none" />
      <div className="max-w-[1400px] mx-auto px-8 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-12 lg:gap-20 items-start">
          {/* Editorial column */}
          <div className="max-w-xl">
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-gold mb-4">
              {t('eyebrowViewing')}
            </p>
            <h2 className="font-display text-[32px] md:text-[44px] text-ink leading-[1.05] tracking-tight mb-5">
              {t('headingViewing')}
            </h2>
            <p className="text-[15px] text-ink/65 leading-relaxed mb-8">{t('subViewing')}</p>
            <ul className="space-y-3">
              {['In-person or video viewing', 'Local advisors, no call centres', 'Same-day response'].map((line) => (
                <li key={line} className="flex items-center gap-3 text-[13.5px] text-ink/70">
                  <span className="w-5 h-[1px] bg-gold shrink-0" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {/* Sticky form column (desktop sidebar) */}
          <div className="lg:sticky lg:top-24">
            <div className="bg-paper border border-ink/[0.08] rounded-2xl p-6 md:p-8 shadow-[0_8px_40px_-12px_rgba(28,26,23,0.08)]">
              <p className="text-[11px] tracking-[0.16em] uppercase text-ink/45 mb-4">
                Ref. {reference}
              </p>
              <LeadForm
                variant="viewing"
                source="viewing-request"
                sourceDetail={reference}
                propertyId={property.id}
              />
            </div>

            {/* Brochure email-gate */}
            <div className="mt-4 bg-paper border border-ink/[0.08] rounded-2xl p-6 md:p-8">
              <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-gold mb-2">
                {t('eyebrowBrochure')}
              </p>
              <h3 className="font-display text-[20px] text-ink mb-1.5">{t('headingBrochure')}</h3>
              <p className="text-[13px] text-ink/60 mb-5">{t('subBrochure')}</p>
              <LeadForm
                variant="brochure"
                source="brochure-request"
                sourceDetail={reference}
                propertyId={property.id}
                brochureUrl={`/api/property/${property.slug}/brochure`}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
