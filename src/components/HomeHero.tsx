'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import MobileNavDrawer from './MobileNavDrawer';

/**
 * Homepage hero — Brand Foundation v1 (Costa Editorial × Editorial Slate).
 *
 * Desktop composition (per `~/Downloads/Brand Foundation.html`):
 *   - 16:9 hero photo with multi-stop dark gradient
 *   - Topbar: nav-left | wordmark | nav-right + utils
 *   - Bottom-left: eyebrow + italic-emphasised h1 + 4-field search rail
 *   - Bottom-right: "Now Featured" glass card
 *
 * Mobile composition (per `~/Downloads/Brand Foundation Mobile.html`):
 *   - 3:4 hero photo (portrait) with two-stop dark gradient
 *   - Topbar: hamburger | wordmark | favourite (no inline nav)
 *   - Bottom-anchored content: eyebrow + h1 + 2-CTA row
 *   - Search rail collapses into a separate <SearchPill> rendered below
 *   - "Now Featured" glass card moves to a separate <PinnedFeaturedCard>
 *
 * Both share the underlying photo and respect prefers-reduced-motion.
 */
interface HomeHeroProps {
  featured?: {
    name: string;
    beds: number | string;
    interior: number | string;
    priceFrom: string;
    href?: string;
  };
}

export default function HomeHero({ featured }: HomeHeroProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // No hardcoded demo fallback — when nothing is curated the "Now Featured"
  // card is hidden (clean slate) instead of showing a placeholder listing.
  const featuredCard = featured;

  return (
    <>
      <section className="sm-hero">
        {/* Background image + gradient overlays.
            The photo is a real next/image (priority) instead of a CSS
            background: the 2MB source JPEG was the homepage LCP element
            with no AVIF/WebP conversion, no srcset, and late discovery.
            Layering is identical — the gradient stack sits in an overlay
            child above the photo, and both live inside .sm-hero__bg so
            the slow-zoom animation moves them together. */}
        <div className="sm-hero__bg">
          <Image
            src="/hero/marbella-living-2023.jpg"
            alt=""
            fill
            priority
            fetchPriority="high"
            quality={70}
            sizes="100vw"
            style={{ objectFit: 'cover', objectPosition: 'center' }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: `
                linear-gradient(180deg, rgba(28,26,23,.40) 0%, rgba(28,26,23,.10) 28%, rgba(28,26,23,.55) 70%, rgba(28,26,23,.85) 100%),
                linear-gradient(100deg, rgba(28,26,23,.45) 0%, rgba(28,26,23,0) 55%)
              `,
            }}
          />
        </div>

        <div className="sm-hero__topbar">
          {/* Mobile hamburger — hidden on desktop via CSS */}
          <button
            type="button"
            className="sm-hero__hamburger"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>

          <nav className="sm-hero__nav-left">
            <Link href="/">Properties</Link>
            <Link href="/new-developments">New Developments</Link>
            <Link href="/areas">Areas</Link>
          </nav>

          <Link href="/" className="sm-hero__brand" aria-label="Smartmove Marbella — home">
            <Image
              src="/brand/logo-white.png"
              alt="Smartmove Marbella"
              width={520}
              height={160}
              priority
              // Rendered at 160px tall (110px mobile) → ~520px/358px wide.
              // Without sizes, the preload grabs a desktop-width candidate.
              sizes="(max-width: 900px) 358px, 520px"
              className="sm-hero__brand-img"
            />
          </Link>

          <div className="sm-hero__right-cluster">
            <nav className="sm-hero__nav-right">
              <Link href="/">Services</Link>
              <Link href="/">About</Link>
              <Link href="/">Contact</Link>
            </nav>
          </div>

          <div className="sm-hero__utils">
            <Link href="/favourites" className="sm-hero__fav" aria-label="Saved properties">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 3h12v18l-6-4-6 4z" />
              </svg>
            </Link>
            <span className="sm-hero__lang">EN · ES</span>
          </div>
        </div>

        <div className="sm-hero__center">
          <div>
            <p className="sm-hero__eyebrow">Marbella · Costa del Sol</p>
            <h1 className="sm-hero__title">
              Properties chosen with the <em>same care</em> we&rsquo;d choose our own.
            </h1>

            {/* Desktop: 4-field search rail. Hidden on mobile via CSS. */}
            <form
              className="sm-hero__search"
              role="search"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="sm-hero__field">
                <div className="sm-hero__field-lbl">Location</div>
                <div className="sm-hero__field-val">Marbella, all areas</div>
              </div>
              <div className="sm-hero__field">
                <div className="sm-hero__field-lbl">Type</div>
                <div className="sm-hero__field-val">Villas &amp; Apartments</div>
              </div>
              <div className="sm-hero__field">
                <div className="sm-hero__field-lbl">Budget</div>
                <div className="sm-hero__field-val">Any</div>
              </div>
              <button type="submit" className="sm-hero__search-btn">Search →</button>
            </form>

            {/* Mobile: 2-col CTA row. Hidden on desktop via CSS. */}
            <div className="sm-hero__cta-row">
              <Link href="/" className="sm-hero__cta-primary">
                Browse Properties
              </Link>
              <Link href="/" className="sm-hero__cta-ghost">
                Speak with us
              </Link>
            </div>
          </div>

          {/* Desktop side card — only when a property is actually curated. */}
          {featuredCard && (
          <div className="sm-hero__feature">
            <div className="sm-hero__feature-lbl">Now Featured</div>
            <div className="sm-hero__feature-ttl">{featuredCard.name}</div>
            <div className="sm-hero__feature-row">
              <span>{featuredCard.beds} beds</span>
              <span>{featuredCard.interior} m²</span>
              <span>{featuredCard.priceFrom}</span>
            </div>
          </div>
          )}
        </div>
      </section>

      <MobileNavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
