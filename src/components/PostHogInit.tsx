'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

const CONSENT_STORAGE_KEY = 'ml_cookie_consent'; // same key Analytics.tsx gates on

/**
 * PostHog bootstrap (EU project). Env (already set in Vercel):
 *  - NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN  (required — absent ⇒ no-op)
 *  - NEXT_PUBLIC_POSTHOG_HOST           (optional, default eu.i.posthog.com)
 *
 * Consent model: PostHog starts in MEMORY persistence — no cookies, no
 * localStorage, identifiers die with the page — so funnel events (quiz
 * steps, lead-form views) flow without an analytics-cookie opt-in,
 * matching our first-party quiz_events. When the visitor accepts the
 * cookie banner (same key/event Analytics.tsx uses for GA/Meta),
 * persistence upgrades to localStorage+cookie and sessions stitch.
 *
 * The instance is exposed as window.posthog — quiz-track.ts and the
 * lead forms mirror through that handle, so they keep working with or
 * without this component mounted.
 */
export default function PostHogInit() {
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    if (!token || posthog.__loaded) return;

    const consented = localStorage.getItem(CONSENT_STORAGE_KEY) === 'accepted';

    posthog.init(token, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
      persistence: consented ? 'localStorage+cookie' : 'memory',
      capture_pageview: 'history_change', // App Router route changes
      capture_pageleave: true,
      autocapture: false, // explicit events only — keeps the EU volume lean
    });
    window.posthog = posthog;

    const onConsent = () => {
      if (localStorage.getItem(CONSENT_STORAGE_KEY) === 'accepted') {
        posthog.set_config({ persistence: 'localStorage+cookie' });
      }
    };
    window.addEventListener('ml-consent-changed', onConsent);
    window.addEventListener('storage', onConsent);
    return () => {
      window.removeEventListener('ml-consent-changed', onConsent);
      window.removeEventListener('storage', onConsent);
    };
  }, []);

  return null;
}
