# Performance

How the site stays fast: rendering strategy, caching, bundle splitting, image handling.

---

## Render Strategy

See [ARCHITECTURE.md](./ARCHITECTURE.md#1-rendering-strategy) for the full table. Summary:

- All public routes use **ISR** (Incremental Static Regeneration) — pre-rendered at build time, served from Vercel edge cache
- Tag-based **instant invalidation** — admin saves bust the cache immediately; no waiting for the revalidate window
- **Hybrid server/client pattern** — server fetches data and renders initial HTML; client hydrates interactivity on top

The biggest win in this approach: **the homepage initial HTML contains the full property grid**. Previously (when the homepage was `'use client'`), initial HTML was an empty shell and every visitor triggered a Supabase round-trip to populate it. Now the grid is in the HTML, indexable by Google, and served from cache.

---

## Cache Layer (`src/lib/cache.ts`)

```ts
export const PROPERTIES_TAG = 'properties';
export const AREAS_TAG = 'areas';
export const SITE_SETTINGS_TAG = 'site_settings';

export const getCachedPublishedProperties = unstable_cache(
  async (): Promise<Property[]> => {
    const supabase = createStaticSupabaseClient();
    const { data } = await supabase
      .from('properties')
      .select('id,slug,name,…hero_image_blur,…') // 21 columns
      .eq('published', true)
      .order('created_at', { ascending: false });
    return (data as Property[]) ?? [];
  },
  ['published-properties'],
  { tags: [PROPERTIES_TAG], revalidate: 600 }
);
```

**Cached** for 10 minutes per process; **invalidated instantly** by `updateTag(PROPERTIES_TAG)` from admin server actions.

Same pattern for `getCachedDefaultSort` (1 hour TTL — site_settings rarely changes).

`getPropertiesForArea(opts)` is NOT a separate cache entry — it just filters the cached property list in memory. Adding/removing area filtering is microseconds, no Supabase round-trip.

### Why narrow column SELECT

Listing payloads only include the 21 columns needed for cards + filtering:
```
id, slug, name, status, property_type, price, price_on_request,
location, area, micro_location, bedrooms, bathrooms,
interior_size, plot_size, hero_image, hero_image_blur,
is_featured, featured_order, features, description, created_at
```

Notably excluded: `gallery_images[]`, `floor_plan_images[]`, `description` (we include short version only via TODO), `latitude`/`longitude` (only needed on detail page).

The detail page's `getPropertyBySlug` uses `select('*')` because we DO need all columns there. It's fine: single-row fetch.

### Cache invalidation pattern

**Server actions** (e.g. `updateProperty` in `src/lib/actions/properties.ts`):
```ts
revalidatePath('/admin');
revalidatePath('/');
revalidatePath(`/property/${slug}`);
updateTag(PROPERTIES_TAG);  // Next 16's read-your-own-writes variant
```

**Client-side admin hooks** (e.g. `useAdminProperties`):
```ts
import { revalidateProperties } from '@/lib/actions/revalidate';
await mutateInSupabase();
await revalidateProperties();  // server action, calls updateTag inside
```

Either way, by the time the admin lands back on the public site, the cache is fresh.

---

## Bundle Strategy

### Public bundle audit

| Package | Public bundle? |
|---|---|
| `@react-pdf/renderer` (~1.2 MB) | ❌ API route only |
| `leaflet` + `react-leaflet` (~600 KB) | ❌ Lazy-loaded only on `/areas` via `React.lazy` |
| `cheerio` (~200 KB) | ❌ API route only |
| `@dnd-kit/*` (~300 KB) | ❌ Admin only |
| `@base-ui/react` (~160 KB) | ⚠️ Used across UI (acceptable) |
| `date-fns` (~130 KB) | ✅ Tree-shaken via `optimizePackageImports` |
| `lucide-react` (~80 KB) | ✅ Tree-shaken via `optimizePackageImports` |

### `optimizePackageImports`

In `next.config.ts`:
```ts
experimental: {
  optimizePackageImports: [
    'lucide-react',
    '@radix-ui/react-dialog',
    '@radix-ui/react-dropdown-menu',
    '@radix-ui/react-select',
    '@radix-ui/react-tabs',
    '@radix-ui/react-tooltip',
    'date-fns',
    '@dnd-kit/core',
    '@dnd-kit/sortable',
    '@dnd-kit/utilities',
  ],
}
```

This makes Next.js tree-shake barrel exports — only the icons / utilities you actually import end up in the bundle.

### Lazy loading the map

```tsx
// src/app/areas/AreasIndexClient.tsx
const AreasLeafletMap = lazy(() => import('@/components/areas/AreasLeafletMap'));

<Suspense fallback={<MapPlaceholder />}>
  <AreasLeafletMap areas={mapAreas} />
</Suspense>
```

Leaflet weighs ~600 KB. Without lazy loading, every public page would carry that weight even though only `/areas` actually uses it.

---

## Image Performance

See [IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md) for the full pipeline.

Key levers:

1. **AVIF + WebP via Next/Image** — 30–50% smaller than JPEG originals
2. **Blur placeholders** (`hero_image_blur`) — instant low-quality preview, no flash of grey
3. **Hover preload** on PropertyCard — warms browser cache before click
4. **`fetchPriority="high"`** on the LCP hero image
5. **`quality={75}`** as default — good balance of size vs visible quality
6. **Tight `sizes` attributes** — prevents over-large variant generation
7. **Aggressive cache headers** on `/_next/image` (24h fresh + 7d stale)

---

## Dev vs Production

**Dev mode (`npm run dev`)** is intentionally less aggressive about caching and image processing. Each unique image variant is processed on demand the first time. Supabase originals are 1–4 MB, so cold loads can feel slow.

**Production (`npm run build && npm start` or Vercel deploy)** pre-builds all static pages at build time, edge-caches images, and serves AVIF/WebP. Real users get the fast experience.

When perf-testing locally, always use a production build.

---

## Lighthouse / Core Web Vitals targets

After this optimisation pass, target:

- **Performance**: ≥ 90
- **SEO**: 100
- **Best Practices**: ≥ 95
- **Accessibility**: ≥ 95
- **LCP**: < 2.5s on 4G
- **CLS**: < 0.05 (low — no layout shifts thanks to blur placeholders + reserved space)
- **INP**: < 200ms (low JS, no big main-thread work)

Vercel Speed Insights monitors these continuously in production.

---

## What's NOT done (yet)

- **React Hook Form** integration in PropertyForm — currently uses manual useState
- **TanStack Table** in admin listing — basic table currently
- **Programmatic landing pages** for long-tail SEO — deferred until inventory grows
- **Cloudflare in front of Supabase storage** — not needed yet, would only matter if Vercel image quota hit

---

## Performance Verification Checklist

After any major change:

1. `npm run build` — confirm homepage shows `○ (Static)` with revalidate set
2. Check `First Load JS` for `/` (target < 250 KB)
3. `curl -s http://localhost:3000 | grep -c '/property/'` — should return >0 (proves homepage is server-rendered)
4. Edit a property in admin → reload `/` → see change immediately (no 10-min wait)
5. Run Lighthouse on production deploy (not dev)
6. Spot-check `/_next/image?url=…` URLs in DevTools → confirm AVIF served on Chrome
7. Verify Vercel Speed Insights dashboard shows healthy LCP/CLS/INP

---

## Cost Implications

**Vercel**:
- Static pages cost $0 per request (edge cache hit)
- ISR pages cost slightly more on cold revalidation (function invocation)
- Image optimisations: 5,000/month free on Hobby tier

**Supabase**:
- Cached fetches mean far fewer DB queries per visitor (homepage was 1 query per visit; now ~0.001 queries per visit assuming 10-min cache + 600 visits/hour)
- Storage egress: counts against bandwidth quota (1 GB/month free)

For pre-launch traffic levels, well within free tiers. Costs scale linearly with traffic; the cache layer keeps that scaling gentle.
