# Tech Stack

The complete dependency inventory, why each was chosen, and where in the codebase it's used.

## Runtime

| Tech | Version | Why |
|---|---|---|
| **Next.js** | 16.1.2 (Turbopack) | App Router for ISR + RSC. Vercel deploy is one-click. Middleware for auth. Image optimisation built-in. |
| **React** | 19.2.3 | Required by Next 16. RSC + suspense + use() hooks. |
| **TypeScript** | 5.x | Type safety across the entire app. |
| **Node.js** | 20+ | Required for Next 16 + sharp + Supabase JS. |

## Styling

| Tech | Why |
|---|---|
| **Tailwind CSS v4** (`@tailwindcss/postcss`) | Utility-first; v4's `@theme inline` lets us declare brand colours in CSS without a config file. |
| **shadcn/ui** + **@base-ui/react** | Unstyled accessible primitives (Dialog, Dropdown, Select, Tabs, Tooltip). 24+ components installed via shadcn CLI. |
| **tw-animate-css** | Animation utilities that complement Tailwind. |
| **class-variance-authority** + **tailwind-merge** + **clsx** | Variant API for component styling + safe class merging (`cn()` helper in `src/lib/utils.ts`). |

## Data layer

| Tech | Why |
|---|---|
| **Supabase Postgres** | Managed Postgres with RLS, real-time, instant REST API. Project ref: `tvuhxqcpunavphakuzhm`. |
| **Supabase Storage** | Three buckets: `property-images`, `blog-images`, `area-images`. CDN-served. |
| **Supabase Auth** | Email/password admin auth. JWT cookies. Refreshed by middleware on every admin route. |
| **@supabase/ssr** | App-Router-friendly client factories (server / browser / static). |
| **@supabase/supabase-js** | Standard client used inside `createStaticSupabaseClient` for build-time + cached fetches. |

Three separate client factories live in `src/lib/`:
- `supabase.ts` — browser client (anon key, cookie-aware)
- `supabase-server.ts` — RSC / server-action client (cookie-aware via `next/headers`)
- `supabase-static.ts` — build-time / cache client (no cookies, safe for `unstable_cache`)

## Forms

| Tech | Status |
|---|---|
| **react-hook-form** | Installed; not yet integrated into PropertyForm (still uses manual useState) — listed as next-step priority. |
| **zod** + **@hookform/resolvers** | Schema validation companion. Used inline in API routes; not yet wired to forms. |

## Tables

| Tech | Status |
|---|---|
| **@tanstack/react-table** | Installed; not yet used in admin property listing — listed as next-step priority. |

## Drag & Drop

| Tech | Where |
|---|---|
| **@dnd-kit/core** + **@dnd-kit/sortable** + **@dnd-kit/utilities** | Image gallery reordering in `ImageUploader`, featured property reordering in admin dashboard. **Admin-only** — never imported from public routes. Tree-shaken via `optimizePackageImports`. |

## Maps

| Tech | Where |
|---|---|
| **leaflet** + **react-leaflet** | Used in two places: public `AreasLeafletMap` (areas index map) and admin `CoordinatePicker` (area coord editing). Lazy-loaded via `React.lazy()` in `AreasIndexClient` so it stays out of every other route's bundle. |

The map tile provider is **CartoDB Positron** (free, no API key). See [MAP_SYSTEM.md](./MAP_SYSTEM.md).

## Icons

| Tech | Why |
|---|---|
| **lucide-react** | Clean line icons. Tree-shaken via `optimizePackageImports`. Default stroke weight bumped to 1.5 for the luxury aesthetic. |

## Notifications

| Tech | Where |
|---|---|
| **sonner** | Toast notifications. `<Toaster position="top-right" richColors />` in root layout. Used by admin actions ("Property saved", "Image upload failed", etc.). |

## PDF Generation

| Tech | Where |
|---|---|
| **@react-pdf/renderer** | Property brochure PDF generation. Lives **only** in `src/app/api/property/[slug]/brochure/route.tsx` (an API route, server-only) — never leaks into client bundles. See [PDF_BROCHURE_GUIDE.md](./PDF_BROCHURE_GUIDE.md). |
| **sharp** | Server-side image processing. Used by the brochure route to download + resize property photos before embedding, and by `src/lib/blur.ts` to generate blur placeholders. |

## Web Scraping

| Tech | Where |
|---|---|
| **cheerio** | HTML parsing for the property scraper. Lives **only** in `src/app/api/admin/scrape/route.ts` (API route) — server-only. See [SCRAPER_SYSTEM_GUIDE.md](./SCRAPER_SYSTEM_GUIDE.md). |

## Date Handling

| Tech | Why |
|---|---|
| **date-fns** | Functional, tree-shakeable. Tree-shaken via `optimizePackageImports`. Used for blog publish/update dates. |

## Analytics & Monitoring

| Tech | Where |
|---|---|
| **@vercel/speed-insights** | Auto-mounted in root layout. Tracks Core Web Vitals (LCP, FID, CLS) without consent (no PII, no cookies). |
| **@next/third-parties** | Provides `<GoogleAnalytics />` for GA4. Mounted via custom `<Analytics />` wrapper that gates loading behind cookie consent. |

Meta Pixel is loaded via a manual `<Script>` block inside `Analytics.tsx` rather than `@next/third-parties` (no `MetaPixel` export there) — also gated behind consent.

## Fonts

Loaded via `next/font/google` in `src/app/layout.tsx` with `display: 'swap'`:
- Geist (sans, UI)
- Inter (sans, fallback)
- Gloock (serif, headings)
- Jost (sans, body)

## Dev tooling

| Tech | Why |
|---|---|
| **eslint** + **eslint-config-next** | Standard Next ESLint config. |
| **typescript** | Strict mode on. `npx tsc --noEmit` for typecheck. |

## Why not chosen

- **No CMS** (Sanity/Contentful) — Supabase is the source of truth. Admin panel is internal.
- **No state library** (Redux/Zustand) — RSC eliminates 90% of state needs; localStorage handles favourites.
- **No animation lib** (Framer/Motion) — CSS animations are enough for the brand voice (slow, eased, decorative). Saves ~80 KB of JS.
- **No CSS-in-JS** (Emotion/styled) — Tailwind covers it; CSS-in-JS would slow runtime.
- **No GraphQL client** — Supabase REST + RPC + JS client is enough.
- **No i18n library** (next-intl) — only English right now; Spanish handled via metadata keywords. When adding `/es/`, evaluate next-intl.

## Heavy dependency audit (>~100 KB)

| Package | Size (rough) | Public bundle? |
|---|---|---|
| `@react-pdf/renderer` | ~1.2 MB | ❌ API route only |
| `leaflet` + `react-leaflet` | ~600 KB | ❌ Lazy-loaded only on `/areas` |
| `cheerio` | ~200 KB | ❌ API route only |
| `@dnd-kit/*` | ~300 KB | ❌ Admin only |
| `@base-ui/react` | ~160 KB | ⚠️ Used across UI (acceptable) |
| `date-fns` | ~130 KB | ✅ Tree-shaken via `optimizePackageImports` |
| `lucide-react` | ~80 KB | ✅ Tree-shaken |
| `sharp` | ~30 MB on disk (build tool) | ❌ Server-only |

Net public bundle is well-controlled.

## Repo & deployment

- **Source**: `github.com/alessiomauri/Marbella-Live`
- **Deploy**: Vercel auto-deploy from `main` branch. Default Next.js build. ISR + image optimisation served from Vercel Edge.
- **Domain**: `marbella.live` (set as `NEXT_PUBLIC_SITE_URL`)
