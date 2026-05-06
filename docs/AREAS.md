# Areas System

Locations / neighbourhoods / resorts on the Costa del Sol. The areas system powers:
- The `/areas` directory page (map + region-filtered list)
- Per-area landing pages at `/areas/[slug]` (hero + description + properties + child areas + nearby areas)
- The micro-location dropdown in the property admin form
- Property→area filtering on listings

---

## Hierarchy

42 area rows total, classified by `pin_category`:

- **12 main** towns / headline areas (`pin_category='main'`): Marbella, Marbella East, Nueva Andalucia, Benahavis, Estepona, Casares, Manilva, Sotogrande, Mijas, Fuengirola, Torremolinos, Malaga
- **~25 micro** neighbourhoods / urbanisations (`pin_category='micro'`): Golden Mile, Sierra Blanca, Aloha, La Quinta, Elviria, Los Monteros, Cabopino, Puerto Banus, San Pedro, Guadalmina, El Rosario, etc.
- **5 resorts** (`pin_category='resort'`): Puente Romano, Finca Cortesin, La Zagaleta, Villa Padierna, Higueron Resort
- **1 airport** (`pin_category='airport'`): Malaga Airport (excluded from grid + bounds)

### Parent linking

Each area row has a nullable `parent_area` text column referencing another area's slug. This drives:

- **Marbella group special case**: `nueva-andalucia` and `marbella-east` are main areas with `parent_area = 'marbella'`. This means visiting `/areas/marbella` automatically pulls in their listings + their micros (Aloha under NA, Elviria under ME, etc.). Visiting `/areas/nueva-andalucia` only shows NA's own listings + NA-only micros. Same for ME. NA and ME do NOT cross-pollinate.
- **Micros under their parent main area**: `golden-mile` has `parent_area = 'marbella'`, `aloha` has `parent_area = 'nueva-andalucia'`, etc.

### Property→area linking

Properties carry two text fields (no FK):
- `area` (text) — must equal one of the 12 main `areas.name` values, set via dropdown in PropertyForm
- `micro_location` (text, nullable) — must equal an `areas.slug` of a sub-area; admin picks from a filtered dropdown showing children of the selected main area

Filtering logic (`getPropertiesForArea` in `src/lib/cache.ts`):

```ts
result = all.filter((p) => {
  if (areaName && p.area === areaName) return true;
  if (childAreaNames.length && childAreaNames.includes(p.area)) return true;
  if (microLocationSlugs.length && p.micro_location) {
    return microLocationSlugs.includes(p.micro_location);
  }
  return false;
});
```

For the Marbella page, `areaName='Marbella'` + `childAreaNames=['Nueva Andalucia','Marbella East']` + `microLocationSlugs=['marbella','golden-mile','sierra-blanca','aloha','elviria',...]` — covers everything in that group. For NA, only `areaName='Nueva Andalucia'` + the NA-only micro slugs.

---

## `/areas` Directory Page

**Files**: `src/app/areas/page.tsx` (Server) + `src/app/areas/AreasIndexClient.tsx` (interactive).

### Server

- ISR with `revalidate = 3600`
- Fetches `getPublishedAreas()`
- Generates `WebPage` + `BreadcrumbList` JSON-LD
- Renders `AreasIndexClient`

### Client

Composed of:
1. **Hero block** — title, subheading
2. **Featured trio** — cards for Marbella / Estepona / Mijas (`FEATURED_SLUGS` constant)
3. **Map** — `AreasLeafletMap` lazy-loaded (`React.lazy`) so leaflet stays out of every other route's bundle
4. **Macro region filter buttons** — Marbella / Benahavis / Estepona / Western Coast / Mijas & East. Clicking one zooms the map to that region's bounds.
5. **CompactDirectory** — text list grouped by region. Region headers link to the main area, children indented underneath with left-border indent. Resorts get a "Resort" tag and taupe styling; micros get grey.

The directory tree is built from `parent_area` relationships:
```
Region (header)
├── Main area (teal)
│   ├── Resort child (taupe + "Resort" tag)
│   └── Micro child (grey)
```

---

## `/areas/[slug]` Detail Page

