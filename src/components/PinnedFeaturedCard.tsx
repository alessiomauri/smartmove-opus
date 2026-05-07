import Image from 'next/image';
import { Link } from '@/i18n/navigation';

interface Props {
  property: {
    slug: string;
    name: string;
    location: string;
    area?: string | null;
    hero_image: string;
    price?: number | null;
    price_on_request?: boolean;
  };
}

/**
 * Mobile pinned featured card — replaces the desktop hero side card.
 *
 * Sits below the SearchPill on mobile only (hidden on desktop via CSS).
 * Composition per Brand Foundation Mobile: gold uppercase header bar,
 * 100×86 photo + info column with area kicker, Cormorant title, and price.
 */
export default function PinnedFeaturedCard({ property }: Props) {
  const priceText = property.price_on_request || !property.price
    ? 'Price on request'
    : `From €${(property.price / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;

  return (
    <Link
      href={{ pathname: '/property/[slug]', params: { slug: property.slug } }}
      className="sm-pinned"
      aria-label={`Featured: ${property.name} in ${property.location}`}
    >
      <div className="sm-pinned__lbl">Now Featured</div>
      <div className="sm-pinned__row">
        <div className="sm-pinned__photo">
          <Image
            src={property.hero_image}
            alt={`${property.name} in ${property.location}`}
            fill
            sizes="100px"
          />
        </div>
        <div className="sm-pinned__info">
          <div className="sm-pinned__area">{property.area || property.location}</div>
          <h4 className="sm-pinned__title">{property.name}</h4>
          <div className="sm-pinned__price">{priceText}</div>
        </div>
      </div>
    </Link>
  );
}
