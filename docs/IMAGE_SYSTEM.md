# Image System

How images flow from upload → storage → optimisation → render.

---

## Storage

Three Supabase storage buckets, all **public read**:

| Bucket | Used by |
|---|---|
| `property-images` | Property heroes, gallery, floor plans |
| `area-images` | Area heroes (stored as `hero/<slug>.jpg`) |
| `blog-images` | Blog post heroes + inline images |

URLs look like:
```
https://tvuhxqcpunavphakuzhm.supabase.co/storage/v1/object/public/area-images/hero/marbella.jpg
```

### RLS on storage

Default policy: only authenticated users can INSERT/UPDATE/DELETE. Anon can only SELECT.

For one-shot bulk operations (e.g. uploading 41 area photos via a script using the anon key), the pattern is:
1. Add temporary policies via SQL: `CREATE POLICY "temp_insert" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'area-images');`
2. Run the upload script
3. `DROP POLICY "temp_insert" ON storage.objects;`

### Cache busting

CDN aggressively caches storage URLs. To force a re-fetch after replacing an image without changing the path, append `?v=N` to the URL in the DB row. We use `?v=2`, `?v=3`, etc. for the few cases where photos were swapped (Sotogrande, Mijas, Estepona).

---

## Upload Path

Two flows:

### 1. Admin-direct upload (`ImageUploader.tsx`)
- File picker / drag-drop
- Browser uploads via Supabase JS client (anon key + admin RLS) directly to the bucket
- Returns the public URL
- URL stored in the DB row (`hero_image`, `gallery_images[]`, etc.)

### 2. Import-from-URL (`/api/admin/import-images`)
- Admin pastes external URLs (e.g. competitor's listing photos via the scraper)
- Server route `fetch`es each URL, uploads to Supabase storage, returns the new internal URLs
- Avoids hot-linking competitors' bandwidth and keeps everything inside our CDN

---

## Blur Placeholders (`hero_image_blur`)

Every property and area row carries a `hero_image_blur` text column — a base64-encoded 20×20 JPEG (~600 bytes) used as `<Image placeholder="blur">`.

### Generation

`src/lib/blur.ts`:
```ts
export async function generateBlurDataURL(imageUrl: string): Promise<string | null> {
  const res = await fetch(imageUrl, { cache: 'no-store' });
  const buf = Buffer.from(await res.arrayBuffer());
  const blurred = await sharp(buf)
    .resize(20, 20, { fit: 'inside' })
    .jpeg({ quality: 50 })
    .toBuffer();
  return `data:image/jpeg;base64,${blurred.toString('base64')}`;
}
```

Called from:
- `createProperty` / `updateProperty` server actions — generates blur whenever `hero_image` changes
- `updateArea` server action — same
- `backfillHeroBlurs` admin action — bulk-generates for all rows with NULL blur

### One-shot CLI backfill

`scripts/backfill-blurs.mjs` — Node script that reads `.env.local`, queries Supabase for rows with `hero_image_blur IS NULL`, fetches each image, generates the blur, updates the row. Used once after rolling out the blur system to backfill the existing 11 properties + 40 areas.

Requires temporary RLS policies for anon UPDATE (or a service-role key), same pattern as bucket bulk uploads.

### Render

In any component using the hero:
```tsx
<Image
  src={property.hero_image}
  alt={…}
  fill
  {...(property.hero_image_blur
    ? { placeholder: 'blur' as const, blurDataURL: property.hero_image_blur }
    : {})}
/>
```

The conditional spread keeps it safe when blur is null.

---

## Next/Image Optimisation

`next.config.ts`:
```ts
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'images.unsplash.com' },
    { protocol: 'https', hostname: '*.supabase.co' },
    { protocol: 'https', hostname: '*.supabase.in' },
  ],
  formats: ['image/avif', 'image/webp'],
}
```

This enables AVIF/WebP serving on supporting browsers — typically 30–50% smaller than the JPEG originals. Vercel handles the optimisation at the edge in production.

### `sizes` discipline

Always specify `sizes` to help Next pick the right `w` parameter:

| Component | sizes |
|---|---|
| `PropertyCard` | `(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw` |
| Property hero | `100vw` |
| Area hero | `(max-width: 1024px) 100vw, 50vw` |
| Blog hero | `100vw` |
| Gallery thumbnail | `(max-width: 640px) 50vw, 25vw` |
| Map popup thumbnail | `240px` |

### `priority` discipline

Only the LCP (Largest Contentful Paint) image per page should get `priority`:
- Homepage: first 3 PropertyCards (above fold on desktop)
- Property detail: hero
- Area detail: hero

Below-fold images skip `priority` so they don't compete with critical resources.

### `quality`

Default 75. Property hero is set to `quality={75}` explicitly. Don't go above 80 unless you have a specific need — file size grows fast for marginal visual improvement.

---

## Cache Headers

`next.config.ts` sets aggressive caching on `/_next/image`:
```
Cache-Control: public, max-age=86400, stale-while-revalidate=604800
```

That's 24h fresh + 7d stale. Vercel's edge respects this.

Static assets (`.ico`, `.png`, `.jpg`, etc. in `public/`) get `max-age=31536000, immutable` (1 year).

---

## Hover Preload

`PropertyCard.tsx` warms the browser cache for a property's hero image when the user hovers/touches the card:
```ts
const preloadHero = () => {
  const img = new window.Image();
  img.src = property.hero_image;
};
// onMouseEnter={preloadHero} onTouchStart={preloadHero}
```

By the time the user clicks, the detail-page hero is already in cache. Negligible overhead for users who never click.

---

## Dev vs Production

In dev (`npm run dev`), Next/Image processes each variant on demand the first time. Supabase originals are large (1–4 MB), so the first visit to a page in dev can feel slow.

In production (Vercel), variants are pre-generated and edge-cached. Real users get small AVIF/WebP files served from the closest edge.

If perf testing locally, use `npm run build && npm start` to see realistic behaviour.

---

## Vercel Image Optimisation Quota

Hobby tier: 5,000 transformations/month. Each unique `(url, w, q)` triple counts as 1 transformation.

A site with 13 properties, each rendering 3 image sizes (mobile 100vw + tablet 50vw + desktop 33vw) at 2 formats (AVIF + WebP) = ~78 transformations from the homepage alone. Property detail pages add more (gallery + hero in larger sizes).

Plenty of headroom currently. If usage grows, options:
1. Upgrade Vercel plan
2. Pre-generate sized variants at upload time (sharp + upload to bucket as multiple files)
3. Use Cloudflare Image Resizing in front of Supabase storage

---

## Recreating the Image System

1. Create the three storage buckets, set them public read.
2. Add the relevant Next/Image `remotePatterns` for your Supabase project URL.
3. Add `hero_image_blur` columns to your tables.
4. Copy `src/lib/blur.ts`.
5. Wire `generateBlurDataURL` into your save server actions.
6. Use `placeholder="blur"` + `blurDataURL` on hero `<Image>` components.
7. Add the `scripts/backfill-blurs.mjs` script for one-shot backfill.
8. Set image cache headers in `next.config.ts`.
9. Add hover preload to listing cards.
