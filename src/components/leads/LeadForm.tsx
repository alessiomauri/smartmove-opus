'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';

/**
 * The one lead form. Every capture surface (property viewing request,
 * brochure gate, development intents, contact page, footer) renders
 * this with a different field preset — one pipeline, one styling, one
 * set of anti-spam measures:
 *
 *  - fetches the signed submit token on mount (/api/leads/token) — the
 *    server rejects submits younger than 2s (bots) or unsigned;
 *  - carries the hidden honeypot input;
 *  - fires a single "view" beacon on mount so conversion (submissions
 *    ÷ views) is measurable per form+listing;
 *  - inline success state, no redirect.
 */

export type LeadFormVariant =
  | 'viewing'        // name, email, phone?, preferred date?, message?
  | 'brochure'       // name, email — the email-gate
  | 'contact'        // name, email, phone?, message
  | 'contact-slim';  // footer: name, email, message?

export interface LeadFormProps {
  variant: LeadFormVariant;
  source: 'viewing-request' | 'brochure-request' | 'contact-form';
  /** Property/dev reference (listing forms) or page context. */
  sourceDetail?: string;
  /** Dev sidebar action label — recorded in source_detail after the ref. */
  intent?: string;
  propertyId?: string;
  developmentId?: string;
  /** Brochure gate: revealed as a download link in the success state. */
  brochureUrl?: string | null;
  /** Success copy override (defaults per variant). */
  successText?: string;
  submitLabel?: string;
  className?: string;
}

// Module-level dedupe: one view beacon per form+detail per page load.
const seenViews = new Set<string>();

export default function LeadForm({
  variant,
  source,
  sourceDetail,
  intent,
  propertyId,
  developmentId,
  brochureUrl,
  successText,
  submitLabel,
  className = '',
}: LeadFormProps) {
  const t = useTranslations('leadForm');
  const locale = useLocale();
  const tokenRef = useRef<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');

  useEffect(() => {
    // Submit token — minted server-side at MOUNT time (pages are
    // ISR-cached, so nothing render-embedded would be fresh).
    fetch('/api/leads/token')
      .then((r) => r.json())
      .then((j) => { tokenRef.current = j.token ?? null; })
      .catch(() => { /* submit will surface a reload hint */ });

    // One view beacon per form+listing per page load.
    const key = `${source}:${sourceDetail ?? ''}`;
    if (!seenViews.has(key)) {
      seenViews.add(key);
      const payload = JSON.stringify({
        form: source,
        path: window.location.pathname,
        detail: sourceDetail,
      });
      try {
        if (!navigator.sendBeacon?.('/api/leads/track', new Blob([payload], { type: 'application/json' }))) {
          void fetch('/api/leads/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true });
        }
      } catch {
        /* tracking must never break the form */
      }
    }
  }, [source, sourceDetail]);

  const showPhone = variant === 'viewing' || variant === 'contact';
  const showDate = variant === 'viewing';
  const showMessage = variant !== 'brochure';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('errorFields'));
      return;
    }
    setState('sending');

    const messageParts: string[] = [];
    if (intent) messageParts.push(`[${intent}]`);
    if (date) messageParts.push(`${t('preferredDate')}: ${date}`);
    if (message.trim()) messageParts.push(message.trim());

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          source_detail: [sourceDetail, intent ? `intent:${intent}` : null]
            .filter(Boolean)
            .join(' · ')
            .slice(0, 120) || undefined,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          message: messageParts.join('\n') || undefined,
          property_id: propertyId,
          property_reference: sourceDetail,
          development_id: developmentId,
          language: locale,
          _ts: tokenRef.current ?? undefined,
          company: honeypot,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState('idle');
        setError(json.error || t('errorGeneric'));
        return;
      }
      setState('done');
    } catch {
      setState('idle');
      setError(t('errorGeneric'));
    }
  }

  if (state === 'done') {
    return (
      <div className={`py-4 ${className}`} role="status">
        <p className="text-[15px] text-ink font-medium mb-1">
          {successText ?? (variant === 'brochure' ? t('successBrochure') : t('successViewing'))}
        </p>
        {variant === 'brochure' && brochureUrl && (
          <a
            href={brochureUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-3 px-5 py-2.5 bg-gold text-white text-[12px] font-semibold tracking-[0.08em] uppercase rounded-full hover:bg-gold-deep transition-colors"
          >
            {t('downloadNow')}
          </a>
        )}
        <p className="text-[12px] text-ink/50 mt-1">{t('successFollowup')}</p>
      </div>
    );
  }

  const slim = variant === 'contact-slim' || variant === 'brochure';
  const inputCls =
    'w-full px-4 py-3 text-[14px] bg-white border border-ink/15 rounded-full focus:outline-none focus:border-gold transition-colors placeholder:text-ink/35';

  return (
    <form onSubmit={onSubmit} className={`flex flex-col gap-2.5 ${className}`} noValidate>
      {/* Honeypot — visually removed, still in the a11y-hidden DOM for bots. */}
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label>
          {t('honeypotLabel')}
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>

      <div className={slim ? 'flex flex-col gap-2.5' : 'grid grid-cols-1 sm:grid-cols-2 gap-2.5'}>
        <input
          type="text"
          required
          placeholder={t('namePlaceholder')}
          aria-label={t('namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
        />
        <input
          type="email"
          required
          placeholder={t('emailPlaceholder')}
          aria-label={t('emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
      </div>

      {(showPhone || showDate) && (
        <div className={showPhone && showDate ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5' : ''}>
          {showPhone && (
            <input
              type="tel"
              placeholder={t('phonePlaceholder')}
              aria-label={t('phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls}
            />
          )}
          {showDate && (
            <input
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              aria-label={t('preferredDate')}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputCls} text-ink/70`}
            />
          )}
        </div>
      )}

      {showMessage && (
        <textarea
          placeholder={t('messagePlaceholder')}
          aria-label={t('messagePlaceholder')}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={variant === 'contact' ? 4 : 3}
          className="w-full px-4 py-3 text-[14px] bg-white border border-ink/15 rounded-2xl focus:outline-none focus:border-gold transition-colors placeholder:text-ink/35 resize-none"
        />
      )}

      {error && (
        <p className="text-[12.5px] text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'sending'}
        className="mt-1 px-6 py-3.5 text-[12px] font-semibold tracking-[0.1em] uppercase bg-gold text-white rounded-full hover:bg-gold-deep transition-colors disabled:opacity-60 disabled:cursor-wait"
      >
        {state === 'sending'
          ? t('sending')
          : submitLabel ?? (variant === 'brochure' ? t('submitBrochure') : variant === 'viewing' ? t('submitViewing') : t('submitContact'))}
      </button>

      <p className="text-[11px] text-ink/40 leading-relaxed">{t('privacyNote')}</p>
    </form>
  );
}
