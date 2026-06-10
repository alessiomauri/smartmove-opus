'use client';

import { useState, FormEvent } from 'react';

interface NewsletterFormProps {
  /** Heading text shown above the input */
  label?: string;
  /** Sub-text shown below the input */
  helperText?: string;
  /** Visual variant — `inline` for footer-style, `card` for boxed feature */
  variant?: 'inline' | 'card';
}

/**
 * Single-field email subscribe form.
 *
 * On submit, validates the email and posts it to /api/leads with
 * source 'newsletter' — the lead lands in the `leads` table (and Monday,
 * when that integration is switched on). When an ESP (Resend, Mailchimp,
 * Beehiiv…) is chosen, add the ESP call next to the lead write.
 */
export default function NewsletterForm({
  label = 'Subscribe to the quarterly Marbella property report',
  helperText = 'Independent market research. No spam, ever.',
  variant = 'inline',
}: NewsletterFormProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    // Optimistic UI: flip to the thank-you state immediately; the lead
    // write is fire-and-forget (durable in the leads table server-side).
    setSubmitted(true);
    void fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'newsletter',
        source_detail: typeof window !== 'undefined' ? window.location.pathname : undefined,
        name: 'Newsletter subscriber',
        email,
      }),
    }).catch(() => {
      // Swallow — the thank-you state already showed; a retry path can
      // come with the ESP integration.
    });
  };

  if (variant === 'card') {
    return (
      <div className="bg-white border border-ink/[0.06] rounded-xl px-8 py-10 lg:px-12 lg:py-12">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-gold mb-4">
          Quarterly Report
        </p>
        <h3 className="font-display text-[24px] md:text-[32px] text-ink leading-tight mb-3">
          {label}
        </h3>
        {helperText && (
          <p className="text-[14px] text-ink/60 mb-6">{helperText}</p>
        )}
        <FormBody
          email={email}
          setEmail={setEmail}
          error={error}
          submitted={submitted}
          onSubmit={onSubmit}
        />
      </div>
    );
  }

  // inline variant
  return (
    <div>
      <h3 className="font-display text-[18px] md:text-[20px] text-ink mb-2 leading-tight">
        {label}
      </h3>
      {helperText && (
        <p className="text-[13px] text-ink/60 mb-4">{helperText}</p>
      )}
      <FormBody
        email={email}
        setEmail={setEmail}
        error={error}
        submitted={submitted}
        onSubmit={onSubmit}
      />
    </div>
  );
}

function FormBody({
  email,
  setEmail,
  error,
  submitted,
  onSubmit,
}: {
  email: string;
  setEmail: (v: string) => void;
  error: string;
  submitted: boolean;
  onSubmit: (e: FormEvent) => void;
}) {
  if (submitted) {
    return (
      <div className="py-3 text-[14px] text-gold">
        Thank you. We&apos;ll be in touch.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md">
      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-label="Email address"
        className="flex-1 px-4 py-3 text-[14px] bg-white border border-ink/15 rounded-full focus:outline-none focus:border-gold transition-colors"
      />
      <button
        type="submit"
        className="px-6 py-3 text-[12px] font-semibold tracking-[0.08em] uppercase bg-gold text-white rounded-full hover:bg-gold-deep transition-colors whitespace-nowrap"
      >
        Subscribe
      </button>
      {error && <p className="text-[12px] text-red-600 sm:hidden">{error}</p>}
    </form>
  );
}
