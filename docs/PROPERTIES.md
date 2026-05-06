# Properties Feature

Everything that touches the `properties` table from the public side.

---

## Overview

Properties are the core entity. They render in three places publicly:
1. **Homepage** (`/`) — full grid with filters, quick buttons, sort
2. **Area pages** (`/areas/[slug]`) — filtered grid showing only that area's properties
3. **Property detail** (`/property/[slug]`) — full hero, gallery, floor plans, location, share

And on the admin side via `/admin` (list + featured ordering) and `/admin/properties/new` + `/admin/properties/[id]/edit` (form). See [ADMIN_PANEL.md](./ADMIN_PANEL.md).

---

## Data Model

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md#properties-13-rows) for the complete column list.

TypeScript shape lives in `src/types/property.ts`:

```ts
export type PropertyStatus = 'available' | 'sold' | 'reserved' | 'under_offer' | 'coming_soon';
export type PropertyType = 'villa' | 'apartment' | 'plot_with_project';

export interface Property {
  id: string;
  name: string;
  slug: string;
  status: PropertyStatus;
  property_type: PropertyType;
  price: number | null;
  price_on_request: boolean;
  location: string;          // Display label, e.g. "El Herrojo, Benahavis"
  area: string;              // Must match one of 12 main area NAMES
  micro_location: string | null;  // Optional area slug
  description: string;
  // … sizing, features, images, etc.
  is_featured: boolean;
  featured_order: number;
  hero_image_blur?: string | null;
}

export interface PropertyFilters {
  status?: PropertyStatus | 'all';
  propertyType?: PropertyType;
  area?: string;
  childAreaNames?: string[];
  microLocationSlugs?: string[];
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  features?: string[];
  search?: string;
}

export type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'name';
```

---

## Homepage Listing (`/`)

**File**: `src/app/page.tsx` (Server Component) + `src/app/HomeClient.tsx` (interactivity).

### Server side (`page.tsx`)

```ts
export const revalidate = 600;

export default async function Home() {
  const [properties, defaultSort] = await Promise.all([
    getCachedPublishedProperties(),
    getCachedDefaultSort(),
  ]);
  // Sort featured-first, newest-next so SSR HTML matches initial client state
  const sorted = sortProperties(properties);
  return (
    <>
      <script type="application/ld+json">…ItemList schema…</script>
      <script type="application/ld+json">…FAQPage schema…</script>
      <HomeClient initialProperties={sorted} defaultSort={defaultSort} />
    </>
  );
}
```

### Client side (`HomeClient.tsx`)

Owns:
- `filters` state (PropertyFilters)
- `quickPrice` state (`'under3' | '3to6' | '6plus' | null`)
- `quickType` state (`'villa' | 'apartment' | null`)
- `sort` state (overrides `defaultSort` when user changes)
- Filter sync: when FilterBar changes price/type, clear the matching quick button

Filtering is **all client-side** over `initialProperties` via `useMemo`. Zero network calls per filter interaction.

Filters applied (in order):
1. status (skip if `'all'`)
2. propertyType
3. area / childAreaNames / microLocationSlugs (any match)
4. minPrice / maxPrice (excludes nulls)
5. minBedrooms (excludes nulls)
6. features (must contain ALL selected)
7. search (matches name OR location OR description, case-insensitive)

Sort always applies featured-first (lower `featured_order` wins), then the user's chosen sort.

### Quick filter buttons

Above the grid, 5 toggle pills:
- **Villas** / **Apartments** (dark-when-active)
- **Under €3M** / **€3M – €6M** / **€6M+** (teal-when-active)
- **Clear** appears when any quick filter is active

Defined as `QuickPrice` and `PropertyType` types. Toggling an already-active button clears it.

---

## Property Card (`PropertyCard.tsx`)

Used everywhere a property is rendered in a grid (homepage, area pages, favourites, collection pages).

**Props**:
```ts
interface PropertyCardProps {
  property: Property;
  index?: number;     // For staggered fade-in animation
  priority?: boolean; // First few cards mark hero as priority
}
```

**Visual structure**:
- Image container `aspect-[4/3]` with hero image (Next/Image, blur placeholder if available)
- Overlays: gradient (top→bottom), teal hover glow, status badge (top-right), favourite heart (top-left), Featured badge (top-left, beside heart, when applicable), bottom info slide-up on hover
- Content section: name (Gloock teal) + location (uppercase grey) on a row, price + specs on a row below
- Hover: card lifts `-translate-y-1.5`, image zooms to `scale-[1.05]`, accent line appears top, ring glow
- **Hover preload**: `onMouseEnter` triggers `new Image().src = property.hero_image` to warm the browser cache before the user clicks into the detail page

