# New Developments

Off-plan / new-build projects. Separate entity from `properties` because the data shape is different (price/bed/size **ranges** across many units, plus developer, completion phases, masterplan).

**Current status**: admin-only. Public routes are built but disabled via a feature flag — they `notFound()` until launch. Not in sitemap, blocked in robots.txt, no nav links from anywhere on the public site.

---

## Schema

Table: `developments` (Postgres). RLS enabled.

Key columns:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `slug` | text (unique) | URL slug |
| `name` | text | Display name |
| `developer` | text | nullable |
| `status` | enum `development_status` | `off_plan \| under_construction \| key_ready \| completed \| sold_out` |
| `source` | enum `development_source` | `manual \| resales_online` |
| `source_id` | text | External feed ID when `source != 'manual'` |
| `last_synced_at` | timestamptz | Last sync timestamp |
| `title`, `meta_description`, `subtitle`, `short_description`, `description` | text | Marketing copy |
| `price_from`, `price_to` | numeric | Range — developments span many units |
| `price_on_request` | bool | |
| `bedrooms_from`, `bedrooms_to` | int | Range |
| `bathrooms_from`, `bathrooms_to` | int | |
| `size_from`, `size_to` | numeric | m² interior |
| `terrace_size_from`, `terrace_size_to` | numeric | |
| `total_units`, `units_available` | int | |
| `unit_types` | text[] | `['apartment','penthouse','townhouse','villa','duplex','studio']` |
| `completion_date` | date | Expected delivery |
| `delivery_phases` | text | Free-text e.g. "Phase 1: Q4 2026; Phase 2: Q2 2027" |
| `location`, `area`, `micro_location` | text | Same convention as properties |
| `latitude`, `longitude` | numeric | Map coords |
| `location_description` | text | Map blurb |
| `hero_image`, `hero_image_blur`, `hero_image_alt` | text | Hero |
| `gallery_images` | text[] | Renders + photos |
| `masterplan_images` | text[] | Site plans |
| `floor_plan_images` | text[] | Typical floor plans |
| `brochure_pdf` | text | URL of uploaded PDF |
| `amenities` | text[] | Pool, spa, gym, gated, etc. |
| `keywords` | text[] | SEO |
| `is_featured`, `featured_order` | bool, int | |
| `published` | bool | **Defaults `false`** — admin must explicitly publish |
| `created_at`, `updated_at` | timestamptz | |

**RLS**:
- Anon: SELECT WHERE `published = true` (will only matter when public site goes live)
- Authenticated: ALL

**Index**: `developments_source_idx (source, source_id)` for sync upserts.

**Storage bucket**: `development-images` (public read, authenticated write).

---

## Files

```
src/types/development.ts                                    # Types + status/source labels + amenity defaults
src/lib/actions/developments.ts                             # CRUD server actions (auth + revalidation)
src/lib/integrations/resales.ts                             # Resales Online sync — STUBBED until creds arrive
src/lib/cache.ts                                            # Adds DEVELOPMENTS_TAG + getCachedPublishedDevelopments
src/components/admin/DevelopmentForm.tsx                    # 6-tab admin form
src/app/admin/developments/page.tsx                         # Admin list view
src/app/admin/developments/SyncResalesButton.tsx            # Sync trigger button (calls the stub)
src/app/admin/developments/new/page.tsx                     # Create form
src/app/admin/developments/[id]/edit/page.tsx               # Edit form (server)
src/app/admin/developments/[id]/edit/EditDevelopmentClient.tsx
src/app/new-developments/feature-flag.ts                    # NEW_DEVELOPMENTS_PUBLIC = false
src/app/new-developments/page.tsx                           # Hidden public index
src/app/new-developments/[slug]/page.tsx                    # Hidden public detail
src/app/robots.ts                                           # Disallows /new-developments
```

---

## Admin workflow

`/admin/developments`:
- Table view of every development (drafts and published)
- "Sync from Resales" button (currently shows a "not configured" toast)
- "New Development" button → `/admin/developments/new`
- Banner reminds admin that public routes are off

