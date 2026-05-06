import HomeListingsClient from './HomeListingsClient';
import { getCachedPublishedProperties, getCachedDefaultSort } from '@/lib/cache';

export const revalidate = 3600;

export default async function Home() {
  const [properties, defaultSort] = await Promise.all([
    getCachedPublishedProperties(),
    getCachedDefaultSort(),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live';

  // Sort properties the same way HomeListingsClient will initially sort them
  // (featured first, then newest) so the SSR HTML matches the hydrated state.
  const sorted = [...properties].sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    if (a.is_featured && b.is_featured) {
      return (a.featured_order ?? 0) - (b.featured_order ?? 0);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // ItemList schema — tells Google this is a listing page and points to the top properties.
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: sorted.slice(0, 10).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${baseUrl}/property/${p.slug}`,
      name: p.name,
      ...(p.price && !p.price_on_request
        ? {
            offers: {
              '@type': 'Offer',
              price: p.price,
              priceCurrency: 'EUR',
              availability:
                p.status === 'available'
                  ? 'https://schema.org/InStock'
                  : 'https://schema.org/OutOfStock',
            },
          }
        : {}),
    })),
  };

  // FAQPage schema — drives rich-snippet FAQ boxes in Google SERPs.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How much does a villa in Marbella cost?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Villa prices in Marbella typically range from €1.5M for a modern home in a well-connected area to €20M+ for a front-line beach or Sierra Blanca mansion. Most luxury villas in prime areas like the Golden Mile, Nueva Andalucía and Benahavís trade between €3M and €8M.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is Marbella a good place to buy property?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Yes. Marbella offers 320+ days of sunshine, a mature international community, world-class golf and dining, strong rental yields on short-term lets, and a long track record of capital appreciation on well-located prime property. It is one of the most sought-after coastal real-estate markets in Europe.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the property buying process in Spain?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'After an offer is accepted, buyers sign a reservation contract (€6k–€10k deposit), a private purchase contract at 10%, then sign the notarised deed (escritura) at completion. Typical timelines are 6–10 weeks. Buyers pay ITP (7–10% on resale) or IVA+AJD (10%+1.5% on new build) plus notary, registry, and legal fees totalling roughly 12–13% of the price.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which area of Marbella is best for luxury property?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'The Golden Mile and Sierra Blanca are the two most prestigious addresses for trophy villas, while Nueva Andalucía offers a lively lifestyle near Puerto Banús. Benahavís hills provide privacy and panoramic sea views, and front-line beach spots like Los Monteros, Bahía de Marbella and Guadalmina Baja are most prized for beach-side living.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can non-residents buy property in Marbella?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Yes. There are no restrictions on non-Spanish nationals buying property in Spain. All you need is a NIE number (Spanish tax ID), a Spanish bank account, and the funds. Many of our buyers purchase remotely with power of attorney handled by their lawyer.',
        },
      },
      {
        '@type': 'Question',
        name: 'What are the best areas in Marbella for investment?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Puerto Banús and the Golden Mile deliver the strongest short-term rental demand. Nueva Andalucía and La Quinta suit buyers seeking capital growth with lifestyle. New-build developments in Estepona and Benahavís have shown the highest appreciation over the last 5 years.',
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <HomeListingsClient initialProperties={sorted} defaultSort={defaultSort} />
    </>
  );
}
