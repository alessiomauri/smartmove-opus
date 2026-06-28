'use client';

import { useState } from 'react';
import LeadForm from '@/components/leads/LeadForm';

/**
 * Brochure email-gate — the design's `.rs-broch` card re-skinned as an
 * expander. Collapsed it's the dark "Download the property PDF" card;
 * expanded it reveals the real brochure LeadForm (variant="brochure",
 * source="brochure-request"), which posts the lead and then reveals the
 * download link to /api/property/[slug]/brochure on success.
 */
export default function ResalesBrochure({
  slug,
  reference,
  propertyId,
}: {
  slug: string;
  reference: string;
  propertyId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`rs-broch${open ? ' open' : ''}`}>
      <button
        className="rs-broch-head"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div>
          <div className="t">Download the <em>property PDF.</em></div>
          <div className="s">Photos · specs · costs · email-gated</div>
        </div>
        <span className="arr">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 9l6 6 6-6" /></svg>
        </span>
      </button>

      {open && (
        <div className="rs-broch-body">
          <LeadForm
            variant="brochure"
            source="brochure-request"
            sourceDetail={reference}
            propertyId={propertyId}
            brochureUrl={`/api/property/${slug}/brochure`}
          />
        </div>
      )}
    </div>
  );
}
