'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { DevSearchFilters } from '@/lib/search';

/**
 * Development search controls — same URL-synced pattern as /properties
 * (?location=&beds=&minp=&maxp=&sort=&page=). router.replace debounced;
 * transition pending dims the grid via a data attribute the page reads.
 */
export default function DevSearchControls({ filters }: { filters: DevSearchFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const [local, setLocal] = useState(filters);
  const [isPending, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setLocal(filters), [filters]);

  const push = useCallback(
    (next: DevSearchFilters, immediate = false) => {
      setLocal(next);
      if (debounce.current) clearTimeout(debounce.current);
      const go = () =>
        startTransition(() => {
          const p = new URLSearchParams();
          if (next.location) p.set('location', next.location);
          if (next.beds) p.set('beds', String(next.beds));
          if (next.minp) p.set('minp', String(next.minp));
          if (next.maxp) p.set('maxp', String(next.maxp));
          if (next.sort !== 'new') p.set('sort', next.sort);
          // page intentionally reset on any filter change
          router.replace(`${pathname}${p.size ? `?${p}` : ''}`, { scroll: false });
        });
      if (immediate) go();
      else debounce.current = setTimeout(go, 350);
    },
    [router, pathname]
  );

  const sel =
    'px-4 py-2.5 text-[13px] bg-white border border-ink/15 rounded-full focus:outline-none focus:border-gold transition-colors';

  return (
    <div
      data-pending={isPending || undefined}
      className="flex flex-wrap items-center gap-2.5 group/devsearch"
    >
      <input
        type="text"
        value={local.location ?? ''}
        onChange={(e) => push({ ...local, location: e.target.value || undefined, page: 1 })}
        placeholder="Location (e.g. Estepona)"
        aria-label="Location"
        className={`${sel} w-56 placeholder:text-ink/35`}
      />
      <select
        value={local.beds ?? ''}
        onChange={(e) => push({ ...local, beds: Number(e.target.value) || undefined, page: 1 }, true)}
        aria-label="Bedrooms"
        className={sel}
      >
        <option value="">Any beds</option>
        {[1, 2, 3, 4, 5].map((b) => (
          <option key={b} value={b}>{b}+ beds</option>
        ))}
      </select>
      <select
        value={local.minp ?? ''}
        onChange={(e) => push({ ...local, minp: Number(e.target.value) || undefined, page: 1 }, true)}
        aria-label="Min price"
        className={sel}
      >
        <option value="">Min price</option>
        {[250_000, 500_000, 750_000, 1_000_000, 2_000_000, 3_000_000].map((p) => (
          <option key={p} value={p}>€{(p / 1000).toFixed(0)}k+</option>
        ))}
      </select>
      <select
        value={local.maxp ?? ''}
        onChange={(e) => push({ ...local, maxp: Number(e.target.value) || undefined, page: 1 }, true)}
        aria-label="Max price"
        className={sel}
      >
        <option value="">Max price</option>
        {[500_000, 750_000, 1_000_000, 2_000_000, 3_000_000, 5_000_000].map((p) => (
          <option key={p} value={p}>up to €{(p / 1_000_000).toFixed(p >= 1_000_000 ? 1 : 2).replace(/\.0$/, '')}M</option>
        ))}
      </select>
      <select
        value={local.sort}
        onChange={(e) => push({ ...local, sort: e.target.value as DevSearchFilters['sort'], page: 1 }, true)}
        aria-label="Sort"
        className={sel}
      >
        <option value="new">Newest</option>
        <option value="price_asc">Price: low → high</option>
        <option value="price_desc">Price: high → low</option>
      </select>
    </div>
  );
}
