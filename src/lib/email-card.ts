/**
 * Email-safe twin of the property card — for the copy-card-to-email
 * workflow (admin copies, pastes into their own mail client; the app
 * never sends email).
 *
 * Constraints honoured (the reason this isn't the React card):
 *  - table-based layout, EVERY style inline, width attributes doubled
 *    in CSS — survives Gmail's style stripping;
 *  - absolute image URLs via the image CDN (Gmail proxies them);
 *  - serif stack with Georgia fallback; no web fonts, no hover, no JS;
 *  - bulletproof-ish button (padded <a>, solid bgcolor).
 *
 * Known caveats (documented, not chased): Outlook desktop (Word
 * engine) ignores border-radius (square corners) and max-width (use of
 * fixed width=600 keeps it sane); border-spacing quirks are avoided by
 * cellpadding/cellspacing=0.
 *
 * Every link carries utm_source=selection&utm_medium=email plus
 * lead=<id> when copied from a lead row, so analytics can tie clicks
 * back to the lead.
 */

// Literal hex — email clients have no CSS-variable cascade.
const GOLD = '#cbaa65';
const INK = '#2e2e2e';
const MUTED = '#6b7280';
const PAPER = '#F7F3EC';
const HAIRLINE = '#e8e2d6';

export interface EmailCardProperty {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  area: string | null;
  price: number | null;
  price_on_request: boolean | null;
  bedrooms: number | null;
  bathrooms: number | null;
  interior_size: number | null;
  hero_image: string | null;
  source_id: string | null;
}

export interface EmailCardOptions {
  /** Ties link clicks back to a lead (lead=<id> on every URL). */
  leadId?: string;
  baseUrl?: string;
}

function esc(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function formatPrice(p: EmailCardProperty): string {
  if (p.price_on_request || p.price == null) return 'Price on request';
  return `€${Math.round(p.price).toLocaleString('en-US')}`;
}

function specLine(p: EmailCardProperty): string {
  const bits: string[] = [];
  if (p.bedrooms != null) bits.push(`${p.bedrooms} bed${p.bedrooms === 1 ? '' : 's'}`);
  if (p.bathrooms != null) bits.push(`${p.bathrooms} bath${p.bathrooms === 1 ? '' : 's'}`);
  if (p.interior_size != null) bits.push(`${Math.round(p.interior_size)} m² built`);
  return bits.join(' &nbsp;·&nbsp; ');
}

export function propertyUrl(p: EmailCardProperty, opts: EmailCardOptions): string {
  const base = (opts.baseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live').replace(/\/$/, '');
  const u = new URL(`${base}/property/${p.slug}`);
  u.searchParams.set('utm_source', 'selection');
  u.searchParams.set('utm_medium', 'email');
  u.searchParams.set('utm_campaign', 'property-selection');
  if (opts.leadId) u.searchParams.set('lead', opts.leadId);
  return u.toString();
}

/** Absolute, CDN-served, email-proxy-friendly image URL. */
function imageUrl(p: EmailCardProperty): string | null {
  if (!p.hero_image) return null;
  if (p.hero_image.startsWith('http')) return p.hero_image;
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://smartmove.live').replace(/\/$/, '');
  return `${base}${p.hero_image}`;
}

const SERIF = `Georgia, 'Times New Roman', Times, serif`;

/** One card. 600px fixed-width table, fully inlined. */
export function renderEmailCard(p: EmailCardProperty, opts: EmailCardOptions = {}): string {
  const url = propertyUrl(p, opts);
  const img = imageUrl(p);
  const kicker = [p.area || p.location, p.source_id ? `Ref. ${p.source_id}` : null]
    .filter(Boolean)
    .join(' &nbsp;·&nbsp; ');

  return `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;border:1px solid ${HAIRLINE};border-radius:8px;border-collapse:separate;">
  <tr>
    <td style="padding:0;">
      ${img ? `<a href="${esc(url)}" target="_blank" style="text-decoration:none;border:0;"><img src="${esc(img)}" width="598" alt="${esc(p.name)}" style="display:block;width:100%;height:auto;border:0;border-radius:8px 8px 0 0;" /></a>` : ''}
    </td>
  </tr>
  <tr>
    <td style="padding:24px 28px 0 28px;font-family:${SERIF};">
      <p style="margin:0 0 6px 0;font-family:${SERIF};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};">${kicker}</p>
      <p style="margin:0;font-family:${SERIF};font-size:22px;line-height:1.25;color:${INK};">
        <a href="${esc(url)}" target="_blank" style="color:${INK};text-decoration:none;">${esc(p.name)}</a>
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:12px 28px 0 28px;font-family:${SERIF};">
      <p style="margin:0;font-family:${SERIF};font-size:20px;color:${INK};"><strong>${formatPrice(p)}</strong></p>
      <p style="margin:6px 0 0 0;font-family:${SERIF};font-size:13px;color:${MUTED};">${specLine(p)}</p>
    </td>
  </tr>
  <tr>
    <td style="padding:18px 28px 0 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="${GOLD}" style="height:1px;line-height:1px;font-size:0;background-color:${GOLD};">&nbsp;</td></tr></table>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 28px 24px 28px;" align="left">
      <a href="${esc(url)}" target="_blank" style="display:inline-block;background-color:${GOLD};color:#ffffff;font-family:${SERIF};font-size:13px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:12px 28px;border-radius:999px;">View property</a>
    </td>
  </tr>
</table>`;
}

/** N cards stacked vertically with breathing room — one paste, one column. */
export function renderEmailCards(props: EmailCardProperty[], opts: EmailCardOptions = {}): string {
  const spacer = `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;"><tr><td height="24" style="height:24px;line-height:24px;font-size:0;">&nbsp;</td></tr></table>`;
  const cards = props.map((p) => renderEmailCard(p, opts)).join(spacer);
  // Outer wrapper keeps Gmail from collapsing whitespace oddly and
  // gives the paste a paper-tinted backdrop cell some clients keep.
  return `<div style="font-family:${SERIF};background-color:${PAPER};">${cards}</div>`;
}

/** text/plain fallback for the same selection. */
export function renderEmailCardsText(props: EmailCardProperty[], opts: EmailCardOptions = {}): string {
  return props
    .map((p) => {
      const spec = [
        p.bedrooms != null ? `${p.bedrooms} beds` : null,
        p.bathrooms != null ? `${p.bathrooms} baths` : null,
        p.interior_size != null ? `${Math.round(p.interior_size)} m²` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      return [
        `${p.name}${p.area ? ` — ${p.area}` : ''}`,
        `${formatPrice(p).replace('&nbsp;', ' ')}${spec ? ` · ${spec}` : ''}`,
        propertyUrl(p, opts),
      ].join('\n');
    })
    .join('\n\n');
}
