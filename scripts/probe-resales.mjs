/**
 * Empirical Resales API probe — answers the open questions in
 * RESALES_API_GAPS.md with real captures, via the proxy Worker
 * (credentials never appear here or in any output).
 *
 * Run: npx tsx scripts/probe-resales.mjs
 * Needs in .env.local: RESALES_PROXY_URL, RESALES_PROXY_SECRET
 *
 * Probes:
 *   (a) error response body shape  — one deliberately invalid request
 *   (b) P_QueryId TTL              — page 2 retries at +1/5/15/30/60 min
 *                                    (single run with sleeps — leave it running)
 *   (c) image URL stability        — same image twice + cache-buster strip,
 *                                    SHA-256 compared (direct media fetch,
 *                                    works even while the API is IP-blocked)
 *   (d) fresh samples              — SearchFeatures + one full new-development
 *                                    PropertyDetails → resales-samples/
 *
 * Pacing: max 1 request / 2 seconds (reuses the app's throttle module).
 * Findings are APPENDED to RESALES_API_GAPS.md as they complete, so a
 * killed run still leaves everything it learned.
 */
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as dotenv } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
dotenv({ path: resolve(here, '../.env.local'), quiet: true });

const { createThrottle } = await import('../src/lib/integrations/resales-throttle.ts');
const { scrubCredentials } = await import('../workers/resales-proxy/src/scrub.ts');

const briefsDir = resolve(here, '../../smartmove-web-briefs');
const gapsDoc = resolve(briefsDir, 'RESALES_API_GAPS.md');
const samplesDir = resolve(briefsDir, 'resales-samples');

/**
 * --direct: bypass the proxy Worker and call the Resales API straight
 * from this machine (whose IP IS whitelisted), reading p1/p2 from
 * workers/resales-proxy/.dev.vars. Credentials are scrubbed from every
 * recorded/saved byte. Used while the Worker-egress IP question is open.
 */
const DIRECT = process.argv.includes('--direct');
const RESALES_BASE = 'https://webapi.resales-online.com/V6';

let CREDS = null;
if (DIRECT) {
  const devVars = await readFile(resolve(here, '../workers/resales-proxy/.dev.vars'), 'utf8');
  const pick = (k) => devVars.match(new RegExp(`^${k}=\\s*"?([^"\\n]+)"?`, 'm'))?.[1]?.trim();
  CREDS = { p1: pick('RESALES_P1'), p2: pick('RESALES_P2') };
  if (!CREDS.p1 || !CREDS.p2) {
    console.error('RESALES_P1 / RESALES_P2 missing in workers/resales-proxy/.dev.vars');
    process.exit(1);
  }
  console.log(`Mode: DIRECT (p1 ends …${CREDS.p1.slice(-3)}, sandbox=true)`);
} else {
  console.log('Mode: via proxy Worker');
}

const PROXY = process.env.RESALES_PROXY_URL?.replace(/\/$/, '');
const SECRET = process.env.RESALES_PROXY_SECRET;
if (!DIRECT && (!PROXY || !SECRET)) {
  console.error('RESALES_PROXY_URL / RESALES_PROXY_SECRET missing in .env.local');
  process.exit(1);
}

/** Remove credential values from anything we print, record, or save. */
function scrub(text) {
  return CREDS ? scrubCredentials(text, [CREDS.p1, CREDS.p2]) : text;
}

// Max 1 req / 2 s, jittered — boring traffic only.
const throttle = createThrottle({ requestsPerSecond: 0.5 });

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
let sectionOpened = false;
async function recordFinding(title, body) {
  if (!sectionOpened) {
    await appendFile(
      gapsDoc,
      `\n\n---\n\n## Probe findings — ${stamp} UTC (scripts/probe-resales.mjs, sandbox, ${DIRECT ? 'DIRECT from whitelisted IP' : 'via Worker proxy'})\n`
    );
    sectionOpened = true;
  }
  await appendFile(gapsDoc, `\n### ${title}\n\n${body}\n`);
  console.log(`\n■ recorded: ${title}`);
}

