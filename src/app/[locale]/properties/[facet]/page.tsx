import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import PropertyGrid from '@/components/PropertyGrid';
import { FACETS, getFacet, siblingFacets } from '@/lib/facets';
import CopyUrlButton from '@/components/search/CopyUrlButton';
import { searchPropertiesPaged, searchParamsString, type SearchFilters } from '@/lib/search';
import { localizedAlternates, localizedUrl } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

/**
 * Curated facet landing pages — Tier-1, the indexed wrappers over the
 * full-search inventory (SEO STANDARDS: hand-tuned metadata, answer-
 * first intro with dated live counts, FAQPage where natural,
 * BreadcrumbList + ItemList schema, lateral sibling links, sitemap).
 * Static (ISR hourly); interacting with filters moves you onto the
 * dynamic /properties surface.
 */

export const revalidate = 3600;

export function generateStaticParams() {
  return FACETS.map((f) => ({ facet: f.slug }));
}

interface Props {
  params: Promise<{ locale: Locale; facet: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, facet: slug } = await params;
  const facet = getFacet(slug);
  if (!facet) return { title: 'Not found' };
  const copy = locale === 'es' ? facet.es : facet.en;
  const href = { pathname: '/properties/[facet]', params: { facet: slug } } as const;
  return {
    title: `${copy.title} | Smartmove Marbella`,
    description: copy.meta,
    robots: { index: true, follow: true },
    alternates: localizedAlternates(locale, href),
    openGraph: {
      title: copy.title,
      description: copy.meta,
      url: localizedUrl(locale, href),
      siteName: 'Smartmove Marbella',
      type: 'website',
    },
  };
}

const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default async function FacetPage({ params }: Props) {
  const { locale, facet: slug } = await params;
  const facet = getFacet(slug);
  if (!facet) notFound();

  const copy = locale === 'es' ? facet.es : facet.en;
  const filters: SearchFilters = { ...facet.filters, sort: 'new', page: 1 };
  const result = await searchPropertiesPaged(filters);
  const siblings = siblingFacets(slug);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';

  const now = new Date();
  const dated =
    locale === 'es'
      ? `a ${now.getDate()} de ${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][now.getMonth()]} de ${now.getFullYear()}`
      : `as of ${MONTHS_EN[now.getMonth()]} ${now.getFullYear()}`;

  const searchHref = `${locale === 'es' ? '/es/propiedades' : '/properties'}${searchParamsString(facet.filters)}`;

  // ── Schema graph ──
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Properties', item: `${baseUrl}/properties` },
      { '@type': 'ListItem', position: 3, name: copy.h1, item: localizedUrl(locale, { pathname: '/properties/[facet]', params: { facet: slug } }) },
    ],
  };
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: result.total,
    itemListElement: result.rows.slice(0, 12).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${baseUrl}/property/${p.slug}`,
      name: p.name,
    })),
  };
  const faq =
    copy.faq && copy.faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: copy.faq.map((x) => ({
            '@type': 'Question',
            name: x.q,
            acceptedAnswer: { '@type': 'Answer', text: x.a },
          })),
        }
      : null;

  return (
    <div className="min-h-screen bg-paper">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      {faq && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />}
      <SiteHeader />

      <main className="max-w-[1600px] mx-auto px-6 lg:px-12 py-10 lg:py-14">
        {/* Breadcrumb (visible) */}
        <nav aria-label="Breadcrumb" className="text-[11.5px] text-ink/45 mb-5">
          <Link href="/" className="hover:text-gold transition-colors">Home</Link>
          <span className="mx-1.5">/</span>
          <Link href={'/properties' as never} className="hover:text-gold transition-colors">Properties</Link>
          <span className="mx-1.5">/</span>
          <span className="text-ink/70">{copy.h1}</span>
        </nav>

        <header className="max-w-3xl mb-9">
          <h1 className="font-display text-[34px] md:text-[50px] leading-[1.03] tracking-tight text-ink mb-5">
            {copy.h1}
          </h1>
          {/* Answer-first block (AI SEARCH standard): direct answer +
              live, dated inventory facts. */}
          <p className="text-[15.5px] text-ink/75 leading-relaxed">
            {copy.intro}
          </p>
          <div className="flex items-end justify-between gap-4 mt-3 flex-wrap">
            <p className="text-[13.5px] text-ink/55">
              <strong className="text-ink">{result.total.toLocaleString(locale === 'es' ? 'es-ES' : 'en-US')}</strong>{' '}
              {locale === 'es' ? 'propiedades disponibles' : 'currently for sale'} {dated}
              {cheapest(result.rows) && (
                <> · {locale === 'es' ? 'desde' : 'from'} €{cheapest(result.rows)!.toLocaleString('en-US')}</>
              )}
              .
            </p>
            <CopyUrlButton label={locale === 'es' ? 'Compartir esta página' : 'Share this page'} />
          </div>
        </header>

        <PropertyGrid properties={result.rows} />

        {result.total > result.rows.length && (
          <div className="text-center mt-10">
            <Link
              href={searchHref as never}
              className="inline-block px-7 py-3.5 text-[12.5px] font-semibold tracking-[0.1em] uppercase bg-gold text-white rounded-full hover:bg-gold-deep transition-colors"
            >
              {locale === 'es'
                ? `Ver las ${result.total.toLocaleString('es-ES')} propiedades`
                : `See all ${result.total.toLocaleString('en-US')} properties`}
            </Link>
          </div>
        )}

        {/* FAQ (mirrors the schema) */}
        {copy.faq && copy.faq.length > 0 && (
          <section className="max-w-3xl mt-16">
            <h2 className="font-display text-[26px] md:text-[32px] text-ink mb-6">
              {locale === 'es' ? 'Preguntas frecuentes' : 'Buyers ask'}
            </h2>
            {copy.faq.map((x) => (
              <details key={x.q} className="group border-b border-ink/[0.08] py-4">
                <summary className="cursor-pointer text-[15px] font-medium text-ink list-none flex justify-between items-center gap-4">
                  {x.q}
                  <span className="text-gold transition-transform duration-300 group-open:rotate-45 shrink-0">+</span>
                </summary>
                <p className="text-[14px] text-ink/65 leading-relaxed mt-3">{x.a}</p>
              </details>
            ))}
          </section>
        )}

        {/* Lateral facet cross-links */}
        {siblings.length > 0 && (
          <section className="mt-16 pt-10 border-t border-ink/[0.08]">
            <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink/50 mb-5">
              {locale === 'es' ? 'Búsquedas relacionadas' : 'Related searches'}
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {siblings.map((s) => (
                <Link
                  key={s.slug}
                  href={{ pathname: '/properties/[facet]', params: { facet: s.slug } }}
                  className="px-4 py-2 text-[13px] text-ink/75 bg-white border border-ink/10 rounded-full hover:border-gold hover:text-gold transition-colors"
                >
                  {(locale === 'es' ? s.es : s.en).h1}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function cheapest(rows: Array<{ price: number | null; price_on_request: boolean | null }>): number | null {
  const prices = rows.map((r) => (!r.price_on_request && r.price ? r.price : null)).filter((p): p is number => !!p);
  return prices.length ? Math.min(...prices) : null;
}
