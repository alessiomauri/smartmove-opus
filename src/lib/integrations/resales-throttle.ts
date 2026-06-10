/**
 * Adaptive throttle for Resales API calls.
 *
 * Resales support (10 Jun 2026): no hard rate limits — they monitor for
 * "unusual or high activity" and contact the account owner. The goal is
 * therefore to never look unusual: a steady, boring ~2–3 req/s with no
 * bursts, slowing down on any sign of trouble.
 *
 *  - Paced: minimum interval between calls = 1000 / RESALES_REQS_PER_SEC
 *    (default 2.5 req/s), with ±20% jitter so the traffic doesn't look
 *    machine-gun regular.
 *  - Backoff: retryable failures (HTTP 429/5xx, network errors, Resales'
 *    own `transaction.status === 'error'` envelope) retry with
 *    exponential backoff + jitter, up to RESALES_MAX_RETRIES (default 4).
 *  - Env-tunable without redeploys of logic: RESALES_REQS_PER_SEC,
 *    RESALES_MAX_RETRIES.
 */

export interface ThrottleOptions {
  requestsPerSecond?: number;
  maxRetries?: number;
  /** Base backoff in ms (doubles per attempt). */
  backoffBaseMs?: number;
}

export interface Throttle {
  /** Resolve when it's polite to fire the next request. */
  pace(): Promise<void>;
  /** Run fn with pacing + retry/backoff. Throws after maxRetries. */
  run<T>(label: string, fn: () => Promise<T>): Promise<T>;
  /** Total upstream calls attempted (including retries). */
  readonly apiCalls: number;
}

/** Errors worth retrying: transient network/server trouble, not 4xx logic bugs. */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    // resales.ts throws `Resales <endpoint> <status>: <body>`
    const m = err.message.match(/\b(\d{3})\b/);
    if (m) {
      const status = Number(m[1]);
      if (status === 429 || status >= 500) return true;
      if (status >= 400) return false;
    }
    // AbortSignal.timeout → TimeoutError; fetch network failures → TypeError
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return true;
    if (err.name === 'TypeError') return true;
    if (/transaction.*error/i.test(err.message)) return true;
  }
  return true; // unknown shapes: retry (bounded by maxRetries anyway)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createThrottle(opts: ThrottleOptions = {}): Throttle {
  const rps =
    opts.requestsPerSecond ??
    (Number(process.env.RESALES_REQS_PER_SEC || '') || 2.5);
  const maxRetries =
    opts.maxRetries ??
    (Number(process.env.RESALES_MAX_RETRIES || '') || 4);
  const backoffBaseMs = opts.backoffBaseMs ?? 1500;
  const intervalMs = 1000 / Math.max(0.1, rps);

  let lastCallAt = 0;
  let apiCalls = 0;

  async function pace(): Promise<void> {
    const jitter = 0.8 + Math.random() * 0.4; // ±20%
    const wait = lastCallAt + intervalMs * jitter - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
  }

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    while (true) {
      await pace();
      apiCalls += 1;
      try {
        return await fn();
      } catch (err) {
        attempt += 1;
        if (attempt > maxRetries || !isRetryableError(err)) throw err;
        const backoff =
          backoffBaseMs * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5);
        console.warn(
          `[resales-throttle] ${label} attempt ${attempt}/${maxRetries} failed, backing off ${Math.round(backoff)}ms:`,
          err instanceof Error ? err.message : err
        );
        await sleep(backoff);
      }
    }
  }

  return {
    pace,
    run,
    get apiCalls() {
      return apiCalls;
    },
  };
}