async function api(endpoint, params = {}) {
  const url = new URL(DIRECT ? `${RESALES_BASE}/${endpoint}` : `${PROXY}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  if (DIRECT) {
    url.searchParams.set('p1', CREDS.p1);
    url.searchParams.set('p2', CREDS.p2);
    url.searchParams.set('P_sandbox', 'true');
  }
  return throttle.run(endpoint, async () => {
    const res = await fetch(url, {
      headers: DIRECT ? { Accept: 'application/json' } : { 'x-smartmove-secret': SECRET },
      signal: AbortSignal.timeout(30_000),
    });
    // Scrub at the boundary — nothing downstream ever sees credentials.
    const text = scrub(await res.text());
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON body */ }
    return { status: res.status, json, text };
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => createHash('sha256').update(Buffer.from(buf)).digest('hex');

function fence(obj) {
  return '```json\n' + JSON.stringify(obj, null, 2).slice(0, 2500) + '\n```';
}

// ─────────────────────────────────────────── preflight
console.log(`Preflight: minimal SearchProperties ${DIRECT ? 'DIRECT against Resales' : 'through the proxy'}…`);
const pre = await api('SearchProperties', { p_agency_filterid: 1, P_PageSize: 1 });
const preErr = pre.json?.transaction?.status === 'error';
const errCodes = preErr ? Object.keys(pre.json.transaction.errordescription ?? {}) : [];
const ipBlocked = errCodes.includes('001');

if (preErr) {
  // The failed preflight IS an error-shape capture — record it as (a).
  await recordFinding(
    '(a) Error response body shape — CONFIRMED',
    [
      'HTTP status stays **200** even for errors — the failure signal is `transaction.status === "error"`.',
      'Multiple simultaneous validation failures come back as a code-keyed map `transaction.errordescription`',
      '(e.g. `001` IP mismatch, `002` p1/p2 missing, `003` FilterId missing, `099` not authorised, `102` P2 not valid, `103` FilterAgencyId not valid).',
      '`QueryInfo` and `Property` are ABSENT on error responses — parsers must not assume they exist.',
      '⚠️ `parsedparameters` **echoes p1/p2 back in clear text** — error bodies leak credentials, one more reason all calls go through the Worker and error bodies must never be logged verbatim to client-visible surfaces.',
      '',
      'Captured response:',
      fence(pre.json),
    ].join('\n')
  );
}

if (ipBlocked) {
  await recordFinding(
    '⛔ Probe blocked: IP whitelisting is ACTIVE (checklist item confirmed empirically)',
    [
      'Error `001: "the IP does not match with your API key"` — the Cloudflare Worker egress IP is not whitelisted for the sandbox key',
      '(Workers egress from a shared IP **pool**, exactly the risk flagged in the checklist). Also `102: "P2 not valid"` — the documented',
      'sandbox p2 may have rotated since the 2026-05-06 captures.',
      '',
      '**Action (user):** ask Resales support how they handle Cloudflare Workers egress (IP pool, not a single IP) and/or issue fresh',
      'sandbox credentials reachable from Workers. Fallback per brief Q1: a tiny fixed-IP relay (€4 VPS) between Worker and Resales.',
      '',
      'Probes (b) P_QueryId TTL and (d) fresh samples are blocked until then. Re-run this script once credentials work — it detects',
      'success automatically and completes the remaining probes.',
    ].join('\n')
  );
  console.log('\n⛔ API blocked by IP whitelist — continuing with probe (c) only (direct media fetch needs no creds).');
} else if (!preErr) {
  console.log('Preflight OK — full probe running.');
  if (DIRECT) {
    await recordFinding(
      '✅ Key validity (direct, whitelisted IP)',
      `New production key authenticates against sandbox: \`transaction.status: success\`, ` +
      `PropertyCount=${pre.json?.QueryInfo?.PropertyCount}, QueryId issued. ` +
      `(The same key through the Worker proxy still returns 001 — Worker egress remains un-whitelisted; known state.)`
    );
  }
}

