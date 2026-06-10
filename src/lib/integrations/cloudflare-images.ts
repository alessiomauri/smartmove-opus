/**
 * Cloudflare Images / R2 / Worker URL helpers.
 *
 * The Worker (`workers/image-proxy/`) sits in front of R2:
 *   - Recognises both Resales URL formats (older ASP `ShowImageXML.asp` and
 *     newer CDN `cdn.resales-online.com/.../wN/...`) — see RESALES_API_REFERENCE §12
 *   - On first miss: fetches the source image, stores in R2, serves via Cloudflare Images
 *   - Subsequent requests: served from R2 with edge caching
 *
 * This file builds the URLs the Next.js app uses. The Worker handles the rest.
 */

const WORKER_URL = process.env.NEXT_PUBLIC_IMAGE_PROXY_URL; // e.g. https://images.smartmove.live

export type ImageKind = 'p' | 'd'; // p = property, d = development

/**
 * Build the public URL for a property/development image. The first request
 * triggers the lazy R2 fill via the Worker; subsequent requests are R2 hits.
 *
 * @param kind  'p' for property, 'd' for development
 * @param id    The DB row id (or Resales Reference for resales-sourced rows)
 * @param index 0-based image index. 0 = main/hero, 1+ = gallery
 */
export function imageUrl(kind: ImageKind, id: string | number, index = 0): string {
  if (!WORKER_URL) {
    // Dev-only fallback: deterministic picsum so the UI works without the
    // Worker. In production a missing NEXT_PUBLIC_IMAGE_PROXY_URL is a
    // misconfiguration — fail loudly instead of shipping placeholder
    // photos on live property pages.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'NEXT_PUBLIC_IMAGE_PROXY_URL is not set — refusing to serve picsum placeholders in production'
      );
    }
    return `https://picsum.photos/seed/${kind}-${id}-${index}/1200/800`;
  }
  return `${WORKER_URL.replace(/\/$/, '')}/${kind}/${id}/${index}`;
}

/**
 * Purge stored + edge-cached images for a property/development. Called by
 * the sync when a row's image manifest changes, and by the weekly
 * reconciliation when a reference leaves the Resales feed entirely.
 *
 * Talks to the image worker's secret-gated DELETE path, which removes
 * every R2 object under `{kind}/{id}/` and evicts the edge cache. (The
 * previous implementation used the zone-level purge_cache API, which
 * never worked here: prefix purge is Enterprise-only, *.workers.dev
 * isn't in our zone, and the actual stale copies live in R2 — nothing
 * ever deleted them.)
 *
 * Returns true on success, false when purging isn't configured —
 * callers treat false as "skipped", not an error.
 */
export async function purgeImages(kind: ImageKind, id: string | number): Promise<boolean> {
  const secret = process.env.IMAGE_PROXY_PURGE_SECRET;
  if (!secret || !WORKER_URL) {
    console.warn('purgeImages skipped: IMAGE_PROXY_PURGE_SECRET / NEXT_PUBLIC_IMAGE_PROXY_URL not set');
    return false;
  }
  const res = await fetch(`${WORKER_URL.replace(/\/$/, '')}/${kind}/${id}`, {
    method: 'DELETE',
    headers: { 'x-purge-secret': secret },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Image purge ${res.status}: ${await res.text()}`);
  }
  return true;
}
