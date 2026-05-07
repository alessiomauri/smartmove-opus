/**
 * Standalone parser sanity check against the saved Resales sample JSONs.
 *
 * Run: `npx tsx scripts/test-resales-parser.mjs`
 * (tsx handles TypeScript imports inline)
 *
 * Prints a one-line summary per sample plus any assertion failures.
 * Exits non-zero on the first failure.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const samplesDir = resolve(here, '../../smartmove-web-briefs/resales-samples');

// tsx will resolve .ts on-the-fly; otherwise this falls back to a sibling .mjs
const { mapToRow, isSoldTail, parseRange } = await import(
  '../src/lib/integrations/resales-mapping.ts'
);

let failures = 0;
const errors = [];

function assert(cond, msg) {
  if (!cond) {
    failures += 1;
    errors.push(msg);
    console.error('  ✗', msg);
  }
}

async function loadSample(filename) {
  const raw = await readFile(join(samplesDir, filename), 'utf8');
  return JSON.parse(raw);
}

function unwrapProperties(envelope) {
  // Handles all observed shapes:
  //   - SearchProperties: { Property: [...] }
  //   - PropertyDetails:  { Property: { ... } }
  //   - Sample fragment:  { _partial_property_object: {...}, ... }
  //   - Sold tail:        { _partial_property_object_when_sold: { Property: {...} } }
  // Filters out the `_note` / `_omitted_references` annotation objects
  // that the sample authors interleave with real properties.
  let arr = [];
  if (envelope.Property) {
    arr = Array.isArray(envelope.Property) ? envelope.Property : [envelope.Property];
  } else if (envelope._partial_property_object) {
    arr = [{ Reference: 'PARTIAL-FRAGMENT', ...envelope._partial_property_object }];
  } else if (envelope._partial_property_object_when_sold?.Property) {
    arr = [envelope._partial_property_object_when_sold.Property];
  }
  // Real entries always carry a Reference; everything else is annotation.
  return arr.filter((p) => typeof p?.Reference === 'string' && p.Reference.length > 0);
}

// ────────────────────────────────────────── Tests

console.log('\n— Resales parser sample sweep —\n');

// Pre-tests: range parser sanity
assert(JSON.stringify(parseRange('1 - 2')) === JSON.stringify({ from: 1, to: 2 }),
  'parseRange("1 - 2") should be {1,2}');
assert(JSON.stringify(parseRange('92000')) === JSON.stringify({ from: 92000, to: 92000 }),
  'parseRange("92000") should be {92000,92000}');
assert(JSON.stringify(parseRange(820)) === JSON.stringify({ from: 820, to: 820 }),
  'parseRange(820) should be {820,820}');
assert(JSON.stringify(parseRange('')) === JSON.stringify({ from: null, to: null }),
  'parseRange("") should be {null,null}');
assert(JSON.stringify(parseRange(undefined)) === JSON.stringify({ from: null, to: null }),
  'parseRange(undefined) should be {null,null}');

// Sample tests
const files = (await readdir(samplesDir)).filter((f) => f.endsWith('.json')).sort();

for (const file of files) {
  const env = await loadSample(file);
  const props = unwrapProperties(env);
  if (props.length === 0) {
    console.log(`  ${file}  →  (no Property array, skipped)`);
    continue;
  }

  let propertyRows = 0;
  let developmentRows = 0;
  let multiLang = 0;
  let soldTail = 0;

  for (const p of props) {
    if (isSoldTail(p)) {
      soldTail += 1;
      continue;
    }
    const result = mapToRow(p, { autoApprove: p.OwnProperty === '1' });
    if (result.kind === 'development') {
      developmentRows += 1;
      const r = result.row;
      assert(r.source === 'resales_online', `${file}: dev source must be 'resales_online'`);
      assert(r.source_id === p.Reference,    `${file}: dev source_id must equal Reference`);
      assert(r.slug.length > 0,              `${file}: dev slug must not be empty`);
      // Range fields
      const beds = r.bedrooms_from != null && r.bedrooms_to != null;
      assert(beds || p.Bedrooms == null,     `${file}: dev bedrooms range must parse`);
    } else {
      propertyRows += 1;
      const r = result.row;
      assert(r.source === 'resales_online', `${file}: source must be 'resales_online'`);
      assert(r.source_id === p.Reference,    `${file}: source_id must equal Reference`);
      assert(r.slug.length > 0,              `${file}: slug must not be empty`);
      assert(r.name.length > 0,              `${file}: name must not be empty`);
      assert(['available','sold','reserved','under_offer','coming_soon'].includes(r.status),
                                             `${file}: status enum must be valid`);
      assert(['villa','apartment','townhouse','penthouse','plot_with_project'].includes(r.property_type),
                                             `${file}: property_type enum must be valid`);
      // Image canonicalisation: no ?v= or ?z= remaining in source URLs
      for (const url of r.source_image_urls) {
        assert(!/\?v=|\?z=/.test(url),       `${file}: image URL "${url}" still has cache-buster`);
      }
      // Multi-lang detection
      const isMulti = typeof p.Description === 'object' && p.Description !== null && !Array.isArray(p.Description);
      if (isMulti) {
        multiLang += 1;
        const localeKeys = Object.keys(r.descriptions);
        assert(localeKeys.length > 0,        `${file}: multi-lang descriptions should have at least one locale`);
      }
      // Numeric coercion
      assert(r.bedrooms === null || typeof r.bedrooms === 'number',
                                             `${file}: bedrooms must be number or null`);
      // OwnProperty respect
      const isOwn = p.OwnProperty === '1';
      assert(r.own_property === isOwn,       `${file}: own_property must reflect Resales OwnProperty`);
    }
  }

  const status = failures === 0 ? '✓' : '✗';
  console.log(
    `  ${status} ${file}  →  ${propertyRows} property, ${developmentRows} dev, ${multiLang} multi-lang, ${soldTail} sold-tail`
  );
}

console.log('');
if (failures === 0) {
  console.log(`✓ All checks passed across ${files.length} samples.\n`);
  process.exit(0);
} else {
  console.error(`✗ ${failures} failure(s):\n`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
