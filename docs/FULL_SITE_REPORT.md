# Marbella Live — Full Site Report

A single end-to-end document covering what the site is, how it's built, what's live, and where it's going. Drill into the per-system docs in this folder for implementation depth.

**Status**: Pre-launch, **info-mode soft launch** (April 2026). The site is publicly accessible as a Marbella real estate **information source** — area guides, blog, calculators, market reports — but property listings + favourites are gated behind a feature flag and only visible to logged-in admins. This builds domain authority + indexing as a neutral information source. When launching the brokerage publicly, follow [GOING_PUBLIC_CHECKLIST.md](./GOING_PUBLIC_CHECKLIST.md) — flipping is a 4-file change.

**Repo**: `github.com/alessiomauri/Marbella-Live` · **Domain**: `marbella.live` · **Deploy**: Vercel auto-deploy from `main`.

---

## 1. What the Site Is

Marbella Live is a luxury real estate website for properties on the Costa del Sol (Marbella, Estepona, Benahavís, Sotogrande, and surrounding areas). It's pre-launch: the agency hasn't opened yet, but the site is being built in advance so it's mature, SEO-ranked, and operationally smooth from day one.

Three audiences:

1. **High-net-worth buyers** browsing properties in English (and increasingly Spanish via SEO keyword surface)
2. **Search engines** indexing property + area + blog content
3. **The admin (the founder)** managing the entire catalogue: properties, areas, blog posts, curated client collections

The site is intentionally **understated luxury** — not a slick portal full of CTAs and pop-ups. It reads like a high-end coffee-table monograph: generous whitespace, slow elegant animations, refined typography, a single teal accent colour. See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).

---

## 2. Tech Foundation

| Layer | Tech |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| **Styling** | Tailwind CSS v4 + shadcn/ui + @base-ui/react |
| **Database** | Supabase Postgres (project ref `tvuhxqcpunavphakuzhm`) |
| **Storage** | Supabase storage — three public buckets |
| **Auth** | Supabase Auth (email/password, admin only) |
| **Maps** | Leaflet + react-leaflet, CartoDB Positron tiles (free) |
| **Images** | Next/Image with AVIF/WebP, sharp for blur placeholders |
| **PDFs** | @react-pdf/renderer (server-only, brochure generation) |
| **Forms** | React Hook Form + Zod (installed; full integration pending) |
| **Tables** | TanStack Table (installed; admin upgrade pending) |
| **Drag & Drop** | @dnd-kit (admin only — image gallery, featured order) |
| **Web Scraping** | cheerio (server-only, property URL → form data) |
| **Analytics** | Vercel Speed Insights + GA4 + Meta Pixel (consent-gated) |
| **Deploy** | Vercel (no custom config) |

Full inventory + rationale in [TECH_STACK.md](./TECH_STACK.md).

---

## 3. Information Architecture (URLs)

### Public

| URL | Purpose |
|---|---|
| `/` | Homepage — full property grid with filters, quick buttons, sort |
| `/property/[slug]` | Property detail — hero, gallery, floorplans, location, share |
| `/areas` | Areas directory — interactive Leaflet map + region filters + hierarchical list |
| `/areas/[slug]` | Area detail — hero, description, properties in that area, child areas, nearby areas |
| `/blog` | Blog index — posts grid with category filters |
| `/blog/[slug]` | Blog post — markdown content, hero, share |
| `/collection/[slug]` | Curated property list (community or personal) |
| `/favourites` | User's saved properties (localStorage) |
| `/favourites/[shareId]` | Shared favourites (encoded in URL) |
| `/sitemap.xml` | Dynamic sitemap |
| `/robots.txt` | Dynamic robots |

### Admin (`/admin/*` — Supabase-Auth-protected via middleware)

| URL | Purpose |
|---|---|
| `/admin/login` | Sign-in |
| `/admin` | Dashboard — property list, search, filters, publish toggle, featured ordering |
| `/admin/properties/new` + `/admin/properties/[id]/edit` | Property CRUD |
| `/admin/areas` + `/admin/areas/[slug]/edit` | Area CRUD with map coord picker |
| `/admin/blog/*` | Blog CRUD |
| `/admin/collections/*` | Curated collections CRUD |
| `/admin/seed` | One-shot DB seeding from static data files |

