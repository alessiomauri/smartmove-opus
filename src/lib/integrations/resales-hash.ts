/**
 * Content hashing + watermark math for the Resales delta sync.
 *
 * Pure module (no DB, no fetch) so the whole thing is testable against
 * the saved samples — see scripts/test-resales-sync.mjs.
 *
 * The hash answers one question: "did the FEED CONTENT of this row
 * change since we last wrote it?" Volatile fields (timestamps the sync
 * itself stamps) and derived fields (hero_image depends on the proxy
 * env var, content_hash is the output) are excluded, as are the
 * admin-owned flags — an admin approving a listing must not make the
 * row look "changed" to the next sync.
 */

import { createHash } from 'node:crypto';

/**
 * Fields excluded from the hash input:
 *  - last_synced_at / content_hash : volatile / self-referential
 *  - hero_image                    : derived from NEXT_PUBLIC_IMAGE_PROXY_URL —
 *                                    an env change must not dirty 50k rows
 *  - pending_review / published / rejected / hide_price_drop:
 *                                    admin-owned state, not feed content
 */
export const HASH_EXCLUDED_FIELDS: ReadonlySet<string> = new Set([
  'last_synced_at',
  'content_hash',
  'hero_image',
  'pending_review',
  'published',
  'rejected',
  'hide_price_drop',
]);

/**
 * Fields the sync must NEVER write when UPDATING an existing row.
 *
 *  - pending_review / published / rejected / hide_price_drop:
 *      admin decisions (approve, publish, reject, hide badge). The old
 *      blind upsert reset an approved MLS listing to pending+unpublished
 *      every time anything about it changed upstream.
 *  - slug: the public URL. Once a row exists its slug is identity —
 *      a feed-side rename must not 404 an indexed page.
 *  - price_drop_at / removed_at: maintained by dedicated logic, not the
 *      generic field copy.
 */
export const SYNC_PROTECTED_FIELDS: ReadonlySet<string> = new Set([
  'pending_review',
  'published',
  'rejected',
  'hide_price_drop',
  'slug',
  'price_drop_at',
  'removed_at',
]);

/** Deterministic JSON: objects get sorted keys, recursively. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    // undefined values disappear in JSON.stringify — mirror that so
    // `{a: undefined}` and `{}` hash identically.
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

/** Strip excluded fields, then hash the stable serialization. */
export function hashContent(row: Record<string, unknown>): string {
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!HASH_EXCLUDED_FIELDS.has(k)) filtered[k] = v;
  }
  return createHash('sha256').update(stableStringify(filtered)).digest('hex');
}

/** Remove sync-protected fields from an UPDATE payload. */
export function stripProtectedFields<T extends Record<string, unknown>>(
  row: T
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!SYNC_PROTECTED_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

// ─────────────────────────────────────────────── watermark math

/**
 * Resales `LastUpdated` format: 'YYYY-MM-DD HH:MM:SS' (assumed UTC; the
 * comparison only ever happens against other values from the same feed,
 * so the absolute timezone doesn't matter — ordering does).
 * Lexicographic comparison on this format IS chronological comparison.
 */
const WATERMARK_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export function isValidWatermark(v: unknown): v is string {
  return typeof v === 'string' && WATERMARK_RE.test(v);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatWatermark(d: Date): string {
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

/**
 * watermark − overlap. The 10-minute default absorbs clock skew between
 * Resales' LastUpdated stamps and the moment our walk observed them;
 * hashing makes the re-processed overlap rows free (skip, no write).
 */
export function subtractOverlap(watermark: string, overlapSeconds = 600): string {
  if (!isValidWatermark(watermark)) {
    throw new Error(`Invalid watermark: ${watermark}`);
  }
  const d = new Date(watermark.replace(' ', 'T') + 'Z');
  d.setUTCSeconds(d.getUTCSeconds() - overlapSeconds);
  return formatWatermark(d);
}

/** max(a, b) for watermark strings; handles null/undefined gracefully. */
export function maxWatermark(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}
