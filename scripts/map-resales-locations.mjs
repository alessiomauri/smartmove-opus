/**
 * Location auto-mapping — proposes a parent area for every distinct
 * Resales (Location, SubLocation) pair in the synced data
 * (SMARTMOVE_NEXT_PROMPTS "LOCATION NESTING", decided 10 Jun).
 *
 * Run: npx tsx scripts/map-resales-locations.mjs [--dry-run]
 * Needs .env.local: Supabase service role + RESALES_PROXY_URL/SECRET.
 *
 * Passes:
 *  1. NAME MATCH (free): normalized (lowercase, accent-stripped)
 *     compare against our curated area names AND slugs.
 *       - SubLocation match beats Location match (more specific:
 *         "Marbella / Elviria" → elviria, not marbella).
 *       - A pair WITH a sublocation whose sub doesn't match falls to
 *         the geo pass first — its Location name match ("Marbella")
 *         is kept as a COARSE fallback (confidence medium), so the
 *         specific area wins when geo can find one.
 *  2. GEO EVIDENCE: the spec's first choice — median GpsX/GpsY of the
 *     pair's own listings — is EMPIRICALLY UNAVAILABLE: synced rows
 *     carry no coordinates (SearchProperties never returns them) and a
 *     1,039-call PropertyDetails sweep (P_ShowGPSCoords=TRUE) returned
 *     GPS for OWN listings only — zero fixes across all MLS rows; the
 *     official SearchLocations taxonomy is flat (no parents). So the
 *     geo evidence comes from geocoding the location NAME via OSM
 *     Nominatim (1 req/s per usage policy, viewbox-bounded to the
 *     Costa del Sol, results outside it discarded), then assigning the
 *     nearest of our area centroids (areas.coordinates_lat/lng),
 *     recording the distance. match_method='geocode' keeps the
 *     provenance reviewable.
 *       confidence: <2 km high · 2–5 km medium · >5 km low ·
 *       geocode miss → coarse Location-name fallback (medium) or
 *       unmapped. Inland villages land low/unmapped BY DESIGN — they
 *       genuinely sit outside the 44 coastal areas and must not nest
 *       under one falsely.
 *
 * Output:
 *  - upserts into resales_location_mapping (re-runs refresh evidence
 *    but NEVER overwrite a row an admin already approved/edited);
 *    high-confidence proposals are approved=true by default.
 *  - CSV report sorted by confidence ascending (unmapped → low →
 *    medium → high) so review starts at the rows that need a human:
 *    ~/Desktop/smartmove-web-briefs/resales-location-mapping-report.csv
 *
 * Nothing user-facing changes — the display switch and admin editor
 * are Prompts 3/5.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as dotenv } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
dotenv({ path: resolve(here, '../.env.local'), quiet: true });

const { createClient } = await import('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const csvPath = resolve(here, '../../smartmove-web-briefs/resales-location-mapping-report.csv');

// Nominatim usage policy: max 1 req/s, identifying User-Agent.
const NOMINATIM_UA = 'smartmove-marbella-location-mapper/1.0 (one-off; alessio.mauri030702@gmail.com)';
// Costa del Sol + immediate hinterland; geocode hits outside are
// treated as misses (wrong-town matches must not map to an area).
const VIEWBOX = { west: -5.75, south: 36.15, east: -3.95, north: 36.95 };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ───────────────────────────────────────── helpers

/** Accent-stripped, lowercased, single-spaced — "Benahavís" ≡ "benahavis". */
function norm(s) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Great-circle distance in km. */
function haversineKm(lat1, lng1, lat2, lng2) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

// ───────────────────────────────────────── 1. load areas + listings

const { data: areas, error: areasErr } = await supabase
  .from('areas')
  .select('name, slug, coordinates_lat, coordinates_lng')
  .order('slug');
if (areasErr) throw new Error(`areas: ${areasErr.message}`);
console.log(`${areas.length} curated areas loaded (all with centroids: ${areas.every((a) => a.coordinates_lat != null && a.coordinates_lng != null)})`);

