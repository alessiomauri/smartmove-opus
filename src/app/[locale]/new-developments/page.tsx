import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { getCachedPublishedDevelopments } from '@/lib/cache';
import { DEVELOPMENT_STATUS_LABELS } from '@/types/development';
import { NEW_DEVELOPMENTS_PUBLIC } from './feature-flag';

export const revalidate = 600;

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

export default async function NewDevelopmentsPage() {
  // Hard-block public access while the feature is off
  if (!NEW_DEVELOPMENTS_PUBLIC) notFound();

  const items = await getCachedPublishedDevelopments();

  return (
    <div className="min-h-screen bg-[#faf9f8]">
      <header className="max-w-[1600px] mx-auto px-6 lg:px-12 pt-12 pb-8">
        <Link
          href="/"
          className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#2e2e2e]/60 hover:text-[#3c9ba7] transition-colors"
        >
          ← Back to all properties
        </Link>
        <h1 className="font-gloock text-[44px] md:text-[64px] text-[#3c9ba7] leading-tight tracking-tight mt-6 mb-4">
          New Developments
        </h1>
        <p className="text-[15px] md:text-[17px] text-[#2e2e2e]/70 max-w-2xl leading-relaxed">
          New-build luxury projects across Marbella and the Costa del Sol. Off-plan, under
          construction, and key-ready.
        </p>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 lg:px-12 pb-16">
        {items.length === 0 ? (
          <div className="text-center py-16 text-[#2e2e2e]/50">No developments published yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {items.map((d) => (
              <Link
                key={d.id}
                href={{ pathname: '/new-developments/[slug]', params: { slug: d.slug } }}
                className="group block rounded-[6px] overflow-hidden bg-white border border-[#2e2e2e]/[0.06] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_-15px_rgba(60,155,167,0.2)]"
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
                  <h2 className="font-gloock text-[22px] md:text-[26px] text-[#3c9ba7] leading-tight">
                    {d.name}
                  </h2>
                  {d.developer && (
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#2e2e2e]/50 mt-1">
                      by {d.developer}
                    </p>
                  )}
                  {d.short_description && (
                    <p className="text-[14px] text-[#2e2e2e]/70 mt-3 line-clamp-2">
                      {d.short_description}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#2e2e2e]/[0.06]">
                    <span className="text-[15px] font-semibold text-[#2e2e2e]">
                      {d.price_on_request
                        ? 'Price on request'
                        : formatPriceFrom(d.price_from) ?? '-'}
                    </span>
                    {d.bedrooms_from && d.bedrooms_to && (
                      <span className="text-[13px] text-[#2e2e2e]/60">
                        {d.bedrooms_from}–{d.bedrooms_to} bed
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
