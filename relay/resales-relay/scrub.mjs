/**
 * Credential scrubbing — JS port of workers/resales-proxy/src/scrub.ts.
 *
 * KEEP IN SYNC with the worker module: the parity suite in
 * workers/resales-proxy/test-scrub.mjs runs the identical assertions
 * against BOTH implementations.
 *
 * Resales error envelopes echo the request's p1/p2 back in clear text
 * under `parsedparameters` (probe finding 2026-06-10) — every response
 * body passes through here before leaving the relay.
 */

const REDACTED = '[redacted]';
const SENSITIVE_KEYS = new Set(['p1', 'p2']);

function redactKeysDeep(node) {
  if (Array.isArray(node)) return node.map(redactKeysDeep);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? REDACTED : redactKeysDeep(v);
    }
    return out;
  }
  return node;
}

/**
 * Scrub a response body. `secrets` are the live credential values; any
 * occurrence of them is removed even outside known key names.
 */
export function scrubCredentials(body, secrets) {
  let text = body;

  // Pass 1: literal secret values, anywhere.
  for (const s of secrets) {
    if (s && s.length >= 4) {
      text = text.split(s).join(REDACTED);
    }
  }

  // Pass 2: key-based, for any JSON payload that mentions p1/p2 keys.
  if (/"p[12]"\s*:/i.test(text)) {
    try {
      text = JSON.stringify(redactKeysDeep(JSON.parse(text)));
    } catch {
      // Not valid JSON — the value pass already ran; return as-is.
    }
  }

  return text;
}