// normalized name AND slug → slug
const areaLookup = new Map();
for (const a of areas) {
  areaLookup.set(norm(a.name), a.slug);
  areaLookup.set(norm(a.slug), a.slug);
}

/**
 * Exact normalized match, with one safe fallback: a leading English
 * article — "The Golden Mile" ≡ "Golden Mile". Spanish articles are
 * NOT stripped ("La Quinta" must never match a hypothetical "Quinta").
 */
function nameMatch(candidate) {
  const n = norm(candidate);
  if (!n) return undefined;
  return areaLookup.get(n) ?? (n.startsWith('the ') ? areaLookup.get(n.slice(4)) : undefined);
}

async function loadRows(table) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select('source_id, location, area')
      .eq('source', 'resales_online')
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const rows = [...(await loadRows('properties')), ...(await loadRows('developments'))];

/**
 * Reconstruct the raw (Location, SubLocation) pair from our columns:
 * the mapper stored location = "Location, SubLocation" (or the bare
 * Location / Area fallback) and area = Location.
 */
const pairs = new Map(); // "loc|sub" → { location, sublocation, refs: [], count }
let skippedEmpty = 0;
for (const r of rows) {
  const loc = (r.area ?? '').trim();
  if (!loc) {
    skippedEmpty += 1;
    continue;
  }
  const full = (r.location ?? '').trim();
  let sub = full.startsWith(`${loc}, `) ? full.slice(loc.length + 2).trim() : '';
  // Some feed rows repeat the Location as its own SubLocation
  // ("La Cala de Mijas, La Cala de Mijas") — collapse into the bare pair.
  if (norm(sub) === norm(loc)) sub = '';
  const key = `${loc}|${sub}`;
  const entry = pairs.get(key) ?? { location: loc, sublocation: sub, count: 0 };
  entry.count += 1;
  pairs.set(key, entry);
}
console.log(`${rows.length} synced rows → ${pairs.size} distinct (Location, SubLocation) pairs (${skippedEmpty} rows with no location skipped)`);

// ───────────────────────────────────────── 2. pass 1: name match

const proposals = []; // {location, sublocation, slug, confidence, method, listing_count, gps_listing_count, median_km}
const needGeo = [];

for (const entry of pairs.values()) {
  const subSlug = entry.sublocation ? nameMatch(entry.sublocation) : undefined;
  const locSlug = nameMatch(entry.location);

  if (subSlug) {
    proposals.push({ ...entry, slug: subSlug, confidence: 'high', method: 'name:sublocation', gps: 0, medianKm: null });
  } else if (!entry.sublocation && locSlug) {
    proposals.push({ ...entry, slug: locSlug, confidence: 'high', method: 'name:location', gps: 0, medianKm: null });
  } else {
    // No name match — or only a COARSE one (pair has a sublocation we
    // don't know; its bare Location may still match). Geo gets first go.
    needGeo.push({ entry, coarseSlug: locSlug ?? null });
  }
}
console.log(`pass 1 (name): ${proposals.length} matched high · ${needGeo.length} pairs → geocode pass (≤${needGeo.length} Nominatim calls at 1 req/s)`);

// ───────────────────────────────────────── 3. pass 2: geocode evidence

const geocodeCache = new Map(); // query → {lat, lng} | null
let geoCalls = 0;
let consecutiveHttpErrors = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Nominatim lookup biased to (and bounded by) the Costa del Sol. */
async function geocode(query) {
  if (geocodeCache.has(query)) return geocodeCache.get(query);
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'es');
  url.searchParams.set('viewbox', `${VIEWBOX.west},${VIEWBOX.north},${VIEWBOX.east},${VIEWBOX.south}`);
  url.searchParams.set('bounded', '0'); // prefer the box; validate below
  let hit = null;
  try {
    if (geoCalls > 0) await sleep(1100); // ≤1 req/s, always
    const res = await fetch(url, {
      headers: { 'User-Agent': NOMINATIM_UA },
      signal: AbortSignal.timeout(15_000),
    });
    geoCalls += 1;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    consecutiveHttpErrors = 0;
    const body = await res.json();
    const first = Array.isArray(body) ? body[0] : null;
    if (first) {
      const lat = Number(first.lat);
      const lng = Number(first.lon);
      const inBox =
        lat >= VIEWBOX.south && lat <= VIEWBOX.north && lng >= VIEWBOX.west && lng <= VIEWBOX.east;
      // A match outside the coast is a wrong-town hit — treat as miss.
      if (Number.isFinite(lat) && Number.isFinite(lng) && inBox) hit = { lat, lng };
    }
  } catch (e) {
    consecutiveHttpErrors += 1;
    if (consecutiveHttpErrors >= 5) {
      throw new Error(`5 consecutive Nominatim failures (last: ${e.message}) — aborting; re-run later, upserts are idempotent`);
    }
  }
  geocodeCache.set(query, hit);
  return hit;
}

