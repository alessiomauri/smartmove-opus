'use client';

import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { Development, DEVELOPMENT_STATUS_LABELS } from '@/types/development';

interface DevelopmentCardProps {
  development: Development;
  priority?: boolean;
}

function formatPriceFrom(n: number | null | undefined) {
  if (n == null) return null;
  if (n >= 1_000_000) {
    return `From €${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  return `From €${Math.round(n / 1000)}K`;
}

/**
 * Development card — Brand Foundation v1, dev-specific.
 *
 * Same chrome as PropertyCard (4:3 photo, gold accents, Cormorant title
 * with animating gold underline, ghost+primary CTA grid) but exposes the
 * fields that matter for off-plan: status pill (off_plan / under_construction /
 * key_ready / completed / sold_out), bedroom range (from-to), price-from,
 * developer credit, completion date when known.
 *
 * Reused on /new-developments index, /areas/[slug] developments section,
 * and the homepage featured-developments block (when that lands).
 */
export default function DevelopmentCard({ development, priority = false }: DevelopmentCardProps) {
  const statusLabel = DEVELOPMENT_STATUS_LABELS[development.status];
  const bedRange =
    development.bedrooms_from != null && development.bedrooms_to != null
      ? development.bedrooms_from === development.bedrooms_to
        ? `${development.bedrooms_from} bed`
        : `${development.bedrooms_from}–${development.bedrooms_to} bed`
      : null;
  const priceText = development.price_on_request
    ? 'Price on request'
    : formatPriceFrom(development.price_from) ?? null;

  return (
    <article className="sm-card">
      <Link
        href={{ pathname: '/new-developments/[slug]', params: { slug: development.slug } }}
        className="sm-card__photo"
        aria-label={`${development.name} — ${development.location || development.area || 'New development'}`}
      >
        {development.hero_image ? (
          <Image
            src={development.hero_image}
            alt={development.hero_image_alt || `${development.name} — new development`}
            fill
            className="object-cover"
            sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
            priority={priority}
            {...(development.hero_image_blur
              ? { placeholder: 'blur' as const, blurDataURL: development.hero_image_blur }
              : {})}
          />
        ) : null}

        {development.is_featured ? (
          <span className="sm-card__badge sm-card__badge--gold">Featured</span>
        ) : (
          <span className="sm-card__badge">{statusLabel}</span>
        )}

        <span className="sm-card__view">
          View development <span className="arrow">↗</span>
        </span>
      </Link>

      <div className="sm-card__body">
        <div className="sm-card__title-row">
          <Link
            href={{ pathname: '/new-developments/[slug]', params: { slug: development.slug } }}
            className="sm-card__title-link"
          >
            <h3 className="sm-card__title">{development.name}</h3>
          </Link>
          <p className="sm-card__area">
            {development.area || development.location}
            {development.developer && (
              <>
                <br />
                <span className="text-ink/50 font-normal normal-case tracking-normal text-[10px]">
                  by {development.developer}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="sm-card__price-specs">
          <span className="sm-card__price">{priceText ?? statusLabel}</span>
          <div className="sm-card__specs">
            {bedRange && <span>{bedRange}</span>}
            {development.size_from != null && development.size_to != null && (
              <span>
                <strong>
                  {development.size_from === development.size_to
                    ? development.size_from
                    : `${development.size_from}–${development.size_to}`}
                </strong>{' '}
                m²
              </span>
            )}
            {development.units_available != null && (
              <span>
                <strong>{development.units_available}</strong> units
              </span>
            )}
          </div>
        </div>

        <div className="sm-card__ctas">
          <Link
            href={{ pathname: '/new-developments/[slug]', params: { slug: development.slug } }}
            className="sm-card__cta sm-card__cta--ghost"
          >
            Details
          </Link>
          <Link
            href={{ pathname: '/new-developments/[slug]', params: { slug: development.slug } }}
            className="sm-card__cta sm-card__cta--primary"
          >
            Request Brochure
          </Link>
        </div>
      </div>
    </article>
  );
}
