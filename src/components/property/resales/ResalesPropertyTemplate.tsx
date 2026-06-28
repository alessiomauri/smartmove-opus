// Server component. The interactive pieces (gallery, read-more, features
// toggle, brochure expander, reveal motion, similar-card hearts) are
// client islands; the composition + data shaping stay on the server so
// the resales page keeps riding the page's ISR.
// The shared chrome (SiteHeader `.sg-top`, SiteFooter `.sm-f`) lives in the
// homepage skin; every rule there is scoped under `.sm-skin`, so importing it
// styles the resales wrapper without touching the manual template (which is
// NOT `.sm-skin`-wrapped). sm-resales.css is imported last so its `.rs-*`
// rules win on any overlap.
import '@/styles/sm-skin.css';
import '@/styles/sm-skin-extra.css';
import '@/styles/sm-resales.css';
import { Link } from '@/i18n/navigation';
import SiteHeader from '@/components/sm/SiteHeader';
import SiteFooter from '@/components/sm/SiteFooter';
import LeadForm from '@/components/leads/LeadForm';
import { getSimilarProperties } from '@/lib/similar';
import { getAreaBySlugCached } from '@/lib/queries';
import { slugify } from '@/lib/utils';
import type { Property } from '@/types/property';
import {
  resalesPhotoUrls,
  resalesFeatureGroups,
  resalesDescriptionParas,
  resalesStatusBadge,
  dedupePlace,
  resalesPriceLabel,
  energyLetter,
  ENERGY_COLORS,
} from '@/lib/resales-detail';
import ResalesGallery from './ResalesGallery';
import ResalesDescription from './ResalesDescription';
import ResalesFeatures from './ResalesFeatures';
import ResalesBrochure from './ResalesBrochure';
import ResalesReveal from './ResalesReveal';
import ResalesCard from './ResalesCard';