for (const [i, { entry, coarseSlug }] of needGeo.entries()) {
  // Most specific name first; add context so "El Faro" finds the coast,
  // not a lighthouse in Galicia. Last resort drops the province — the
  // west end of the coast (Sotogrande, La Alcaidesa) is CÁDIZ, so a
  // "Málaga" context makes Nominatim miss it; the viewbox check still
  // rejects anything actually outside the coast.
  const target = entry.sublocation || entry.location;
  const context = entry.sublocation ? `${entry.location}, ` : '';
  const fix =
    (await geocode(`${target}, ${context}Málaga, Spain`)) ??
    (await geocode(`${target}, Costa del Sol, Spain`)) ??
    (await geocode(`${target}, Spain`));

  let result = null; // {slug, km}
  if (fix) {
    let best = null;
    for (const a of areas) {
      const km = haversineKm(fix.lat, fix.lng, a.coordinates_lat, a.coordinates_lng);
      if (!best || km < best.km) best = { slug: a.slug, km };
    }
    result = best;
  }

  const geoTier =
    result == null ? null : result.km < 2 ? 'high' : result.km <= 5 ? 'medium' : 'low';

  if (geoTier === 'high' || geoTier === 'medium') {
    proposals.push({ ...entry, slug: result.slug, confidence: geoTier, method: 'geocode', gps: 1, medianKm: result.km });
  } else if (coarseSlug) {
    // Weak/no geocode, but the bare Location IS one of our areas —
    // coarse parent beats a >5km guess. Evidence still recorded.
    proposals.push({ ...entry, slug: coarseSlug, confidence: 'medium', method: 'name:location', gps: fix ? 1 : 0, medianKm: result?.km ?? null });
  } else if (geoTier === 'low') {
    proposals.push({ ...entry, slug: result.slug, confidence: 'low', method: 'geocode', gps: 1, medianKm: result.km });
  } else {
    proposals.push({ ...entry, slug: null, confidence: 'unmapped', method: null, gps: 0, medianKm: null });
  }

  if ((i + 1) % 25 === 0) console.log(`  geocode: ${i + 1}/${needGeo.length} pairs (${geoCalls} calls)`);
}
console.log(`pass 2 (geocode): done — ${geoCalls} Nominatim calls`);

// ───────────────────────────────────────── 4. upsert (admin edits win)

const { data: existing, error: exErr } = await supabase
  .from('resales_location_mapping')
  .select('location, sublocation, approved, proposed_area_slug, confidence, match_method');
if (exErr && !DRY_RUN) throw new Error(`existing mappings: ${exErr.message}`);
const existingByKey = new Map((existing ?? []).map((e) => [`${e.location}|${e.sublocation}`, e]));

const stamp = new Date().toISOString();
const upserts = proposals.map((p) => {
  const prior = existingByKey.get(`${p.location}|${p.sublocation}`);
  const keepAdmin = prior?.approved === true; // never clobber a reviewed row
  return {
    location: p.location,
    sublocation: p.sublocation,
    proposed_area_slug: keepAdmin ? prior.proposed_area_slug : p.slug,
    confidence: keepAdmin ? prior.confidence : p.confidence,
    match_method: keepAdmin ? prior.match_method : p.method,
    listing_count: p.count,
    gps_listing_count: p.gps,
    median_distance_km: p.medianKm == null ? null : Math.round(p.medianKm * 100) / 100,
    approved: keepAdmin ? true : p.confidence === 'high',
    updated_at: stamp,
  };
});

