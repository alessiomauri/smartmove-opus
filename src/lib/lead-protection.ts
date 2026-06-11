/**
 * Anti-spam for the public lead endpoints. Three independent layers —
 * a bot has to beat all of them to create a row:
 *
 *  1. RATE LIMIT — Upstash sliding window per IP (default 5/min).
 *     Env-gated: without UPSTASH_REDIS_REST_URL/TOKEN (local dev) the
 *     limiter is skipped entirely, so `npm run dev` needs no Redis.
 *  2. HONEYPOT — a visually-hidden "company" input. Humans never see
 *     it; naive bots fill everything. Filled ⇒ pretend success (200),
 *     write nothing: the bot learns nothing from the response.
 *  3. MIN TIME-TO-SUBMIT — the form fetches a server-minted HMAC token
 *     on MOUNT (not at static render — these pages are ISR-cached, so
 *     a render-time stamp would be hours old and useless). A submit
 *     arriving <2s after the token was minted is no human: pretend
 *     success, write nothing. Missing/forged tokens are a hard 400.
 *
 * The token secret rides LEAD_FORM_SECRET, falling back to
 * SYNC_CRON_SECRET so production needs no new env var.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/** Hidden form field name. Looks legitimate to autofill bots. */
export const HONEYPOT_FIELD = 'company';

export const MIN_SUBMIT_MS = 2_000;
/** Tokens older than this are stale (page left open all day → refetch). */
export const MAX_TOKEN_AGE_MS = 6 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.LEAD_FORM_SECRET || process.env.SYNC_CRON_SECRET;
  if (!s) throw new Error('LEAD_FORM_SECRET / SYNC_CRON_SECRET not set');
  return s;
}

/** `<epoch-ms>.<hmac>` — stateless, verifiable, unforgeable. */
export function mintSubmitToken(now = Date.now()): string {
  const ts = String(now);
  const mac = createHmac('sha256', secret()).update(ts).digest('hex');
  return `${ts}.${mac}`;
}

export type TokenVerdict = 'ok' | 'too-fast' | 'invalid';

export function verifySubmitToken(token: unknown, now = Date.now()): TokenVerdict {
  if (typeof token !== 'string') return 'invalid';
  const dot = token.indexOf('.');
  if (dot <= 0) return 'invalid';
  const ts = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!/^\d{10,16}$/.test(ts) || !/^[0-9a-f]{64}$/.test(mac)) return 'invalid';
  const expected = createHmac('sha256', secret()).update(ts).digest('hex');
  const a = Buffer.from(mac, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return 'invalid';
  const age = now - Number(ts);
  if (age < 0 || age > MAX_TOKEN_AGE_MS) return 'invalid';
  if (age < MIN_SUBMIT_MS) return 'too-fast';
  return 'ok';
}

// ── Rate limiting ──

let limiter: Ratelimit | null | undefined;

/** Singleton sliding-window limiter; null when Upstash isn't configured. */
function getLimiter(): Ratelimit | null {
  if (limiter !== undefined) return limiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    limiter = null; // local dev / not yet provisioned — limit skipped
    return limiter;
  }
  const perMin = Number(process.env.LEADS_RATE_LIMIT_PER_MIN || '') || 5;
  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(perMin, '60 s'),
    prefix: 'leads-rl',
  });
  return limiter;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

/** True ⇒ over the limit (caller returns 429). Fails OPEN on Redis errors. */
export async function isRateLimited(req: Request, keySuffix = ''): Promise<boolean> {
  const rl = getLimiter();
  if (!rl) return false;
  try {
    const { success } = await rl.limit(clientIp(req) + keySuffix);
    return !success;
  } catch (e) {
    console.error('rate limiter unavailable (failing open):', e);
    return false;
  }
}