### API Routes

| URL | Purpose |
|---|---|
| `/api/property/[slug]/brochure` | Generate property PDF brochure on demand |
| `/api/admin/scrape` | URL → normalised property object (Inertia.js + generic HTML parsers) |
| `/api/admin/import-images` | Download external image URLs → upload to Supabase storage |

---

## 4. Public Site Walkthrough

### Homepage (`/`)

The most important page. It's a **hybrid Server/Client** route:

- `src/app/page.tsx` is a Server Component. It awaits cached Supabase data (`getCachedPublishedProperties()` + `getCachedDefaultSort()`), sorts it featured-first, injects `ItemList` + `FAQPage` JSON-LD into HTML, and renders a Client child.
- `src/app/HomeClient.tsx` is `'use client'`. It receives the property list as a prop and owns all interactive state: filters, quick filter buttons (Villas / Apartments + Under €3M / €3M-€6M / €6M+), sort dropdown, FilterBar.

The full property grid is in the **initial HTML** — fast LCP, indexable by Google, served from Vercel edge cache. No Supabase round-trip from the browser on first paint. Filtering is client-side over the cached list (zero network, instant).

ISR with `revalidate = 600` (10 min) + tag-based instant invalidation when admin saves.

See [PROPERTIES.md](./PROPERTIES.md), [ARCHITECTURE.md](./ARCHITECTURE.md).

### Property Detail (`/property/[slug]`)

Composed of a parallax hero (`HeroSection`), sticky in-page nav (`PropertyHeader`), and stacked sections: overview, features, gallery, floor plans, location with map blurb, more from area, contact CTAs. Uses a `'use client'` wrapper for hero interactivity, but data + structured metadata are server-rendered.

Per-property `generateMetadata` produces:
- Rich title with location
- Description with size + price + features
- OG card with multiple images
- Spanish keyword variants
- `RealEstateListing/Product` JSON-LD
- `BreadcrumbList` JSON-LD

Hero image uses `priority`, `fetchPriority="high"`, `quality={75}`, blur placeholder, `sizes="100vw"`.

ISR with `revalidate = 3600`, `generateStaticParams` pre-builds every published property at build time.

### Areas Index (`/areas`)

Server-rendered hero + featured trio (Marbella / Estepona / Mijas), then a **lazy-loaded** Leaflet map with all 42 area pins colour-coded by category, then macro-region filter buttons that zoom to specific regions, then a hierarchical `CompactDirectory` listing every area grouped by region with parent/child indenting.

Map weighs ~600 KB — `lazy()`-loaded so it only ships on this route. See [MAP_SYSTEM.md](./MAP_SYSTEM.md).

### Area Detail (`/areas/[slug]`)

Hero (image left + text right side-by-side), then properties in that area, then child areas, then nearby areas, then SEO footer with internal links to top areas.

Properties are **server-fetched** via `getPropertiesForArea()` (filters the cached property list in memory by area name + child names + micro-location slugs). No client-side Supabase round-trip.

The area hierarchy is non-trivial. **Marbella special case**: Marbella, Nueva Andalucia, and Marbella East are all "main" areas, but NA and ME have `parent_area = 'marbella'`. So:
- Visiting `/areas/marbella` → shows everything (its own + NA + ME + their micro children)
- Visiting `/areas/nueva-andalucia` → shows only NA + NA-only micros
- Visiting `/areas/marbella-east` → shows only ME + ME-only micros
- NA and ME don't cross-pollinate

Implementation: each area collects only its own descendants via recursive `parent_area` walk. Marbella naturally pulls everything because NA and ME are its direct children.

See [AREAS.md](./AREAS.md).

### Blog (`/blog` + `/blog/[slug]`)

Six categories (`buying-guide`, `selling-guide`, `area-guide`, `market-report`, `lifestyle`, `investment`). Currently 7 placeholder posts seeded — needs real long-form content for SEO impact.

