# Admin Panel

The internal-only admin interface lives under `/admin/*`. Protected by Supabase Auth + Next.js middleware. See [AUTH.md](./AUTH.md).

---

## Routes

| Route | Purpose |
|---|---|
| `/admin/login` | Email + password sign-in |
| `/admin` | Dashboard: property list, search, filters, publish toggles, featured ordering |
| `/admin/properties/new` | Create property |
| `/admin/properties/[id]/edit` | Edit property |
| `/admin/areas` | Areas list grouped by region |
| `/admin/areas/[slug]/edit` | Edit area (with CoordinatePicker map) |
| `/admin/blog` | Blog post list |
| `/admin/blog/new` | Create blog post |
| `/admin/blog/[slug]/edit` | Edit blog post |
| `/admin/collections` | Collections list |
| `/admin/collections/new` | Create collection |
| `/admin/collections/[id]/edit` | Edit collection (property picker, sort order) |
| `/admin/seed` | Seed DB from static data files (one-shot setup) |

---

## Dashboard (`/admin`)

`src/app/admin/page.tsx`:
- Lists all properties (admin sees unpublished too)
- Search box (filters in-memory)
- Status filter dropdown
- Type filter dropdown
- Each row: thumbnail, name, location, price, status badge, published toggle, edit link
- **Featured ordering**: properties marked `is_featured` appear in a special drag-and-drop list at the top, ordered by `featured_order`. Uses `@dnd-kit/sortable`.
- "Add Property" button → `/admin/properties/new`

Uses the `useAdminProperties` hook, which fetches all rows directly from Supabase (no `published` filter, since admin needs to see drafts).

Mutations (delete, toggle published) call `revalidateProperties()` server action after each one to invalidate the public ISR cache.

---

## Property Form (`PropertyForm.tsx`)

The most complex form in the app. Tabbed layout:

### Tab 1: Basic
- Name, slug (auto-generated from name)
- Status (dropdown of `PropertyStatus` enum)
- Property Type (Villa / Apartment / Plot with project)
- Area (dropdown of 12 main areas)
- Micro-location (dropdown filtered to children of the selected area)
- Location (display label)
- Price + Price on request toggle
- Bedrooms, Bathrooms
- Interior, terrace, plot size
- Orientation
- Has pool, parking spaces

### Tab 2: Features
- Loads `feature_options` from DB (101 items across 8 categories)
- Multi-select chips grouped by category
- "+ Add custom feature" — stores via `addFeatureOption` server action so it persists for future properties

### Tab 3: Media
- Hero image picker (single image, sets `hero_image`)
- Gallery uploader (multi-image, drag-reorderable, sets `gallery_images[]`)
- Floor plan uploader (sets `floor_plan_images[]`)
- All use the shared `ImageUploader` component

