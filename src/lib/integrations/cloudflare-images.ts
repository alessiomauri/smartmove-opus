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
 * Purge cached images for a property/development. Called by the cleanse job
 * (SMARTMOVE_BRIEF §3.7) when a property is removed from the Resales feed.
 *
 * Requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID server-side.
 */
export async function purgeImages(kind: ImageKind, id: string | number): Promise<void> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zone || !WORKER_URL) {
    throw new Error('Cloudflare credentials not configured');
  }
  // Purge the Worker URL prefix so cached image variants flush.
  const prefix = `${WORKER_URL}/${kind}/${id}/`;
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: [prefix] }),
  });
  if (!res.ok) {
    throw new Error(`Cloudflare purge ${res.status}: ${await res.text()}`);
  }
}
