'use client';

import { useState } from 'react';
import FilterBottomSheet from './FilterBottomSheet';

/**
 * Mobile search pill — Brand Foundation Mobile spec.
 *
 * Sits below the hero, overlapping by -28px. White rounded pill with summary
 * text on the left and a circular gold search button on the right. Tapping
 * anywhere opens the FilterBottomSheet.
 *
 * Hidden on desktop via CSS.
 */
export default function SearchPill() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="sm-search-pill"
        onClick={() => setOpen(true)}
        aria-label="Open search filters"
      >
        <span className="sm-search-pill__text">
          <span className="sm-search-pill__lbl">Search Marbella</span>
          <span className="sm-search-pill__summary">Any area · Any type · Any budget</span>
        </span>
        <span className="sm-search-pill__btn" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      <FilterBottomSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
