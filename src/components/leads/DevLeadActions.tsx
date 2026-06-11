'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import LeadForm from '@/components/leads/LeadForm';

/**
 * Development-page sidebar: the four designed actions — Register early
 * interest / Download the brochure / Book a virtual presentation /
 * Schedule a viewing — all open the SAME mini lead-form; the chosen
 * action travels as an intent label inside source_detail. One
 * pipeline, four intents.
 */

const INTENTS = [
  { key: 'register', label: 'Register early interest', source: 'viewing-request' },
  { key: 'brochure', label: 'Download the brochure', source: 'brochure-request' },
  { key: 'virtual', label: 'Book a virtual presentation', source: 'viewing-request' },
  { key: 'viewing', label: 'Schedule a viewing', source: 'viewing-request' },
] as const;

type IntentKey = (typeof INTENTS)[number]['key'];

export default function DevLeadActions({
  reference,
  developmentId,
  brochureUrl,
}: {
  reference: string;
  developmentId: string;
  brochureUrl?: string | null;
}) {
  const t = useTranslations('leadForm');
  const [active, setActive] = useState<IntentKey | null>(null);
  const intent = INTENTS.find((i) => i.key === active);

  return (
    <div className="bg-white border border-ink/[0.08] rounded-2xl p-6 md:p-7 shadow-[0_8px_40px_-12px_rgba(28,26,23,0.08)]">
      <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-gold mb-2">
        {t('devSidebarEyebrow')}
      </p>
      <h3 className="font-display text-[22px] text-ink leading-tight mb-5">
        {t('devSidebarHeading')}
      </h3>

      {!intent ? (
        <div className="flex flex-col gap-2.5">
          {INTENTS.map((i, idx) => (
            <button
              key={i.key}
              type="button"
              onClick={() => setActive(i.key)}
              className={
                idx === 0
                  ? 'px-5 py-3.5 text-[12px] font-semibold tracking-[0.08em] uppercase bg-gold text-white rounded-full hover:bg-gold-deep transition-colors'
                  : 'px-5 py-3.5 text-[12px] font-semibold tracking-[0.08em] uppercase bg-white text-ink border border-ink/15 rounded-full hover:border-gold hover:text-gold transition-colors'
              }
            >
              {i.label}
            </button>
          ))}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[12px] font-semibold tracking-[0.06em] uppercase text-gold">
              {intent.label}
            </span>
            <button
              type="button"
              onClick={() => setActive(null)}
              className="text-[11px] text-ink/50 hover:text-gold transition-colors"
            >
              {t('backToActions')}
            </button>
          </div>
          <LeadForm
            key={intent.key} // fresh form state per intent
            variant={intent.key === 'brochure' ? 'brochure' : 'viewing'}
            source={intent.source}
            sourceDetail={reference}
            intent={intent.label}
            developmentId={developmentId}
            brochureUrl={intent.key === 'brochure' ? brochureUrl : undefined}
            submitLabel={intent.key === 'brochure' ? undefined : intent.label}
          />
        </div>
      )}
    </div>
  );
}
