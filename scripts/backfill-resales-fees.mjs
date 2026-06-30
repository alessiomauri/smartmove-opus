#!/usr/bin/env node
/**
 * One-time (re-runnable) backfill of resales running-cost fees
 * (community_fees_year / ibi_fees_year / basura_tax_year).
 *
 * WHY: the nightly sync walks the bulk SearchProperties feed, which does NOT
 * carry the fee fields — they live only on PropertyDetails. So every synced
 * resales row has null fees. This script hydrates them out-of-band.
 *
 * DESIGN (matches the "protect fees, no nightly details" decision):
 *   - For each published resales ref: one PropertyDetails call → parse the 3
 *     fee fields (comma-aware, same as the production mapper's feeNum) → UPDATE
 *     ONLY those 3 columns. content_hash / last_synced_at are left untouched, so
 *     the search-sync still sees the row as "unchanged" and skips it (no churn,
 *     no mass re-hash). The 3 columns are in SYNC_PROTECTED_FIELDS, so even when
 *     a row legitimately changes upstream the nightly UPDATE can't wipe them.
 *   - Idempotent: writes only when the parsed value differs from the DB value;
 *     re-running is a no-op for already-correct rows.
 *   - Resumable: a cursor file records the last completed source_id; re-run
 *     continues after it. --reset starts over.
 *   - Throttled: adaptive delay with exponential backoff on errors/429 — gentle
 *     on the shared Resales proxy/key.
 *
 * Usage:
 *   node scripts/backfill-resales-fees.mjs --limit 30        # sample (Step-3 gate)
 *   node scripts/backfill-resales-fees.mjs                    # full run (await go)
 *   node scripts/backfill-resales-fees.mjs --reset            # restart from the top
 *   node scripts/backfill-resales-fees.mjs --refs R5125255,R5225707   # specific refs
 *   node scripts/backfill-resales-fees.mjs --dry-run          # report, write nothing
 *
 * Reads .env.local (clone DB + shared Resales proxy creds).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';

// ── args
const args = process.argv.slice(2);
const getFlag = (n) => args.includes(n);
const getOpt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const LIMIT = getOpt('--limit') ? parseInt(getOpt('--limit'), 10) : Infinity;
const RESET = getFlag('--reset');
const DRY = getFlag('--dry-run');
const ONLY_REFS = getOpt('--refs')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;
const CURSOR_FILE = getOpt('--cursor-file') ?? '.backfill-fees-cursor.txt';

// ── env
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const PROXY = env.RESALES_PROXY_URL.replace(/\/$/, '');
const SECRET = env.RESALES_PROXY_SECRET;

// ── same comma-aware parse as the production mapper's feeNum()
const feeNum = (v) => {
  if (v == null) return null;
  const s = String(v).trim().replace(/,/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

async function propertyDetails(ref) {
  const u = new URL(`${PROXY}/PropertyDetails`);
  u.searchParams.set('p_agency_filterid', '1');
  u.searchParams.set('P_RefId', ref);
  u.searchParams.set('P_Lang', '1,2');
  const r = await fetch(u, { headers: { 'x-smartmove-secret': SECRET }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`PropertyDetails ${ref} ${r.status}`);
  const j = await r.json();
  const p = Array.isArray(j.Property) ? j.Property[0] : j.Property;
  return p ?? null;
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function selectRefs() {
  if (ONLY_REFS) {
    const { data } = await sb.from('properties').select('source_id,community_fees_year,ibi_fees_year,basura_tax_year')
      .eq('source', 'resales_online').in('source_id', ONLY_REFS);
    return data ?? [];
  }
  let cursor = '';
  if (!RESET && existsSync(CURSOR_FILE)) cursor = readFileSync(CURSOR_FILE, 'utf8').trim();
  if (RESET && existsSync(CURSOR_FILE)) rmSync(CURSOR_FILE);
  const out = [];
  let after = cursor;
  while (out.length < LIMIT) {
    const pageSize = Math.min(500, (LIMIT === Infinity ? 500 : LIMIT - out.length));
    const { data, error } = await sb.from('properties')
      .select('source_id,community_fees_year,ibi_fees_year,basura_tax_year')
      .eq('source', 'resales_online').eq('published', true)
      .gt('source_id', after).order('source_id').limit(pageSize);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    after = data[data.length - 1].source_id;
    if (data.length < pageSize) break;
  }
  return out.slice(0, LIMIT === Infinity ? out.length : LIMIT);
}

async function main() {
  const rows = await selectRefs();
  console.log(`[backfill] ${rows.length} published resales refs to process${DRY ? ' (DRY RUN)' : ''}${ONLY_REFS ? ' (explicit refs)' : ` from cursor "${(!RESET && existsSync(CURSOR_FILE)) ? readFileSync(CURSOR_FILE, 'utf8').trim() : '(start)'}"`}`);
  let delay = 600; // adaptive base
  const stat = { processed: 0, updated: 0, unchanged: 0, noProperty: 0, errors: 0 };
  const changes = [];
  for (const row of rows) {
    const ref = row.source_id;
    let p = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try { p = await propertyDetails(ref); break; }
      catch (e) {
        stat.errors++;
        delay = Math.min(delay * 2, 8000); // backoff
        if (attempt === 3) { console.log(`  ${ref}  ERROR(give up): ${e.message}`); }
        await sleep(delay);
      }
    }
    stat.processed++;
    if (stat.processed % 200 === 0) console.log(`[backfill] ${stat.processed}/${rows.length} | updated=${stat.updated} unchanged=${stat.unchanged} no-prop=${stat.noProperty} err=${stat.errors} | cursor=${ref} delay=${delay}ms`);
    if (p === null) { stat.noProperty++; if (!ONLY_REFS) writeFileSync(CURSOR_FILE, ref); await sleep(delay); continue; }
    const next = { community_fees_year: feeNum(p.Community_Fees_Year), ibi_fees_year: feeNum(p.IBI_Fees_Year), basura_tax_year: feeNum(p.Basura_Tax_Year) };
    const changed = next.community_fees_year !== row.community_fees_year || next.ibi_fees_year !== row.ibi_fees_year || next.basura_tax_year !== row.basura_tax_year;
    if (changed) {
      if (!DRY) {
        const { error } = await sb.from('properties').update(next).eq('source', 'resales_online').eq('source_id', ref);
        if (error) { stat.errors++; console.log(`  ${ref}  DB ERROR: ${error.message}`); }
        else stat.updated++;
      } else stat.updated++;
      changes.push(`  ${ref}  comm ${row.community_fees_year}→${next.community_fees_year}  ibi ${row.ibi_fees_year}→${next.ibi_fees_year}  basura ${row.basura_tax_year}→${next.basura_tax_year}`);
    } else stat.unchanged++;
    if (!ONLY_REFS) writeFileSync(CURSOR_FILE, ref);
    delay = Math.max(550, delay - 50); // recover toward base on success
    await sleep(delay);
  }
  if (changes.length) { console.log('\n[backfill] changes:'); console.log(changes.join('\n')); }
  console.log(`\n[backfill] done: processed=${stat.processed} updated=${stat.updated} unchanged=${stat.unchanged} no-property=${stat.noProperty} errors=${stat.errors}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