`DevelopmentForm.tsx` is a 6-tab form:

1. **Basic** — name, slug (auto-generated), developer, status, subtitle, short + full descriptions, featured toggle
2. **Units & Pricing** — price range, bed/bath/size ranges, total/available units, unit types (apartment, penthouse, etc.), completion date, delivery phases
3. **Media** — hero (uses `HeroImagePicker` against `development-images` bucket), gallery, masterplan images, floor plans, brochure PDF URL
4. **Location** — display label, main area dropdown, micro-location slug, lat/lng, location description
5. **Amenities** — chip selector with 17 sensible defaults + custom-add
6. **SEO** — title, meta description, keywords

Save flow:
- Validates auth
- Generates `hero_image_blur` if hero changed (sharp)
- Persists row
- Calls `revalidatePath('/admin/developments')` + `revalidatePath('/new-developments')` + `updateTag(DEVELOPMENTS_TAG)`

---

## Public routes (currently hidden)

`src/app/new-developments/feature-flag.ts` exports `NEW_DEVELOPMENTS_PUBLIC = false`. Both public route files check this flag and `notFound()` immediately when it's off. Their metadata also sets `robots: { index: false, follow: false, nocache: true }` defensively.

**To launch publicly:**

1. Set `NEW_DEVELOPMENTS_PUBLIC = true` in `src/app/new-developments/feature-flag.ts`
2. Remove the two `/new-developments` lines from the disallow list in `src/app/robots.ts`
3. Add `/new-developments` entries to `src/app/sitemap.ts` (loop over `getPublishedDevelopments()` and include each slug)
4. Add a nav link from the public header to `/new-developments`
5. Add an item under `<a href="...">` in the SEO footer
6. Redeploy

---

## Resales Online integration (stubbed)

`src/lib/integrations/resales.ts` is the integration contract. Today it throws a long instructional error so the admin sees exactly what's needed:

> "Resales Online sync is not yet configured. Add API credentials to .env.local (RESALES_API_URL, RESALES_API_KEY, RESALES_AGENT_ID), then implement the fetch + map + upsert in src/lib/integrations/resales.ts."

When credentials arrive:

1. Add three env vars: `RESALES_API_URL`, `RESALES_API_KEY`, `RESALES_AGENT_ID`
2. In `src/lib/integrations/resales.ts`, uncomment the `fetchResalesDevelopments` and `mapResalesToDevelopment` helpers and adapt them to the actual Resales API response shape
3. Replace the `throw` in `syncDevelopmentsFromResales()` with the real fetch + map + upsert loop (the structure is documented in a comment block in the same file)
4. Optionally schedule a Vercel Cron job to call the sync nightly — easiest path is to expose a protected `/api/admin/developments/sync` route that calls `syncDevelopmentsFromResales()` and gate it with a shared secret, then point Cron at it

Sync semantics:
- Upsert by `(source='resales_online', source_id=remote_id)`
- Set `last_synced_at = now()` on every touched row
- After the loop, `updateTag(DEVELOPMENTS_TAG)` to invalidate the public cache

Manual entries (`source = 'manual'`) are left alone by sync — admin can edit them freely without sync overwriting their work.

---

## Recreating the developments system

1. Apply the `create_developments_table` migration (table + enums + RLS + index + storage bucket)
2. Copy `src/types/development.ts`
3. Copy `src/lib/actions/developments.ts` and `src/lib/integrations/resales.ts`
4. Add `DEVELOPMENTS_TAG` and `getCachedPublishedDevelopments` to `src/lib/cache.ts`
5. Copy `src/components/admin/DevelopmentForm.tsx`
6. Copy the four admin route files
7. Copy the two `/new-developments` public route files + `feature-flag.ts`
8. Add `'/new-developments', '/new-developments/*'` to robots.ts disallow
9. Add the nav item to `AdminHeader.tsx`
10. Add `'development-images'` to the `StorageBucket` type in `src/lib/storage.ts`
