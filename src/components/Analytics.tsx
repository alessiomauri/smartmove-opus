'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { GoogleAnalytics } from '@next/third-parties/google';

const CONSENT_STORAGE_KEY = 'ml_cookie_consent';

/**
 * Wraps GA4 + Meta Pixel and only mounts them once the user has explicitly
 * accepted analytics cookies. Vercel Analytics doesn't run through here —
 * it's first-party, no PII, doesn't need consent (mounted in layout.tsx).
 *
 * IDs are read from build-time env vars:
 *  - NEXT_PUBLIC_GA_ID         (e.g. "G-XXXXXXXXXX")
 *  - NEXT_PUBLIC_META_PIXEL_ID (numeric pixel id, e.g. "1234567890")
 */
export default function Analytics() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(CONSENT_STORAGE_KEY) : null;
    setConsented(stored === 'accepted');

    const onChange = () => {
      const v = localStorage.getItem(CONSENT_STORAGE_KEY);
      setConsented(v === 'accepted');
    };
    window.addEventListener('storage', onChange);
    window.addEventListener('ml-consent-changed', onChange);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener('ml-consent-changed', onChange);
    };
  }, []);

  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  if (!consented) return null;

  return (
    <>
      {gaId && <GoogleAnalytics gaId={gaId} />}
      {pixelId && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window,document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${pixelId}');
              fbq('track', 'PageView');
            `}
          </Script>
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              alt=""
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}
    </>
  );
}
