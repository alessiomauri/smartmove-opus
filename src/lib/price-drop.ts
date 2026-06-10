/**
 * Price-drop badge gating (RESALES_SYNC_PROMPT Phase 3).
 *
 * The sync maintains `price_drop_at` (stamped on a price DECREASE,
 * cleared on an increase). Whether the public UI may surface that fact
 * is gated twice:
 *
 *   1. Site-wide: `site_settings.show_price_drop_badges` — default OFF.
 *   2. Per listing: `properties.hide_price_drop` — admin-owned; the
 *      sync never writes it (SYNC_PROTECTED_FIELDS).
 *
 * `price_drop` is only ever computed server-side via these helpers, so
 * a listing with the badge suppressed never even hints at it in the
 * payload. The same gate applies to any future price-drop alert emails.
 */

export const PRICE_DROP_WINDOW_DAYS = 30;

export interface PriceDropFields {
  price_drop_at?: string | null;
  hide_price_drop?: boolean | null;
}

export function isPriceDropVisible(
  row: PriceDropFields,
  showBadgesSiteWide: boolean,
  nowMs: number = Date.now()
): boolean {
  if (!showBadgesSiteWide) return false;
  if (row.hide_price_drop) return false;
  if (!row.price_drop_at) return false;
  const droppedAt = Date.parse(row.price_drop_at);
  if (Number.isNaN(droppedAt)) return false;
  return nowMs - droppedAt <= PRICE_DROP_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/** Attach the computed flag to a list of rows. */
export function withPriceDropFlag<T extends PriceDropFields>(
  rows: T[],
  showBadgesSiteWide: boolean
): Array<T & { price_drop: boolean }> {
  const now = Date.now();
  return rows.map((r) => ({
    ...r,
    price_drop: isPriceDropVisible(r, showBadgesSiteWide, now),
  }));
}
