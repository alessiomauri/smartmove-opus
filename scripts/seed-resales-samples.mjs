/**
 * One-shot seed script: reads the saved Resales sample JSONs and upserts
 * them into Supabase via the service role key. Bypasses /admin auth.
 *
 * Run from the project root:
 *   npx tsx scripts/seed-resales-samples.mjs
 *
 * Requires `.env.local` with NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY set.
 *
 * Re-runnable: existing rows get updated (UPSERT on source + source_id).
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const samplesDir = resolve(here, '..', '..', 'smartmove-web-briefs', 'resales-samples');
const { mapToRow, isSoldTail } = await import(
  '../src/lib/integrations/resales-mapping.ts'
);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log('\n— Seeding Smartmove DB from Resales samples —\n');

// Collect all properties from every sample
const files = (await readdir(samplesDir)).filter((f) => f.endsWith('.json')).sort();
const allProperties = [];
for (const file of files) {
  const env = JSON.parse(await readFile(join(samplesDir, file), 'utf8'));
  let arr = [];
  if (env.Property) arr = Array.isArray(env.Property) ? env.Property : [env.Property];
  else if (env._partial_property_object)
    arr = [{ Reference: 'PARTIAL-FRAGMENT', ...env._partial_property_object }];
  else if (env._partial_property_object_when_sold?.Property)
    arr = [env._partial_property_object_when_sold.Property];
  arr = arr.filter((p) => typeof p?.Reference === 'string' && p.Reference.length > 0);
  console.log(`  ${file}  →  ${arr.length} properties`);
  allProperties.push(...arr);
}

// De-duplicate by Reference (multiple samples may include the same property)
const byRef = new Map();
for (const p of allProperties) byRef.set(p.Reference, p);
const unique = [...byRef.values()];
console.log(`\nDe-duplicated → ${unique.length} unique properties.\n`);

let propertyUpserts = 0;
let developmentUpserts = 0;
let soldTailUpdates = 0;
let errors = 0;

for (const raw of unique) {
  if (raw.Reference === 'PARTIAL-FRAGMENT') {
    console.log(`  · skip PARTIAL-FRAGMENT (no real Reference)`);
    continue;
  }
  if (isSoldTail(raw)) {
    const { error } = await supabase
      .from('properties')
      .update({ status: 'sold', last_synced_at: new Date().toISOString() })
      .eq('source', 'resales_online')
      .eq('source_id', raw.Reference);
    if (error && !error.message.includes('rows')) {
      errors += 1;
      console.error(`  ✗ sold-tail ${raw.Reference}: ${error.message}`);
    } else {
      soldTailUpdates += 1;
      console.log(`  ↩ sold-tail ${raw.Reference}`);
    }
    continue;
  }

  try {
    // Dev seed: auto-approve everything so the homepage isn't empty.
    // Live sync (the API route) keeps the OwnProperty-driven default.
    const mapped = mapToRow(raw, { autoApprove: true });
    const table = mapped.kind === 'development' ? 'developments' : 'properties';
    const { error } = await supabase
      .from(table)
      .upsert(mapped.row, { onConflict: 'source,source_id' });
    if (error) {
      errors += 1;
      console.error(`  ✗ ${table} ${raw.Reference}: ${error.message}`);
    } else if (mapped.kind === 'development') {
      developmentUpserts += 1;
      console.log(`  ✓ development ${raw.Reference} → ${mapped.row.slug}`);
    } else {
      propertyUpserts += 1;
      console.log(`  ✓ property    ${raw.Reference} → ${mapped.row.slug}`);
    }
  } catch (e) {
    errors += 1;
    console.error(`  ✗ ${raw.Reference}: ${e.message}`);
  }
}

console.log('\n— Done —');
console.log(`  Properties upserted:    ${propertyUpserts}`);
console.log(`  Developments upserted:  ${developmentUpserts}`);
console.log(`  Sold-tail updates:      ${soldTailUpdates}`);
console.log(`  Errors:                 ${errors}`);
console.log('');
process.exit(errors === 0 ? 0 : 1);