Per-post `generateMetadata` produces full `BlogPosting` JSON-LD with `articleBody`, `author`, `datePublished`, `dateModified`, etc. See [BLOG.md](./BLOG.md).

### Collections (`/collection/[slug]`)

Curated property lists for two audiences:
- **Community**: public, indexable, shareable (e.g. "Top 10 villas in Sierra Blanca")
- **Personal**: agent-built shortlists for specific buyers ("John Smith — your shortlist") with custom message + recipient name. `noindex`.

See [COLLECTIONS.md](./COLLECTIONS.md).

### Favourites (`/favourites` + `/favourites/[shareId]`)

Anonymous client-side favourites in localStorage. Share via base64-encoded URL — no backend, no auth. See [FAVOURITES.md](./FAVOURITES.md).

### Property listings — gated behind PROPERTIES_PUBLIC flag (info-mode soft launch)

The site is currently in info-mode. Property listings (`/property/[slug]`, the homepage grid, `/favourites`, the "Properties in [Area]" section on area pages) are gated behind `PROPERTIES_PUBLIC = false` in `src/lib/feature-flags.ts`.

**Info-mode homepage** (`src/app/HomeInfo.tsx`): polished editorial layout — minimal transparent header, full-bleed Marbella hero with overlay text + data sub-line ("Tracking N areas across N regions"), a "Where to start" trio (Areas / Guides / Reports), featured areas grid (6 areas, pulled from DB with hero images + blurs), latest insight (1 hero + 2 cards from blog), quiet about block, subtle newsletter capture (visual only — no backend wired yet, will plug into chosen ESP later), minimal footer. Single Server Component, only the newsletter form is a client island.

**Info-mode area pages**: when `showProperties=false`, the "Properties in [Area]" section is replaced with a richer info-mode block — at-a-glance stat cards (region, price range, neighbourhood count, property-type count), "What makes [Area] special" cards rendered from the area's `highlights[]`, "Property types you'll find here" pills from `property_types[]`, and a contextual newsletter CTA ("Get notified about [Area] property listings"). Auto-reverts to the property grid when the flag flips.

Public visitors see:

- **Homepage**: a clean, brand-led info hero (`HomeInfoClient.tsx`) instead of the property grid
- **`/property/[slug]`**: 404
- **`/favourites/*`**: 404
- **`/areas/[slug]`**: full area guide content + a "Property listings launching soon" placeholder where the property grid would be
- **`/areas` directory**: fully public — area guides ARE the content
- **`/blog`**: fully public

**Logged-in admins always see the full real-estate experience** as a live preview — visit any property URL, browse the homepage with the grid, use favourites. This lets you QA the post-launch experience without flipping the flag. The current homepage code (now `HomeListingsClient.tsx`) is preserved bit-for-bit; flipping the flag restores everything.

The play: build domain authority + indexing as a neutral info source, then reveal listings on launch day to a site Google already trusts. See [GOING_PUBLIC_CHECKLIST.md](./GOING_PUBLIC_CHECKLIST.md) for the 4-file flip.

### New Developments — admin-only, hidden from public

Off-plan / new-build projects, separate entity from properties (price/bed/size **ranges** across many units, plus developer, completion phases, masterplan). Admin can manage them via `/admin/developments`. Public routes at `/new-developments` are built but disabled via a feature flag (`NEW_DEVELOPMENTS_PUBLIC = false`); they `notFound()` until launch. Excluded from sitemap, blocked in robots.txt, no public nav links. Resales Online API sync is stubbed with a clear contract — fill in three env vars + the mapping function when credentials arrive. See [DEVELOPMENTS.md](./DEVELOPMENTS.md).

---

## 5. Admin Walkthrough

The admin is **internal-only** — there's no signup; users are created manually in the Supabase dashboard. Middleware (`src/middleware.ts`) gates every `/admin/:path*` route via Supabase Auth JWT cookies.

### Property workflow (the most-used admin flow)

