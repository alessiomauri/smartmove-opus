/**
 * Image proxy Worker.
 *
 * URL pattern (the Next.js `<PropertyImage>` calls these):
 *   GET /p/{property_id}/{image_index}    — property image
 *   GET /d/{development_id}/{image_index}  — development image
 *
 * Flow:
 *   1. Check R2 for `<kind>/<id>/<index>.jpg`. Hit → serve.
 *   2. Miss → look up the source URL (KV or Supabase), fetch from Resales,
 *      store in R2, serve the bytes.
 *   3. Subsequent requests are R2 hits, edge-cached for one year.
 *
 * Recognises both Resales image URL formats (RESALES_API_REFERENCE §12):
 *   - Old ASP: https://media-webapi.resales-online.com/live/ShowImageXML.asp?...
 *   - New CDN: https://cdn.resales-online.com/public/<account>/properties/<SecId>/wN/<index>-<hash>.jpg
 *
 * Cache strategy:
 *   - Cache-Control: public, max-age=31536000, immutable
 *   - The `purgeImages()` helper in src/lib/integrations/cloudflare-images.ts
 *     issues a prefix purge when a property is removed from the Resales feed.
 */

export interface Env {
  IMAGES_BUCKET: R2Bucket;
  ALLOWED_ORIGINS: string;
  CF_IMAGES_DELIVERY: string;
  SOURCE_URLS?: KVNamespace;
  /** Set via wrangler secret. Used for the source URL lookup. */
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

const ROUTE_RE = /^\/(p|d)\/([\w-]+)\/(\d+)$/;

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method !== 'GET' && req.method !== 'OPTIONS' && req.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(req.url);
    const m = url.pathname.match(ROUTE_RE);
    if (!m) return new Response('Not found', { status: 404 });

    const [, kind, id, index] = m;
    const r2Key = `${kind}/${id}/${index}.jpg`;

    // 0. Edge cache. No-op on *.workers.dev (Cache API needs a zone),
    // but the moment the worker gets a custom domain every repeat hit
    // is served from the Cloudflare edge without invoking R2 at all.
    const cacheKey = new Request(url.toString(), { method: 'GET' });
    const edge = await caches.default.match(cacheKey);
    if (edge) return edge;

    // 1. R2 hit — honour conditional requests so Vercel's image
    // optimizer revalidations cost a 304 instead of a full body.
    const ifNoneMatch = req.headers.get('if-none-match');
    const cached = await env.IMAGES_BUCKET.get(r2Key);
    if (cached) {
      if (ifNoneMatch && ifNoneMatch === cached.httpEtag) {
        return new Response(null, { status: 304, headers: { etag: cached.httpEtag, ...corsHeaders() } });
      }
      const res = r2Response(cached);
      ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
      return res;
    }

    // 2. Miss — resolve source URL and fetch
    const sourceUrl = await resolveSourceUrl(kind, id, index, env);
    if (!sourceUrl) {
      // Negative-cache unknown ids briefly: a dead image URL in cached
      // HTML otherwise re-triggers a Supabase lookup on every load.
      const nf = new Response('Source URL unknown', {
        status: 404,
        headers: { 'cache-control': 'public, max-age=300' },
      });
      ctx.waitUntil(caches.default.put(cacheKey, nf.clone()));
      return nf;
    }
    if (!isOriginAllowed(sourceUrl, env)) {
      return new Response('Source origin not allowed', { status: 403 });
    }

    const upstream = await fetch(stripCacheBuster(sourceUrl));
    if (!upstream.ok) {
      return new Response(`Upstream ${upstream.status}`, {
        status: 502,
        headers: { 'cache-control': 'public, max-age=120' },
      });
    }

    // 3. Serve immediately; persist to R2 in the background. The R2 put
    // used to be awaited inline, delaying first byte by the full upload.
    const bytes = await upstream.arrayBuffer();
    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    ctx.waitUntil(
      env.IMAGES_BUCKET.put(r2Key, bytes, {
        httpMetadata: {
          contentType,
          cacheControl: 'public, max-age=31536000, immutable',
        },
      })
    );

    const res = new Response(bytes, {
      status: 200,
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=31536000, immutable',
        ...corsHeaders(),
      },
    });
    ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
    return res;
  },
};

async function resolveSourceUrl(
  kind: string,
  id: string,
  index: string,
  env: Env
): Promise<string | null> {
  // Preferred: KV-backed source URL map populated by the nightly Resales sync.
  if (env.SOURCE_URLS) {
    const v = await env.SOURCE_URLS.get(`${kind}/${id}/${index}`);
    if (v) return v;
  }
  // Fallback: Supabase REST PostgREST lookup. Reads source_image_urls[index]
  // from properties (kind='p') or developments (kind='d').
  // The id is matched against either the row id (UUID) or the source_id
  // (Resales Reference like R3479851) — the URL pattern lets the app pass
  // whichever it has.
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;

  const table = kind === 'p' ? 'properties' : 'developments';
  // Pick the filter column based on the id shape. UUIDs look like
  // 8-4-4-4-12 hex; Resales references are R<digits>; everything else is
  // assumed to be a slug.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const isResalesRef = /^R\d+$/i.test(id);
  const column = isUuid ? 'id' : isResalesRef ? 'source_id' : 'slug';
  const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}?select=source_image_urls&${column}=eq.${encodeURIComponent(id)}&limit=1`;

  try {
    const res = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ source_image_urls?: string[] | null }>;
    const arr = rows[0]?.source_image_urls;
    const idx = Number(index);
    if (!arr || !Number.isFinite(idx) || idx < 0 || idx >= arr.length) return null;
    return arr[idx] || null;
  } catch {
    return null;
  }
}

function isOriginAllowed(srcUrl: string, env: Env): boolean {
  try {
    const host = new URL(srcUrl).hostname;
    return (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).includes(host);
  } catch {
    return false;
  }
}

function stripCacheBuster(srcUrl: string): string {
  // Resales appends ?z=<ts> (old ASP format) or ?v=<ts> (new CDN format).
  return srcUrl.replace(/[?&](z|v)=\d+/g, '').replace(/[?&]$/, '');
}

function r2Response(obj: R2ObjectBody): Response {
  return new Response(obj.body, {
    status: 200,
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'image/jpeg',
      'cache-control': obj.httpMetadata?.cacheControl ?? 'public, max-age=31536000, immutable',
      etag: obj.httpEtag,
      ...corsHeaders(),
    },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  };
}
