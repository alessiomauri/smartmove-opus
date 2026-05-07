'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Mobile nav drawer — Brand Foundation Mobile spec.
 *
 * Full-screen ink overlay. Cormorant 32px nav links, each with a gold arrow.
 * Foot row carries the language pill and a saved-properties link.
 *
 * Locks body scroll while open and closes on Escape.
 */
export default function MobileNavDrawer({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sm-drawer" role="dialog" aria-modal="true" aria-label="Site navigation">
      <div className="sm-drawer__top">
        <Link href="/" onClick={onClose} aria-label="Smartmove Marbella — home">
          <Image
            src="/brand/logo-white.png"
            alt="Smartmove Marbella"
            width={400}
            height={120}
            className="sm-drawer__logo"
          />
        </Link>
        <button
          type="button"
          className="sm-drawer__close"
          aria-label="Close menu"
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <nav className="sm-drawer__nav">
        <Link href="/" onClick={onClose}>
          Properties <span className="sm-drawer__arrow">→</span>
        </Link>
        <Link href="/new-developments" onClick={onClose}>
          New Developments <span className="sm-drawer__arrow">→</span>
        </Link>
        <Link href="/areas" onClick={onClose}>
          Areas <span className="sm-drawer__arrow">→</span>
        </Link>
        <Link href="/" onClick={onClose}>
          Services <span className="sm-drawer__arrow">→</span>
        </Link>
        <Link href="/" onClick={onClose}>
          About <span className="sm-drawer__arrow">→</span>
        </Link>
        <Link href="/" onClick={onClose}>
          Contact <span className="sm-drawer__arrow">→</span>
        </Link>
      </nav>

      <div className="sm-drawer__foot">
        <span className="sm-drawer__lang">EN · ES</span>
        <Link href="/favourites" onClick={onClose} className="sm-drawer__saved">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M6 3h12v18l-6-4-6 4z" />
          </svg>
          Saved properties
        </Link>
      </div>
    </div>
  );
}
