// One-shot CLI backfill: generates `hero_image_blur` for any property/area row
// that has a `hero_image` but no blur. Run with:
//   node scripts/backfill-blurs.mjs
//
// Reads NEXT_PUBLIC_SUPABASE_URL + service role key from .env.local. We need
// the service role key here because RLS blocks anon UPDATE on these tables.
// If you don't have it set, the script tells you what to add.

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(join(here, '..', '.env.local'), 'utf-8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or service role key in .env.local');
  process.exit(1);
}
const usingAnon = !env.SUPABASE_SERVICE_ROLE_KEY;
if (usingAnon) {
  console.log('⚠️  Using anon key — UPDATE may be blocked by RLS. If 0 rows update, add SUPABASE_SERVICE_ROLE_KEY to .env.local.');
}

const supabase = createClient(url, key);

async function blurFor(imageUrl) {
  try {
    const res = await fetch(imageUrl, { cache: 'no-store' });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const out = await sharp(buf).resize(20, 20, { fit: 'inside' }).jpeg({ quality: 50 }).toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch (e) {
    console.warn('blur failed for', imageUrl, e.message);
    return null;
  }
}

async function backfillTable(table, key, label) {
  const { data, error } = await supabase
    .from(table)
    .select(`${key},hero_image`)
    .not('hero_image', 'is', null)
    .neq('hero_image', '')
    .is('hero_image_blur', null);

  if (error) {
    console.error(`Failed to query ${table}:`, error.message);
    return 0;
  }
  console.log(`Found ${data.length} ${label} needing blurs`);

  let done = 0;
  for (const row of data) {
    const blur = await blurFor(row.hero_image);
    if (!blur) continue;
    const { error: upErr } = await supabase
      .from(table)
      .update({ hero_image_blur: blur })
      .eq(key, row[key]);
    if (upErr) {
      console.warn(`update ${row[key]} failed:`, upErr.message);
      continue;
    }
    done++;
    process.stdout.write(`\r  ${done}/${data.length} ${label}…`);
  }
  process.stdout.write('\n');
  return done;
}

console.log('Backfilling hero blur placeholders…');
const props = await backfillTable('properties', 'id', 'properties');
const areas = await backfillTable('areas', 'slug', 'areas');
console.log(`✅ Done — ${props} properties, ${areas} areas updated.`);
