'use client';

import { ChevronDown } from 'lucide-react';

/**
 * Subtle "Discover" scroll indicator anchored at the bottom of the hero.
 * Matches the pattern used on the property detail page hero so the brand
 * design language stays consistent across the site.
 *
 * Uses JS for smooth scroll because global `scroll-behavior: smooth` was
 * intentionally removed from this project (caused mobile scroll-restoration
 * issues). Falls back to native anchor jump if JS doesn't run.
 */
export default function HeroScrollCue({ targetId }: { targetId: string }) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="absolute bottom-6 lg:bottom-8 left-1/2 -translate-x-1/2 group flex flex-col items-center text-white/70 hover:text-white transition-colors"
      aria-label="Scroll to next section"
    >
      <span className="text-[10px] tracking-[0.4em] uppercase mb-3 drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
        Discover
      </span>
      <span className="block w-px h-10 bg-gradient-to-b from-white/50 to-transparent group-hover:from-white/80 transition-colors" />
      <ChevronDown
        className="w-4 h-4 -mt-1 animate-bounce drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]"
        strokeWidth={1.5}
      />
    </a>
  );
}
