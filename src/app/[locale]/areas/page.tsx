import { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { MapPin } from 'lucide-react';
import { getPublishedAreas } from '@/lib/actions/areas';
import AreasIndexClient from './AreasIndexClient';

export const revalidate = 3600; // ISR: regenerate every hour

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';

export const metadata: Metadata = {
  title: 'Costa del Sol Areas Guide | Property by Location',
  description: 'Explore luxury properties across the Costa del Sol. Browse by area: Marbella, Golden Mile, Puerto Banus, Nueva Andalucia, Estepona, Benahavis, and 25+ more exclusive locations.',
  keywords: [
    'Costa del Sol areas', 'Marbella areas', 'where to buy property Costa del Sol',
    'Marbella neighbourhoods', 'best areas Marbella', 'Costa del Sol locations',
    'property by area Marbella', 'Costa del Sol property guide',
  ],
  alternates: { canonical: `${baseUrl}/areas` },
  openGraph: {
    title: 'Costa del Sol Areas Guide | Smartmove Marbella',
    description: 'Explore luxury properties across 30+ exclusive locations on the Costa del Sol.',
    url: `${baseUrl}/areas`,
    siteName: 'Smartmove Marbella',
    type: 'website',
  },
};

export default async function AreasIndexPage() {
  const areas = await getPublishedAreas();

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Areas', item: `${baseUrl}/areas` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="min-h-screen bg-paper">
        {/* Header */}
        <header className="sticky top-0 z-50 header-glass">
          <div className="absolute top-0 left-0 right-0 h-[2px] header-gradient-border" />
          <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
            <div className="flex items-center justify-between h-[60px] lg:h-[72px]">
              <Link href="/" className="group relative shrink-0 inline-block">
                <span className="text-[24px] lg:text-[26px] tracking-[-0.02em] font-display text-gold transition-colors group-hover:text-gold-deep">
                  Smartmove Marbella
                </span>
                <span className="absolute -bottom-0.5 left-0 h-[1px] w-0 bg-gold transition-all duration-500 ease-out group-hover:w-full" />
              </Link>
              {/* Single nav link — wordmark already serves as the home link.
                  Removed "All Properties" (real-estate language + redundant). */}
              <Link
                href="/blog"
                className="text-[11px] font-semibold tracking-[0.08em] uppercase text-ink/60 hover:text-gold transition-colors"
              >
                Blog
              </Link>
            </div>
          </div>
        </header>

        <div className="header-divider" />

        {/* Hero */}
        <section className="max-w-[1600px] mx-auto px-6 lg:px-12 pt-12 pb-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-gold" />
              <span className="text-[12px] font-semibold tracking-[0.12em] uppercase text-gold">
                Costa del Sol
              </span>
            </div>
            <h1 className="font-display text-[36px] md:text-[48px] lg:text-[56px] text-ink leading-[1.1] tracking-tight mb-4">
              Explore by Area
            </h1>
            <p className="text-[18px] text-ink/60 leading-relaxed">
              From the glamour of Marbella&apos;s Golden Mile to the whitewashed villages of the mountains, discover {areas.length} unique locations across the Costa del Sol.
            </p>
          </div>
        </section>

        {/* Client-side: featured trio + grid/map toggle + filters */}
        <AreasIndexClient areas={areas} />

        {/* Footer */}
        <footer className="py-16 bg-paper border-t border-ink/[0.06]">
          <div className="max-w-[1600px] mx-auto px-6 lg:px-12 text-center">
            <Link href="/" className="group relative inline-block">
              <span className="font-display text-[28px] md:text-[36px] text-gold/90 leading-none tracking-tight transition-colors group-hover:text-gold-deep">
                Smartmove Marbella
              </span>
              <span className="absolute -bottom-0.5 left-0 h-[1px] w-0 bg-gold transition-all duration-500 ease-out group-hover:w-full" />
            </Link>
            <p className="text-[13px] text-ink/40 tracking-widest uppercase mt-4">
              &copy; {new Date().getFullYear()} All Rights Reserved
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