**Files**: `src/app/areas/[slug]/page.tsx` (Server) + `AreaPageClient.tsx` (client wrapper).

### Server (`page.tsx`)

- ISR with `revalidate = 3600`
- `generateStaticParams` pre-builds all area slugs
- `generateMetadata` produces title, description, geo tags (`geo.region: ES-AN`, `geo.position: lat;lng`, `ICBM`), canonical, hreflang (en-US + es-ES + x-default), OG with hero image, Spanish keyword variants
- Resolves: parent area, child areas (direct children), all descendant areas (recursively), nearby areas (from `nearby_areas[]` slug list)
- Server-fetches the property list via `getPropertiesForArea()` using the descendants logic
- Sorts properties featured-first
- Injects `Place` + `BreadcrumbList` + `FAQPage` JSON-LD
- Renders `AreaPageClient` with all data as props

### Client (`AreaPageClient.tsx`)

Composes:
- **Header** — same sticky glass header as homepage (different content: brand + "All Properties" link + Saved)
- **Breadcrumbs** — Home > Areas > (parent if any) > Current
- **Hero side-by-side** — image (left, 4/3 aspect, blur placeholder) + text block (right, with eyebrow region tag, heading, subheading, description paragraphs, highlights bullets, property types pills)
- **Properties section** — uses `<PropertyGrid>` with the server-fetched properties
- **Child areas section** (when present) — grid of cards for direct children with hero thumbnails
- **Nearby areas section** (when `nearby_areas[]` populated) — chips linking to other area pages
- **Footer** — `SiteFooter` with internal links to top areas + main routes (good for SEO crawl)

---

## Areas Admin

`/admin/areas` — list grouped by region. Click an area to edit at `/admin/areas/[slug]/edit`.

`AreaForm.tsx` provides:
- Basic fields (slug, name, region, pin_category, parent_area dropdown)
- Description, heading, subheading, meta_description
- Property types and highlights (text[] editors)
- Keywords editor
- `CoordinatePicker` — Leaflet map with a draggable pin to set lat/lng visually
- `nearby_areas[]` editor (multi-select of other area slugs)
- Hero image upload + alt text
- Display order, published toggle

On save, `updateArea` server action:
1. Generates `hero_image_blur` if hero changed (via `generateBlurDataURL`)
2. Updates the row
3. `revalidatePath('/admin/areas')`, `revalidatePath('/areas')`, `revalidatePath('/areas/${slug}')`
4. `updateTag(AREAS_TAG)` — invalidates the cache

The admin can also seed/re-seed from `src/lib/areas-data.ts` via `seedAreasFromStatic` for initial setup.

---

## Special Behaviours

### Coordinate picker
Click anywhere on the map to drop the pin; drag to fine-tune. Uses CartoDB Positron tiles. See [MAP_SYSTEM.md](./MAP_SYSTEM.md).

### Region grouping
Each area belongs to one of 10 `area_region` enum values. Used to group the directory and decide map zoom-to-region targets.

### Pin category vs is_micro_location
Both columns exist for legacy reasons. `pin_category` is the source of truth for visual classification. `is_micro_location` is older and mostly unused now.

---

## Recreating the Areas System

1. Create the `areas` table per [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md). RLS: anon SELECT all.
2. Create the `area_region` enum.
3. Create the `area-images` storage bucket (public read).
4. Copy `src/types/area.ts`.
5. Copy `src/lib/areas-data.ts` (seed data) and `src/lib/actions/areas.ts` (CRUD + seedAreasFromStatic).
6. Copy `src/app/areas/page.tsx` + `AreasIndexClient.tsx`.
7. Copy `src/app/areas/[slug]/page.tsx` + `AreaPageClient.tsx`.
8. Copy `src/components/areas/AreasLeafletMap.tsx`.
9. Copy `src/components/admin/AreaForm.tsx` + `CoordinatePicker.tsx`.
10. Add the `getPropertiesForArea` helper to `src/lib/cache.ts` if you've ported the cache layer.
11. Run the seed action from `/admin/areas` once to populate.
12. Upload area hero images via the admin form.
