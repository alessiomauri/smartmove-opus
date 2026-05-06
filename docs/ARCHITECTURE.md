# Architecture

How the site is structured, rendered, and cached. This is the document to read before making any change that touches routing, data fetching, or performance.

---

## 1. Rendering Strategy

Every public route is **Incrementally Static Regenerated (ISR)** — pre-rendered at build time, served from Vercel's edge cache, regenerated on a schedule AND invalidated instantly by admin mutations.

| Route | Type | Revalidate | Static params |
|---|---|---|---|
| `/` | Server Component → `HomeClient` | 600s (10 min) | — |
| `/property/[slug]` | Server Component → `PropertyPageClient` | 3600s (1 h) | All published property slugs |
| `/areas` | Server Component → `AreasIndexClient` | 3600s | — |
| `/areas/[slug]` | Server Component → `AreaPageClient` | 3600s | All area slugs |
| `/blog` | Server Component | 3600s | — |
| `/blog/[slug]` | Server Component | 3600s | All published blog slugs |
| `/collection/[slug]` | Server Component | (none) | All collection slugs |
| `/favourites` | `'use client'` | — | — |
| `/favourites/[shareId]` | `'use client'` | — | — |
| `/admin/*` | Mostly `'use client'` | — | — |

The build log shows `○ (Static)` for prerendered routes and `ƒ (Dynamic)` for routes with dynamic params (they're still prerendered for the known slugs — the ƒ just means "the handler can respond to unknown slugs too").

### Hybrid server/client pattern

The homepage is the canonical example. We **don't** mark it `'use client'` — instead:

1. `src/app/page.tsx` is a **Server Component**. It `await`s cached Supabase data and injects JSON-LD scripts into the HTML.
2. `src/app/HomeClient.tsx` is a `'use client'` child that receives the property list + default sort as props, and owns all interactive state (filters, quick buttons, sort).

Result: the initial HTML ships the full property grid (SEO-indexable, fast LCP), and interactivity hydrates on top of it. **No Supabase round-trip from the browser on first paint.**

The same pattern is used for `/areas/[slug]` → `AreaPageClient`, `/property/[slug]` → `PropertyPageClient`.

---

## 2. Cache Layer (`src/lib/cache.ts`)

All public Supabase reads go through `unstable_cache` with **tag-based invalidation**:

```ts
export const PROPERTIES_TAG = 'properties';
export const AREAS_TAG = 'areas';
export const SITE_SETTINGS_TAG = 'site_settings';

export const getCachedPublishedProperties = unstable_cache(
  async (): Promise<Property[]> => { /* SELECT … */ },
  ['published-properties'],
  { tags: [PROPERTIES_TAG], revalidate: 600 }
);
```

**When admin mutates, invalidate:**

Server actions (`src/lib/actions/properties.ts`, `areas.ts`) call `updateTag(PROPERTIES_TAG)` (Next 16's server-action variant of `revalidateTag`) on every create/update/delete/toggle.

Client-side admin hooks (`src/hooks/useAdminProperties.ts`) that mutate Supabase directly call `revalidateProperties()` from `src/lib/actions/revalidate.ts` — a thin server action that wraps `updateTag`.

Net effect: admin saves → cache busts → next public request gets fresh data. No 10-minute wait for the revalidate window.

---

## 3. Folder Layout

```
src/
├── app/
│   ├── layout.tsx                  # Root layout — metadata, fonts, consent, analytics
│   ├── page.tsx                    # Homepage (Server Component)
│   ├── HomeClient.tsx              # Homepage interactivity
│   ├── globals.css                 # Tailwind v4 tokens + brand CSS
│   ├── robots.ts                   # Dynamic robots.txt
│   ├── sitemap.ts                  # Dynamic sitemap.xml
│   ├── opengraph-image.tsx         # Default OG image
│   ├── admin/                      # Admin panel (middleware-protected)
│   │   ├── page.tsx                # Dashboard: property list
│   │   ├── login/page.tsx
│   │   ├── properties/new/page.tsx
│   │   ├── properties/[id]/edit/page.tsx
│   │   ├── areas/page.tsx
│   │   ├── areas/[slug]/edit/page.tsx
│   │   ├── blog/page.tsx
│   │   ├── blog/new/page.tsx
│   │   ├── blog/[slug]/edit/page.tsx
│   │   ├── collections/…
│   │   └── seed/page.tsx
│   ├── api/
│   │   ├── property/[slug]/brochure/route.tsx    # PDF generation
│   │   └── admin/
│   │       ├── scrape/route.ts                   # URL → property data
│   │       └── import-images/route.ts            # External URL → Supabase storage
│   ├── property/[slug]/page.tsx + PropertyPageClient.tsx
│   ├── areas/page.tsx + AreasIndexClient.tsx
│   ├── areas/[slug]/page.tsx + AreaPageClient.tsx
│   ├── blog/[slug]/page.tsx
│   ├── collection/[slug]/page.tsx
│   └── favourites/…
├── components/
│   ├── PropertyCard.tsx            # Listing card
│   ├── PropertyGrid.tsx            # Grid wrapper with skeleton
│   ├── FilterBar.tsx               # Multi-facet filter UI
│   ├── FavouriteButton.tsx         # Heart toggle
│   ├── SiteFooter.tsx              # SEO footer (used on /areas/[slug])
│   ├── CookieBanner.tsx            # EU consent (hidden unless analytics IDs set)
│   ├── Analytics.tsx               # GA4 + Pixel, consent-gated
│   ├── property/                   # Property detail page subcomponents
│   │   ├── HeroSection.tsx         # Parallax hero
│   │   ├── PropertyHeader.tsx      # Sticky nav on detail page
│   │   ├── GallerySection.tsx
│   │   ├── FloorplansSection.tsx
│   │   ├── LocationSection.tsx
│   │   ├── ShareButton.tsx
│   │   └── …
│   ├── areas/AreasLeafletMap.tsx   # Lazy-loaded map
│   └── admin/                      # Admin form + uploader components
│       ├── PropertyForm.tsx
│       ├── AreaForm.tsx
│       ├── BlogForm.tsx
│       ├── ImageUploader.tsx
│       ├── CoordinatePicker.tsx
│       └── SocialContentGenerator.tsx
├── hooks/
│   ├── useProperties.ts            # Client-side property fetch (now only used by /favourites)
│   ├── useFavourites.ts            # localStorage favourites
│   ├── useAdminProperties.ts       # Admin list + mutations
│   └── …
├── lib/
│   ├── supabase.ts                 # Browser client
│   ├── supabase-server.ts          # Server-action / RSC client
│   ├── supabase-static.ts          # Build-time / cache client
│   ├── cache.ts                    # unstable_cache wrappers + tags
│   ├── blur.ts                     # sharp-based blur data URI generator
│   ├── utils.ts                    # cn(), formatPrice(), formatNumber()
│   ├── areas-data.ts               # Static seed data for areas table
│   ├── blog-data.ts                # Static seed data for blog_posts
│   ├── mock-data.ts                # 6 mock properties (dev without Supabase)
│   └── actions/
│       ├── properties.ts           # CRUD server actions
│       ├── areas.ts                # CRUD server actions
│       ├── blog.ts
│       ├── collections.ts
│       ├── features.ts             # feature_options management
│       ├── auth.ts                 # signIn / signOut
│       ├── revalidate.ts           # Tag invalidation helpers
│       └── backfill-blurs.ts       # One-shot admin action to backfill hero blurs
├── contexts/
│   └── FavouritesContext.tsx       # localStorage-backed favourites provider
├── types/
│   ├── property.ts
│   ├── area.ts
│   └── blog.ts
├── middleware.ts                   # Admin auth gate (Supabase JWT check)
└── …
```

---

## 4. Middleware

`src/middleware.ts` runs on every request matching `/admin/:path*`:

- Refreshes the Supabase auth cookies
- Checks `supabase.auth.getUser()`
- If admin route + no user → redirect to `/admin/login`
- If on login page + already authed → redirect to `/admin`

The matcher is tight (`/admin/:path*`) so middleware overhead is zero on public routes.

**Note on Next 16 deprecation**: Next 16 renamed `middleware.ts` → `proxy.ts`. Both still work in 16.x; the warning is informational. Migrate when convenient.

---

## 5. Static Params Generation

Every dynamic route that can be listed ahead of time uses `generateStaticParams`:

```ts
export async function generateStaticParams() {
  const supabase = createStaticSupabaseClient();
  const { data } = await supabase.from('properties').select('slug').eq('published', true);
  return (data || []).map((p) => ({ slug: p.slug }));
}
```

This pre-builds every property/area/blog/collection page at build time. New additions show up via the ISR revalidate window or immediate tag invalidation.

---

## 6. Environment Configuration

Required:
```
NEXT_PUBLIC_SUPABASE_URL=https://tvuhxqcpunavphakuzhm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

Optional:
```
NEXT_PUBLIC_SITE_URL=https://marbella.live   # Falls back to same string hard-coded
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX               # Google Analytics 4 (consent-gated)
NEXT_PUBLIC_META_PIXEL_ID=1234567890         # Meta Pixel (consent-gated)
NEXT_PUBLIC_GSC_VERIFICATION=<token>         # Search Console verification
```

When GA/Pixel IDs are unset, the `<Analytics />` and `<CookieBanner />` components short-circuit to `null` — no banner, no tracker, no consent UX.

---

## 7. Build & Deploy

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # serve production build
npx tsc --noEmit   # typecheck only
```

Deploys auto-trigger from the `main` branch on GitHub → Vercel. No `vercel.json` — uses Next.js framework defaults.

## 8. Things to watch when extending

- **Don't mark a page `'use client'` at the top** if you can server-render its static parts. Use the server/client split pattern shown above.
- **New server actions that mutate properties/areas** must call `updateTag(PROPERTIES_TAG)` or `updateTag(AREAS_TAG)` or the public cache will be stale.
- **New heavy dependencies** (>100 KB) should be dynamically imported if they're not needed on every route.
- **New public tables** should have RLS enabled with a `SELECT WHERE published = true` policy for anon.
- **Images** must be served via Next/Image — never raw `<img>`. Add the domain to `next.config.ts` `images.remotePatterns`.
