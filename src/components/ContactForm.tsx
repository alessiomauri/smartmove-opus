'use client';

import { useState } from 'react';
import { toast } from 'sonner';

type FormSource =
  | 'contact-form'
  | 'viewing-request'
  | 'brochure-request'
  | 'two-step-landing'
  | 'newsletter';

interface ContactFormProps {
  /** Where this form lives — used to differentiate funnels in admin / Monday */
  source: FormSource;
  /** Specific identifier (e.g. 'villas-up-to-2m', 'property-detail-villa-amara') */
  sourceDetail?: string;
  /** Optional property/dev context. Either a Smartmove UUID or a Resales ref */
  propertyId?: string;
  propertyReference?: string;
  developmentId?: string;
  /** Show the Step 2 enrichment fields (timeline, contact method) */
  showStep2?: boolean;
  /** UI labels — defaults are sensible for the contact-form variant */
  title?: string;
  intro?: string;
  submitLabel?: string;
  successMessage?: string;
  className?: string;
}

/**
 * Single-step contact form with optional Step 2 enrichment.
 *
 * Step 1 is the bare minimum (name + email + GDPR consent) — the lead is
 * captured the moment Step 1 submits. Step 2 fields are purely additive
 * and never gate the conversion (per CLAUDE_DESIGN_BRIEF §4.5).
 *
 * Posts to /api/leads which writes to the local DB always and fires the
 * Monday wrapper as a side effect (no-op until env-configured).
 */
export default function ContactForm({
  source,
  sourceDetail,
  propertyId,
  propertyReference,
  developmentId,
  showStep2 = false,
  title = 'Speak with our team',
  intro = 'Tell us a little about what you’re looking for. We respond within one business day.',
  submitLabel = 'Send enquiry',
  successMessage = 'Thanks. We’ll be in touch shortly.',
  className,
}: ContactFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const fd = new FormData(e.currentTarget);

    if (!fd.get('consent')) {
      toast.error('Please agree to the privacy policy to continue.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          source_detail: sourceDetail,
          name: String(fd.get('name') || '').trim(),
          email: String(fd.get('email') || '').trim(),
          phone: stringOrUndefined(fd.get('phone')),
          bedrooms: stringOrUndefined(fd.get('bedrooms')),
          budget_tier: stringOrUndefined(fd.get('budget_tier')),
          purchase_timeline: stringOrUndefined(fd.get('purchase_timeline')),
          contact_method: stringOrUndefined(fd.get('contact_method')),
          message: stringOrUndefined(fd.get('message')),
          property_id: propertyId,
          property_reference: propertyReference,
          development_id: developmentId,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error('Something went wrong — please try again.', {
          description: Array.isArray(json.issues) ? json.issues.join(' · ') : json.error,
        });
        return;
      }
      setSubmitted(true);
      toast.success(successMessage);
    } catch (err) {
      toast.error('Network error — please try again.', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className={className} style={{ padding: 32, textAlign: 'center' }}>
        <p
          style={{
            fontFamily: 'var(--sm-font-display)',
            fontSize: 24,
            color: 'var(--sm-ink)',
            marginBottom: 8,
          }}
        >
          Thank you.
        </p>
        <p style={{ color: 'var(--sm-text-muted)', fontSize: 14 }}>
          {successMessage}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={className}>
      {(title || intro) && (
        <header style={{ marginBottom: 24 }}>
          {title && <h3 className="sm-form__title">{title}</h3>}
          {intro && <p className="sm-form__intro">{intro}</p>}
        </header>
      )}

      <div className="sm-form__grid">
        <Field name="name" label="Name" required />
        <Field name="email" type="email" label="Email" required />
        <Field name="phone" type="tel" label="Phone (optional)" />
      </div>

      {showStep2 && (
        <div className="sm-form__grid sm-form__grid--step2">
          <Select
            name="bedrooms"
            label="Bedrooms"
            options={['Any', 'Studio', '1+', '2+', '3+', '4+', '5+']}
          />
          <Select
            name="budget_tier"
            label="Budget"
            options={[
              'Up to €1M',
              '€1M – €2M',
              '€2M – €5M',
              '€5M – €10M',
              'Over €10M',
            ]}
          />
          <Select
            name="purchase_timeline"
            label="Timeline"
            options={['Within 1 month', '1–3 months', '3–6 months', '6+ months', 'Just exploring']}
          />
          <Select
            name="contact_method"
            label="Preferred contact"
            options={['Email', 'Phone', 'WhatsApp', 'Video call']}
          />
        </div>
      )}

      <div className="sm-form__field">
        <label htmlFor="message" className="sm-form__lbl">
          Message (optional)
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          className="sm-form__input sm-form__textarea"
          placeholder="Anything specific you’re looking for?"
        />
      </div>

      <label className="sm-form__consent">
        <input type="checkbox" name="consent" required />
        <span>
          I agree to be contacted about this enquiry. We’ll never share your details.
        </span>
      </label>

      <button type="submit" disabled={submitting} className="sm-form__submit">
        {submitting ? 'Sending…' : submitLabel}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="sm-form__field">
      <label htmlFor={name} className="sm-form__lbl">
        {label}
        {required && <span className="sm-form__req"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="sm-form__input"
        autoComplete={name === 'name' ? 'name' : name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'off'}
      />
    </div>
  );
}

function Select({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: string[];
}) {
  return (
    <div className="sm-form__field">
      <label htmlFor={name} className="sm-form__lbl">
        {label}
      </label>
      <select id={name} name={name} className="sm-form__input">
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function stringOrUndefined(v: FormDataEntryValue | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}
