import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { getDevelopmentBySlugCached } from '@/lib/queries';
import { localizedAlternates, localizedUrl } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';
import { createStaticSupabaseClient } from '@/lib/supabase-static';
import { DEVELOPMENT_STATUS_LABELS } from '@/types/development';
import DevLeadActions from '@/components/leads/DevLeadActions';
import { NEW_DEVELOPMENTS_PUBLIC } from '../feature-flag';
import { resolveDevOverrides } from '@/lib/dev-overrides';

export const revalidate = 3600;

// Prebuild every published development — without this the route fell
// back to per-request rendering despite the revalidate export.
export async function generateStaticParams() {
  const supabase = createStaticSupabaseClient();
  const { data } = await supabase
    .from('developments')
    .select('slug')
    .eq('published', true);
  return (data || []).map((d) => ({ slug: d.slug }));
}

interface Props {
  params: Promise<{ locale: Locale; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const raw = await getDevelopmentBySlugCached(slug);
  if (!raw) return { title: 'Not found' };
  const dev = resolveDevOverrides(raw);

  const href = { pathname: '/new-developments/[slug]', params: { slug: dev.slug } } as const;

  return {
    title: dev.title || `${dev.name} | Smartmove Marbella`,
    description: dev.meta_description || dev.short_description,
    keywords: dev.keywords,
    robots: NEW_DEVELOPMENTS_PUBLIC
      ? undefined
      : { index: false, follow: false, nocache: true },
    alternates: localizedAlternates(locale, href),
    openGraph: {
      title: dev.title || dev.name,
      description: dev.meta_description || dev.short_description,
      url: localizedUrl(locale, href),
      siteName: 'Smartmove Marbella',
      type: 'website',
      images: dev.hero_image
        ? [{ url: dev.hero_image, width: 1200, height: 630, alt: dev.hero_image_alt }]
        : undefined,
    },
  };
}

function formatPriceFrom(n: number | null) {
  if (n === null) return '-';
  if (n >= 1_000_000) return `from €${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  return `from €${(n / 1000).toFixed(0)}K`;
}

export default async function NewDevelopmentDetailPage({ params }: Props) {
  // Hard-block public access while feature flag is off
  if (!NEW_DEVELOPMENTS_PUBLIC) notFound();

  const { slug } = await params;
  const raw = await getDevelopmentBySlugCached(slug);
  if (!raw || !raw.published) notFound();
  const dev = resolveDevOverrides(raw);

  return (
    <div className="min-h-screen bg-paper">
      {/* Hero */}
      {dev.hero_image && (
        <section className="relative h-[60vh] min-h-[420px] max-h-[680px] overflow-hidden">
          <Image
            src={dev.hero_image}
            alt={dev.hero_image_alt || dev.name}
            fill
            className="object-cover"
            priority
            sizes="100vw"
            {...(dev.hero_image_blur
              ? { placeholder: 'blur' as const, blurDataURL: dev.hero_image_blur }
              : {})}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
          <div className="absolute bottom-0 inset-x-0 max-w-[1600px] mx-auto px-6 lg:px-12 pb-12 text-white">
            <span className="inline-flex items-center px-3 py-1 text-[10px] tracking-[0.25em] uppercase bg-white/10 backdrop-blur-md rounded-full border border-white/20 mb-4">
              {DEVELOPMENT_STATUS_LABELS[dev.status]}
            </span>
            <h1 className="font-display text-[44px] md:text-[80px] leading-[0.95] tracking-tight">
              {dev.name}
            </h1>
            {dev.subtitle && (
              <p className="text-[16px] md:text-[20px] text-white/80 mt-3 max-w-2xl">
                {dev.subtitle}
              </p>
            )}
            {/* Brand rule: developer / architect / interior-designer credits
                stay INTERNAL — never rendered publicly (and there is no
                JSON-LD on this page that exposes them). */}
          </div>
        </section>
      )}

      <main className="max-w-[1600px] mx-auto px-6 lg:px-12 py-16">
        {/* Quick stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16 pb-16 border-b border-ink/10">
          <Stat label="Price" value={dev.price_on_request ? 'On request' : formatPriceFrom(dev.price_from)} />
          {dev.bedrooms_from && dev.bedrooms_to && (
            <Stat label="Bedrooms" value={`${dev.bedrooms_from}–${dev.bedrooms_to}`} />
          )}
          {dev.size_from && dev.size_to && (
            <Stat label="Size" value={`${dev.size_from}–${dev.size_to} m²`} />
          )}
          {dev.total_units && <Stat label="Total units" value={String(dev.total_units)} />}
        </section>

        <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-16 lg:items-start">
        <div className="min-w-0">
        {/* Mobile: actions card right after the stats, before the longform */}
        <div className="lg:hidden mb-16">
          <DevLeadActions
            reference={dev.source_id || dev.slug}
            developmentId={dev.id}
            brochureUrl={dev.brochure_pdf}
          />
        </div>

        {/* Description */}
        {dev.description && (
          <section className="max-w-3xl mb-16">
            <h2 className="font-display text-[28px] md:text-[36px] text-ink mb-6">About the development</h2>
            {dev.description.split('\n\n').map((p, i) => (
              <p key={i} className="text-[15px] text-ink/80 leading-relaxed mb-4">{p}</p>
            ))}
          </section>
        )}

        {/* Amenities */}
        {dev.amenities.length > 0 && (
          <section className="mb-16">
            <h2 className="font-display text-[28px] md:text-[36px] text-ink mb-6">Amenities</h2>
            <div className="flex flex-wrap gap-2">
              {dev.amenities.map((a) => (
                <span key={a} className="px-3 py-1.5 text-[12px] text-ink/70 bg-white border border-ink/10 rounded-full">
                  {a}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Gallery */}
        {dev.gallery_images.length > 0 && (
          <section className="mb-16">
            <h2 className="font-display text-[28px] md:text-[36px] text-ink mb-6">Gallery</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dev.gallery_images.map((img) => (
                <div key={img} className="relative aspect-[4/3] bg-[#f0ede9] rounded overflow-hidden">
                  <Image src={img} alt="" fill className="object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Brochure is email-gated — it lives behind the "Download the
            brochure" intent in the actions card, not as an open link. */}

        <Link
          href="/new-developments"
          className="text-[12px] font-semibold tracking-[0.08em] uppercase text-ink/60 hover:text-gold transition-colors"
        >
          ← Back to all developments
        </Link>
        </div>

        {/* Desktop: sticky actions rail */}
        <aside className="hidden lg:block lg:sticky lg:top-24">
          <DevLeadActions
            reference={dev.source_id || dev.slug}
            developmentId={dev.id}
            brochureUrl={dev.brochure_pdf}
          />
        </aside>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-ink/50 mb-2">{label}</p>
      <p className="font-display text-[24px] md:text-[28px] text-ink">{value}</p>
    </div>
  );
}
