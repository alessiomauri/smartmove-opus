'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Shared site header — adapted from the design's Compact Header & Footer
 * (.sg-top glass variant + .solidbar solid fallback). Centered logo in a
 * 1fr·auto·1fr grid, bookmark + EN·€ pinned right. Sticky: liquid-glass over
 * the hero, switches to the scrolled bar once scrolled.
 *
 * `variant="solid"` forces the solid bar (content pages without a hero).
 *
 * `glassScroll` (resales hero pages): scopes the resales-only treatment —
 * adds the `.sg-rs` class (CSS gives it the liquid-glass over-hero pane + a
 * frosted-glass scrolled bar) and engages the scrolled state as soon as
 * scrolling begins (~8px), not only after the hero. The homepage does NOT
 * pass it, so it keeps its 560px threshold + original solid scrolled bar
 * — byte-identical.
 */
export default function SiteHeader({
  variant = 'glass',
  current = '',
  glassScroll = false,
}: {
  variant?: 'glass' | 'solid';
  current?: string;
  glassScroll?: boolean;
}) {
  const [solid, setSolid] = useState(variant === 'solid');

  useEffect(() => {
    if (variant === 'solid') return;
    const threshold = glassScroll ? 8 : 560;
    const onScroll = () => setSolid(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [variant, glassScroll]);

  const cls = ['sg-top', solid && 'sg-solid', glassScroll && 'sg-rs'].filter(Boolean).join(' ');
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
