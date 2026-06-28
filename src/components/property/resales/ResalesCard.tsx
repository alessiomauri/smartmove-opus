'use client';

import { Link } from '@/i18n/navigation';
import type { Property } from '@/types/property';
import { useFavourites } from '@/hooks/useFavourites';
import { resalesStatusBadge, resalesPriceLabel } from '@/lib/resales-detail';

/**
 * Resales search-result card (ported from "Resales Card.html"). Re-skin
 * of the "similar" grid only — the heart wires to the existing
 * favourites store (useFavourites), not a new feature. The card never
 * invents data: zero/absent fields simply drop out.
 */
export default function ResalesCard({ property }: { property: Property }) {
  const { isFavourite, toggleFavourite, isLoaded } = useFavourites();
  const saved = isFavourite(property.id);

  const status = property.status;
  const badge = resalesStatusBadge(status);
  const showStatusPill = status !== 'available';
  const showReduced = status === 'available' && property.price_drop === true;
  const priceLabel = resalesPriceLabel(property);

  const specs: string[] = [];
  if (property.bedrooms && property.bedrooms > 0) specs.push(`${property.bedrooms} bed`);
  if (property.bathrooms && property.bathrooms > 0) specs.push(`${property.bathrooms} bath`);
  if (property.interior_size && property.interior_size > 0) specs.push(`${property.interior_size.toLocaleString('en-GB')} m²`);
  if (property.terrace_size && property.terrace_size > 0) specs.push(`${property.terrace_size.toLocaleString('en-GB')} m² terrace`);
  else if (property.plot_size && property.plot_size > 0) specs.push(`${property.plot_size.toLocaleString('en-GB')} m² plot`);

  const href = { pathname: '/property/[slug]' as const, params: { slug: property.slug } };

  return (
    <Link className="rs-card" href={href} aria-label={`${property.name} in ${property.area || property.location}`}>
      <div className="ph">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={property.hero_image} alt={`${property.name} — ${property.area || property.location}`} loading="lazy" />
        <button
          className="save"
          aria-label={saved ? 'Remove from favourites' : 'Save to favourites'}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isLoaded) toggleFavourite(property.id);
          }}
        >
          <svg viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6"><path d="M6 3h12v18l-6-4.5L6 21V3z" /></svg>
        </button>
        {showStatusPill && <span className={`stat ${badge.cls === 'status-agreed' ? 'agreed' : 'offer'}`}>{badge.label}</span>}
        {showReduced && (
          <span className="red">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 19V5M5 12l7 7 7-7" /></svg> Reduced
          </span>
        )}
      </div>
      <div className="meta">
        <div className="loc">{property.area || property.location}</div>
        <h4>{property.name}</h4>
        {specs.length > 0 && (
          <div className="row">
            {specs.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        )}
        <div className="bar">
          {priceLabel ? (
            <span className="price">{priceLabel}</span>
          ) : (
            <span className="price por">Price on request</span>
          )}
          {property.source_id && <span className="ref">{property.source_id}</span>}
        </div>
      </div>
    </Link>
  );
}
