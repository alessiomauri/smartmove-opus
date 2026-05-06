# Image Proxy Worker

Cloudflare Worker that fronts an R2 bucket of property/development images.
First request lazily fetches from Resales' CDN, stores in R2, then serves
edge-cached for one year.

## Setup

```bash
cd workers/image-proxy
npm install

# Auth (one-time)
npx wrangler login

# Create the R2 bucket (one-time)
npx wrangler r2 bucket create smartmove-property-images

# Deploy
npm run deploy
```

After deploy, the public URL is `https://smartmove-image-proxy.<account>.workers.dev`.
Drop that into the Next.js app's `NEXT_PUBLIC_IMAGE_PROXY_URL` env var.

For a custom domain (e.g. `images.smartmove.live`), add a Workers Route in
the Cloudflare dashboard once your DNS zone is set up.

## URL pattern

- `GET /p/{property_id}/{image_index}` — property image (0 = main, 1+ = gallery)
- `GET /d/{development_id}/{image_index}` — development image

The Worker resolves the source URL via the `SOURCE_URLS` KV namespace
(populated by the nightly Resales sync). When KV isn't bound it falls back
to a Supabase RPC lookup (Phase 4 — TODO in `src/index.ts`).

## Allowed origins

`media-webapi.resales-online.com,cdn.resales-online.com,picsum.photos`. Add
more via `wrangler.toml` if needed (e.g. when a manual upload origin lands).

## Cleanse

The Next.js app's nightly cleanse job (Phase 4) calls `purgeImages(kind, id)`
in `src/lib/integrations/cloudflare-images.ts` to evict R2 + CDN cache for a
removed property. Deletes happen via the Cloudflare API, not the Worker.

## Local dev

```bash
npm run dev
# Worker runs at http://127.0.0.1:8787
# Local R2 binding via miniflare
```