### Tab 4: Location
- Latitude / Longitude inputs (manual or via map click — there's no embedded `CoordinatePicker` here yet; admin types coords)
- `location_description` (rich-text-ish blurb shown on the map section)

### Tab 5: Social
- `SocialContentGenerator` produces ready-to-paste WhatsApp + Instagram content based on the property's data

### Toolbar
- **URL Scraper**: paste a competitor URL → server fetches + parses the listing → pre-fills the form. See [SCRAPER_SYSTEM_GUIDE.md](./SCRAPER_SYSTEM_GUIDE.md).
- **Save Draft** / **Publish** / **Unpublish** / **Delete**

On save, calls `createProperty` or `updateProperty` server action. These:
1. Validate auth
2. Generate `hero_image_blur` if hero changed (via sharp)
3. Persist to Supabase
4. `revalidatePath('/admin')`, `revalidatePath('/')`, `revalidatePath('/property/${slug}')`
5. `updateTag(PROPERTIES_TAG)` — public cache invalidates instantly

---

## Image Uploader (`ImageUploader.tsx`)

The shared component for property photos, area heroes, and blog heroes.

Features:
- **Drag-and-drop area** — drops files anywhere in the dropzone or click to file picker
- **Mass upload** — select 50 files at once; uploads in parallel with progress
- **Reorder** — `@dnd-kit/sortable`, drag thumbnails to rearrange
- **Hero selection** — click the star on any thumbnail to mark as hero
- **Bulk delete** — checkbox each thumbnail, "Delete selected" button
- **Import from URL** — bulk import images from external URLs (pastes URL list, server downloads + uploads to Supabase storage). See `/api/admin/import-images`.

Stored in: `property-images` (or `area-images`/`blog-images` depending on prop).

Uploads go directly via the browser to Supabase storage using the anon key + an admin-time RLS policy (authenticated users can INSERT to these buckets).

---

## Areas Admin (`/admin/areas`)

List view groups areas by region. Each row: slug, name, region tag, pin_category badge, parent_area, published toggle, edit button.

`AreaForm.tsx`:
- Slug, name, region, `pin_category` dropdown
- `parent_area` dropdown (other area slugs)
- Title, meta_description, heading, subheading, description (long-form)
- Property types editor (text[] chips)
- Highlights editor (text[] chips)
- Keywords editor (text[] chips, used in SEO meta)
- `nearby_areas` multi-select (other slugs)
- `CoordinatePicker` Leaflet map for setting coords visually
- Hero image picker + alt text
- Display order, published toggle
- Price range (free-text)

Save action: `updateArea` — auto-generates blur for new hero images, invalidates `AREAS_TAG`.

The `/admin/seed` page also has a "Re-seed areas from static data" button that calls `seedAreasFromStatic` (idempotent upsert of `src/lib/areas-data.ts`).

---

## Blog Admin (`/admin/blog`)

List view: posts table (title, category badge, published, featured, edit).

`BlogForm.tsx`:
- Slug, title, meta_description, excerpt
- Category dropdown (6 enum values)
- Hero image + alt text
- Reading time (free-text, e.g. "5 min read")
- Featured toggle, published toggle
- Keywords editor
- Markdown content editor (textarea — no rich text editor yet)

Save: `createBlogPost` / `updateBlogPost` server actions.

---

## Collections Admin (`/admin/collections`)

For curated lists of properties. Two types:
- `community` — public, indexable, listed (e.g. "Beachfront villas")
- `personal` — recipient-specific (e.g. "John Smith — your shortlist"), `noindex`

`CollectionForm.tsx`:
- Title, slug, type, message, recipient_name, cover_image
- `CollectionPropertyPicker` — sortable list of properties; add by search
- Published toggle

Save calls `createCollection` / `updateCollection` server actions. Collection→property junction rows are inserted/updated/deleted to match.

---

## Seed Page (`/admin/seed`)

One-shot maintenance buttons:
- **Seed areas from static data** → calls `seedAreasFromStatic`
- **Seed blog posts from static data** → similar
- (Future) **Backfill hero blurs** → call `backfillHeroBlurs`

Useful for first-run setup and recovery.

---

## Auth & Protection

Middleware (`src/middleware.ts`) gates every `/admin/:path*` route:
- Calls `supabase.auth.getUser()` (refreshes JWT cookies)
- If no user: redirect to `/admin/login`
- If on login page already authed: redirect to `/admin`

`src/app/admin/login/page.tsx` is a client component that calls the `signIn` server action and on success forces a hard navigation to `/admin`.

There's no signup flow — admin users are created manually via Supabase dashboard.

---

## Cache Invalidation Pattern

When admin saves anything that affects the public site:

**Server actions** call:
```ts
revalidatePath('/admin');
revalidatePath('/');
revalidatePath(`/property/${slug}`);  // or area, etc.
updateTag(PROPERTIES_TAG);            // or AREAS_TAG
```

**Client-side admin hooks** (which mutate Supabase directly) call:
```ts
import { revalidateProperties } from '@/lib/actions/revalidate';
await mutation();
await revalidateProperties();  // server action that calls updateTag + revalidatePath
```

Either way, by the time the admin lands back on the public site, the cache is fresh.

---

## Scraper Integration

`PropertyForm` has a **URL Scraper** button at the top. Paste a competitor's listing URL:
- Server `/api/admin/scrape` route fetches the URL, detects whether it's an Inertia.js page (Turnkey, Hills, KeyReady) or generic HTML (Drumelia, Moving, Listings)
- Returns a normalised property object (name, price, beds, location, description, image URLs, features)
- Pre-fills the form
- Admin reviews and saves

Then **Import images**: hits `/api/admin/import-images` which downloads each external image URL via `fetch`, uploads to `property-images` Supabase storage, returns the new URLs to attach to the property. Avoids hot-linking competitors' images.

See [SCRAPER_SYSTEM_GUIDE.md](./SCRAPER_SYSTEM_GUIDE.md).

---

## Recreating the Admin

1. Set up Supabase Auth with email/password.
2. Create your admin user via the Supabase dashboard (no signup flow exposed).
3. Copy `src/middleware.ts` (auth gate).
4. Copy `src/app/admin/*` routes.
5. Copy the form components: `PropertyForm.tsx`, `AreaForm.tsx`, `BlogForm.tsx`, `CollectionForm.tsx`.
6. Copy `ImageUploader.tsx` + `CoordinatePicker.tsx`.
7. Copy server actions in `src/lib/actions/`.
8. Wire `revalidate.ts` so client-side mutations also invalidate the public cache.
9. Optionally copy `/api/admin/scrape` + `/api/admin/import-images` for the scraper system.
