'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Move, ChevronLeft, ChevronRight, MapPin, ArrowRight } from 'lucide-react';
import { Area } from '@/types/area';

interface AreaCarouselProps {
  areas: Area[];
  /** Map of area.slug → display label for the area's parent (e.g. "Marbella"
   *  for Golden Mile). Falls back to area.region when no parent exists.
   *  Computed server-side in HomeInfo and passed in. */
  parentLabels: Record<string, string>;
}

/**
 * Auto-scrolling, drag-interactive carousel of areas.
 *
 * Behaviour:
 *  - Content is duplicated so the scroll loops seamlessly
 *  - Auto-scrolls slowly (configurable SPEED) via requestAnimationFrame
 *  - Users can click-and-drag (desktop) or swipe (touch / mobile) to scrub
 *  - Prev / next buttons nudge by one card-width for fine-grained control
 *  - Progress bar tracks current position — fills + drains in real time
 *    during both auto-scroll AND user interaction, signalling interactivity
 *  - "Drag to explore" hint label provides explicit affordance
 *  - "View on the map →" CTA below links into /areas for the full atlas
 *  - Auto-scroll pauses while user is interacting OR hovering
 *  - Cursor changes to grab/grabbing for affordance
 *  - Respects `prefers-reduced-motion` (auto disabled, drag still works)
 */