if (!DRY_RUN) {
  for (let i = 0; i < upserts.length; i += 500) {
    const { error } = await supabase
      .from('resales_location_mapping')
      .upsert(upserts.slice(i, i + 500), { onConflict: 'location,sublocation' });
    if (error) throw new Error(`upsert: ${error.message}`);
  }
  console.log(`${upserts.length} mappings upserted (admin-approved rows preserved: ${[...existingByKey.values()].filter((e) => e.approved).length})`);

  // Pairs that no longer exist in the data (e.g. the collapsed
  // "X / X" duplicates) — drop them unless an admin approved them.
  const currentKeys = new Set(upserts.map((u) => `${u.location}|${u.sublocation}`));
  const stale = (existing ?? []).filter(
    (e) => !currentKeys.has(`${e.location}|${e.sublocation}`) && !e.approved
  );
  for (const e of stale) {
    await supabase
      .from('resales_location_mapping')
      .delete()
      .eq('location', e.location)
      .eq('sublocation', e.sublocation)
      .eq('approved', false);
  }
  if (stale.length) console.log(`${stale.length} stale unapproved rows removed`);
} else {
  console.log(`[dry-run] would upsert ${upserts.length} mappings`);
}

// ───────────────────────────────────────── 5. CSV report + summary

const TIER_ORDER = { unmapped: 0, low: 1, medium: 2, high: 3 };
const sorted = [...upserts].sort(
  (a, b) =>
    TIER_ORDER[a.confidence] - TIER_ORDER[b.confidence] ||
    b.listing_count - a.listing_count ||
    a.location.localeCompare(b.location)
);
const csv = [
  'confidence,approved,location,sublocation,proposed_area_slug,match_method,listings,gps_fixes,median_km',
  ...sorted.map((r) =>
    [r.confidence, r.approved, r.location, r.sublocation, r.proposed_area_slug ?? '', r.match_method ?? '', r.listing_count, r.gps_listing_count, r.median_distance_km ?? '']
      .map(csvCell)
      .join(',')
  ),
].join('\n');
await writeFile(csvPath, csv + '\n');

const tally = { high: 0, medium: 0, low: 0, unmapped: 0 };
const listings = { high: 0, medium: 0, low: 0, unmapped: 0 };
for (const r of upserts) {
  tally[r.confidence] += 1;
  listings[r.confidence] += r.listing_count;
}
console.log('\n═══ SUMMARY ═══');
for (const tier of ['high', 'medium', 'low', 'unmapped']) {
  console.log(`${tier.padEnd(8)} ${String(tally[tier]).padStart(4)} locations  (${listings[tier]} listings)`);
}
console.log(`review queue (medium+low+unmapped): ${tally.medium + tally.low + tally.unmapped} rows`);
console.log(`CSV: ${csvPath}`);

// Spot-checks requested in the brief. 'Lomas de Marbella Club' may not
// exist as a feed Location/SubLocation — fall back to other Golden Mile
// identifiers so the golden-mile assignment is still exercised.
const fmt = (l) =>
  `(${l.location}${l.sublocation ? ' / ' + l.sublocation : ''}) → ${l.proposed_area_slug ?? '∅'} [${l.confidence}, ${l.match_method ?? '—'}${l.median_distance_km != null ? `, ${l.median_distance_km}km` : ''}]`;
const spot = (label, pred) => {
  const hits = upserts.filter(pred);
  console.log(`spot-check ${label}: ${hits.length ? hits.map(fmt).join(' · ') : 'pair not present in synced data'}`);
};
spot('Lomas de Marbella Club', (u) => norm(`${u.location} ${u.sublocation}`).includes('lomas de marbella'));
spot('Milla de oro / Golden Mile', (u) => /milla de oro|golden mile/.test(norm(`${u.location} ${u.sublocation}`)));
spot('Nagüeles (Golden Mile back-hill)', (u) => norm(`${u.location} ${u.sublocation}`).includes('nagueles'));