// ─────────────────────────────────────────── (a) deliberate invalid request
if (!preErr) {
  const bad = await api('PropertyDetails', { p_agency_filterid: 1, P_RefId: 'RTHIS-DOES-NOT-EXIST' });
  await recordFinding(
    '(a) Error response body shape — deliberate invalid P_RefId',
    [
      `HTTP ${bad.status}; \`transaction.status\`: \`${bad.json?.transaction?.status}\`.`,
      'Captured response:',
      fence(bad.json ?? bad.text),
    ].join('\n')
  );
}

// ─────────────────────────────────────────── (4) watermark dry-run (direct only)
if (DIRECT && !preErr) {
  console.log('\nLeg (4): incremental-sync DRY RUN against live sandbox (no table writes)…');
  const { runResalesSync } = await import('../src/lib/integrations/resales-sync.ts');
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Bare fetcher (no api() wrapper) — the orchestrator's own throttle
  // paces it; sharing the script's throttle keeps GLOBAL pacing ≤0.5rps.
  const directFetchPage = async ({ page, queryId, pageSize }) => {
    const url = new URL(`${RESALES_BASE}/SearchProperties`);
    url.searchParams.set('p_agency_filterid', '1');
    url.searchParams.set('P_PageSize', String(pageSize));
    if (page) url.searchParams.set('P_PageNo', String(page));
    if (queryId) url.searchParams.set('P_QueryId', queryId);
    url.searchParams.set('p_SortType', '3');
    url.searchParams.set('p_ShowLastUpdateDate', 'true');
    url.searchParams.set('p1', CREDS.p1);
    url.searchParams.set('p2', CREDS.p2);
    url.searchParams.set('P_sandbox', 'true');
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
    const env = JSON.parse(scrub(await res.text()));
    if (env.transaction?.status === 'error') {
      throw new Error(`Resales transaction error: ${JSON.stringify(env.transaction.errordescription ?? {})}`);
    }
    const total = env.QueryInfo.PropertyCount;
    const perPage = env.QueryInfo.PropertiesPerPage || pageSize;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    return {
      properties: env.Property ?? [],
      totalCount: total,
      queryId: env.QueryInfo.QueryId || null,
      done: page >= totalPages || (env.Property ?? []).length === 0,
    };
  };

  const report = await runResalesSync({
    supabase,
    trigger: 'probe',
    fetchPage: directFetchPage,
    pageSize: 50,
    maxPages: 5,
    useWatermark: true,   // exercise read + advance logic
    dryRun: true,         // …but persist nothing except the sync_runs row
    throttle,             // shared pacing with the rest of the probe
  });

  const wmOk = report.status === 'success' && report.watermarkAfter && report.watermarkAfter !== report.watermarkBefore;
  await recordFinding(
    '(4) Watermark seeding against real LastUpdated values — DRY RUN ' + (wmOk ? '✅' : '⚠️'),
    [
      `Live sandbox walk (sorted LastUpdated DESC, dry run — zero table writes, run logged as trigger='probe'):`,
      '',
      `| metric | value |`,
      `|---|---|`,
      `| status | ${report.status} |`,
      `| pages / rows seen | ${report.pagesWalked} / ${report.rowsSeen} |`,
      `| would insert / update / skip | ${report.rowsInserted} / ${report.rowsUpdated} / ${report.rowsSkippedUnchanged} |`,
      `| watermark before | ${report.watermarkBefore ?? '∅ (none persisted yet)'} |`,
      `| watermark WOULD seed to | ${report.watermarkAfter ?? '∅'} |`,
      '',
      wmOk
        ? 'LastUpdated is present on live rows, the max extracts correctly, and a successful run would persist it — the acceptance criterion the samples couldn\'t cover. ✓'
        : 'Watermark did not advance — inspect the report above (errors / partial cap / missing LastUpdated).',
      report.errors.length ? `Errors: ${report.errors.join('; ')}` : '',
    ].filter(Boolean).join('\n')
  );
  console.log(`  dry-run: ${report.status}, seen ${report.rowsSeen}, watermark → ${report.watermarkAfter}`);
}