1. Admin clicks "Add Property" → `/admin/properties/new`
2. Optionally pastes a competitor URL into the **Scraper** at the top of the form. Server fetches + parses (Inertia.js or generic HTML), pre-fills the form. See [SCRAPER_SYSTEM_GUIDE.md](./SCRAPER_SYSTEM_GUIDE.md).
3. Optionally clicks **Import Images** to download competitor photos and upload to our Supabase storage bucket (avoids hot-linking).
4. Admin reviews/edits across 5 tabs: Basic, Features, Media, Location, Social.
5. **Media tab**: drag-drop image upload (mass upload, reorderable via @dnd-kit, mark hero, bulk delete). Server-side `sharp` generates a `hero_image_blur` placeholder when hero changes.
6. **Features tab**: 101 amenities across 8 categories from the `feature_options` table. Custom features can be added inline and persist for future properties.
7. **Social tab**: `SocialContentGenerator` produces ready-to-paste WhatsApp + Instagram copy.
8. Admin clicks Save → server action validates auth, persists, calls `revalidatePath('/')` + `revalidatePath('/property/${slug}')` + `updateTag(PROPERTIES_TAG)`. Public cache invalidates instantly.
9. Optional: Generate PDF brochure via `/api/property/[slug]/brochure`. See [PDF_BROCHURE_GUIDE.md](./PDF_BROCHURE_GUIDE.md).

The **dashboard** (`/admin`) lists all properties with search/filter, plus a drag-and-drop list at the top for ordering featured properties.

### Area workflow

`/admin/areas` lists areas grouped by region. Edit form (`AreaForm.tsx`) includes a `CoordinatePicker` Leaflet map for setting lat/lng visually by clicking/dragging a pin.

### Other admin areas

Blog posts, curated collections, and a `/admin/seed` page for one-shot setup (re-seed areas from static data, re-seed blog posts, future blur backfill button).

Full detail: [ADMIN_PANEL.md](./ADMIN_PANEL.md), [AUTH.md](./AUTH.md).

---

## 6. Data Model

Seven tables in the `public` schema, all RLS-enabled:

| Table | Rows | Role |
|---|---|---|
| `properties` | 13 | Core entity. 30+ columns: name, slug, status, type, price, sizes, features, images, lat/lng, featured order, blur placeholder |
| `areas` | 42 | Locations + neighbourhoods + resorts. Hierarchical via `parent_area`. Categorised by `pin_category` (main/micro/resort/airport) |
| `blog_posts` | 7 | Long-form content for SEO. 6 enum categories. |
| `collections` + `collection_properties` | 2 + 7 | Curated lists with junction table for ordering |
| `feature_options` | 101 | Amenity catalogue across 8 categories. Admins can add custom features. |
| `site_settings` | 1 | Single-row config. Currently just `default_sort` for homepage. |

Plus three Supabase storage buckets: `property-images`, `area-images`, `blog-images` (all public read).

RLS pattern: anon SELECT (with `published = true` filter on properties), authenticated ALL.

Full schema in [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md).

---

## 7. Key Cross-Cutting Systems

### Render strategy + caching ([ARCHITECTURE.md](./ARCHITECTURE.md), [PERFORMANCE.md](./PERFORMANCE.md))

Every public route is **ISR** — pre-rendered at build time, served from Vercel edge, regenerated on a schedule AND invalidated instantly by admin mutations.

