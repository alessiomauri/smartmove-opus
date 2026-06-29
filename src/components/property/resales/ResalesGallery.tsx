'use client';

import { useState } from 'react';
import Lightbox from '@/components/ui/Lightbox';

/**
 * Resales gallery hero — the design's locked full-bleed carousel with a
 * discreet thumbnail film strip, prev/next, and a "View all photos"
 * button that opens the existing site Lightbox. photoCount is the real
 * photo-array length (no phantom "+N"); images are the proxied URLs
 * passed from the server.
 *
 * Top BLEED band: the liquid-glass header overlays the top ~96px of the hero,
 * so that band is a BLURRED copy of the current photo (a soft continuation of
 * the crisp image below). The crisp image fills the carousel; the blurred bleed
 * overlays only the top band, continuous with the crisp image at its bottom
 * edge. Both use the CURRENT frame `photos[i]`, so the bleed tracks the carousel
 * (it lives here, in the gallery — no cross-component plumbing).
 */
export default function ResalesGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [i, setI] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const count = photos.length;
  if (count === 0) return null;

  const step = (n: number) => setI((p) => (p + n + count) % count);

  return (
    <section className="rs-gallery" aria-label="Property photos">
      <div className="rs-carousel">
        {/* crisp hero image (whole subject visible below the bleed/header) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="rs-carimg" src={photos[i]} alt={alt} />
        {/* blurred bleed band under the glass header — same frame, same cover
            box, blurred + clipped to the top band; continuous with the crisp
            image at the band's bottom edge. */}
        <div className="rs-bleed" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="rs-bleed-img" src={photos[i]} alt="" />
        </div>

        {count > 1 && (
          <>
            <button className="rs-car-nav prev" onClick={() => step(-1)} aria-label="Previous photo" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <button className="rs-car-nav next" onClick={() => step(1)} aria-label="Next photo" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 5l7 7-7 7" /></svg>
            </button>
          </>
        )}

        <button className="rs-allbtn" onClick={() => setLightbox(true)} type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></svg>
          View all photos
        </button>

        <div className="rs-film">
          <span className="rs-counter">{i + 1} / {count}</span>
          {photos.map((p, idx) => (
            <button
              key={idx}
              className={`rs-thumb${idx === i ? ' active' : ''}`}
              onClick={() => setI(idx)}
              aria-label={`Photo ${idx + 1}`}
              type="button"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      </div>

      {lightbox && (
        <Lightbox
          images={photos}
          currentIndex={i}
          onClose={() => setLightbox(false)}
          onPrevious={() => step(-1)}
          onNext={() => step(1)}
        />
      )}
    </section>
  );
}
