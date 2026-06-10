/**
 * Credential scrubbing for Resales responses.
 *
 * Probe finding (2026-06-10, RESALES_API_GAPS.md): when
 * `transaction.status === 'error'`, Resales echoes the request's query
 * params back under `parsedparameters` — INCLUDING `p1` and `p2` in
 * clear text. Without scrubbing, the proxy would hand the credentials
 * to every caller that triggers an error (and into any log that
 * captures response bodies).
 *
 * Two passes, both applied to every JSON body we return:
 *   1. VALUE pass: every occurrence of the actual secret strings is
 *      replaced, wherever it appears.
 *   2. KEY pass: any `"p1"` / `"p2"` members anywhere in the JSON tree
 *      are overwritten — covers upstream echoing a *different* value
 *      (e.g. when the caller smuggled their own p1/p2 params).
 *
 * Pure module (no Workers types) so it's unit-testable with node.
 */

const REDACTED = '[redacted]';
const SENSITIVE_KEYS = new Set(['p1', 'p2']);

function redactKeysDeep(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(redactKeysDeep);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
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
export function scrubCredentials(body: string, secrets: string[]): string {
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
