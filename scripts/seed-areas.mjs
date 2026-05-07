/**
 * One-shot seed: writes the 42 Costa del Sol areas (with pins) from
 * src/lib/areas-data.ts into the Smartmove `areas` table via service role.
 * Bypasses /admin auth.
 *
 * Run: npx tsx scripts/seed-areas.mjs
 *
 * Re-runnable — upserts on `slug`. Safe to call after editing areas-data.ts
 * to push updates.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing Supabase env vars in .env.local');
  process.exit(1);
}

// Mirror of PIN_CATEGORY_BY_SLUG from src/lib/actions/areas.ts so this
// script doesn't need to import server-only code.
const PIN_CATEGORY_BY_SLUG = {
  // 5 resorts
  'puente-romano': 'resort',
  'finca-cortesin': 'resort',
  'la-zagaleta': 'resort',
  'villa-padierna': 'resort',
  'higueron': 'resort',
  // 1 airport
  'malaga-airport': 'airport',
  // Everything else falls through to main vs micro based on isMicroLocation.
};

const { COSTA_DEL_SOL_AREAS } = await import('../src/lib/areas-data.ts');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`\nSeeding ${COSTA_DEL_SOL_AREAS.length} areas →\n`);

const rows = COSTA_DEL_SOL_AREAS.map((a, i) => ({
  slug: a.slug,
  name: a.name,
  region: a.region,
  title: a.title,
  meta_description: a.metaDescription,
  heading: a.heading,
  subheading: a.subheading,
  description: a.description,
  property_types: a.propertyTypes,
  highlights: a.highlights,
  coordinates_lat: a.coordinates.lat,
  coordinates_lng: a.coordinates.lng,
  price_range: a.priceRange,
  nearby_areas: a.nearbyAreas,
  keywords: a.keywords,
  is_micro_location: a.isMicroLocation,
  parent_area: a.parentArea ?? null,
  hero_image: '',
  hero_image_alt: `${a.name} property for sale on the Costa del Sol`,
  display_order: i,
  published: true,
  pin_category:
    PIN_CATEGORY_BY_SLUG[a.slug] ?? (a.isMicroLocation ? 'micro' : 'main'),
}));

const { error } = await supabase.from('areas').upsert(rows, { onConflict: 'slug' });

if (error) {
  console.error('✗ Seed failed:', error.message);
  process.exit(1);
}

const counts = rows.reduce((acc, r) => {
  acc[r.pin_category] = (acc[r.pin_category] ?? 0) + 1;
  return acc;
}, {});
console.log(`✓ Upserted ${rows.length} areas`);
console.log('  pin_category breakdown:', counts);
console.log('');
