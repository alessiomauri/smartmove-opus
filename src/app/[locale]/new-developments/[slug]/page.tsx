import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { getDevelopmentBySlug } from '@/lib/actions/developments';
import { DEVELOPMENT_STATUS_LABELS } from '@/types/development';
import { NEW_DEVELOPMENTS_PUBLIC } from '../feature-flag';

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const dev = await getDevelopmentBySlug(slug);
  if (!dev) return { title: 'Not found' };

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';

  return {
    title: dev.title || `${dev.name} | Smartmove Marbella`,
    description: dev.meta_description || dev.short_description,
    keywords: dev.keywords,
    robots: NEW_DEVELOPMENTS_PUBLIC
      ? undefined
      : { index: false, follow: false, nocache: true },
    alternates: { canonical: `${baseUrl}/new-developments/${dev.slug}` },
    openGraph: {
      title: dev.title || dev.name,
      description: dev.meta_description || dev.short_description,
      url: `${baseUrl}/new-developments/${dev.slug}`,
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
  const dev = await getDevelopmentBySlug(slug);
  if (!dev || !dev.published) notFound();

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
            {dev.developer && (
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60 mt-4">
                by {dev.developer}
              </p>
            )}
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

        {/* Brochure */}
        {dev.brochure_pdf && (
          <section className="mb-16">
            <a
              href={dev.brochure_pdf}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gold text-white text-[13px] font-semibold tracking-[0.05em] uppercase rounded-full hover:bg-gold-deep transition-colors"
            >
              Download brochure
            </a>
          </section>
        )}

        <Link
          href="/new-developments"
          className="text-[12px] font-semibold tracking-[0.08em] uppercase text-ink/60 hover:text-gold transition-colors"
        >
          ← Back to all developments
        </Link>
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
