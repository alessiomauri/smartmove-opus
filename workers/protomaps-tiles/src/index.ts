/**
 * smartmove-map-tiles
 *
 * Range-reads a PMTiles archive in R2 and serves individual vector tiles
 * over HTTP. The PMTiles directory is fetched on demand via byte-range
 * R2 reads (no full-file download), and finished tile responses are
 * edge-cached so subsequent hits skip the R2 round-trip entirely.
 *
 * Route shape:
 *   GET /{archive}/{z}/{x}/{y}.mvt
 *
 * Only archives whose filename appears in ALLOWED_ARCHIVES are served;
 * everything else returns 403. This keeps the bucket from being turned
 * into a generic file host.
 */
import { PMTiles, type Source, type RangeResponse, TileType, Compression, type Header } from 'pmtiles';

interface Env {
  TILES_BUCKET: R2Bucket;
  ALLOWED_ARCHIVES: string;
  ALLOWED_ORIGINS: string;
}

/**
 * Source adapter — gives the pmtiles JS library byte-range access to the
 * archive in R2. The library calls getBytes(offset, length) as it needs
 * header bytes, directory pages, and finally the tile slice.
 */
class R2Source implements Source {
  constructor(private readonly archiveName: string, private readonly bucket: R2Bucket) {}
  getKey(): string { return this.archiveName; }
  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    const obj = await this.bucket.get(this.archiveName, {
      range: { offset, length },
    });
    if (!obj) throw new Error(`Archive ${this.archiveName} not found in R2`);
    return {
      data: await obj.arrayBuffer(),
      etag: obj.httpEtag,
    };
  }
}

const TILE_PATTERN = /^\/([\w-]+)\/(\d+)\/(\d+)\/(\d+)\.mvt$/;

function corsHeaders(allowedOrigins: string, requestOrigin: string | null): Record<string, string> {
  const allowList = allowedOrigins
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin =
    allowList.length === 0
      ? '*'
      : requestOrigin && allowList.includes(requestOrigin)
        ? requestOrigin
        : allowList[0];
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function contentEncodingFor(compression: Compression): string | null {
  if (compression === Compression.None) return null;
  if (compression === Compression.Gzip) return 'gzip';
  if (compression === Compression.Brotli) return 'br';
  if (compression === Compression.Zstd) return 'zstd';
  return null;
}

function contentTypeFor(tileType: TileType): string {
  if (tileType === TileType.Mvt) return 'application/vnd.mapbox-vector-tile';
  if (tileType === TileType.Png) return 'image/png';
  if (tileType === TileType.Jpeg) return 'image/jpeg';
  if (tileType === TileType.Webp) return 'image/webp';
  if (tileType === TileType.Avif) return 'image/avif';
  return 'application/octet-stream';
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const cors = corsHeaders(env.ALLOWED_ORIGINS ?? '', req.headers.get('Origin'));

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    // Edge cache lookup — keyed by full URL, so each unique tile is its
    // own entry. PMTiles archives are immutable per upload, so the cache
    // never goes stale until the archive is replaced.
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) {
      const h = new Headers(cached.headers);
      for (const [k, v] of Object.entries(cors)) h.set(k, v);
      h.set('x-cache', 'HIT');
      return new Response(cached.body, { status: cached.status, headers: h });
    }

    const m = url.pathname.match(TILE_PATTERN);
    if (!m) {
      return new Response('Not found', { status: 404, headers: cors });
    }
    const [, archiveStem, zs, xs, ys] = m;
    const archive = `${archiveStem}.pmtiles`;

    const allowList = new Set(
      (env.ALLOWED_ARCHIVES ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    );
    if (!allowList.has(archive)) {
      return new Response(`Archive ${archive} not allowed`, { status: 403, headers: cors });
    }

    const z = parseInt(zs, 10);
    const x = parseInt(xs, 10);
    const y = parseInt(ys, 10);

    const p = new PMTiles(new R2Source(archive, env.TILES_BUCKET));

    let header: Header;
    try {
      header = await p.getHeader();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(`Archive read failed: ${msg}`, { status: 500, headers: cors });
    }

    if (z < header.minZoom || z > header.maxZoom) {
      // Outside the archive's zoom range — return 204 so MapLibre treats
      // it as "no data" and continues without spamming errors.
      const resp = new Response(null, {
        status: 204,
        headers: { ...cors, 'Cache-Control': 'public, max-age=86400', 'x-cache': 'MISS' },
      });
      ctx.waitUntil(cache.put(cacheKey, resp.clone()));
      return resp;
    }

    const tile = await p.getZxy(z, x, y);
    if (!tile) {
      const resp = new Response(null, {
        status: 204,
        headers: { ...cors, 'Cache-Control': 'public, max-age=86400', 'x-cache': 'MISS' },
      });
      ctx.waitUntil(cache.put(cacheKey, resp.clone()));
      return resp;
    }

    const respHeaders: Record<string, string> = {
      ...cors,
      'Content-Type': contentTypeFor(header.tileType),
      'Cache-Control': 'public, max-age=86400, immutable',
      ETag: `"${header.etag ?? `${archive}-${z}-${x}-${y}`}"`,
      'x-cache': 'MISS',
    };
    // PMTiles stores each tile pre-compressed (gzip by default). Pass the
    // raw bytes through with Content-Encoding so the browser decompresses —
    // cheaper than decompressing in the worker, and saves egress bytes.
    const enc = contentEncodingFor(header.tileCompression);
    if (enc) respHeaders['Content-Encoding'] = enc;

    const resp = new Response(tile.data, { status: 200, headers: respHeaders });
    ctx.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  },
};
