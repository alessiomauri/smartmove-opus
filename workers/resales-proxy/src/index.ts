/**
 * Resales Online API proxy.
 *
 * The Worker holds the Resales `p1` + `p2` credentials and the sandbox toggle
 * server-side. The Next.js app calls this Worker; the Worker injects creds
 * and proxies to https://webapi.resales-online.com/V6/<endpoint>.
 *
 * Why this is non-negotiable:
 *   - Resales credentials sit in URL query params (RESALES_API_REFERENCE §2)
 *   - The Worker has a stable Cloudflare egress IP that Resales whitelists
 *   - Credentials never appear in browser network panels, server logs, or
 *     referrer headers
 *
 * Auth model:
 *   - Inbound: every request must carry `x-smartmove-secret: <RESALES_PROXY_SECRET>`
 *     matching the env secret. Anything else gets a 401
 *   - Outbound: Worker appends `?p1=...&p2=...&P_sandbox=...` to every Resales call
 *
 * Endpoint allow-list: `ALLOWED_ENDPOINTS` env (comma-separated). RegisterLead
 * is intentionally NOT in the list — Smartmove does not push leads to Resales.
 */

import { scrubCredentials } from './scrub';

export interface Env {
  RESALES_P1: string;
  RESALES_P2: string;
  RESALES_PROXY_SECRET: string;
  RESALES_BASE: string;
  RESALES_SANDBOX: string;
  ALLOWED_ENDPOINTS: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== 'GET' && req.method !== 'OPTIONS') {
      return new Response('Method not allowed', { status: 405 });
    }
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Inbound auth
    const secret = req.headers.get('x-smartmove-secret');
    if (!secret || secret !== env.RESALES_PROXY_SECRET) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders() });
    }

    const url = new URL(req.url);
    const endpoint = url.pathname.replace(/^\/+/, '').split('/')[0];
    const allowed = (env.ALLOWED_ENDPOINTS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!endpoint || !allowed.includes(endpoint)) {
      return new Response(`Endpoint not allowed: ${endpoint}`, { status: 403, headers: corsHeaders() });
    }

    // Build the upstream URL with credentials injected
    const upstream = new URL(`${env.RESALES_BASE}/${endpoint}`);
    for (const [k, v] of url.searchParams.entries()) {
      upstream.searchParams.set(k, v);
    }
    upstream.searchParams.set('p1', env.RESALES_P1);
    upstream.searchParams.set('p2', env.RESALES_P2);
    upstream.searchParams.set('P_sandbox', env.RESALES_SANDBOX);

    // NOTE: never log `upstream` (it carries p1/p2 in the query string).
    let upstreamRes: Response;
    try {
      upstreamRes = await fetch(upstream.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
    } catch {
      // Generic failure — deliberately no error detail that could carry
      // the credentialed URL.
      return new Response('Upstream unreachable', { status: 502, headers: corsHeaders() });
    }

    // Pass through body + content-type, but never leak upstream headers —
    // and scrub credentials: Resales error envelopes echo p1/p2 in clear
    // text under `parsedparameters` (probe finding, RESALES_API_GAPS.md).
    const raw = await upstreamRes.text();
    const body = scrubCredentials(raw, [env.RESALES_P1, env.RESALES_P2]);
    return new Response(body, {
      status: upstreamRes.status,
      headers: {
        'content-type': upstreamRes.headers.get('content-type') ?? 'application/json',
        ...corsHeaders(),
      },
    });
  },
};

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'x-smartmove-secret, content-type',
  };
}
