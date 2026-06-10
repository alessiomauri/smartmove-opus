# smartmove-map-tiles

Cloudflare Worker that serves vector tiles out of a Protomaps PMTiles
archive stored in R2. Range-reads the archive on the fly; finished tile
responses are edge-cached so repeat hits skip R2 entirely.

## Routes

```
GET /{archive}/{z}/{x}/{y}.mvt
```

Where `{archive}` is the filename of the archive in R2 minus the
`.pmtiles` suffix. Allowed archive names are pinned via the
`ALLOWED_ARCHIVES` env var in `wrangler.toml` — anything not on that
list returns 403.

## Layout

- `src/index.ts` — request handler + R2 source adapter for the pmtiles
  JS library
- `wrangler.toml` — bucket binding + allowed archive list

## Setup

```bash
# 1. Bucket already created via `wrangler r2 bucket create smartmove-map-tiles`.
# 2. Upload the extract:
wrangler r2 object put smartmove-map-tiles/costa-del-sol.pmtiles \
  --file=/path/to/costa-del-sol.pmtiles \
  --content-type=application/octet-stream \
  --remote

# 3. Install local deps + deploy:
cd workers/protomaps-tiles
npm install
npx wrangler deploy
```

After deploy, the worker URL is printed (something like
`https://smartmove-map-tiles.<account>.workers.dev`). Set that as
`PROTOMAPS_TILES_URL` in `src/lib/map-style.ts`.

## Refreshing the basemap

Protomaps publishes a new daily build of the planet. To refresh:

```bash
/tmp/pmtiles-bin/pmtiles extract \
  "https://build.protomaps.com/$(date -u +%Y%m%d).pmtiles" \
  ./costa-del-sol.pmtiles \
  --bbox=-5.55,36.20,-4.20,36.85 \
  --maxzoom=14

wrangler r2 object put smartmove-map-tiles/costa-del-sol.pmtiles \
  --file=./costa-del-sol.pmtiles \
  --content-type=application/octet-stream \
  --remote
```

Tiles are edge-cached with `Cache-Control: max-age=86400, immutable` —
after a refresh, tiles already in the edge cache will continue to serve
the old data for up to 24h. To force-purge, bump the path in the client
(e.g. add a `?v=2026-06-10` query string when building the style URL)
so the cache keys differ.
