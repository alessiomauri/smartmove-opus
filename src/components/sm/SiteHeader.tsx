'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useHeroReflection } from './HeroReflectionContext';

/**
 * Shared site header — adapted from the design's Compact Header & Footer
 * (.sg-top glass variant + .solidbar solid fallback). Centered logo in a
 * 1fr·auto·1fr grid, bookmark + EN·€ pinned right. Sticky: glass over the
 * hero, switches to the solid dark bar once scrolled past the hero.
 *
 * `variant="solid"` forces the solid bar (content pages without a hero).
 *
 * Over-hero MIRROR REFLECTION (opt-in): when a page wraps its tree in
 * <HeroReflectionProvider> and its hero gallery publishes the current frame,
 * the over-hero header renders a seam-aligned vertical mirror of that frame
 * (a "lake" reflection across the header's 96px bottom edge) instead of the
 * default glass pane. Pages that don't opt in (e.g. the homepage) get
 * `reflectSrc = null` → the header is unchanged. The scrolled solid state and
 * the original height are untouched.
 */
export default function SiteHeader({ variant = 'glass', current = '' }: { variant?: 'glass' | 'solid'; current?: string }) {
  const [solid, setSolid] = useState(variant === 'solid');
  const reflectSrc = useHeroReflection();

  useEffect(() => {
    if (variant === 'solid') return;
    const onScroll = () => setSolid(window.scrollY > 560);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [variant]);

  const reflecting = !solid && !!reflectSrc;
  const cls = solid ? 'sg-top sg-solid' : reflecting ? 'sg-top sg-reflecting' : 'sg-top';
  const navA = (label: string, href: string) => (
    <Link href={href} className={current === label ? 'is-current' : ''}>{label}</Link>
  );

  return (
    <header className={cls}>
      {reflecting && (
        <div className="sg-reflect" aria-hidden="true">
          {/* Vertically-flipped copy of the current hero frame, same cover box,
              mirrored about the header's bottom edge (see sm-skin-extra.css). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="sg-reflect-img" src={reflectSrc!} alt="" />
          <div className="sg-reflect-sheen" />
        </div>
      )}
      <nav className="l">
        {navA('Properties', '/properties')}
        {navA('New Developments', '/new-developments')}
        {navA('Areas', '/areas')}
      </nav>
      <Link className="brand" href="/">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sm/logo-smartmove-boxed-white.png" alt="Smartmove Marbella" />
      </Link>
      <nav className="r">
        {navA('Services', '/services')}
        {navA('About', '/about')}
        {navA('Contact', '/contact')}
      </nav>
      <div className="utils">
        <button className="bk" aria-label="Saved properties" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 3h12v18l-6-4.5L6 21V3z" /></svg>
        </button>
        <button className="lang" type="button">EN · €</button>
      </div>
    </header>
  );
}