export default function AreaCarousel({ areas, parentLabels }: AreaCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isHovering = useRef(false);
  const isNudging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScrollLeft = useRef(0);
  // Total pointer movement during the current drag — measured here so the
  // click handler can distinguish a real click (small movement) from a drag
  // (>5 px). Using actual pointer movement is more accurate than diffing
  // scrollLeft, which gets nudged even by 1-px mouse jitter during a click.
  const dragDistance = useRef(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [progress, setProgress] = useState(0);

  // Detect prefers-reduced-motion at mount
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Auto-scroll loop + progress tracking
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame: number;
    const SPEED = 0.7; // px per frame ≈ 42px/sec at 60fps — ambient
    // Wait this long before starting the auto-scroll so first-time visitors
    // can read the leading cards (Golden Mile etc.) before they slide off.
    const START_DELAY_MS = 1500;
    const startTime = performance.now();

    const tick = () => {
      if (track) {
        const elapsed = performance.now() - startTime;
        const startedScrolling = elapsed >= START_DELAY_MS;
        // Auto-scroll is paused during the initial delay, drag, hover,
        // AND nudge (so smooth-scroll isn't overwritten by the RAF loop).
        if (
          startedScrolling &&
          !prefersReducedMotion &&
          !isDragging.current &&
          !isHovering.current &&
          !isNudging.current
        ) {
          track.scrollLeft += SPEED;
        }
        const halfWidth = track.scrollWidth / 2;
        if (halfWidth > 0 && track.scrollLeft >= halfWidth) {
          track.scrollLeft -= halfWidth;
        }
        const pct = halfWidth > 0 ? (track.scrollLeft % halfWidth) / halfWidth : 0;
        setProgress(pct);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [prefersReducedMotion]);

  /* ───────── Drag handlers ───────── */

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const track = trackRef.current;
    if (!track) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartScrollLeft.current = track.scrollLeft;
    dragDistance.current = 0;
    track.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const track = trackRef.current;
    if (!track) return;
    const dx = e.clientX - dragStartX.current;
    track.scrollLeft = dragStartScrollLeft.current - dx;
    // Track total movement so the click handler can distinguish click-vs-drag
    dragDistance.current = Math.max(dragDistance.current, Math.abs(dx));
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const track = trackRef.current;
    if (!track) return;
    isDragging.current = false;
    try {
      track.releasePointerCapture(e.pointerId);
    } catch {
      // pointer already released
    }
  }, []);

  /* ───────── Nudge buttons (prev/next) ───────── */

  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudge = useCallback((direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    // Pause auto-scroll for the duration of the smooth-scroll, otherwise
    // the RAF loop's per-frame increment fights against scrollBy and the
    // movement looks broken / stuck.
    isNudging.current = true;
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    nudgeTimer.current = setTimeout(() => {
      isNudging.current = false;
    }, 600);
    // Scroll by ~1 card width (≈ 200px including gap)
    track.scrollBy({ left: direction * 210, behavior: 'smooth' });
  }, []);

  if (areas.length === 0) return null;

  // Render twice for the seamless loop
  const looped = [...areas, ...areas];

  return (
    <div>
      {/* The carousel itself */}
      <div
        ref={trackRef}
        className="overflow-x-scroll cursor-grab active:cursor-grabbing select-none scrollbar-hide"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onMouseEnter={() => {
          isHovering.current = true;
        }}
        onMouseLeave={() => {
          isHovering.current = false;
        }}
        aria-label="Featured Costa del Sol areas. Drag, swipe, or use prev/next to browse"
      >
        <div className="flex gap-4 py-2 w-max">
          {looped.map((area, i) => {
            const parent = parentLabels[area.slug];
            return (
              <div
                key={`${area.slug}-${i}`}
                className="shrink-0 w-[150px] sm:w-[170px] lg:w-[190px]"
                aria-hidden={i >= areas.length}
              >
                <Link
                  href={`/areas/${area.slug}`}
                  draggable={false}
                  className="group block"
                  onDragStart={(e) => e.preventDefault()}
                  onClick={(e) => {
                    // Suppress navigation only on a real drag (>5 px of
                    // pointer movement). Tiny mouse jitter during a click
                    // doesn't cross this threshold so clicks always work.
                    if (dragDistance.current > 5) e.preventDefault();
                  }}
                >
                  <div className="relative aspect-[4/5] rounded-[6px] overflow-hidden bg-[#f0ede9] transition-all duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_12px_28px_-10px_rgba(0,0,0,0.18)]">
                    {area.hero_image && (
                      <Image
                        src={area.hero_image}
                        alt={area.hero_image_alt || area.name}
                        fill
                        draggable={false}
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.06] pointer-events-none"
                        sizes="190px"
                        {...(area.hero_image_blur
                          ? { placeholder: 'blur' as const, blurDataURL: area.hero_image_blur }
                          : {})}
                      />
                    )}
                    {/* Stronger dark gradient at the bottom — keeps the
                        text band fully shaded so eyebrow + name pop on any
                        underlying photo, not just the dark ones. */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.78) 18%, rgba(0,0,0,0.4) 38%, rgba(0,0,0,0) 60%)',
                      }}
                    />
                    <div className="absolute bottom-0 inset-x-0 p-3 overflow-hidden">
                      {parent && parent !== area.name && (
                        // Light brand teal — visible on the dark gradient and
                        // ties the eyebrow to the site's accent palette.
                        <p className="text-[9px] font-semibold tracking-[0.16em] uppercase text-[#7dd3df] mb-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                          {parent}
                        </p>
                      )}
                      <h4 className="font-gloock text-white text-[13px] md:text-[14px] leading-[1.1] tracking-tight break-words drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                        {area.name}
                      </h4>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Affordance row — drag hint, progress bar, counter, prev/next */}
      <div className="mt-5 flex items-center gap-3 sm:gap-4 text-[#2e2e2e]/40">
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <Move className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span className="text-[10px] font-semibold tracking-[0.18em] uppercase">
            Drag to explore
          </span>
        </div>
        <div
          className="flex-1 h-px bg-[#2e2e2e]/10 relative overflow-hidden rounded-full"
          aria-hidden="true"
        >
          <div
            className="absolute top-0 left-0 h-full bg-[#3c9ba7]/70 rounded-full transition-[width] duration-100"
            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          />
        </div>
        <span className="text-[10px] font-medium tabular-nums tracking-wider shrink-0">
          {Math.round(progress * areas.length) % areas.length || areas.length}
          <span className="text-[#2e2e2e]/30"> / {areas.length}</span>
        </span>
        {/* Prev / next buttons — make manual control more obvious */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => nudge(-1)}
            aria-label="Previous"
            className="w-7 h-7 flex items-center justify-center rounded-full border border-[#2e2e2e]/15 text-[#2e2e2e]/60 hover:text-[#3c9ba7] hover:border-[#3c9ba7]/40 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => nudge(1)}
            aria-label="Next"
            className="w-7 h-7 flex items-center justify-center rounded-full border border-[#2e2e2e]/15 text-[#2e2e2e]/60 hover:text-[#3c9ba7] hover:border-[#3c9ba7]/40 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* CTA — link to the interactive map for users who want the full picture */}
      <div className="mt-6 text-center">
        <Link
          href="/areas"
          className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-[0.08em] uppercase text-[#3c9ba7] hover:text-[#2d8a95] transition-colors"
        >
          <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
          View all areas on the interactive map
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
