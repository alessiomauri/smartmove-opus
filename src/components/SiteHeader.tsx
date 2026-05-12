'use client';

import { useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { useFavourites } from '@/hooks/useFavourites';

/**
 * Site-wide editorial header. Used across all "content" pages
 * (areas index, area detail, blog, etc.). The homepage uses its own
 * variant that inlines the filter bar — this one stays focused on
 * brand + nav so reading pages aren't competing with controls.
 *
 * Composition mirrors the homepage chrome (glass background, animated
 * gradient hairline, gold underline on hover) so the brand feels
 * continuous when you move between /, /areas, /blog, /favourites.
 */
export default function SiteHeader() {
  const pathname = usePathname();
  const { favouriteCount } = useFavourites();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: NavHref) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <>
      <header className="sticky top-0 z-50 header-glass">
        {/* Animated gold hairline */}
        <div className="absolute top-0 left-0 right-0 h-[2px] header-gradient-border" />
        {/* Floating orb accents — purely decorative */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-gold/[0.08] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-10 right-1/4 w-32 h-32 bg-gold-soft/[0.06] rounded-full blur-2xl pointer-events-none animate-float-slow" />
        <div className="absolute inset-0 header-shimmer pointer-events-none" />

        {/* Desktop */}
        <div className="hidden lg:block max-w-[1600px] mx-auto px-8 lg:px-12 relative">
          <div className="flex items-center justify-between h-[72px] gap-10">
            <Link href="/" className="group relative shrink-0">
              <span className="text-[26px] tracking-[-0.02em] font-display text-gold transition-all duration-500 group-hover:text-gold-deep">
                Smartmove Marbella
              </span>
              <span className="absolute -bottom-0.5 left-0 h-[1px] w-0 bg-gradient-to-r from-gold to-gold-soft transition-all duration-500 ease-out group-hover:w-full" />
            </Link>

            <nav className="flex items-center gap-9">
              <NavLink href="/" label="Properties" active={isActive('/')} />
              <NavLink href="/areas" label="Areas" active={isActive('/areas')} />
              <NavLink href="/blog" label="Journal" active={isActive('/blog')} />
              <SavedLink count={favouriteCount} active={isActive('/favourites')} />
            </nav>
          </div>
        </div>

        {/* Mobile */}
        <div className="lg:hidden max-w-[1600px] mx-auto px-6 relative">
          <div className="flex items-center justify-between h-[60px]">
            <Link href="/" className="group relative">
              <span className="text-[22px] tracking-[-0.02em] font-display text-gold">
                Smartmove Marbella
              </span>
            </Link>
            <div className="flex items-center gap-1">
              <Link
                href="/favourites"
                aria-label="Saved properties"
                className="relative p-2.5 text-ink/60 rounded-full hover:bg-gold/[0.06] transition-colors"
              >
                <BookmarkIcon />
                {favouriteCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[14px] h-[14px] flex items-center justify-center text-[8px] font-bold text-white bg-gradient-to-br from-gold to-gold-deep rounded-full shadow-sm">
                    {favouriteCount}
                  </span>
                )}
              </Link>
              <button
                type="button"
                aria-label="Toggle menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="p-2.5 text-ink/70 rounded-full hover:bg-gold/[0.06] transition-colors"
              >
                {menuOpen ? <CloseIcon /> : <BurgerIcon />}
              </button>
            </div>
          </div>

          {menuOpen && (
            <nav className="border-t border-ink/[0.06] bg-white/85 backdrop-blur-sm">
              <div className="flex flex-col py-3">
                <MobileLink href="/" label="Properties" onClick={() => setMenuOpen(false)} active={isActive('/')} />
                <MobileLink href="/areas" label="Areas" onClick={() => setMenuOpen(false)} active={isActive('/areas')} />
                <MobileLink href="/blog" label="Journal" onClick={() => setMenuOpen(false)} active={isActive('/blog')} />
                <MobileLink href="/favourites" label="Saved" onClick={() => setMenuOpen(false)} active={isActive('/favourites')} />
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Sleek divider line below the header */}
      <div className="header-divider" />
    </>
  );
}

/* ───────── bits ───────── */

/** Pathnames our nav links can point at. Narrowed so the i18n Link's
 *  typed-routes Pathnames union accepts them. */
type NavHref = '/' | '/areas' | '/blog' | '/favourites';

function NavLink({ href, label, active }: { href: NavHref; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`group relative text-[12px] font-semibold tracking-[0.12em] uppercase transition-colors ${
        active ? 'text-gold' : 'text-ink/65 hover:text-ink'
      }`}
    >
      {label}
      <span
        className={`absolute -bottom-1 left-0 h-[1px] bg-gold transition-all duration-400 ease-out ${
          active ? 'w-full' : 'w-0 group-hover:w-full'
        }`}
      />
    </Link>
  );
}

function SavedLink({ count, active }: { count: number; active: boolean }) {
  return (
    <Link
      href="/favourites"
      className={`group flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-400 ${
        active
          ? 'text-gold bg-gold/[0.06]'
          : 'text-ink/60 hover:text-gold hover:bg-gold/[0.06]'
      }`}
    >
      <div className="relative">
        <BookmarkIcon />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] flex items-center justify-center text-[9px] font-bold text-white bg-gradient-to-br from-gold to-gold-deep rounded-full shadow-sm">
            {count}
          </span>
        )}
      </div>
      <span className="text-[11px] font-semibold tracking-[0.12em] uppercase">Saved</span>
    </Link>
  );
}

function MobileLink({
  href,
  label,
  active,
  onClick,
}: {
  href: NavHref;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`px-6 py-3 text-[14px] font-semibold tracking-[0.08em] uppercase transition-colors ${
        active ? 'text-gold' : 'text-ink/75 hover:text-gold'
      }`}
    >
      {label}
    </Link>
  );
}

function BookmarkIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function BurgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
