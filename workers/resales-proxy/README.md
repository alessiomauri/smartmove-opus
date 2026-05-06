# Resales Proxy Worker

Cloudflare Worker that proxies Resales Online V6 API calls. Holds `p1` + `p2`
credentials server-side and gives us a stable egress IP for Resales' whitelist.

## Setup

```bash
cd workers/resales-proxy
npm install

# Auth (one-time)
npx wrangler login

# Set secrets (one-time, replace placeholders)
echo "<YOUR_P1>" | npx wrangler secret put RESALES_P1
echo "<YOUR_P2>" | npx wrangler secret put RESALES_P2
echo "$(openssl rand -hex 32)" | npx wrangler secret put RESALES_PROXY_SECRET

# Deploy
npm run deploy
```

After deploy, the Worker URL is `https://smartmove-resales-proxy.<account>.workers.dev`.
Drop that into the Next.js app's `RESALES_PROXY_URL` env var, and the same
`RESALES_PROXY_SECRET` value into `RESALES_PROXY_SECRET` (server-only).

## Egress IP for Resales whitelist

Cloudflare Workers don't get a single static IP — Resales should whitelist
the documented Cloudflare egress range OR Resales accepts the Worker's
hostname / a Cloudflare-issued static IP (paid feature). Confirm with Resales
which approach they support.

## Allowed endpoints

`SearchProperties`, `PropertyDetails`, `SearchFeatures`, `SearchLocations`,
`SearchPropertyTypes`, `FeaturedProperties`. Anything else returns 403.

`RegisterLead` is **deliberately excluded**. Smartmove's lead pipeline lives
inside our own infra (local DB + Monday CRM only — see SMARTMOVE_BRIEF §4.5).
Do not add it.

## Local dev

```bash
npm run dev
# Worker runs at http://127.0.0.1:8787
# Set RESALES_P1, RESALES_P2, RESALES_PROXY_SECRET in .dev.vars (gitignored)
```
