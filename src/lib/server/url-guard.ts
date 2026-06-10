/**
 * SSRF guard for admin routes that fetch user-supplied URLs server-side
 * (/api/admin/scrape, /api/admin/import-images).
 *
 * These routes are auth-gated, but defense-in-depth matters: a fetched
 * URL must never be able to reach cloud metadata endpoints, localhost,
 * or anything on a private network — an admin pasting a malicious link
 * (or a stolen admin session) shouldn't turn the Vercel function into
 * an internal-network probe.
 *
 * Hostname-level checks only — we don't resolve DNS here (Vercel
 * functions can't pin the resolved IP for fetch anyway). Literal IPs,
 * localhost aliases, and known metadata hosts are rejected; everything
 * else must be a public https/http hostname.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
]);

/** RFC1918 / loopback / link-local / CGN / metadata IPv4 ranges. */
function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254
  if (a === 100 && b >= 64 && b <= 127) return true; // CGN
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    h === '::1' ||
    h === '::' ||
    h.startsWith('fe80:') || // link-local
    h.startsWith('fc') || // unique-local fc00::/7
    h.startsWith('fd') ||
    h.startsWith('::ffff:') // v4-mapped — could smuggle a private v4
  );
}

/**
 * Returns null if the URL is safe to fetch server-side, otherwise a
 * human-readable rejection reason.
 */
export function validateExternalUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'Invalid URL';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'Only http(s) URLs are allowed';
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return 'Host not allowed';
  if (host.endsWith('.internal') || host.endsWith('.local')) return 'Host not allowed';
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) return 'Private addresses are not allowed';
  if (!host.includes('.')) return 'Host not allowed'; // bare hostnames (intranet)
  return null;
}
