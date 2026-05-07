import { Link } from '@/i18n/navigation';

/**
 * Site-wide footer. Beyond brand chrome, it ships **internal links** to the
 * highest-value SEO pages — Google uses these to understand site structure
 * and topical authority. Crawlers follow these every page load.
 */

const TOP_AREAS: { slug: string; name: string }[] = [
  { slug: 'marbella', name: 'Marbella' },
  { slug: 'puerto-banus', name: 'Puerto Banús' },
  { slug: 'golden-mile', name: 'Golden Mile' },
  { slug: 'sierra-blanca', name: 'Sierra Blanca' },
  { slug: 'nueva-andalucia', name: 'Nueva Andalucía' },
  { slug: 'benahavis', name: 'Benahavís' },
  { slug: 'estepona', name: 'Estepona' },
  { slug: 'sotogrande', name: 'Sotogrande' },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-paper border-t border-ink/[0.06] mt-16">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
          {/* Brand */}
          <div>
            <Link href="/" className="group relative inline-block">
              <span className="font-display text-[28px] text-gold leading-none tracking-tight transition-colors group-hover:text-gold-deep">
                Smartmove Marbella
              </span>
              <span className="absolute -bottom-0.5 left-0 h-[1px] w-0 bg-gold transition-all duration-500 ease-out group-hover:w-full" />
            </Link>
            <p className="text-[13px] text-ink/60 mt-3 max-w-[280px] leading-relaxed">
              Curated luxury villas, apartments and penthouses across Marbella
              and the Costa del Sol.
            </p>
          </div>

          {/* Top Areas */}
          <nav aria-label="Top areas" className="md:pl-6">
            <h3 className="text-[10px] font-semibold tracking-[0.14em] uppercase text-ink/50 mb-4">
              Locations
            </h3>
            <ul className="grid grid-cols-2 gap-y-2 gap-x-4 text-[13px]">
              {TOP_AREAS.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={{ pathname: '/areas/[slug]', params: { slug: a.slug } }}
                    className="text-ink/70 hover:text-gold transition-colors"
                  >
                    {a.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Site nav */}
          <nav aria-label="Site" className="md:pl-6">
            <h3 className="text-[10px] font-semibold tracking-[0.14em] uppercase text-ink/50 mb-4">
              Browse
            </h3>
            <ul className="space-y-2 text-[13px]">
              <li>
                <Link href="/" className="text-ink/70 hover:text-gold transition-colors">
                  All properties
                </Link>
              </li>
              <li>
                <Link href="/areas" className="text-ink/70 hover:text-gold transition-colors">
                  Areas
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-ink/70 hover:text-gold transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/favourites" className="text-ink/70 hover:text-gold transition-colors">
                  Saved
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="border-t border-ink/[0.06] pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="text-[11px] text-ink/40 tracking-[0.1em] uppercase">
            © {year} Smartmove Marbella · All rights reserved
          </p>
          <p className="text-[11px] text-ink/40 tracking-[0.05em]">
            Marbella · Costa del Sol · Andalucía · Spain
          </p>
        </div>
      </div>
    </footer>
  );
}
