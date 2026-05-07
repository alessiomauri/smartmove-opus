'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

/**
 * Homepage hero — Brand Foundation v1 (Costa Editorial × Editorial Slate).
 *
 * Composition (per `~/Downloads/Brand Foundation.html`):
 *   - 16:9 hero photo with multi-stop dark gradient
 *   - Embedded topbar: nav-left | wordmark | nav-right + utils
 *   - Bottom-left: gold eyebrow → italic-emphasised h1 → 4-field search rail
 *   - Bottom-right: "Now Featured" glass card
 *   - Subtle scale-zoom on the bg, staggered rise-in on text, all
 *     respecting prefers-reduced-motion
 *
 * Hero photo currently picsum placeholder; swap for real photography
 * (or a Resales-sourced hero) when available.
 */

interface HomeHeroProps {
  featured?: {
    name: string;
    location: string;
    beds: number | string;
    interior: number | string;
    priceFrom: string;
    href?: string;
  };
}

export default function HomeHero({ featured }: HomeHeroProps) {
  const tNav = useTranslations('nav');

  const featuredCard = featured ?? {
    name: 'Villa Amara, Sierra Blanca',
    location: 'Marbella · Costa del Sol',
    beds: 6,
    interior: 820,
    priceFrom: 'From €8.95M',
    href: '/',
  };

  return (
    <section className="sm-hero">
      {/* Background image + gradient overlays */}
      <div
        className="sm-hero__bg"
        style={{
          backgroundImage: `
            linear-gradient(180deg, rgba(28,26,23,.40) 0%, rgba(28,26,23,.10) 28%, rgba(28,26,23,.55) 70%, rgba(28,26,23,.85) 100%),
            linear-gradient(100deg, rgba(28,26,23,.45) 0%, rgba(28,26,23,0) 55%),
            url('https://picsum.photos/seed/smartmove-hero/1920/1080')
          `,
        }}
      />

      <div className="sm-hero__topbar">
        <nav className="sm-hero__nav-left">
          <Link href="/">{tNav('properties')}</Link>
          <Link href="/new-developments">{tNav('newDevelopments')}</Link>
          <Link href="/areas">{tNav('areas')}</Link>
        </nav>

        <Link href="/" className="sm-hero__brand">
          Smartmove
          <span className="sm-hero__brand-mark">Marbella</span>
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

          <form className="sm-hero__search" role="search" onSubmit={(e) => e.preventDefault()}>
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
        </div>

        <div className="sm-hero__feature">
          <div className="sm-hero__feature-lbl">Now Featured</div>
          <div className="sm-hero__feature-ttl">{featuredCard.name}</div>
          <div className="sm-hero__feature-row">
            <span>{featuredCard.beds} beds</span>
            <span>{featuredCard.interior} m²</span>
            <span>{featuredCard.priceFrom}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
