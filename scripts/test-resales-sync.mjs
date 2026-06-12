/**
 * Delta-sync logic tests — hashing, watermark math, batch planning,
 * reconciliation diff — run against the saved Resales samples.
 *
 * Run: `npx tsx scripts/test-resales-sync.mjs`
 *
 * These encode the spec's acceptance criteria at the planner level:
 *   - no upstream change  → zero inserts/updates (touch-only)
 *   - one price change    → exactly 1 update + exactly 1 price-history
 *   - admin flags         → never present in update payloads
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const samplesDir = resolve(here, '../../smartmove-web-briefs/resales-samples');

const { mapToRow, isSoldTail } = await import('../src/lib/integrations/resales-mapping.ts');
const {
  hashContent,
  stableStringify,
  stripProtectedFields,
  subtractOverlap,
  maxWatermark,
  SYNC_PROTECTED_FIELDS,
} = await import('../src/lib/integrations/resales-hash.ts');
const { planBatch } = await import('../src/lib/integrations/resales-sync.ts');
const { computeReconcileDiff } = await import('../src/lib/integrations/resales-reconcile.ts');

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures += 1;
    console.error('  ✗', msg);
  } else {
    console.log('  ✓', msg);
  }
}

async function loadSample(name) {
  return JSON.parse(await readFile(resolve(samplesDir, name), 'utf8'));
}

const search = await loadSample('01-search-default.json');
const soldTail = await loadSample('08-sold-property-tail.json');
const raw = search.Property[0];

// ───────────────────────────── 1. stable stringify + hash stability
console.log('\n— hash stability —');
{
  const a = { z: 1, a: [{ b: 2, a: 1 }], m: null };
  const b = { m: null, a: [{ a: 1, b: 2 }], z: 1 };
  assert(stableStringify(a) === stableStringify(b), 'key order does not change serialization');
  assert(
    stableStringify({ x: 1, y: undefined }) === stableStringify({ x: 1 }),
    'undefined values are dropped like JSON.stringify'
  );

  // Same property mapped twice (different wall-clock) → same hash,
  // because last_synced_at is excluded.
  const row1 = mapToRow(raw).row;
  await new Promise((r) => setTimeout(r, 15));
  const row2 = mapToRow(raw).row;
  assert(row1.last_synced_at !== row2.last_synced_at, 'precondition: timestamps differ');
  assert(hashContent(row1) === hashContent(row2), 'volatile last_synced_at excluded from hash');

  // ?v= / ?z= cache-busters on image URLs are stripped by the mapper →
  // same hash even when Resales rotates the buster.
  const busted = structuredClone(raw);
  busted.MainImage = `${raw.MainImage}${raw.MainImage.includes('?') ? '&' : '?'}v=99999999`;
  assert(
    hashContent(mapToRow(busted).row) === hashContent(row1),
    'image cache-buster rotation does not change the hash'
  );

  // A real content change does.
  const repriced = structuredClone(raw);
  repriced.Price = String(Number(raw.Price) + 50000);
  assert(hashContent(mapToRow(repriced).row) !== hashContent(row1), 'price change changes the hash');

  // Admin flags are not part of the hash.
  const flagged = { ...row1, pending_review: !row1.pending_review, published: !row1.published };
  assert(hashContent(flagged) === hashContent(row1), 'admin flags excluded from hash');
}

// ───────────────────────────── 2. protected-field stripping
console.log('\n— protected fields —');
{
  const row = mapToRow(raw).row;
  const stripped = stripProtectedFields({ ...row, rejected: false, hide_price_drop: true });
  for (const f of SYNC_PROTECTED_FIELDS) {
    assert(!(f in stripped), `update payload never carries '${f}'`);
  }
  assert('price' in stripped && 'name' in stripped, 'content fields survive stripping');
}

// ───────────────────────────── 3. watermark math
console.log('\n— watermark —');
{
  assert(subtractOverlap('2026-06-10 03:00:00', 600) === '2026-06-10 02:50:00', '10-min overlap');
  assert(subtractOverlap('2026-06-10 00:04:00', 600) === '2026-06-09 23:54:00', 'overlap across midnight');
  assert(maxWatermark('2026-06-10 03:00:00', '2026-06-09 12:00:00') === '2026-06-10 03:00:00', 'max picks newer');
  assert(maxWatermark(null, '2026-06-09 12:00:00') === '2026-06-09 12:00:00', 'max handles null');
}

// ───────────────────────────── 4. sold tail
console.log('\n— sold tail —');
{
  // Sample 08 is a docs-style capture: the row sits under
  // `_partial_property_object_when_sold.Property`.
  const tailRow = soldTail._partial_property_object_when_sold?.Property ?? soldTail.Property;
  assert(isSoldTail(tailRow), 'sample 08 detected as sold-tail');
  assert(!isSoldTail(raw), 'regular row is not sold-tail');
}

// ───────────────────────────── 5. planBatch — the acceptance criteria
console.log('\n— planBatch acceptance —');
{
  const entry = mapToRow(raw);
  const kind = entry.kind === 'development' ? 'd' : 'p';
  const row = entry.row;
  const hash = hashContent(row);
  const now = new Date().toISOString();
  const mapped = [{ kind, reference: raw.Reference, currency: raw.Currency ?? 'EUR', entry }];

  // (a) UNCHANGED: stored hash matches → zero writes, touch-only.
  const unchanged = planBatch(
    mapped,
    new Map([[`${kind}:${raw.Reference}`, {
      id: 'row-1', source_id: raw.Reference, content_hash: hash, rejected: false,
      price: row.price, status: row.status, source_image_urls: row.source_image_urls,
    }]]),
    now
  );
  assert(unchanged.inserts.length === 0 && unchanged.updates.length === 0,
    'no-change night → zero row writes');
  assert(unchanged.skippedUnchanged === 1 && unchanged.touchIds.properties.length === 1,
    'no-change night → batched last_synced_at touch only');

  // (b) PRICE DROP: exactly one update, one price change, drop stamped.
  const dropped = planBatch(
    mapped,
    new Map([[`${kind}:${raw.Reference}`, {
      id: 'row-1', source_id: raw.Reference, content_hash: 'stale-hash', rejected: false,
      price: row.price + 100000, status: row.status, source_image_urls: row.source_image_urls,
    }]]),
    now
  );
  assert(dropped.updates.length === 1, 'one changed row → exactly one update');
  assert(dropped.updates[0].priceChange?.old === row.price + 100000 &&
         dropped.updates[0].priceChange?.next === row.price,
    'price change captured old → new');
  assert(dropped.updates[0].payload.price_drop_at === now, 'price DECREASE stamps price_drop_at');
  for (const f of SYNC_PROTECTED_FIELDS) {
    assert(!(f in dropped.updates[0].payload) || f === 'price_drop_at',
      `update payload omits protected '${f}'`);
  }

  // (c) PRICE RISE: drop flag cleared.
  const risen = planBatch(
    mapped,
    new Map([[`${kind}:${raw.Reference}`, {
      id: 'row-1', source_id: raw.Reference, content_hash: 'stale-hash', rejected: false,
      price: row.price - 50000, status: row.status, source_image_urls: row.source_image_urls,
    }]]),
    now
  );
  assert(risen.updates[0].payload.price_drop_at === null, 'price INCREASE clears price_drop_at');

  // (d) NEW row → insert carrying its content hash.
  const fresh = planBatch(mapped, new Map(), now);
  assert(fresh.inserts.length === 1 && fresh.inserts[0].row.content_hash === hash,
    'unknown reference → one insert with content_hash');

  // (e) REJECTED rows are never re-introduced.
  const rejected = planBatch(
    mapped,
    new Map([[`${kind}:${raw.Reference}`, {
      id: 'row-1', source_id: raw.Reference, content_hash: 'whatever', rejected: true,
      price: null, status: null, source_image_urls: [],
    }]]),
    now
  );
  assert(rejected.updates.length === 0 && rejected.inserts.length === 0 && rejected.skippedRejected === 1,
    'rejected row → skipped entirely');

  // (f) Image manifest change detected.
  const manifested = planBatch(
    mapped,
    new Map([[`${kind}:${raw.Reference}`, {
      id: 'row-1', source_id: raw.Reference, content_hash: 'stale-hash', rejected: false,
      price: row.price, status: row.status, source_image_urls: ['https://old.example/1.jpg'],
    }]]),
    now
  );
  assert(manifested.updates[0].imagesChanged === true, 'manifest difference flags an image purge');
}

// ───────────────────────────── 6. own-vs-MLS split (filter membership)
console.log('\n— own-property detection (filter membership) —');
{
  const ownRefs = new Set([raw.Reference]);

  // Membership → auto-publish on insert.
  const own = mapToRow(raw, { autoApprove: ownRefs.has(raw.Reference) });
  assert(own.row.pending_review === false, 'own listing inserts with pending_review=false');
  assert(own.row.published === true, 'own listing inserts published (available status)');

  // Non-membership → MLS, pending review, unpublished.
  const mls = mapToRow(raw, { autoApprove: ownRefs.has('R-NOT-OURS') });
  assert(mls.row.pending_review === true, 'MLS listing inserts with pending_review=true');
  assert(mls.row.published === false, 'MLS listing inserts unpublished');

  // Membership overrides the per-row OwnProperty flag (untrusted).
  const flaggedOwn = structuredClone(raw);
  flaggedOwn.OwnProperty = '1';
  const overridden = mapToRow(flaggedOwn, { autoApprove: false });
  assert(overridden.row.pending_review === true,
    'filter membership OVERRIDES the OwnProperty field');

  // The split survives planBatch inserts (flags land on the insert rows).
  const splitPlan = planBatch(
    [
      { kind: 'p', reference: raw.Reference, currency: 'EUR', entry: own },
      { kind: 'p', reference: 'R-NOT-OURS', currency: 'EUR', entry: { kind: mls.kind, row: { ...mls.row, source_id: 'R-NOT-OURS', slug: 'mls-test' } } },
    ],
    new Map(),
    new Date().toISOString()
  );
  const ownInsert = splitPlan.inserts.find((i) => i.reference === raw.Reference);
  const mlsInsert = splitPlan.inserts.find((i) => i.reference === 'R-NOT-OURS');
  assert(ownInsert?.row.published === true && ownInsert?.row.pending_review === false,
    'planBatch insert carries own auto-publish flags');
  assert(mlsInsert?.row.published === false && mlsInsert?.row.pending_review === true,
    'planBatch insert carries MLS pending flags');
}

// ───────────────────────────── 7. curated-surface guard (featured)
console.log('\n— curation guard: featured is admin-owned —');
{
  // The mapper must never emit curation flags — inserts land on the DB
  // default (is_featured=false), keeping Resales rows off curated
  // surfaces until an admin whitelists them.
  const row = mapToRow(raw).row;
  assert(!('is_featured' in row) && !('featured_order' in row),
    'mapper emits no is_featured / featured_order');

  // Even if a future mapper change emitted them, updates must strip them.
  const stripped = stripProtectedFields({ ...row, is_featured: true, featured_order: 3 });
  assert(!('is_featured' in stripped) && !('featured_order' in stripped),
    'update payloads strip is_featured / featured_order');

  // Admin featuring a row must not dirty its hash (no phantom updates).
  const featuredCopy = { ...row, is_featured: true, featured_order: 1 };
  assert(hashContent(featuredCopy) === hashContent(row),
    'featuring a row does not change its content hash');
}

// ───────────────────────────── 8. reconciliation diff
console.log('\n— reconcile diff —');
{
  const now = new Date('2026-06-10T03:00:00Z');
  const fresh = '2026-06-09T00:00:00Z';     // seen yesterday
  const stale = '2026-05-01T00:00:00Z';     // last seen 40 days ago
  const db = [
    { id: '1', source_id: 'R1', last_synced_at: fresh, published: true,  removed_at: null, kind: 'p' },
    { id: '2', source_id: 'R2', last_synced_at: stale, published: true,  removed_at: null, kind: 'p' },
    { id: '3', source_id: 'R3', last_synced_at: stale, published: false, removed_at: '2026-05-20T00:00:00Z', kind: 'p' },
    { id: '4', source_id: 'R4', last_synced_at: stale, published: true,  removed_at: null, kind: 'd' },
  ];
  const live = new Set(['R1', 'R4', 'R9']);
  const diff = computeReconcileDiff(db, live, now);
  assert(diff.toRemove.length === 1 && diff.toRemove[0].source_id === 'R2',
    'absent + past 15-day tail + not already removed → removed');
  assert(!diff.toRemove.some((r) => r.source_id === 'R3'), 'already-removed rows are not re-removed');
  assert(!diff.toRemove.some((r) => r.source_id === 'R1'), 'recently-seen rows are protected by the tail');
  assert(diff.toIngest.length === 1 && diff.toIngest[0] === 'R9', 'live-but-unknown reference → ingest');
}

// ───────────────────────────── 9. publish gate (review-by-exception)
console.log('\n— publish gate —');
{
  const { evaluatePublishGate, mergeGateConfig, referenceNumber, DEFAULT_PUBLISH_GATE } =
    await import('../src/lib/integrations/resales-publish-gate.ts');

  const cfg = { ...DEFAULT_PUBLISH_GATE }; // 4 photos / 150k / desc / 4M ref / location
  const goodRow = {
    source_id: 'R5361961',
    price: 425_000,
    description: 'A lovely frontline-golf apartment.',
    location: 'Estepona',
    source_image_urls: ['1', '2', '3', '4'],
  };

  // Rule units — pass/fail boundaries.
  assert(evaluatePublishGate(goodRow, cfg).pass === true, 'clean row passes every rule');
  assert(evaluatePublishGate({ ...goodRow, source_image_urls: ['1', '2', '3'] }, cfg)
    .failures.includes('min_photos'), '3 photos < 4 → min_photos fails');
  assert(evaluatePublishGate({ ...goodRow, price: 149_999 }, cfg)
    .failures.includes('min_price'), '149,999 < 150k → min_price fails');
  assert(evaluatePublishGate({ ...goodRow, price: 150_000 }, cfg).pass === true,
    'exactly 150k passes (inclusive floor)');
  assert(evaluatePublishGate({ ...goodRow, price: null }, cfg)
    .failures.includes('min_price'), 'POA (null price) → min_price fails');
  assert(evaluatePublishGate({ ...goodRow, description: '  ' }, cfg)
    .failures.includes('require_description'), 'whitespace description fails');
  assert(evaluatePublishGate({ ...goodRow, location: '' }, cfg)
    .failures.includes('require_location'), 'empty location fails');
  assert(evaluatePublishGate({ ...goodRow, source_id: 'R3999999' }, cfg)
    .failures.includes('min_reference_number'), 'R3999999 < 4M floor → stale ref fails');
  assert(evaluatePublishGate({ ...goodRow, source_id: 'R4000000' }, cfg).pass === true,
    'R4000000 passes (inclusive floor)');
  assert(evaluatePublishGate({ ...goodRow, source_id: 'NO-DIGITS' }, cfg)
    .failures.includes('min_reference_number'), 'unparseable reference is held for review');
  assert(referenceNumber('R5361961') === 5361961 && referenceNumber('r123x') === 123,
    'referenceNumber parses the numeric part');
  const multi = evaluatePublishGate({ ...goodRow, price: 1000, source_image_urls: [] }, cfg);
  assert(multi.failures.length === 2 && multi.failures.includes('min_price') && multi.failures.includes('min_photos'),
    'multiple failures all recorded');

  // Config: partial JSONB merges over defaults; bad types/unknown keys ignored;
  // 0 disables a threshold rule.
  const merged = mergeGateConfig({ min_price: 200_000, bogus_key: true, min_photos: 'nope' });
  assert(merged.min_price === 200_000 && merged.min_photos === 4 && !('bogus_key' in merged),
    'mergeGateConfig: partial override, wrong types + unknown keys ignored');
  assert(evaluatePublishGate({ ...goodRow, source_id: 'R1' }, { ...cfg, min_reference_number: 0 }).pass === true,
    'threshold 0 disables a rule');

  // planBatch INSERT path: MLS passers publish, failers hold with reasons,
  // own rows bypass the gate entirely.
  const now = new Date().toISOString();
  const mlsPass = mapToRow(structuredClone(raw), { autoApprove: false });
  mlsPass.row.price = 425_000;
  mlsPass.row.source_id = 'R5361961';
  mlsPass.row.source_image_urls = ['1', '2', '3', '4'];
  mlsPass.row.description = 'desc';
  mlsPass.row.location = 'Estepona';

  const mlsFail = { kind: mlsPass.kind, row: { ...mlsPass.row, source_id: 'R5361962', slug: 'fail-row', price: 90_000, source_image_urls: ['1'] } };
  const ownRow = mapToRow(structuredClone(raw), { autoApprove: true });
  ownRow.row.source_id = 'R5361963';
  ownRow.row.price = 1000; // would fail the gate — but own rows never see it
  ownRow.row.source_image_urls = [];

  const gatedPlan = planBatch(
    [
      { kind: 'p', reference: 'R5361961', currency: 'EUR', entry: mlsPass },
      { kind: 'p', reference: 'R5361962', currency: 'EUR', entry: mlsFail },
      { kind: 'p', reference: 'R5361963', currency: 'EUR', entry: ownRow },
    ],
    new Map(),
    now,
    cfg
  );
  const passIns = gatedPlan.inserts.find((i) => i.reference === 'R5361961');
  const failIns = gatedPlan.inserts.find((i) => i.reference === 'R5361962');
  const ownIns = gatedPlan.inserts.find((i) => i.reference === 'R5361963');
  assert(passIns.row.published === true && passIns.row.pending_review === false &&
         passIns.row.publish_gate_failures === null,
    'gate-passing MLS insert auto-publishes');
  assert(failIns.row.published === false && failIns.row.pending_review === true,
    'gate-failing MLS insert stays pending');
  assert(Array.isArray(failIns.row.publish_gate_failures) &&
         failIns.row.publish_gate_failures.includes('min_price') &&
         failIns.row.publish_gate_failures.includes('min_photos'),
    'failing rules recorded on the held row');
  assert(ownIns.row.published === true && !('publish_gate_failures' in ownIns.row),
    'own rows bypass the gate (no evaluation, still published)');
  assert(gatedPlan.gatePublished === 1 && gatedPlan.gateHeld === 1, 'gate counters track outcomes');
  assert(!('is_featured' in passIns.row) && !('featured_order' in passIns.row),
    'gate publish never touches curation flags');

  // Gate inactive (null cfg) → pre-gate behaviour: MLS inserts stay pending.
  const ungatedPlan = planBatch(
    [{ kind: 'p', reference: 'R5361961', currency: 'EUR', entry: mlsPass }],
    new Map(),
    now,
    null
  );
  assert(ungatedPlan.inserts[0].row.published === false &&
         !('publish_gate_failures' in ungatedPlan.inserts[0].row),
    'gate disabled → MLS inserts stay pending, nothing recorded');

  // planBatch UPDATE path: untouched-held rows re-evaluate; admin-touched
  // rows never do.
  const heldExisting = {
    id: 'row-h', source_id: 'R5361961', slug: 'held', content_hash: 'stale', rejected: false,
    price: 425_000, status: 'available', source_image_urls: mlsPass.row.source_image_urls,
    pending_review: true, published: false, removed_at: null,
  };
  const promoted = planBatch(
    [{ kind: 'p', reference: 'R5361961', currency: 'EUR', entry: mlsPass }],
    new Map([['p:R5361961', heldExisting]]),
    now,
    cfg
  );
  assert(promoted.updates[0].payload.published === true &&
         promoted.updates[0].payload.pending_review === false,
    'untouched held row that now passes → published on update');

  const stillBad = planBatch(
    [{ kind: 'p', reference: 'R5361962', currency: 'EUR', entry: mlsFail }],
    new Map([['p:R5361962', { ...heldExisting, id: 'row-f', source_id: 'R5361962', price: 90_000 }]]),
    now,
    cfg
  );
  assert(!('published' in stillBad.updates[0].payload) &&
         Array.isArray(stillBad.updates[0].payload.publish_gate_failures),
    'still-failing held row → failure record refreshed, stays unpublished');

  const adminUnpublished = planBatch(
    [{ kind: 'p', reference: 'R5361961', currency: 'EUR', entry: mlsPass }],
    new Map([['p:R5361961', { ...heldExisting, pending_review: false }]]),
    now,
    cfg
  );
  assert(!('published' in adminUnpublished.updates[0].payload) &&
         !('publish_gate_failures' in adminUnpublished.updates[0].payload),
    'admin-reviewed row (pending=false) is never touched by the gate');

  const removedRow = planBatch(
    [{ kind: 'p', reference: 'R5361961', currency: 'EUR', entry: mlsPass }],
    new Map([['p:R5361961', { ...heldExisting, removed_at: '2026-06-01T00:00:00Z' }]]),
    now,
    cfg
  );
  assert(!('published' in removedRow.updates[0].payload),
    'reconciliation-removed row is never gate-published');

  // Rejected rows: planBatch skips them before the gate can ever see them
  // (re-asserted here as the gate spec's "reject overrides everything").
  const rejectedPlan = planBatch(
    [{ kind: 'p', reference: 'R5361961', currency: 'EUR', entry: mlsPass }],
    new Map([['p:R5361961', { ...heldExisting, rejected: true }]]),
    now,
    cfg
  );
  assert(rejectedPlan.updates.length === 0 && rejectedPlan.skippedRejected === 1,
    'rejected row: gate never evaluates it');

  // Gate bookkeeping never dirties the hash (no phantom updates next night).
  const gateStamped = { ...mlsPass.row, publish_gate_failures: ['min_price'], publish_gate_checked_at: now };
  assert(hashContent(gateStamped) === hashContent(mlsPass.row),
    'gate fields excluded from the content hash');
}

// ───────────────────────────── 10. canonical area filtering (search)
console.log('\n— area filter resolves through the location-nesting system —');
{
  const { buildAreaFilterIndex, resolveAreaEntry } =
    await import('../src/lib/area-resolve.ts');

  const areas = [
    { slug: 'marbella', name: 'Marbella', parent_area: null },
    { slug: 'marbella-east', name: 'Marbella East', parent_area: 'marbella' },
    { slug: 'elviria', name: 'Elviria', parent_area: 'marbella-east' },
    { slug: 'nueva-andalucia', name: 'Nueva Andalucía', parent_area: 'marbella' },
    { slug: 'benahavis', name: 'Benahavís', parent_area: null },
  ];
  const mappings = [
    { location: 'Marbella', sublocation: '', proposed_area_slug: 'marbella', approved: true },
    { location: 'La Mairena', sublocation: '', proposed_area_slug: 'marbella-east', approved: true },
    { location: 'Marbella', sublocation: 'Elviria Alta', proposed_area_slug: 'elviria', approved: true },
    { location: 'Nueva Andalucía', sublocation: '', proposed_area_slug: 'nueva-andalucia', approved: true },
    { location: 'Benahavís', sublocation: '', proposed_area_slug: 'benahavis', approved: true },
    // rejected/unapproved rows must never leak into the filter
    { location: 'Ronda', sublocation: '', proposed_area_slug: 'marbella', approved: false },
    { location: 'Istán', sublocation: '', proposed_area_slug: null, approved: true },
  ];
  const index = buildAreaFilterIndex(areas, mappings);

  // NESTED custom area returns its mapped rows (the reported bug).
  const east = resolveAreaEntry(index, 'marbella-east');
  assert(east?.locationStrings.includes('La Mairena'),
    'nested area (Marbella East) resolves to its mapped feed locations');
  assert(east?.locationStrings.includes('Marbella, Elviria Alta'),
    'descendant micro mappings are included (sublocation pair → exact location string)');
  assert(east?.areaNames.includes('Marbella East') && east?.areaNames.includes('Elviria'),
    'curated/manual rows match via nested area NAMES');

  // Parent pulls everything under it.
  const marbella = resolveAreaEntry(index, 'marbella');
  assert(marbella?.locationStrings.includes('La Mairena') &&
         marbella?.locationStrings.includes('Nueva Andalucía'),
    'parent area (Marbella) includes all descendant mappings');

  // Accent/diacritic-safe lookups, by slug OR display name.
  assert(resolveAreaEntry(index, 'Benahavís')?.slug === 'benahavis', 'accented name resolves');
  assert(resolveAreaEntry(index, 'benahavis')?.slug === 'benahavis', 'bare slug resolves');
  assert(resolveAreaEntry(index, 'Nueva Andalucia')?.slug === 'nueva-andalucia',
    'unaccented name resolves to the accented area');

  // Hygiene: unapproved mappings never leak; unknown params return null
  // (search falls back to free-text ilike).
  assert(!marbella?.locationStrings.includes('Ronda'), 'unapproved mapping rows excluded');
  assert(resolveAreaEntry(index, 'atlantis') === null, 'unknown area → null (ilike fallback)');
}

console.log(failures === 0 ? '\nAll sync tests passed ✓' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
