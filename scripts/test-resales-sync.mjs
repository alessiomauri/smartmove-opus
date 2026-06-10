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

console.log(failures === 0 ? '\nAll sync tests passed ✓' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
