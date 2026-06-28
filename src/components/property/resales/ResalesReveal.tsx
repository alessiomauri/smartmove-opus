'use client';

import { useEffect } from 'react';

/**
 * Arms the design's `.reveal` scroll motion (here `.rs-reveal`). Mirrors
 * the design's progressive-enhancement: the markup is visible without JS;
 * once mounted we add `sm-rs-io` to the `.sm-skin` root, which switches
 * the reveal elements to their animated-in state, then an Intersection
 * Observer adds `.in` as each scrolls into view. The reduced-motion guard
 * lives in CSS. Renders nothing.
 */
export default function ResalesReveal() {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const root = (document.querySelector('.sm-skin') as HTMLElement) || document.body;
    const els = Array.from(root.querySelectorAll<HTMLElement>('.rs-reveal'));
    if (!els.length) return;
    root.classList.add('sm-rs-io');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    els.forEach((el) => io.observe(el));
    // Safety net: ensure everything is visible even if a callback is missed.
    const t = setTimeout(() => els.forEach((el) => el.classList.add('in')), 2500);
    return () => {
      clearTimeout(t);
      io.disconnect();
      root.classList.remove('sm-rs-io');
    };
  }, []);

  return null;
}
