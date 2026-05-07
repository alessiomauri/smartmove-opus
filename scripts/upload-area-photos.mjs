/**
 * One-shot: upload area hero photos from
 * ~/Desktop/smartmove-brand-assets/04-photography/area-photos-from-marbella-live/
 * to Supabase Storage (`area-images` bucket) and update areas.hero_image
 * to the public URL.
 *
 * Filename → area slug mapping uses a slugified version of the name (case-
 * insensitive, spaces and " resort" suffix stripped). Mismatches are
 * reported but don't abort the run; everything that does match goes up.
 *
 * Re-runnable: upserts files (overwrite) and updates areas in place.
 *
 * Run: npx tsx scripts/upload-area-photos.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, basename, join, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const PHOTOS_DIR =
  '/Users/alessiomauri/Desktop/smartmove-brand-assets/04-photography/area-photos-from-marbella-live';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Pull all areas to know the canonical slugs we can match against.
const { data: areas, error: areasErr } = await supabase
  .from('areas')
  .select('slug,name');
if (areasErr) {
  console.error('Failed to fetch areas:', areasErr.message);
  process.exit(1);
}

const slugSet = new Set(areas.map((a) => a.slug));

// Slugifier — match scripts/seed-areas.mjs behaviour: lowercase, strip
// "resort" suffix on filenames, replace whitespace with hyphens, drop
// accents.
function slugifyFilename(filename) {
  const stem = basename(filename, extname(filename));
  return stem
    .toLowerCase()
    .replace(/\s+resort\b/g, '')      // "Higueron resort" → "higueron"
    .replace(/\s+marbella\b/g, '')    // "Palo Alto Marbella" → "palo alto"
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Manual overrides where the slugified filename and DB slug don't match.
const OVERRIDES = {
  'el-madronal': 'el-madroñal',
  'san-pedro-de-alcantara': 'san-pedro',
};

// Supabase Storage paths must be ASCII; strip non-ASCII slug chars when
// building the object key only (DB slug stays as-is).
function asciiKey(slug) {
  return slug.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]/g, '');
}

const files = (await readdir(PHOTOS_DIR)).filter((f) =>
  /\.(jpg|jpeg|png|webp|avif)$/i.test(f)
);

console.log(`\n— Uploading ${files.length} area photos —\n`);

let uploaded = 0;
let skipped = 0;
let unmatched = [];

for (const file of files) {
  const candidateSlug = slugifyFilename(file);
  const slug = OVERRIDES[candidateSlug] ?? candidateSlug;

  if (!slugSet.has(slug)) {
    // Try a couple of heuristics before giving up.
    const fuzzy = [...slugSet].find(
      (s) => s.replace(/-/g, '') === candidateSlug.replace(/-/g, '')
    );
    if (!fuzzy) {
      unmatched.push({ file, candidateSlug });
      console.log(`  ✗ ${file.padEnd(36)} → no area for "${candidateSlug}"`);
      continue;
    }
    // matched via fuzzy; proceed with that
    await uploadFor(file, fuzzy);
    continue;
  }

  await uploadFor(file, slug);
}

async function uploadFor(file, slug) {
  const ext = extname(file).slice(1).toLowerCase().replace('jpeg', 'jpg');
  const objectKey = `hero/${asciiKey(slug)}.${ext}`;
  const buf = await readFile(join(PHOTOS_DIR, file));
  const { error: upErr } = await supabase.storage
    .from('area-images')
    .upload(objectKey, buf, {
      cacheControl: '31536000',
      upsert: true,
      contentType: contentTypeFor(ext),
    });
  if (upErr) {
    console.log(`  ✗ ${file.padEnd(36)} → ${upErr.message}`);
    skipped += 1;
    return;
  }
  const { data: pub } = supabase.storage.from('area-images').getPublicUrl(objectKey);
  const url = pub.publicUrl;
  const { error: dbErr } = await supabase
    .from('areas')
    .update({ hero_image: url })
    .eq('slug', slug);
  if (dbErr) {
    console.log(`  ✗ ${file.padEnd(36)} → DB update: ${dbErr.message}`);
    skipped += 1;
    return;
  }
  console.log(`  ✓ ${file.padEnd(36)} → ${slug}`);
  uploaded += 1;
}

function contentTypeFor(ext) {
  switch (ext) {
    case 'png':  return 'image/png';
    case 'webp': return 'image/webp';
    case 'avif': return 'image/avif';
    default:     return 'image/jpeg';
  }
}

console.log('');
console.log(`✓ Uploaded:  ${uploaded}`);
console.log(`✗ Skipped:   ${skipped}`);
console.log(`? Unmatched: ${unmatched.length}`);
if (unmatched.length) {
  console.log('  Filenames that did not match any area slug:');
  for (const { file, candidateSlug } of unmatched) {
    console.log(`    - "${file}" (slug guess: "${candidateSlug}")`);
  }
}
console.log('');
