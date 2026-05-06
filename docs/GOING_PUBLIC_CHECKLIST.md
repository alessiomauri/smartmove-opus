# Going-Public Checklist — Property Listings

**Use this when you're ready to flip the property listings from dark (info-mode) to live (real-estate-mode).**

The site is currently in **info-mode**: homepage, area guides, and blog are public; property listings, favourites, and property detail pages are gated. Logged-in admins see the listings as a live preview.

Going public is a small, deliberate set of changes. Every step is reversible. Follow the list in order — none of these can be skipped.

---

## Pre-flight (do BEFORE flipping the flag)

### 1. Sanity-check inventory in admin preview

While still logged in to `/admin`:
- Visit `/` — confirm the property grid renders correctly
- Visit several `/property/[slug]` pages — confirm they look right (heroes, gallery, all sections)
- Visit `/areas/marbella` — confirm "Properties in Marbella" section renders the grid
- Visit `/favourites` — confirm it loads (will be empty if you haven't favourited anything in this browser)

If anything is broken in preview, FIX IT before going public. The public will see exactly what you see in preview.

### 2. Run the production build locally

```bash
npm run build
```

Confirm zero errors. Look at the route table — `/property/[slug]` should still appear and the build should succeed.

### 3. Confirm the latest code is pushed

```bash
git status
git push origin main
```

Vercel auto-deploys; wait for the build to go green on Vercel before continuing.

---

## The flip (4 file changes)

### Change 1 — Flip the flag

**File**: `src/lib/feature-flags.ts`

```ts
- export const PROPERTIES_PUBLIC = false;
+ export const PROPERTIES_PUBLIC = true;
```

This single change cascades through the whole app:
- Homepage now shows `HomeListingsClient` for everyone (not just admins)
- `/property/[slug]` no longer 404s for public visitors
- `/favourites/*` opens to public
- `/areas/[slug]` shows the properties section instead of the placeholder
- Sitemap auto-includes property URLs + filter URLs
- robots.txt auto-removes property/favourites disallow rules

### Change 2 — Restore property detail page to ISR

**File**: `src/app/property/[slug]/page.tsx`

Find this block near the top:

```ts
// ⚠ FLIP THESE WHEN PROPERTIES_PUBLIC GOES TRUE…
export const dynamic = 'force-dynamic';
```

Replace with:

```ts
export const revalidate = 3600;  // ISR: regenerate every hour
// (delete the dynamic export entirely — defaults to 'auto')
```

This restores ISR on property pages (much faster + cheaper than per-request rendering).

### Change 3 — Restore homepage to ISR

**File**: `src/app/page.tsx`

Find:

```ts
export const dynamic = 'force-dynamic';
```

Replace with:

```ts
export const revalidate = 600;  // ISR: regenerate every 10 minutes
```

(The homepage no longer needs auth-aware rendering once everyone sees the listings.)

You can also remove the `if (!(await shouldShowListings()))` block at the top of `Home()` and inline the listings render — but it's safe to leave; the helper just always returns `true` once the flag is on.

### Change 4 — Restore favourites layout to ISR-friendly

**File**: `src/app/favourites/layout.tsx`

Remove the `dynamic = 'force-dynamic'` export and the `notFound()` gate inside `FavouritesLayout`. The layout becomes a no-op wrapper again:

```ts
export default function FavouritesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

(Or just leave the gate — `shouldShowListings()` always returns `true` when the flag is on, so it costs an auth check per request but doesn't break anything. Removing is the cleaner option.)

---

## Post-flip verification

Deploy to Vercel. Once live:

### Smoke tests

```bash
# All should return 200
curl -I https://marbella.live/
curl -I https://marbella.live/property/villa-amara
curl -I https://marbella.live/favourites
curl -I https://marbella.live/areas/marbella
```

### Visual checks

- [ ] Homepage shows property grid (not the info-mode hero)
- [ ] `/property/villa-amara` renders fully — hero, gallery, breadcrumbs
- [ ] `/areas/marbella` shows "Properties in Marbella" with the grid
- [ ] `/favourites` works — try favouriting a property and refresh
- [ ] Sitemap (`/sitemap.xml`) now contains property URLs
- [ ] robots.txt no longer disallows `/property/*` or `/favourites/*`

### Search Console

- [ ] Resubmit the sitemap in Google Search Console (Settings → Sitemaps → submit `https://marbella.live/sitemap.xml`)
- [ ] Use the URL Inspection tool to request indexing on the homepage and 2-3 hero properties — speeds up Google noticing the change
- [ ] Bing Webmaster Tools: same drill if you've claimed it

### Analytics

- [ ] Confirm GA4 is firing pageviews on the homepage (Realtime tab)
- [ ] Confirm Meta Pixel is firing if configured (Events Manager)

---

## Rollback (if anything goes wrong)

The flip is **fully reversible** in 60 seconds:

1. In `src/lib/feature-flags.ts`: change `PROPERTIES_PUBLIC = true` back to `false`
2. In `src/app/property/[slug]/page.tsx`: change `revalidate = 3600` back to `dynamic = 'force-dynamic'` (delete the revalidate line)
3. In `src/app/page.tsx`: change `revalidate = 600` back to `dynamic = 'force-dynamic'`
4. Push to main → Vercel deploys → site returns to dark mode

You'll lose any pageviews collected during the live window but there's no data loss — properties stay in the DB, favourites stay in users' localStorage, etc.

---

## What's NOT touched by going public

For peace of mind, here's everything that stays exactly as it is — no changes needed:

- **Database** — properties, areas, blog posts, collections all unchanged
- **Storage buckets** — `property-images`, `area-images`, `blog-images`, `development-images` unchanged
- **Admin panel** — works identically before and after
- **Areas system** (the public area pages, the map, the directory) — already public, no change
- **Blog system** — already public, no change
- **`/new-developments`** — separate feature flag (`NEW_DEVELOPMENTS_PUBLIC` in `src/app/new-developments/feature-flag.ts`); unrelated to this flip
- **All cache layer code** (`src/lib/cache.ts`, server actions, revalidate tags) — unchanged
- **Middleware** (admin auth) — unchanged
- **Metadata, JSON-LD, OG images** on property pages — already complete; just becomes visible

---

## Files touched by the dark-mode pattern (for reference)

If you ever need to audit what was changed for the info-mode period:

```
src/lib/feature-flags.ts          (NEW — single source of truth)
src/lib/visibility.ts             (NEW — shouldShowListings() helper)
src/app/HomeListingsClient.tsx    (RENAMED from HomeClient.tsx — bit-for-bit same)
src/app/HomeInfoClient.tsx        (NEW — info-mode homepage)
src/app/page.tsx                  (branches on shouldShowListings())
src/app/property/[slug]/page.tsx  (gates with notFound() + adjusted dynamic export)
src/app/favourites/layout.tsx     (gates whole subtree)
src/app/areas/[slug]/page.tsx     (passes showProperties prop)
src/app/areas/[slug]/AreaPageClient.tsx  (renders placeholder when showProperties=false)
src/app/sitemap.ts                (excludes property URLs while dark)
src/app/robots.ts                 (disallows /property + /favourites while dark)
```

Every file kept the original logic intact and only added gating. Restoring full public listings = changes 4 of these files (the ones called out above).

---

## Future flip checklist (for `/new-developments`)

When you're also ready to launch the developments side, see `src/app/new-developments/feature-flag.ts` — it's a separate boolean (`NEW_DEVELOPMENTS_PUBLIC`) that follows the same pattern. Steps documented in `docs/DEVELOPMENTS.md`.