// ─────────────────────────────────────────── (c) image URL stability
if (!DIRECT) {
  console.log('\nProbe (c): image URL stability (direct media fetch)…');
  // Pull a known image URL from the saved samples — prefer the newer CDN
  // format, fall back to the ASP format.
  const sample = JSON.parse(await readFile(resolve(samplesDir, '01-search-default.json'), 'utf8'));
  const urls = (sample.Property ?? []).map((p) => p.MainImage).filter(Boolean);
  const target = urls[0];
  if (!target) {
    console.log('  no image URL in samples — skipped');
  } else {
    const fetchImg = (u) =>
      throttle.run('image', async () => {
        const res = await fetch(u, { signal: AbortSignal.timeout(30_000) });
        return { status: res.status, bytes: res.ok ? await res.arrayBuffer() : null, type: res.headers.get('content-type') };
      });

    const first = await fetchImg(target);
    const second = await fetchImg(target);
    const stripped = await fetchImg(target.replace(/[?&](z|v)=\d+/g, '').replace(/[?&]$/, ''));
    const rebusted = await fetchImg(
      target.replace(/([?&])(z|v)=\d+/, (_, sep, k) => `${sep}${k}=${Math.floor(Date.now() / 1000)}`)
    );

    const h = (r) => (r.bytes ? sha256(r.bytes).slice(0, 16) : `HTTP ${r.status}`);
    const lines = [
      `Test URL (from sample 01, captured 2026-05-06): \`${target.slice(0, 110)}…\``,
      '',
      '| Fetch | Result |',
      '|---|---|',
      `| same URL, fetch #1 | ${h(first)} (${first.type ?? '—'}) |`,
      `| same URL, fetch #2 | ${h(second)} |`,
      `| cache-buster STRIPPED | ${h(stripped)} |`,
      `| cache-buster REPLACED with current ts | ${h(rebusted)} |`,
      '',
      first.bytes && second.bytes
        ? `Same-URL refetch is ${h(first) === h(second) ? '**byte-stable** ✓' : '**NOT byte-stable** ⚠️'}.`
        : 'Same-URL refetch could not be compared (non-200).',
      first.bytes && stripped.bytes
        ? `Stripping the \`z=\`/\`v=\` cache-buster returns ${h(first) === h(stripped) ? '**identical bytes** ✓ — safe to strip for R2 keying (as the pipeline already does)' : 'DIFFERENT bytes ⚠️ — buster must be preserved'}.`
        : `Stripped-buster fetch: HTTP ${stripped.status} — ${stripped.status === 200 ? '' : 'the ASP endpoint may REQUIRE the buster param'}.`,
      first.bytes && rebusted.bytes
        ? `A rotated buster returns ${h(first) === h(rebusted) ? 'identical bytes ✓ (buster is pure cache-bust)' : 'different bytes ⚠️'}.`
        : '',
    ].filter(Boolean);

    await recordFinding('(c) Image URL stability', lines.join('\n'));
  }
}

// ─────────────────────────────────────────── blocked? stop here
if (ipBlocked || preErr) {
  console.log('\nDone (partial — API-side probes pending credential/IP fix).');
  process.exit(0);
}

