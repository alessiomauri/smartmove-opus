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

  // Visible manual fallback — clipboard can fail (Safari focus rules,
  // permissions); the share flow must NEVER fail silently.
  const [manualShareUrl, setManualShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  async function shareSearch() {
    setSharing(true);
    setManualShareUrl(null);
    // 1. Mint the short link (fall back to the long URL if minting fails).
    let url = window.location.href;
    try {
      const target = `${basePath}${searchParamsString(local)}`;
      const res = await fetch('/api/short-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, kind: 'search' }),
      });
      const json = await res.json();
      if (res.ok && json.code) url = `${window.location.origin}/s/${json.code}`;
    } catch {
      /* long URL is still a working share */
    }
    // 2. Copy — and on ANY clipboard failure, show the link to copy by hand.
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied ✓', { description: url, duration: 6000 });
    } catch {
      setManualShareUrl(url);
      toast.info('Copy the link below', { description: 'Your browser blocked automatic copying.' });
    } finally {
      setSharing(false);
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
          disabled={sharing}
          className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gold hover:text-gold-deep transition-colors disabled:opacity-60"
        >
          {sharing ? 'Creating link…' : 'Share this search'}
        </button>
      </div>

      {/* Manual-copy fallback — clipboard rejected, link still usable */}
      {manualShareUrl && (
        <div className="flex items-center gap-2 mb-5 px-4 py-3 bg-white border border-gold/30 rounded-2xl">
          <input
            readOnly
            value={manualShareUrl}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Share link"
            className="flex-1 text-[13px] font-mono text-ink bg-transparent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setManualShareUrl(null)}
            className="text-[11px] text-ink/45 hover:text-gold"
          >
            ✕
          </button>
        </div>
      )}

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
