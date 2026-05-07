'use client';

import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Mobile filter bottom sheet — Brand Foundation Mobile spec.
 *
 * Slides up from the bottom over a dim backdrop. Grabber bar at top, field
 * rows separated by hairlines, gold "Apply" button at the bottom.
 *
 * Currently the fields are placeholders — wired to actual filter state in
 * Phase 4 once Resales-sourced inventory is flowing and there's something
 * to filter against.
 */
export default function FilterBottomSheet({ open, onClose }: Props) {
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
    <>
      <button
        type="button"
        className="sm-sheet-backdrop"
        aria-label="Close filters"
        onClick={onClose}
      />
      <div
        className="sm-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Property search filters"
      >
        <div className="sm-sheet__grabber" aria-hidden />
        <h4 className="sm-sheet__title">Refine your search</h4>

        <div className="sm-sheet__field">
          <span className="sm-sheet__lbl">Location</span>
          <span className="sm-sheet__val">Marbella, all areas</span>
        </div>
        <div className="sm-sheet__field">
          <span className="sm-sheet__lbl">Property type</span>
          <span className="sm-sheet__val">Villas &amp; Apartments</span>
        </div>
        <div className="sm-sheet__field">
          <span className="sm-sheet__lbl">Bedrooms</span>
          <span className="sm-sheet__val">Any</span>
        </div>
        <div className="sm-sheet__field">
          <span className="sm-sheet__lbl">Budget</span>
          <span className="sm-sheet__val">Any</span>
        </div>

        <button type="button" className="sm-sheet__apply" onClick={onClose}>
          Apply filters
        </button>
      </div>
    </>
  );
}