The cache layer (`src/lib/cache.ts`) wraps Supabase reads in `unstable_cache` with named tags (`PROPERTIES_TAG`, `AREAS_TAG`, `SITE_SETTINGS_TAG`). Admin server actions call `updateTag(...)` (Next 16's read-your-own-writes variant) on every mutation. Client-side admin hooks call `revalidateProperties()` from `src/lib/actions/revalidate.ts` after their mutations.

Net: admin saves a property → next public request gets fresh data. No 10-minute wait.

### Image system ([IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md))

- All images served via Next/Image (AVIF + WebP)
- `hero_image_blur` column on properties + areas stores a 20×20 base64 JPEG (~600 bytes) for instant blur placeholders
- `sharp` generates blurs at admin save time + via `scripts/backfill-blurs.mjs` for one-shot backfill
- Hover-preload on PropertyCards warms browser cache before clicks
- Aggressive cache headers on `/_next/image` (24h fresh + 7d stale)

### SEO ([SEO.md](./SEO.md))

Comprehensive Metadata API + JSON-LD across the site:
- Site-wide: `Organization` (RealEstateAgent), `Website`, `LocalBusiness`, default `ItemList`
- Homepage: `FAQPage` (6 high-value questions) + `ItemList` (top 10 properties)
- Property detail: `RealEstateListing/Product` + `BreadcrumbList`
- Area detail: `Place` + `BreadcrumbList` + `FAQPage` (auto-generated 3 questions per area)
- Blog post: `BlogPosting`
- Collection: `CollectionPage` + `ItemList`

Spanish keyword surface: ~22 Spanish phrases in root metadata, plus auto-generated per-area and per-property Spanish variants. `alternateLocale: ['es_ES']` in OpenGraph + `hreflang: es-ES` in alternates → captures Spanish search traffic without committing to a `/es/` subtree yet.

Dynamic `sitemap.ts` includes properties (with image refs), areas, blog posts, sort variants, popular filter combos. `robots.ts` allows public, disallows admin/API/favourites, blocks scraper bots, has per-bot rules.

### Map ([MAP_SYSTEM.md](./MAP_SYSTEM.md))

Leaflet + react-leaflet with CartoDB Positron tiles. Pin palette: teal-filled disc (main), white-with-teal-outline (micro), taupe (resort), slate plane (airport). Lazy-loaded so leaflet (~600 KB) only ships on `/areas`.

Admin gets a `CoordinatePicker` for setting area lat/lng visually.

### Analytics ([ANALYTICS.md](./ANALYTICS.md))

- **Vercel Speed Insights** — always on, no consent (no PII, no cookies)
- **GA4** + **Meta Pixel** — consent-gated via `<Analytics />` + `<CookieBanner />`. Cookie banner only appears when GA/Pixel env IDs are set; pre-launch state has no banner.
- **Google Search Console** — verification meta tag from `NEXT_PUBLIC_GSC_VERIFICATION` env var

---

## 8. Brand & Design

The brand voice is **understated luxury, modernist serenity, Mediterranean palette**. Single teal accent (`#3c9ba7`), warm bone background (`#faf9f8`), no pure white or black, slow elegant animations.

Typography:
- **Gloock** (serif) — all headings, property names, brand wordmark
- **Jost** (sans) — body
- **Geist** — UI / form inputs

Layout: 1600px max-width container, generous spacing, `rounded-[6px]` cards (sharp luxury, not plump friendly).

Animations: 400–1500ms with smooth cubic-bezier easing. Never spring physics. Never <200ms (feels cheap).

Full brand system in [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).

---

## 9. Operations

### Environment variables

```
# Required
NEXT_PUBLIC_SUPABASE_URL=https://tvuhxqcpunavphakuzhm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>

# Optional
NEXT_PUBLIC_SITE_URL=https://marbella.live
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX               # Google Analytics 4 (consent-gated)
NEXT_PUBLIC_META_PIXEL_ID=1234567890         # Meta Pixel (consent-gated)
NEXT_PUBLIC_GSC_VERIFICATION=<token>         # Search Console verification
```

When GA/Pixel IDs are unset, the cookie banner stays hidden — useful pre-launch.

### Build & deploy

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # serve production build
npx tsc --noEmit   # typecheck only
```

Vercel auto-deploys from `main` branch. Default Next.js build. No `vercel.json`.

### Monitoring

- **Vercel Speed Insights** dashboard — Core Web Vitals (LCP, INP, CLS) by route
- **Vercel Analytics** dashboard — page views, top routes, referrers, devices
- **Google Search Console** — indexed pages, search queries, click-through rates (post-launch)
- **Supabase dashboard** — DB usage, storage egress, auth event log

### When something goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| Public site shows stale data after admin edit | Cache wasn't invalidated | Confirm `updateTag(...)` was called in the server action |
| 503 on Supabase reads | Anon key missing or RLS misconfigured | Check env vars + table policies |
| Image 404 | Domain not in `next.config.ts` `remotePatterns` | Add the host |
| Slow images in dev | Next/Image processes on demand in dev | Use production build for perf testing |
| Lighthouse Performance dropping | Check First Load JS, image quotas, oversized variants | See [PERFORMANCE.md](./PERFORMANCE.md) verification checklist |
| Hero loads with grey rectangle | `hero_image_blur` is null | Run `node scripts/backfill-blurs.mjs` (after adding temp RLS UPDATE policies) |

---

## 10. Status & Roadmap

### Completed (as of April 2026)

- Full property catalogue with 30+ columns, 13 seeded properties
- 42-area catalogue with hierarchy + map + per-area landing pages
- Admin panel covering properties, areas, blog, collections, seed
- Image management: upload, reorder, mass operations, blur placeholders
- Property scraper for 6 competitor sites (Inertia.js + generic HTML)
- PDF brochure generation
- Hybrid Server/Client homepage with ISR + tag invalidation
- Comprehensive SEO: sitemap, robots, JSON-LD on every route, Spanish keyword surface
- Cookie consent + GA4 + Meta Pixel (consent-gated)
- Full design system applied site-wide
- Lazy-loaded map keeping bundle under control

### In progress / next up (priority order)

1. **Lead generation / Contact system** — inquiry forms on property pages, contact page, WhatsApp CTA buttons. The site's primary business purpose.
2. **Programmatic SEO landing pages** — `/villas-in-marbella`, `/apartments-puerto-banus`, `/properties-under-3m`, etc. Auto-generated from area × type × price-range combos. Deferred until inventory is ≥30 properties so each page has substance.
3. **Blog content** — DB and pages exist; need real long-form content (area guides, market reports, lifestyle articles) for SEO impact.
4. **Backfill blurs** — run once on production after deploy so existing properties/areas pick up blur placeholders.
5. **Admin form validation** — integrate React Hook Form + Zod into `PropertyForm` for proper error handling.
6. **Admin table upgrade** — TanStack Table for property listing with server-side pagination.
7. **Collections frontend polish** — public collection pages need design refinement + SEO optimisation.
8. **New developments page** — dedicated page for new development projects.
9. **Full Spanish (`/es/`) variant** — proper translations with `next-intl`. Currently captured via metadata keywords + `alternateLocale`.

### Known limitations

- `hero_image_blur` is auto-generated for new uploads but the existing 11 properties + 40 areas were backfilled via a one-shot script. New environments will need to run that script too.
- Some area pin coordinates are approximate — admin can fix via the `CoordinatePicker`.
- `src/lib/areas-data.ts` (static seed file) isn't fully in sync with the DB — newer areas were only added to the DB. Re-running `seedAreasFromStatic` would clobber recent additions; treat the static file as historical.
- Next 16 deprecation warning: `middleware.ts` should eventually become `proxy.ts`. Not blocking.
- Dev mode (`npm run dev`) feels slow on image loads compared to before because images now go through Next/Image optimisation. Production is dramatically faster — run `npm run build && npm start` for accurate perf testing.

---

## 11. Where to Read Next

If you're here to:

- **Onboard as a new developer** → start with [ARCHITECTURE.md](./ARCHITECTURE.md), then [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md), then drill into the feature you'll work on
- **Recreate a single subsystem in another project** → read the relevant feature doc end-to-end + DATABASE_SCHEMA + ARCHITECTURE
- **Change the brand identity** → [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- **Audit dependencies** → [TECH_STACK.md](./TECH_STACK.md)
- **Improve performance** → [PERFORMANCE.md](./PERFORMANCE.md)
- **Improve SEO** → [SEO.md](./SEO.md)
- **Set up analytics** → [ANALYTICS.md](./ANALYTICS.md)
- **Understand the admin panel** → [ADMIN_PANEL.md](./ADMIN_PANEL.md)

The single source of truth for "what's done vs what's next" lives in `~/.claude/projects/-Users-alessiomauri-Desktop-marbella-live-v2/memory/project_status.md` (auto-loaded by Claude across sessions).

---

*Document generated 2026-04-16. Keep in sync when architecture, brand, or major features change.*
