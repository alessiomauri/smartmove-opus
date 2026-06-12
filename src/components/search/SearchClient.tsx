'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import FilterBar from '@/components/FilterBar';
import PropertyGrid from '@/components/PropertyGrid';
import Pagination from '@/components/search/Pagination';
import { searchParamsString, type SearchFilters, type SearchResult } from '@/lib/search';
import type { Property, PropertyFilters, SortOption } from '@/types/property';

/**
 * Client shell of the /properties search (Prompt 3): the server gave us
 * the page's rows; every control writes the URL (router.replace,
 * debounced) and the server re-renders — state lives in the URL, so
 * refresh/back/forward/share all reproduce the exact result. Transition
 * pending state dims the grid; no spinners (brief: no "Loading…").
 */

interface Props {
  filters: SearchFilters;
  result: SearchResult;
  /** Search surface path (locale-aware EN/ES base). */
  basePath: string;
}

export default function SearchClient({ filters, result, basePath }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Local mirror so typing feels instant; URL follows debounced.
  const [local, setLocal] = useState<SearchFilters>(filters);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setLocal(filters), [filters]);

  const push = useCallback(
    (next: SearchFilters, immediate = false) => {
      setLocal(next);
      if (debounce.current) clearTimeout(debounce.current);
      const go = () =>
        startTransition(() => {
          router.replace(`${basePath}${searchParamsString(next)}`, { scroll: false });
        });
      if (immediate) go();
      else debounce.current = setTimeout(go, 350);
    },
    [router, basePath]
  );

  // ── FilterBar adapter (its props speak PropertyFilters/SortOption) ──
  const fbFilters: PropertyFilters = {
    area: local.area,
    propertyType: local.type,
    minBedrooms: local.beds,
    minPrice: local.minp,
    maxPrice: local.maxp,
    search: local.feat,
  };
  const fbSort: SortOption =
    local.sort === 'price_asc' ? 'price_asc' : local.sort === 'price_desc' ? 'price_desc' : 'newest';

  function onFiltersChange(f: PropertyFilters) {
    push({
      ...local,
      area: f.area || undefined,
      type: f.propertyType || undefined,
      beds: f.minBedrooms || undefined,
      minp: f.minPrice || undefined,
      maxp: f.maxPrice && f.maxPrice < 15_000_000 ? f.maxPrice : undefined,
      feat: f.search || undefined,
      page: 1, // any filter change resets pagination
    });
  }
  function onSortChange(s: SortOption) {
    push({ ...local, sort: s === 'price_asc' ? 'price_asc' : s === 'price_desc' ? 'price_desc' : 'new', page: 1 }, true);
  }

  async function shareSearch() {
    try {
      const target = `${basePath}${searchParamsString(local)}`;
      const res = await fetch('/api/short-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, kind: 'search' }),
      });
      const json = await res.json();
      if (!res.ok || !json.code) throw new Error(json.error || 'mint failed');
      const url = `${window.location.origin}/s/${json.code}`;
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied', { description: url });
    } catch {
      // Fallback: copy the long URL — still shareable.
      await navigator.clipboard.writeText(window.location.href).catch(() => {});
      toast.success('Link copied');
    }
  }

  const showingClosest = !!result.closest;

  return (
    <div>
      <FilterBar
        filters={fbFilters}
        onFiltersChange={onFiltersChange}
        sort={fbSort}
        onSortChange={onSortChange}
        resultCount={result.total}
      />

      {/* Results line + share */}
      <div className="flex items-center justify-between gap-4 mt-6 mb-5 flex-wrap">
        <p className="text-[13px] text-ink/60">
          {showingClosest ? (
            <span>No exact matches</span>
          ) : (
            <span>
              <strong className="text-ink">{result.total.toLocaleString('en-US')}</strong>{' '}
              {result.total === 1 ? 'property' : 'properties'}
              {result.pages > 1 && (
                <span className="text-ink/45"> · page {result.page} of {result.pages}</span>
              )}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={shareSearch}
          className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gold hover:text-gold-deep transition-colors"
        >
          Share this search
        </button>
      </div>

      {/* Zero-state: closest matches, never a dead end */}
      {showingClosest && (
        <div className="mb-6 px-5 py-4 bg-gold/[0.06] border border-gold/25 rounded-2xl">
          <p className="text-[14px] text-ink">
            Nothing matches everything you asked for — these are the closest{' '}
            {result.rows.length === 1 ? 'match' : 'matches'}
            {result.closest!.dropped.length > 0 && (
              <span className="text-ink/55"> (we relaxed: {result.closest!.dropped.join(', ')})</span>
            )}
            .
          </p>
        </div>
      )}

      <div className={isPending ? 'opacity-55 transition-opacity duration-200' : 'transition-opacity duration-200'}>
        <PropertyGrid properties={result.rows as Property[]} />
      </div>

      {/* Numbered pagination — server-rendered links, back/forward safe */}
      <Pagination
        page={result.page}
        pages={result.pages}
        hrefFor={(p) => basePath + searchParamsString({ ...local, page: p })}
      />
    </div>
  );
}
