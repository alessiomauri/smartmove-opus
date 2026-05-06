# SEO

How the site ranks: metadata, structured data, sitemap, robots, language signalling.

---

## Metadata API

Every page exports either `metadata` (static) or `generateMetadata` (dynamic). Built on Next.js's typed Metadata API.

### Root metadata (`src/app/layout.tsx`)

The most important block. Includes:
- `metadataBase` — set to `NEXT_PUBLIC_SITE_URL`
- `title` template: `"%s | Marbella Live - Luxury Real Estate Marbella"`
- Default title for pages without one
- ~60 keyword phrases (English) covering main areas, property types, buyer intent, long-tail
- ~22 Spanish keyword phrases (added in the optimisation pass)
- Authors / creator / publisher
- Robots directives (index/follow, large image previews, no snippet limits)
- `alternates.languages`: en-US, en-GB, es-ES, x-default
- OpenGraph block (title, description, url, siteName, locale `en_US`, alternateLocale `[en_GB, es_ES]`, default OG image, countryName Spain)
- Twitter card config
- Geo tags (`geo.region: ES-AN`, `geo.placename`, `geo.position: 36.5100;-4.8860`, ICBM)
- Dublin Core meta tags
- `verification.google` — set from `NEXT_PUBLIC_GSC_VERIFICATION` env var

### Per-route metadata

Every dynamic route has `generateMetadata`:

- `property/[slug]` — title with location, description with size + price, OG with multiple images, Spanish keyword variants per property
- `areas/[slug]` — title + description from `area.title`/`area.meta_description`, geo tags from area coords, Spanish keyword variants per area
- `blog/[slug]` — `type: 'article'`, `publishedTime`/`modifiedTime`, `section: BLOG_CATEGORY_LABELS[category]`, Spanish blog-relevant terms

All three include `alternates.languages` with `en-US`, `es-ES`, `x-default` mapping to the same URL — telling Google "this page serves both audiences" without committing to a separate `/es/` subtree.

---

## Spanish Keyword Surface

We don't yet have a full Spanish (`/es/`) variant. Instead, we capture Spanish search traffic via:

1. **Spanish keyword phrases** in every metadata `keywords` array
2. **`alternateLocale: ['es_ES']`** in OpenGraph → tells Facebook/Google our content suits Spanish-speaking users
3. **`hreflang: es-ES`** in `alternates.languages` → tells Google to surface this page for Spanish queries

Examples seeded in metadata:
- "villas en venta Marbella", "casas Marbella", "pisos Puerto Banús"
- "propiedades de lujo Costa del Sol", "inmobiliaria Marbella"
- "comprar casa Marbella", "Milla de Oro Marbella", "Nueva Andalucía propiedades"

Per-area pages auto-generate variants based on the area name:
- `villas en ${area.name}`, `casas en ${area.name}`, `comprar en ${area.name}`, `inmobiliaria ${area.name}`, `${area.name} venta`

When real Spanish content is needed (full `/es/` variant), add proper translations + an `[locale]` segment in App Router.

---

## Structured Data (JSON-LD)

Multiple `<script type="application/ld+json">` blocks injected per page.

### Site-wide (in root layout)

