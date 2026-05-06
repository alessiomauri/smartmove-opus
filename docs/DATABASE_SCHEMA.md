# Database Schema

Supabase project ref: **`tvuhxqcpunavphakuzhm`**. URL: `https://tvuhxqcpunavphakuzhm.supabase.co`.

All tables live in the `public` schema. RLS is enabled on every table.

---

## Tables

### `properties` (13 rows)

The core entity. Every column:

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | uuid (PK) | `uuid_generate_v4()` | |
| `name` | text | — | Display name (e.g. "Villa Amara") |
| `slug` | text (unique) | — | URL slug |
| `status` | enum `property_status` | `'available'` | `available\|sold\|reserved\|under_offer\|coming_soon` |
| `property_type` | text | `'villa'` | CHECK: `villa\|apartment\|plot_with_project` |
| `price` | numeric | NULL | EUR. Null when price_on_request |
| `price_on_request` | bool | `false` | |
| `location` | text | — | Display label (e.g. "El Herrojo, Benahavis") |
| `area` | text | — | Must match one of 12 main `areas.name` values |
| `micro_location` | text | NULL | Optional `areas.slug` for sub-area linking |
| `description` | text | — | Markdown allowed; rendered with paragraph splits |
| `bedrooms` | int | NULL | |
| `bathrooms` | int | NULL | |
| `interior_size` | numeric | NULL | m² |
| `terrace_size` | numeric | NULL | m² |
| `plot_size` | numeric | NULL | m² |
| `orientation` | text | NULL | `North`, `South-West`, etc. |
| `has_pool` | bool | `false` | |
| `parking_spaces` | int | NULL | |
| `features` | text[] | `'{}'` | Free-form list, picked from `feature_options` |
| `hero_image` | text | — | Supabase storage URL |
| `hero_image_blur` | text | NULL | Base64 blur placeholder (~600 bytes) |
| `gallery_images` | text[] | `'{}'` | Ordered Supabase storage URLs |
| `floor_plan_images` | text[] | `'{}'` | |
| `latitude` | numeric | NULL | |
| `longitude` | numeric | NULL | |
| `location_description` | text | NULL | Map blurb |
| `is_featured` | bool | `false` | Pins to top of listings |
| `featured_order` | int | `0` | Among featured, lower comes first |
| `published` | bool | `false` | RLS: anon SELECT requires this true |
| `created_at` | timestamptz | `now()` | |
| `updated_at` | timestamptz | `now()` | |

**RLS policies**:
- Anon: SELECT WHERE `published = true`
- Authenticated: ALL

### `areas` (42 rows)

Location/neighbourhood catalogue. Drives map pins, area pages, and property→area linking.

| Column | Type | Default | Notes |
|---|---|---|---|
| `slug` | text (PK) | — | URL slug |
| `name` | text | — | Display name |
| `region` | enum `area_region` | — | `Marbella\|Estepona\|Benahavis\|Mijas\|Fuengirola\|Torremolinos\|Malaga\|Casares\|Manilva\|San Roque` |
| `pin_category` | text | `'micro'` | CHECK: `main\|micro\|resort\|airport` |
| `parent_area` | text | NULL | Optional slug of parent area (hierarchy) |
| `is_micro_location` | bool | `false` | Legacy flag, mostly superseded by pin_category |
| `title` | text | — | `<title>` for SEO |
| `meta_description` | text | `''` | |
| `heading` | text | `''` | H1 on the area page |
| `subheading` | text | `''` | Tagline below H1 |
| `description` | text | `''` | Long-form prose |
| `property_types` | text[] | `'{}'` | What's typically available (used in copy) |
| `highlights` | text[] | `'{}'` | Bullet points |
| `coordinates_lat` | numeric | `0` | For map pin |
| `coordinates_lng` | numeric | `0` | |
| `price_range` | text | `''` | Free-form e.g. "€1M – €15M" |
| `nearby_areas` | text[] | `'{}'` | Slugs to show in "nearby" section |
| `keywords` | text[] | `'{}'` | SEO meta keywords |
| `hero_image` | text | `''` | Supabase storage URL |
| `hero_image_alt` | text | `''` | Alt text for SEO |
| `hero_image_blur` | text | NULL | Base64 placeholder |
| `display_order` | int | `0` | Sort order in admin lists |
| `published` | bool | `true` | |
| `created_at` | timestamptz | `now()` | |
| `updated_at` | timestamptz | `now()` | |

**RLS**: Anon SELECT all (no `published` filter at SQL level — UI filters in queries).