export default async function ResalesPropertyTemplate({
  property,
  locale,
}: {
  property: Property;
  locale: string;
}) {
  const photos = resalesPhotoUrls(property);
  const featureGroups = resalesFeatureGroups(property, locale);
  const descParas = resalesDescriptionParas(property, locale);
  const reference = property.source_id || property.slug;
  const badge = resalesStatusBadge(property.status);
  const place = dedupePlace(property.location) || property.area;
  const priceLabel = resalesPriceLabel(property);
  const showReduced = property.status === 'available' && property.price_drop === true;
  const energy = energyLetter(property.energy_rated);

  const typeTitle =
    property.property_type_labels?.[locale] ||
    property.property_type_labels?.en ||
    property.name ||
    'Property';
  const tm = typeTitle.match(/^(.*?)(\S+)$/);

  const specDefs = (
    [
      { lbl: 'Bedrooms', val: property.bedrooms },
      { lbl: 'Bathrooms', val: property.bathrooms },
      { lbl: 'Built', val: property.interior_size, unit: 'm²' },
      { lbl: 'Terrace', val: property.terrace_size, unit: 'm²' },
      { lbl: 'Plot', val: property.plot_size, unit: 'm²' },
    ] as { lbl: string; val: number | null; unit?: string }[]
  ).filter((s): s is { lbl: string; val: number; unit?: string } => !!s.val && s.val > 0);

  const moneyRows = (
    [
      property.community_fees_year && property.community_fees_year > 0
        ? { l: 'Community', v: property.community_fees_year }
        : null,
      property.ibi_fees_year && property.ibi_fees_year > 0
        ? { l: 'IBI (property tax)', v: property.ibi_fees_year }
        : null,
      property.basura_tax_year && property.basura_tax_year > 0
        ? { l: 'Refuse (basura)', v: property.basura_tax_year }
        : null,
    ].filter(Boolean) as { l: string; v: number }[]
  );
  const moneyNote =
    moneyRows.length === 0
      ? 'Annual running costs were not supplied for this listing. We confirm them before any offer.'
      : moneyRows.length < 2 && !energy
        ? 'Only the figures the agency supplied are shown. We confirm the rest before any offer.'
        : null;

  const descHeading = property.bedrooms && property.bedrooms > 0 ? 'A closer look.' : 'About this plot.';

  // Area-guide CTA → real /areas/[slug] via slugified town; hide if unmapped.
  const areaSlug = slugify(property.area || property.location || '');
  const areaGuide = areaSlug ? await getAreaBySlugCached(areaSlug) : null;

  // Geo-ranked similar (existing component logic), re-skinned cards.
  const similar = await getSimilarProperties(property);

  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_URL || null;

  return (
    <div className="sm-skin rs-skin">
      <SiteHeader variant="glass" current="Properties" />
      <ResalesReveal />

      <ResalesGallery photos={photos} alt={`${typeTitle} — ${place}`} />

      {/* ───────── TITLE BLOCK ───────── */}
      <div className="rs-titlewrap">
        <div className="rs-wrap">
          <div className="rs-utilrow">
            <nav className="rs-crumbs">
              <Link href="/">Home</Link>
              <span className="sep">/</span>
              <Link href="/properties">Properties</Link>
              <span className="sep">/</span>
              <span className="cur">{property.area || place}</span>
            </nav>
            <div className="rs-badges">
              <span className={`rs-badge ${badge.cls}`}>{badge.label}</span>
            </div>
          </div>

          <div className="rs-title">
            <div>
              <h1 className="rs-type">{tm ? (<>{tm[1]}<em>{tm[2]}</em></>) : typeTitle}</h1>
              <div className="rs-place">
                <span>{place}</span>
                <span className="dot" />
                <span className="ref">Ref {reference}</span>
              </div>
            </div>
            <div className="rs-pricebox">
              {priceLabel ? (
                <>
                  <div className="rs-price">{priceLabel}</div>
                  {showReduced && (
                    <div className="rs-reduced-line">
                      <span className="mark">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 19V5M5 12l7 7 7-7" /></svg>
                        Reduced
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="rs-price por">Price on request</div>
                  <div className="rs-price-sub">Enquire for guide price</div>
                </>
              )}
            </div>
          </div>

          <div className="rs-specs">
            {specDefs.map((s) => (
              <div className="rs-spec" key={s.lbl}>
                <span className="v">
                  {s.val.toLocaleString('en-GB')}
                  {s.unit && <em>{s.unit}</em>}
                </span>
                <span className="k">{s.lbl}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ───────── MAIN SPLIT ───────── */}
      <div className="rs-main">
        <div>
          {descParas.length > 0 && <ResalesDescription heading={descHeading} paras={descParas} />}

          <ResalesFeatures groups={featureGroups} />

          {/* running costs — "The numbers" (ITP estimator intentionally omitted) */}
          <div className="rs-money rs-reveal">
            <div className="c-sheet">
              <div className="c-head">
                <span className="t">The <em>numbers.</em></span>
                <span className="verified">As listed</span>
              </div>
              {(moneyRows.length > 0 || energy) && (
                <div className="c-recur">
                  {moneyRows.map((r) => (
                    <div className="c-line" key={r.l}>
                      <span className="l">{r.l}</span>
                      <span className="v">€{r.v.toLocaleString('en-GB')}<span>/yr</span></span>
                    </div>
                  ))}
                  {energy && (
                    <div className="c-line">
                      <span className="l">Energy rating</span>
                      <span className="v">
                        <span className="rs-energy"><span className="letter" style={{ background: ENERGY_COLORS[energy] }}>{energy}</span></span>
                      </span>
                    </div>
                  )}
                </div>
              )}
              {moneyNote && <p className="rs-money-note">{moneyNote}</p>}
            </div>
          </div>

          {/* approximate location — coordinate-free faux map (no pin for resales) */}
          <div className="rs-loc rs-reveal">
            <h3>Approximate <em>location.</em></h3>
            <div className="rs-map">
              <div className="streets" />
              <div className="coast" />
              <div className="rs-radius"><span className="center" /></div>
              <div className="note">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="10" r="3" /><path d="M12 2a8 8 0 0 0-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z" /></svg>
                Location is approximate
              </div>
            </div>
            {areaGuide && (
              <Link className="rs-areaguide" href={{ pathname: '/areas/[slug]', params: { slug: areaGuide.slug } }}>
                <span className="ag-ph">
                  {areaGuide.hero_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={areaGuide.hero_image} alt="" />
                  ) : null}
                </span>
                <span>
                  <span className="ag-k">Area guide</span>
                  <span className="ag-t">Living in <em>{areaGuide.name}</em></span>
                </span>
                <span className="ag-arr">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </span>
              </Link>
            )}
          </div>
        </div>

        {/* lead rail */}
        <aside className="rs-rail">
          <div className="rs-lead" id="rs-request">
            <div className="l-kicker">{typeTitle} · Ref {reference}</div>
            <h3>Request <em>information.</em></h3>
            <div className="advisor">
              <div className="av" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 20a7 7 0 0 1 14 0" /><circle cx="12" cy="8" r="4" /></svg>
              </div>
              <div>
                <div className="nm">Your Costa del Sol advisor</div>
                <div className="rl">Speaks EN / ES · replies within the hour</div>
              </div>
              <span className="dot">Online</span>
            </div>

            <LeadForm
              variant="viewing"
              source="viewing-request"
              sourceDetail={reference}
              propertyId={property.id}
            />

            <div className="alt">
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5z" /></svg>
                  WhatsApp
                </a>
              )}
              <a href="#rs-request" className={whatsapp ? '' : 'full'}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 11h16" /></svg>
                Book viewing
              </a>
            </div>
          </div>

          <ResalesBrochure slug={property.slug} reference={reference} propertyId={property.id} />

          <p className="rs-railnote">
            Listing reference <span className="ref">{reference}</span>. We confirm every detail with you before any viewing or offer.
          </p>
        </aside>
      </div>

      {/* ───────── SIMILAR ───────── */}
      {similar.length > 0 && (
        <section className="rs-similar">
          <div className="rs-wrap">
            <div className="head">
              <h2>Similar <em>nearby.</em></h2>
              <Link href="/properties">All properties →</Link>
            </div>
            <div className="rs-simgrid">
              {similar.slice(0, 4).map((p) => (
                <ResalesCard key={p.id} property={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Nameless partner-network provenance line — kept (flagged for Alessio). */}
      <p className="rs-partnernote">Listed via partner network · Reference {reference}</p>

      <SiteFooter />
    </div>
  );
}
