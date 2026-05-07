'use client';

import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { Property, STATUS_LABELS } from '@/types/property';
import { formatPrice, formatNumber } from '@/lib/utils';
import { useFavourites } from '@/hooks/useFavourites';

interface PropertyCardProps {
  property: Property;
  index?: number;
  priority?: boolean;
}

/**
 * Property card — Brand Foundation v1 (Costa Editorial × Editorial Slate).
 *
 * Composition (per `~/Downloads/Brand Foundation.html`):
 *   - 4:3 photo with hover scale, badge top-left, favourite top-right,
 *     "VIEW PROPERTY ↗" reveal at bottom-left on hover
 *   - Title row: h3 (Cormorant bold) with gold underline animating in on
 *     hover; area uppercase gold, top-right
 *   - Price-specs row: price (Cormorant bold) + spec strip
 *   - Two-CTA grid: ghost "Details" + primary "Request Brochure" (gold)
 *
 * Featured properties get the gold badge variant. Sold/under-offer use
 * a subtle desaturate without changing the card chrome.
 */
export default function PropertyCard({ property, priority = false }: PropertyCardProps) {
  const isFeatured = property.is_featured && property.status === 'available';
  const isUnavailable =
    property.status === 'sold' ||
    property.status === 'under_offer' ||
    property.status === 'reserved';
  // Source-aware UX. Resales-sourced rows are bulk MLS inventory — they
  // get a tighter card chrome and a subtle "Partner listing" indicator;
  // Smartmove's own (manual / scraper) listings stay editorial-class.
  const isPartnerListing = property.source === 'resales_online';
  const { isFavourite, toggleFavourite, isLoaded } = useFavourites();
  const saved = isFavourite(property.id);

  // Warm the cache for the property's hero image when the user hovers.
  const preloadHero = () => {
    if (typeof window === 'undefined' || !property.hero_image) return;
    const img = new window.Image();
    img.src = property.hero_image;
  };

  return (
    <article className="sm-card" onMouseEnter={preloadHero} onTouchStart={preloadHero}>
      <Link
        href={{ pathname: '/property/[slug]', params: { slug: property.slug } }}
        className="sm-card__photo"
        aria-label={`${property.name} in ${property.location}`}
      >
        <Image
          src={property.hero_image}
          alt={`${property.name} — ${property.location}, Marbella`}
          fill
          className={isUnavailable ? 'saturate-[0.4] brightness-95' : ''}
          sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
          priority={priority}
          {...(property.hero_image_blur
            ? { placeholder: 'blur' as const, blurDataURL: property.hero_image_blur }
            : {})}
        />

        <span
          className={`sm-card__badge${isFeatured ? ' sm-card__badge--gold' : ''}`}
        >
          {isUnavailable
            ? STATUS_LABELS[property.status]
            : isFeatured
              ? 'Featured'
              : isPartnerListing
                ? 'Partner'
                : 'New'}
        </span>

        <button
          type="button"
          className="sm-card__bookmark"
          aria-label={saved ? 'Remove from favourites' : 'Save to favourites'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isLoaded) toggleFavourite(property.id);
          }}
        >
          <svg viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6">
            <path d="M6 3h12v18l-6-4-6 4z" />
          </svg>
        </button>

        <span className="sm-card__view">
          View Property <span className="arrow">↗</span>
        </span>
      </Link>

      <div className="sm-card__body">
        <div className="sm-card__title-row">
          <Link
            href={{ pathname: '/property/[slug]', params: { slug: property.slug } }}
            className="sm-card__title-link"
          >
            <h3 className="sm-card__title">{property.name}</h3>
          </Link>
          <p className="sm-card__area">{property.location}</p>
        </div>

        <div className="sm-card__price-specs">
          <span className="sm-card__price">
            {formatPrice(property.price, property.price_on_request)}
          </span>
          <div className="sm-card__specs">
            {property.bedrooms != null && (
              <span>
                <strong>{property.bedrooms}</strong> bed
              </span>
            )}
            {property.bathrooms != null && (
              <span>
                <strong>{property.bathrooms}</strong> bath
              </span>
            )}
            {property.interior_size != null && (
              <span>
                <strong>{formatNumber(property.interior_size)}</strong> m²
              </span>
            )}
            {property.plot_size != null && (
              <span>
                <strong>{formatNumber(property.plot_size)}</strong> plot
              </span>
            )}
          </div>
        </div>

        <div className="sm-card__ctas">
          <Link
            href={{ pathname: '/property/[slug]', params: { slug: property.slug } }}
            className="sm-card__cta sm-card__cta--ghost"
          >
            Details
          </Link>
          <Link
            href={{ pathname: '/property/[slug]', params: { slug: property.slug } }}
            className="sm-card__cta sm-card__cta--primary"
          >
            Request Brochure
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Loading skeleton matching the new card geometry. */
export function PropertyCardSkeleton() {
  return (
    <div
      className="sm-card"
      style={{ pointerEvents: 'none' }}
      aria-hidden
    >
      <div className="sm-card__photo">
        <div
          style={{ position: 'absolute', inset: 0, background: 'var(--sm-cream)' }}
          className="skeleton"
        />
      </div>
      <div className="sm-card__body">
        <div className="sm-card__title-row">
          <div
            style={{
              height: 28,
              width: 180,
              background: 'var(--sm-cream)',
              borderRadius: 'var(--sm-radius-xs)',
            }}
            className="skeleton"
          />
          <div
            style={{
              height: 12,
              width: 80,
              background: 'var(--sm-cream)',
              borderRadius: 'var(--sm-radius-xs)',
            }}
            className="skeleton"
          />
        </div>
        <div className="sm-card__price-specs">
          <div
            style={{
              height: 24,
              width: 120,
              background: 'var(--sm-cream)',
              borderRadius: 'var(--sm-radius-xs)',
            }}
            className="skeleton"
          />
          <div
            style={{
              height: 16,
              width: 200,
              background: 'var(--sm-cream)',
              borderRadius: 'var(--sm-radius-xs)',
            }}
            className="skeleton"
          />
        </div>
      </div>
    </div>
  );
}
