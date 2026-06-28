'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Shared site header — adapted from the design's Compact Header & Footer
 * (.sg-top glass variant + .solidbar solid fallback). Centered logo in a
 * 1fr·auto·1fr grid, bookmark + EN·€ pinned right. Sticky: glass over the
 * hero, switches to the solid dark bar once scrolled past the hero.
 *
 * `variant="solid"` forces the solid bar (content pages without a hero).
 */
export default function SiteHeader({ variant = 'glass', current = '' }: { variant?: 'glass' | 'solid'; current?: string }) {
  const [solid, setSolid] = useState(variant === 'solid');

  useEffect(() => {
    if (variant === 'solid') return;
    const onScroll = () => setSolid(window.scrollY > 560);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [variant]);

  const cls = solid ? 'sg-top sg-solid' : 'sg-top';
  const navA = (label: string, href: string) => (
    <Link href={href} className={current === label ? 'is-current' : ''}>{label}</Link>
  );

  return (
    <header className={cls}>
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