- **Organization** — RealEstateAgent type with detailed `areaServed` (30+ Costa del Sol locations), `openingHoursSpecification`, `hasOfferCatalog`
- **Website** — `SearchAction` with URL template (enables Google's site-search widget)
- **LocalBusiness** — full address, geo, contact, ratings (placeholder)
- **ItemList** — Marbella Live's main offerings catalogue

### Homepage (`/`)

- **FAQPage** — 6 high-value questions ("How much does a villa in Marbella cost?", "Is Marbella a good place to buy property?", "What is the property buying process in Spain?", etc.). Drives FAQ rich snippets in SERPs.
- **ItemList** — top 10 visible properties with positions, names, URLs, prices (when available). Helps Google understand the listing structure.

### Property detail (`/property/[slug]`)

- **RealEstateListing / Product** schema with `name`, `description`, `image` (multiple), `url`, `offers` (price + currency + availability), `numberOfRooms`, `floorSize`
- **BreadcrumbList** — Home > Properties > [Area] > [Property]
- (Future) **FAQ** if property page adds Q&A section

### Area detail (`/areas/[slug]`)

- **Place** — area name, geo coords, `containedInPlace: 'Costa del Sol' → 'Andalusia, Spain'`
- **BreadcrumbList** — Home > Areas > (parent if any) > [Area]
- **FAQPage** — 3 area-specific questions auto-generated from the area data ("What are property prices like in [Area]?", "Why buy property in [Area]?", "What types of properties are available in [Area]?")

### Blog detail (`/blog/[slug]`)

- **BlogPosting** — full article schema with `datePublished`, `dateModified`, `image`, `author`, `articleBody`, `articleSection`, `keywords`, `inLanguage`

### Collection detail (`/collection/[slug]`)

- **CollectionPage** with `numberOfItems`, `provider`
- **ItemList** of properties

---

## Sitemap (`src/app/sitemap.ts`)

Dynamic. Generated on demand from Supabase. Includes:

- Static pages (home, /areas, /blog, /favourites — limited)
- Property pages (priority 0.9 for available, 0.7 for sold/reserved/under_offer/coming_soon — sold properties stay indexed because they still rank for the property name)
- Area pages (priority 0.85 for `pin_category='main'`, 0.7 for micro/resort)
- Blog posts (priority 0.7)
- Sort variant URLs (e.g. `?sort=price_asc`) — small priority bump for popular sort orders
- Filter combinations (e.g. `?propertyType=villa`)

Properties also include `<image:image>` tags pointing to hero + gallery images (Google Image indexing).

`changeFrequency`:
- Home: daily
- Areas/Properties: weekly
- Blog posts: monthly
- Status-changing pages: daily

Submitted to Google Search Console after deploy.

---

## Robots (`src/app/robots.ts`)

Dynamic. Allows public routes, disallows admin / API / favourites share pages / `/_next/`. Also blocks notorious scraper bots (AhrefsBot, SemrushBot, MJ12bot, DotBot).

Per-bot rules for:
- Googlebot — full access including images
- Google Images — extra access to image paths
- Bing, DuckDuckGo, Yandex, Baidu — full access
- Social crawlers (Facebookexternalhit, Twitterbot, LinkedInBot, WhatsApp, Pinterest) — full access for link previews

---

## Canonical URLs & hreflang

Every page sets `alternates.canonical` to its own URL. This prevents duplicate-content issues from query strings.

`alternates.languages` on key pages:
```ts
languages: {
  'en-US': pageUrl,
  'es-ES': pageUrl,
  'x-default': pageUrl,
}
```

This signals to Google that the same URL serves both languages (as opposed to having a separate `/es/page` URL).

When we later add a `/es/` subtree, switch this to:
```ts
languages: {
  'en-US': pageUrl,
  'es-ES': `${pageUrl}/es`,
  'x-default': pageUrl,
}
```

---

## OpenGraph Images

Default OG image: `/og-image.jpg` in `public/` (1200×630).

Per-route OG images:
- Property: hero + 3 gallery images, all 1200×630 with proper alt
- Area: area `hero_image`
- Blog: post `hero_image`
- Collection: dynamically generated via `opengraph-image.tsx` route (combines title + first property image)

---

## Internal Linking

- Header has links to Areas, Favourites, etc.
- `SiteFooter` (used on `/areas/[slug]`) lists top areas + main routes — boosts crawl depth
- Property detail "More from this area" section cross-links related properties
- Area detail "Nearby areas" + "Child areas" sections cross-link related areas
- Areas index has the compact directory with hierarchical links

The homepage footer is intentionally minimal right now — links will be added when more pages are ready.

---

## Spanish vs English content strategy

**Today**: English content + Spanish meta keywords + hreflang signalling. Captures Spanish search traffic without doubling content workload.

**Future** (planned): Full `/es/` subtree with translated property descriptions, area pages, blog posts. When that happens:
1. Add `[locale]` segment in App Router
2. Use `next-intl` or similar for translation management
3. Update `hreflang` to point to actual Spanish URLs
4. Update sitemap to include both language versions

---

## Programmatic SEO Landing Pages (planned, deferred)

Examples of what to build when inventory is large enough (≥30 properties):
- `/villas-in-marbella`
- `/apartments-puerto-banus`
- `/properties-under-3m`
- `/beachfront-villas-estepona`
- `/golf-villas-nueva-andalucia`

Each page filters the existing property list by area × type × price-range × feature, with hand-written (or AI-assisted) copy. Captures massive long-tail search volume.

Currently deferred — listed as next-step priority in `project_status.md`.

---

## Verification & Monitoring

- **Google Search Console**: register `marbella.live`, paste verification token into `NEXT_PUBLIC_GSC_VERIFICATION` env var, submit sitemap URL
- **Bing Webmaster Tools**: similar process, add `verification.bing` to root metadata
- Monitor: indexed page count, search queries driving impressions, click-through rates per page

Once content is bedded in (3–6 months post-launch), expect to see Marbella-related queries driving impressions.