Unavailable states (`sold`, `under_offer`, `reserved`) desaturate the image and use a darker glass status badge.

---

## Property Detail (`/property/[slug]`)

**File**: `src/app/property/[slug]/page.tsx` (Server) + `PropertyPageClient.tsx` (interactivity).

`page.tsx`:
- ISR with `revalidate = 3600`
- `generateStaticParams` pre-builds all published slugs at build time
- Fetches property via `getPropertyBySlug` (single-row, not cached via `unstable_cache` — fast direct fetch)
- Generates rich `generateMetadata` (title, description, OG with multiple images, keywords incl. Spanish, geo tags, price meta)
- Injects multiple JSON-LD schemas (RealEstateListing/Product, BreadcrumbList, FAQ where applicable)
- Renders `PropertyPageClient`

`PropertyPageClient.tsx` composes:
- `PropertyHeader` — sticky in-page nav (Gallery / Floorplans / Location / Download / Share / Properties / Favourites)
- `HeroSection` — full-viewport parallax with property name, location, status, scroll indicator
- `OverviewSection` — description + key stats
- `FeaturesSection` — chip cloud grouped by category
- `GallerySection` — horizontal scroll-snap gallery with lightbox
- `FloorplansSection` — when present
- `LocationSection` — embedded mini-map + neighbourhood blurb
- `MoreFromAreaSection` — sibling property cards
- `ContactCTA` — WhatsApp / share / favourite

Hero image uses `priority`, `fetchPriority="high"`, `quality={75}`, blur placeholder, `sizes="100vw"`.

---

## Filtering

`src/components/FilterBar.tsx` is the multi-facet filter UI used on homepage. Modes:
- `inline={true}` — horizontal row of dropdowns inside the desktop header
- `inline={false}` — accordion / sheet style for mobile

Facets exposed:
- Search (text input)
- Location (dropdown of `AREAS` constant + "All locations")
- Status
- Price (dual range)
- Features (multi-select)
- Sort (dropdown)

Changes are debounced by React state — no debouncing needed because filtering is in-memory.

---

## Featured Properties

Properties with `is_featured: true` always sort to the top, ordered ascending by `featured_order` (lower = higher in list).

**Visual treatment** (in `PropertyCard.tsx`):
- 2.5px gradient teal accent strip at top of card
- `ring-1 ring-[#3c9ba7]/20` halo around card
- "Featured" glass badge with star icon at top-left next to favourite heart

Admin can drag-reorder featured properties on `/admin` (the dashboard).

---

## Status & Lifecycle

| Status | Meaning | Visual treatment |
|---|---|---|
| `available` | Default, on the market | Normal rendering |
| `coming_soon` | Pre-launch | Status badge "Coming soon"; otherwise normal |
| `under_offer` | Offer accepted, awaiting completion | Image desaturates, badge "Under offer" |
| `reserved` | Reserved by client | Image desaturates, badge "Reserved" |
| `sold` | Closed | Image desaturates, badge "Sold" |

Sold/reserved/under-offer properties stay in the listing (sitemap includes them with priority 0.7 vs 0.9 for available) — this is a deliberate SEO choice; sold-property pages still rank for the property name.

---

## Cache Layer

All public reads go through `getCachedPublishedProperties()` in `src/lib/cache.ts` (see [PERFORMANCE.md](./PERFORMANCE.md)). Admin mutations call `updateTag('properties')`.

The detail page uses `getPropertyBySlug()` (NOT cached via unstable_cache — single-row direct fetch is already fast and we want fresh data on detail-page visits).

---

## Image Pipeline

Images are stored in the `property-images` Supabase bucket. `hero_image_blur` is auto-generated at admin save time via `src/lib/blur.ts` (sharp). See [IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md).

`gallery_images` is an ordered text[] of URLs. The `ImageUploader` admin component uses `@dnd-kit/sortable` to let admins reorder via drag.

---

## Recreating Properties from Scratch

1. Create the table per [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md). Enable RLS with `SELECT WHERE published = true` for anon.
2. Add the storage bucket `property-images` (public read).
3. Copy `src/types/property.ts`.
4. Copy `src/lib/cache.ts` (cache wrappers + tag constants).
5. Copy `src/lib/actions/properties.ts` (CRUD + tag invalidation).
6. Copy `src/components/PropertyCard.tsx` + `PropertyGrid.tsx`.
7. Copy `src/app/page.tsx` + `HomeClient.tsx` (homepage listing).
8. Copy `src/app/property/[slug]/page.tsx` + `PropertyPageClient.tsx` and the `src/components/property/*` subcomponents.
9. Copy `src/lib/blur.ts` for blur placeholders.
10. Wire admin from [ADMIN_PANEL.md](./ADMIN_PANEL.md).
