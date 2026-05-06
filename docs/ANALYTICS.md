# Analytics & Tracking

Three trackers, only one runs unconditionally.

| Tracker | Status | Consent required |
|---|---|---|
| **Vercel Speed Insights** | Always on | ❌ (no PII, no cookies) |
| **Vercel Analytics** | Same as above (page views) | ❌ |
| **Google Analytics 4** | Loads after consent | ✅ EU |
| **Meta Pixel** | Loads after consent | ✅ EU |
| **Google Search Console** | Verification meta tag | ❌ (just a verification mark) |

---

## Vercel Speed Insights

Mounted unconditionally in `src/app/layout.tsx`:
```tsx
<SpeedInsights />
```

Tracks Core Web Vitals (LCP, FID/INP, CLS, TTFB) and reports to the Vercel dashboard. No cookies, no PII, no consent needed under GDPR.

---

## Google Analytics 4 + Meta Pixel

Both loaded by `src/components/Analytics.tsx`, gated behind cookie consent:

```tsx
const [consented, setConsented] = useState(false);
useEffect(() => {
  const stored = localStorage.getItem('ml_cookie_consent');
  setConsented(stored === 'accepted');
  // Listen for live consent change events
  const onChange = () => setConsented(localStorage.getItem('ml_cookie_consent') === 'accepted');
  window.addEventListener('ml-consent-changed', onChange);
  return () => window.removeEventListener('ml-consent-changed', onChange);
}, []);

if (!consented) return null;

return (
  <>
    {gaId && <GoogleAnalytics gaId={gaId} />}
    {pixelId && (
      <>
        <Script id="meta-pixel">{/* fbq init script */}</Script>
        <noscript>{/* tracking pixel img */}</noscript>
      </>
    )}
  </>
);
```

GA4 uses `@next/third-parties/google`'s `<GoogleAnalytics />` component (loads gtag.js with proper async + Vercel-optimised script ordering).

Meta Pixel is loaded via a manual `<Script>` block (the `@next/third-parties` package doesn't include a Pixel component).

### Environment variables

```
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX           # Get from Google Analytics 4 admin
NEXT_PUBLIC_META_PIXEL_ID=1234567890     # Get from Meta Events Manager
```

When neither is set, `Analytics.tsx` short-circuits to `null` and the cookie banner doesn't appear.

---

## Cookie Consent Banner

`src/components/CookieBanner.tsx`:

- Appears bottom-left on desktop, full-width on mobile, only when GA or Pixel ID is set
- Two buttons: **Accept** (teal, mounts GA + Pixel) or **Decline** (mutes GA + Pixel; site still functions)
- Choice persists in `localStorage['ml_cookie_consent']`
- Dispatches a custom `ml-consent-changed` event when the user clicks, so `Analytics.tsx` reacts immediately without a reload

Hidden entirely in two cases:
1. User has already chosen (Accept or Decline)
2. Neither `NEXT_PUBLIC_GA_ID` nor `NEXT_PUBLIC_META_PIXEL_ID` is set in env

The pre-launch state (no analytics IDs) means no banner is shown to the dev / preview deploys.

---

## Google Search Console

Verification works via meta tag:

```ts
// src/app/layout.tsx
verification: {
  google: process.env.NEXT_PUBLIC_GSC_VERIFICATION || undefined,
}
```

Set `NEXT_PUBLIC_GSC_VERIFICATION` to the value from the GSC verification meta tag (just the content, not the full tag).

After deploy:
1. Verify domain in Google Search Console using the meta tag method
2. Submit `https://marbella.live/sitemap.xml` in Settings > Sitemaps
3. Monitor Coverage, Performance, and Enhancements reports

---

## Bing Webmaster Tools

Currently not configured. To add:
1. Get verification meta value from Bing Webmaster Tools
2. Add `bing` to the `verification` block in root metadata
3. Submit sitemap

---

## Event Tracking (planned)

GA4 will need custom events configured for meaningful conversion tracking:
- `view_property` — fired on property detail page mount
- `filter_used` — when a user changes any filter
- `favourite_added` / `favourite_removed`
- `share_property` — WhatsApp / native share / link copy
- `contact_cta_click` — when contact buttons are added
- `pdf_download` — brochure download

Currently only PageView tracking is set up (the default). Add custom events via the `gtag` function once meaningful conversion goals are defined.

---

## Privacy Notes

- We never collect personal information without consent
- Vercel Speed Insights is privacy-safe (no cookies, aggregated metrics only)
- GA4 + Meta Pixel are gated behind explicit Accept
- The cookie banner is dismissible (no dark patterns); Decline keeps the site fully functional
- No third-party scripts run before consent

For full GDPR compliance when launching publicly:
- Add a `/privacy` page explaining what's collected
- Add a `/cookies` page detailing each tracker
- Add a "Cookie settings" link in the footer that re-shows the banner on click (currently TODO)

---

## Recreating Analytics Setup

1. Sign up for Vercel Analytics + Speed Insights (free for Hobby).
2. Create a GA4 property at `analytics.google.com`, copy the Measurement ID (`G-…`).
3. Create a Meta Pixel at `business.facebook.com`, copy the Pixel ID.
4. Verify domain in Google Search Console with the meta tag method, copy the token.
5. Add three env vars: `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_GSC_VERIFICATION`.
6. Copy `src/components/Analytics.tsx` + `CookieBanner.tsx`.
7. Mount both in `src/app/layout.tsx` body.
8. Verify GA4 real-time + Meta Events Manager show test traffic after Accept.
