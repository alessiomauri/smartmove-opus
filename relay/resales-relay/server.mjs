/**
 * Resales fixed-IP relay — minimal plain-node port of the Cloudflare
 * proxy worker (workers/resales-proxy), per SMARTMOVE_BRIEF Q1 Phase 2.
 *
 * Why it exists: Resales whitelists exactly ONE static IP per key (no
 * ranges, no Workers accommodation — support, 2026-06-10). Cloudflare
 * Workers egress from a shared pool, so the key's whitelist points at
 * this VPS instead and the app talks to this relay.
 *
 * Behavioural contract (identical to the worker):
 *   - Inbound auth: `x-smartmove-secret` must equal RESALES_PROXY_SECRET
 *   - Endpoint allowlist (ALLOWED_ENDPOINTS, never RegisterLead)
 *   - Outbound: appends ?p1&p2&P_sandbox to the upstream call
 *   - Every response body is credential-scrubbed (scrub.mjs) — Resales
 *     error envelopes echo p1/p2 in clear text
 *   - Never logs upstream URLs or response bodies (both can carry creds)
 *   - GET /healthz: unauthenticated liveness (no secrets in output)
 *
 * Runs as a non-root systemd service behind Caddy (TLS). Binds
 * localhost only — Caddy is the sole public entry.
 *
 * Zero npm dependencies: node:http + global fetch (node ≥ 18).
 */

import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const HOST = '127.0.0.1';

const {
  RESALES_P1,
  RESALES_P2,
  RESALES_PROXY_SECRET,
  RESALES_BASE = 'https://webapi.resales-online.com/V6',
  RESALES_SANDBOX = 'true',
  ALLOWED_ENDPOINTS = 'SearchProperties,PropertyDetails,SearchFeatures,SearchLocations,SearchPropertyTypes,FeaturedProperties',
} = process.env;

if (!RESALES_P1 || !RESALES_P2 || !RESALES_PROXY_SECRET) {
  console.error('Missing RESALES_P1 / RESALES_P2 / RESALES_PROXY_SECRET in environment');
  process.exit(1);
}

const { scrubCredentials } = await import('./scrub.mjs');
const allowed = new Set(ALLOWED_ENDPOINTS.split(',').map((s) => s.trim()).filter(Boolean));
const startedAt = Date.now();

/** Constant-time-ish secret comparison (length leak is acceptable). */
function secretMatches(provided) {
  if (typeof provided !== 'string' || provided.length !== RESALES_PROXY_SECRET.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ RESALES_PROXY_SECRET.charCodeAt(i);
  }
  return diff === 0;
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, {
    'content-type': type,
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'x-smartmove-secret, content-type',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (req.method === 'OPTIONS') return send(res, 204, '');

    if (req.method === 'GET' && url.pathname === '/healthz') {
      return send(
        res,
        200,
        JSON.stringify({
          ok: true,
          sandbox: RESALES_SANDBOX === 'true',
          uptime_s: Math.round((Date.now() - startedAt) / 1000),
        })
      );
    }

    if (req.method !== 'GET') return send(res, 405, 'Method not allowed', 'text/plain');

    // Inbound auth
    if (!secretMatches(req.headers['x-smartmove-secret'])) {
      return send(res, 401, 'Unauthorized', 'text/plain');
    }

    const endpoint = url.pathname.replace(/^\/+/, '').split('/')[0];
    if (!endpoint || !allowed.has(endpoint)) {
      return send(res, 403, `Endpoint not allowed: ${endpoint}`, 'text/plain');
    }

    // Build upstream URL with credentials injected.
    // NOTE: never log `upstream` — it carries p1/p2 in the query string.
    const upstream = new URL(`${RESALES_BASE}/${endpoint}`);
    for (const [k, v] of url.searchParams.entries()) {
      upstream.searchParams.set(k, v);
    }
    upstream.searchParams.set('p1', RESALES_P1);
    upstream.searchParams.set('p2', RESALES_P2);
    upstream.searchParams.set('P_sandbox', RESALES_SANDBOX);

    let upstreamRes;
    try {
      upstreamRes = await fetch(upstream, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      // Generic — no detail that could carry the credentialed URL.
      return send(res, 502, 'Upstream unreachable', 'text/plain');
    }

    const raw = await upstreamRes.text();
    const body = scrubCredentials(raw, [RESALES_P1, RESALES_P2]);
    return send(
      res,
      upstreamRes.status,
      body,
      upstreamRes.headers.get('content-type') ?? 'application/json'
    );
  } catch (e) {
    // Catch-all: message only, never request/upstream detail.
    console.error('relay error:', e instanceof Error ? e.message : 'unknown');
    return send(res, 500, 'Internal error', 'text/plain');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`resales-relay listening on ${HOST}:${PORT} (sandbox=${RESALES_SANDBOX})`);
});
