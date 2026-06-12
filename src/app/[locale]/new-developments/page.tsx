import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import DevSearchControls from '@/components/search/DevSearchControls';
import Pagination from '@/components/search/Pagination';
import { parseDevSearchParams, searchDevelopmentsPaged } from '@/lib/search';
import { DEVELOPMENT_STATUS_LABELS } from '@/types/development';
import type { Development } from '@/types/development';
import { NEW_DEVELOPMENTS_PUBLIC } from './feature-flag';

/**
 * Development search — same URL-synced, server-paginated pattern as
 * /properties (?location=&beds=&minp=&maxp=&sort=&page=). Numbered
 * pagination, results line, closest-matches zero-state. Still behind
 * NEW_DEVELOPMENTS_PUBLIC.
 */

export const metadata: Metadata = {
  // Always noindex while feature flag is off, even if someone hits the URL directly
  robots: NEW_DEVELOPMENTS_PUBLIC
    ? undefined
    : { index: false, follow: false, nocache: true },
  title: 'New Developments | Smartmove Marbella',
  description: 'Discover new-build luxury developments in Marbella and the Costa del Sol.',
};

function formatPriceFrom(n: number | null) {
  if (n === null) return null;
  if (n >= 1_000_000) return `from €${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  return `from €${(n / 1000).toFixed(0)}K`;
}

export default async function NewDevelopmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Hard-block public access while the feature is off
  if (!NEW_DEVELOPMENTS_PUBLIC) notFound();

  const filters = parseDevSearchParams(await searchParams);
  const result = await searchDevelopmentsPaged(filters);

  const hrefFor = (page: number) => {
    const p = new URLSearchParams();
    if (filters.location) p.set('location', filters.location);
    if (filters.beds) p.set('beds', String(filters.beds));
    if (filters.minp) p.set('minp', String(filters.minp));
    if (filters.maxp) p.set('maxp', String(filters.maxp));
    if (filters.sort !== 'new') p.set('sort', filters.sort);
    if (page > 1) p.set('page', String(page));
    return `/new-developments${p.size ? `?${p}` : ''}`;
  };

  return (
    <div className="min-h-screen bg-paper">
      <header className="max-w-[1600px] mx-auto px-6 lg:px-12 pt-12 pb-8">
        <Link
          href="/"
          className="text-[11px] font-semibold tracking-[0.08em] uppercase text-ink/60 hover:text-gold transition-colors"
        >
          ← Back to all properties
        </Link>
        <h1 className="font-display text-[44px] md:text-[64px] text-gold leading-tight tracking-tight mt-6 mb-4">
          New Developments
        </h1>
        <p className="text-[15px] md:text-[17px] text-ink/70 max-w-2xl leading-relaxed mb-8">
          New-build luxury projects across Marbella and the Costa del Sol. Off-plan, under
          construction, and key-ready.
        </p>
        <DevSearchControls filters={filters} />
      </header>

      <main className="max-w-[1600px] mx-auto px-6 lg:px-12 pb-16">
        {/* Results line */}
        <p className="text-[13px] text-ink/60 mb-6">
          {result.closest ? (
            'No exact matches'
          ) : (
            <>
              <strong className="text-ink">{result.total.toLocaleString('en-US')}</strong>{' '}
              {result.total === 1 ? 'development' : 'developments'}
              {result.pages > 1 && <span className="text-ink/45"> · page {result.page} of {result.pages}</span>}
            </>
          )}
        </p>

        {/* Zero-state: closest matches, never a dead end */}
        {result.closest && result.rows.length > 0 && (
          <div className="mb-6 px-5 py-4 bg-gold/[0.06] border border-gold/25 rounded-2xl">
            <p className="text-[14px] text-ink">
              Nothing matches everything you asked for — these are the closest{' '}
              {result.rows.length === 1 ? 'match' : 'matches'}
              {result.closest.dropped.length > 0 && (
                <span className="text-ink/55"> (we relaxed: {result.closest.dropped.join(', ')})</span>
              )}
              .
            </p>
          </div>
        )}

        {result.rows.length === 0 ? (
          <div className="text-center py-16 text-ink/50">No developments published yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {result.rows.map((d: Development) => (
              <Link
                key={d.id}
                href={{ pathname: '/new-developments/[slug]', params: { slug: d.slug } }}
                className="group block rounded-[6px] overflow-hidden bg-white border border-ink/[0.06] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_-15px_rgba(60,155,167,0.2)]"
              >
                <div className="relative aspect-[4/3] bg-[#f0ede9] overflow-hidden">
                  {d.hero_image && (
                    <Image
                      src={d.hero_image}
                      alt={d.hero_image_alt || d.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      {...(d.hero_image_blur
                        ? { placeholder: 'blur' as const, blurDataURL: d.hero_image_blur }
                        : {})}
                    />
                  )}
                  <span className="absolute top-4 right-4 inline-flex items-center px-3 py-1.5 text-[10px] font-medium tracking-[0.1em] uppercase text-white bg-black/30 backdrop-blur-md rounded-full border border-white/10">
                    {DEVELOPMENT_STATUS_LABELS[d.status]}
                  </span>
                </div>
                <div className="p-5">
                  <h2 className="font-display text-[22px] md:text-[26px] text-gold leading-tight">
                    {d.name}
                  </h2>
                  {d.developer && (
                    <p className="text-[11px] uppercase tracking-[0.12em] text-ink/50 mt-1">
                      by {d.developer}
                    </p>
                  )}
                  {d.short_description && (
                    <p className="text-[14px] text-ink/70 mt-3 line-clamp-2">
                      {d.short_description}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-ink/[0.06]">
                    <span className="text-[15px] font-semibold text-ink">
                      {d.price_on_request
                        ? 'Price on request'
                        : formatPriceFrom(d.price_from) ?? '-'}
                    </span>
                    {d.bedrooms_from && d.bedrooms_to && (
                      <span className="text-[13px] text-ink/60">
                        {d.bedrooms_from}–{d.bedrooms_to} bed
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <Pagination page={result.page} pages={result.pages} hrefFor={hrefFor} />
      </main>
    </div>
  );
}
