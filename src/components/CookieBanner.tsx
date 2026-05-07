'use client';

import { useEffect, useState } from 'react';

const CONSENT_STORAGE_KEY = 'ml_cookie_consent';

/**
 * Minimal cookie banner. EU/GDPR-friendly: GA4 + Meta Pixel only mount
 * after the user clicks Accept. Decline keeps the site fully functional
 * (Vercel Analytics still runs because it sets no cookies and collects no PII).
 *
 * Choice persists in localStorage; banner re-appears if the user clears it.
 * The user can change their mind via the small footer "Cookie settings" link
 * (not implemented yet — easy follow-up).
 */
export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show the banner if there's actually a tracker that needs consent.
    // While GA/Pixel IDs are unset (pre-launch), hide it entirely.
    const hasTrackers =
      !!process.env.NEXT_PUBLIC_GA_ID || !!process.env.NEXT_PUBLIC_META_PIXEL_ID;
    if (!hasTrackers) return;

    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!stored) setVisible(true);
  }, []);

  const handleChoice = (choice: 'accepted' | 'declined') => {
    localStorage.setItem(CONSENT_STORAGE_KEY, choice);
    window.dispatchEvent(new Event('ml-consent-changed'));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-4 inset-x-4 lg:inset-x-auto lg:left-6 lg:bottom-6 lg:w-[360px] z-[60] bg-white border border-ink/10 rounded-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)] p-5"
    >
      <p className="text-[13px] leading-relaxed text-ink/80 mb-4">
        We use cookies to understand how visitors use the site (Google Analytics)
        and for marketing measurement (Meta Pixel). Decline keeps the site fully
        functional.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleChoice('accepted')}
          className="flex-1 bg-gold hover:bg-gold-deep text-white text-[12px] font-semibold tracking-[0.04em] uppercase py-2.5 rounded-full transition-colors duration-200"
        >
          Accept
        </button>
        <button
          onClick={() => handleChoice('declined')}
          className="flex-1 bg-transparent text-ink/60 hover:text-ink text-[12px] font-semibold tracking-[0.04em] uppercase py-2.5 rounded-full border border-ink/15 transition-colors duration-200"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