**Hierarchy convention**: 12 main areas (`pin_category='main'`), ~25 micro areas, 5 resorts, 1 airport. `Nueva Andalucia` and `Marbella East` have `parent_area = 'marbella'` (special case — they're main areas under Marbella for nesting).

### `blog_posts` (7 rows)

| Column | Type | Notes |
|---|---|---|
| `slug` | text (PK) | URL slug |
| `title` | text | |
| `meta_description` | text | |
| `category` | enum `blog_category` | `buying-guide\|selling-guide\|area-guide\|market-report\|lifestyle\|investment` |
| `excerpt` | text | Card preview |
| `content` | text | Markdown body |
| `keywords` | text[] | SEO |
| `published_at` | date | |
| `updated_at_date` | date | (Different from `updated_at` timestamptz) |
| `reading_time` | text | e.g. "5 min read" |
| `featured` | bool | |
| `hero_image` | text | |
| `hero_image_alt` | text | |
| `published` | bool | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `collections` (2 rows) + `collection_properties` (7 rows)

Curated property lists.

`collections`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `slug` | text (unique) | URL slug |
| `title` | text | |
| `message` | text | Optional intro (e.g. "Hand-picked for John") |
| `type` | text | CHECK: `community\|personal` |
| `cover_image` | text | |
| `recipient_name` | text | For personal collections |
| `is_published` | bool | |
| `view_count` | int | Increments on visit |
| `created_at` / `updated_at` | timestamptz | |

`collection_properties` (junction):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `collection_id` | uuid (FK → collections.id) | |
| `property_id` | uuid (FK → properties.id) | |
| `sort_order` | int | Order within the collection |
| `created_at` | timestamptz | |

### `feature_options` (101 rows)

Catalogue of property amenities. Admin can add custom features which persist here.

| Column | Type |
|---|---|
| `id` | uuid (PK) |
| `name` | text (unique) |
| `category` | text — defaults to `'Other'` |
| `created_at` | timestamptz |

Categories used in the UI: `Views`, `Pool & Water`, `Wellness & Leisure`, `Entertainment`, `Living`, `Technology & Systems`, `Outdoor`, `Parking & Access`, `Other`.

### `site_settings` (1 row, `id = 1`)

Global config. The CHECK constraint enforces a single row.

| Column | Type | Notes |
|---|---|---|
| `id` | int (PK, CHECK = 1) | Always 1 |
| `default_sort` | text | CHECK: `newest\|price_asc\|price_desc\|name`. Drives homepage default order. |
| `updated_at` | timestamptz | |

---

## Storage Buckets

Three public buckets configured on the Supabase project:

| Bucket | Purpose | Public read |
|---|---|---|
| `property-images` | Property hero, gallery, floor plans | ✅ |
| `area-images` | Area hero photos. Stored under `hero/<slug>.jpg` | ✅ |
| `blog-images` | Blog hero + inline images | ✅ |

**RLS on storage**: by default, only authenticated users can INSERT/UPDATE/DELETE. For one-shot bulk operations (e.g. backfilling area photos), the pattern is to add a temporary `FOR INSERT TO anon WITH CHECK (bucket_id = '...')` policy, run the script, then DROP the policy. See `scripts/backfill-blurs.mjs` for the same pattern applied to row updates.

---

## Enums

```sql
CREATE TYPE property_status AS ENUM (
  'available', 'sold', 'reserved', 'under_offer', 'coming_soon'
);

CREATE TYPE area_region AS ENUM (
  'Marbella', 'Estepona', 'Benahavis', 'Mijas', 'Fuengirola',
  'Torremolinos', 'Malaga', 'Casares', 'Manilva', 'San Roque'
);

CREATE TYPE blog_category AS ENUM (
  'buying-guide', 'selling-guide', 'area-guide',
  'market-report', 'lifestyle', 'investment'
);
```

---

## Foreign Keys

Only `collection_properties` carries FKs:
- `collection_id → collections.id` (CASCADE if collection deleted)
- `property_id → properties.id` (CASCADE if property deleted)

All other "links" are loose text references resolved client/server-side:
- `properties.area` → matches `areas.name` (text, not FK)
- `properties.micro_location` → matches `areas.slug` (text, not FK)
- `areas.parent_area` → references `areas.slug` (text, not FK — could be made self-FK)
- `areas.nearby_areas[]` → array of `areas.slug` (no FK)

---

## Indexes

Standard PK + unique indexes on:
- `properties.id`, `properties.slug`
- `areas.slug`
- `blog_posts.slug`
- `collections.id`, `collections.slug`
- `feature_options.name`

No additional manual indexes have been added — the table volumes (≤50 rows on most tables) don't warrant them.

---

## Common Queries

### Get all published properties for the homepage
```sql
SELECT id, slug, name, status, property_type, price, price_on_request,
       location, area, micro_location, bedrooms, bathrooms, interior_size,
       plot_size, hero_image, hero_image_blur, is_featured, featured_order,
       features, description, created_at
FROM properties
WHERE published = true
ORDER BY created_at DESC;
```
Wrapped by `getCachedPublishedProperties` in `src/lib/cache.ts`.

### Get an area's properties
```ts
// In src/lib/cache.ts
export async function getPropertiesForArea(opts: {
  areaName?: string;
  childAreaNames?: string[];
  microLocationSlugs?: string[];
}): Promise<Property[]>
```
Filters the cached property list in memory — no extra Supabase round-trip.

### Get a single property
```sql
SELECT * FROM properties WHERE slug = $1 AND published = true;
```
Server action `getPropertyBySlug` in `src/lib/actions/properties.ts`.

---

## Migrations

Migrations are applied via the Supabase MCP `apply_migration` tool. Recent ones include:
- `add_hero_image_blur_columns` — added `hero_image_blur text` to `properties` and `areas`
- (earlier) `add_property_type_column`, `add_micro_location_column`, etc.

When adding new columns:
1. `ALTER TABLE … ADD COLUMN …`
2. Issue `NOTIFY pgrst, 'reload schema';` so PostgREST picks up the change immediately
3. Update the TypeScript types in `src/types/`
4. Update `LIST_COLUMNS` in `src/lib/cache.ts` if the column is needed in listing payloads