// ─────────────────────────────────────────── (d) fresh samples
{
  console.log('\nProbe (d): fresh samples…');
  const feats = await api('SearchFeatures', { p_agency_filterid: 1, P_Lang: 1 });
  if (feats.json) {
    await writeFile(
      resolve(samplesDir, '11-search-features.json'),
      JSON.stringify({ _metadata: { captured: stamp, via: 'probe-resales.mjs (sandbox)' }, ...feats.json }, null, 2)
    );
    await recordFinding('(d) SearchFeatures sample — CAPTURED', 'Saved to `resales-samples/11-search-features.json`. Top-level keys: ' + Object.keys(feats.json).join(', '));
  }

  // Find a new development, then pull its full multi-lang details.
  const devs = await api('SearchProperties', { p_agency_filterid: 1, P_PageSize: 10, P_New_Devs: 'true' });
  const devRef = (devs.json?.Property ?? []).find((p) => p?.PropertyType?.NameType === 'New Development')?.Reference
    ?? (devs.json?.Property ?? [])[0]?.Reference;
  if (devRef) {
    const full = await api('PropertyDetails', {
      p_agency_filterid: 1, P_RefId: devRef, P_Lang: '1,2', P_ShowGPSCoords: 'TRUE', P_showdecree218: 'YES',
    });
    if (full.json) {
      await writeFile(
        resolve(samplesDir, '12-property-details-new-dev-multilang.json'),
        JSON.stringify({ _metadata: { captured: stamp, reference: devRef, via: 'probe-resales.mjs (sandbox)' }, ...full.json }, null, 2)
      );
      await recordFinding('(d) New-development PropertyDetails sample — CAPTURED', `Reference \`${devRef}\`, EN+ES, GPS + Decree218 opted in. Saved to \`resales-samples/12-property-details-new-dev-multilang.json\`.`);
    }
  }
}

// ─────────────────────────────────────────── (b) P_QueryId TTL
{
  console.log('\nProbe (b): P_QueryId TTL — this leg takes ~61 minutes (sleeps between retries)…');
  const open = await api('SearchProperties', { p_agency_filterid: 1, P_PageSize: 5, p_SortType: 3, p_ShowLastUpdateDate: 'true' });
  const queryId = open.json?.QueryInfo?.QueryId;
  if (!queryId) {
    await recordFinding('(b) P_QueryId TTL — INCONCLUSIVE', 'Opening query returned no QueryId.');
  } else {
    const checkpoints = [1, 5, 15, 30, 60]; // minutes after open
    const results = [];
    const openedAt = Date.now();
    for (const min of checkpoints) {
      const wait = openedAt + min * 60_000 - Date.now();
      if (wait > 0) {
        console.log(`  sleeping until +${min}min…`);
        await sleep(wait);
      }
      const page2 = await api('SearchProperties', {
        p_agency_filterid: 1, P_QueryId: queryId, P_PageNo: 2, P_PageSize: 5,
      });
      const ok = page2.json?.transaction?.status === 'success' && (page2.json?.Property?.length ?? 0) > 0;
      const note = ok
        ? `alive (page 2: ${page2.json.Property.length} rows, CurrentPage=${page2.json.QueryInfo?.CurrentPage})`
        : `DEAD/EMPTY (status=${page2.json?.transaction?.status}, rows=${page2.json?.Property?.length ?? 'n/a'}, errors=${JSON.stringify(page2.json?.transaction?.errordescription ?? null)})`;
      results.push(`| +${min} min | ${note} |`);
      console.log(`  +${min}min → ${note}`);
      if (!ok) break; // TTL found — no point sleeping further
    }
    await recordFinding(
      '(b) P_QueryId TTL',
      ['| Retry after | Page-2 result |', '|---|---|', ...results, '', 'Sync implication: chunked walks resuming after longer gaps must expect a dead QueryId and restart from page 1 (the orchestrator already does; hash-skips make the re-walk cheap).'].join('\n')
    );
  }
}

console.log(`\nDone. API calls made: ${throttle.apiCalls}. Findings appended to RESALES_API_GAPS.md.`);
