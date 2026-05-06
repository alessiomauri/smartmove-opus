# Marbella Live - Website Features Guide

Complete reference of all features in the Marbella Live luxury real estate website. Use this to understand what exists, how it works, and where to find the code.

---

## 1. Property Listings & Display

### Property Cards (`src/components/PropertyCard.tsx`)
- Hover effects: card lifts, image zooms, teal accents appear
- Status badge (pill design) in top-right
- Favourite heart button in top-left
- Name in Gloock font, location with animated underline
- Price + specs (beds, baths, m², plot) row
- **Unavailable properties (sold/under offer/reserved):**
  - Image desaturated (30% saturation) and darkened
  - Diagonal ribbon banner with status text
  - Muted gray title instead of teal
  - Persistent gray accent line at top
  - Status badge stays dark (no teal hover)

### Sorting & Filtering (`src/components/FilterBar.tsx`, `src/hooks/useProperties.ts`)
- **Filters:** Search (name/location/description), Location/Area dropdown, Status dropdown, Price range (min/max selects), Features (multi-select pills)
- **Sort options:** Newest, Price High to Low, Price Low to High, Name A-Z
- **Desktop:** Inline filter bar in header with Sort dropdown
- **Mobile:** Full-screen filter/sort panel via "Filters & Sort" button
- **Default sort:** Controlled by admin via `site_settings.default_sort` — visitors see admin's chosen default until they change it
- **Featured override:** Properties with `is_featured = true` always appear first regardless of sort, ordered by `featured_order`

### Featured Properties
- **Admin toggle:** Star button in admin dashboard table
- **Database:** `is_featured` boolean + `featured_order` integer on `properties` table
- **Behavior:** Featured properties are always pinned to the top of the public listing, sorted by `featured_order` among themselves
- **Admin setting:** "Display" button in admin header opens dropdown to set default sort for public site

---

## 2. Property Detail Pages

**Route:** `/property/[slug]` (server-rendered)

### Sections (top to bottom)
1. **PropertyHeader** — Sticky, transparent over hero, turns white on scroll. Contains nav anchors (Overview, Gallery, Floor Plans, Location), download brochure, share button
2. **HeroSection** — Full-viewport image with slow zoom animation, property name overlay, location badge
3. **FeaturesSection** — Two columns: specs with icons (beds, baths, sizes, orientation, pool, parking) + description text with "Read More"
4. **GallerySection** — 2×3 image grid with "View All" lightbox
5. **FloorPlanSection** — Floor plan images (if available)
6. **LocationSection** — Interactive map + location description
7. **Footer** — Marbella Live branding

### SEO & Social
- Server-rendered with dynamic `generateMetadata()`
- **Split descriptions:** Short `ogDescription` (specs + price) for OG/Twitter cards (clean WhatsApp previews), full `description` for `<meta name="description">` (Google indexing)
- **Dynamic OG image** (`opengraph-image.tsx`): Edge runtime, shows hero image with property name, location, specs, price badge, Marbella Live branding

### Share Button (`src/components/property/ShareButton.tsx`)
- Dropdown with WhatsApp share + Copy Link
- Uses `navigator.share` on mobile for native share sheet
- Pre-formatted share text with property name, specs, price, URL

---

## 3. Favourites System

### How It Works
- **Storage:** localStorage (no account needed)
- **Context:** `FavouritesContext` wraps the entire app via root layout
- **Toggle:** Heart button on every property card
- **Page:** `/favourites` shows saved properties as horizontal cards with remove/clear/share
- **Sharing:** Encodes property IDs as URL-safe base64 → `/favourites/[encodedIds]` → recipient sees the same properties (read-only)

### Key Files
- `src/contexts/FavouritesContext.tsx` — State, localStorage sync, share link generation
- `src/hooks/useFavourites.ts` — Hook wrapper + `decodeSharedFavourites()`
- `src/components/FavouriteButton.tsx` — Heart icon (sm/md/lg sizes)
- `src/components/FavouritePropertyCard.tsx` — Horizontal card for favourites page
- `src/components/ShareModal.tsx` — Modal with copy link + social sharing buttons

---

## 4. Admin-Curated Collections

See `COLLECTIONS_GUIDE.md` for full implementation details.

### Summary
- Admin creates curated property selections in `/admin/collections`
- Two types: **Community** (editorial picks) and **Personal** (tailored for a client)
- Each gets a shareable link: `/collection/[slug]`
- Community: grid layout, editorial intro, indexed by Google
- Personal: "Selected for [Name]" greeting, personal note, horizontal card layout, noindex
- Dynamic OG images for WhatsApp previews
- View count tracking per collection

---

## 5. Property Scraper

See `SCRAPER_SYSTEM_GUIDE.md` for full implementation details.

### Summary
- Admin pastes competitor URL in property form → extracts all data
- **Inertia.js detection** for Turnkey/thehills sites (data embedded in HTML, no headless browser)
- **Generic HTML scraper** with cascading selectors for all other sites
- **Feature normalization:** 100+ alias map to canonical DB names
- **Auto image import:** Downloads gallery + floor plan images, uploads to Supabase storage
- Progress bar shows import progress

---

## 6. Social Content Generator

**File:** `src/components/admin/SocialContentGenerator.tsx`

Appears in the "Share & Social" tab of the property edit form (only when editing an existing property).

### Generators
1. **WhatsApp Community Post** — Middle-ground format: specs on one line with dots, features on one line with bullets, price, CTA
2. **WhatsApp Quick Share** — Minimal clean format with property name, specs, price, link
3. **Instagram Caption** — Three style variants (Elegant/Bold/Minimal) with area-specific hashtags

### Features
- Copy buttons for each format
- Direct "Send via WhatsApp" buttons
- Hero image preview
- Caption style toggle for Instagram

---

## 7. PDF Brochure Generation

See `PDF_BROCHURE_GUIDE.md` for implementation details.

- **API:** `GET /api/property/[slug]/brochure`
- Server-side PDF generation using `@react-pdf/renderer`
- Cover page with hero image, property specs, branding
- Gallery pages with 2-column image grid
- Download button in property page header

---

## 8. Admin Panel

**Route:** `/admin` (protected by middleware, redirects to `/admin/login` if unauthenticated)

### Dashboard (`/admin`)
- Property table: thumbnail, name/location, status badge, price, featured star, published toggle, actions
- **Search** by name or location
- **Status filter** dropdown
- **Sort dropdown:** Newest, Oldest, Price High/Low, Name, Location
- **Clickable table headers** (Property toggles name/newest, Price toggles high/low)
- **Display settings:** Set default sort order for public site
- **Featured star toggle:** Pin properties to top of public listing
- Stats row: Total, Featured, Available, Sold, Reserved, Under Offer, Coming Soon

### Property Form (`/admin/properties/new` and `/admin/properties/[id]/edit`)
- Tabbed form: Details, Features, Images, Location, Share & Social (edit only)
- Scraper URL input in Details tab
- Image uploaders with drag-and-drop and reordering
- Feature options loaded from `feature_options` database table
- Auto-slug generation from name
- Publish toggle

### Collections Manager (`/admin/collections`)
- See Collections Guide for details

### Navigation
- Admin header: Dashboard, Collections, Add Property
- Right side: View Site link, Logout button

---

## 9. SEO & Performance

### Root Layout SEO (`src/app/layout.tsx`)
- Comprehensive metadata: title template, description, keywords (40+ terms), robots directives
- JSON-LD schemas: Organization (RealEstateAgent), WebSite, LocalBusiness, ItemList
- Area-served covers: Golden Mile, Puerto Banus, Nueva Andalucia, Sierra Blanca, etc.
- Geo-targeting meta tags for Marbella/Costa del Sol
- Dublin Core metadata

### Sitemap & Robots
- `src/app/sitemap.xml/` — Auto-generated from published properties
- `src/app/robots.txt/` — Standard crawling directives

### Performance
- Vercel Speed Insights integrated
- Next.js Image optimization with appropriate `sizes` attributes
- Turbopack for fast development builds
- Static generation where possible (SSG for collections, ISR consideration)

---

## Database Tables Summary

| Table | Purpose |
|-------|---------|
| `properties` | All property listings with specs, images, featured flag |
| `collections` | Admin-curated property selections |
| `collection_properties` | Join table: which properties in which collection, with order |
| `feature_options` | 101 property features across 8 categories |
| `site_settings` | Single-row config: default sort order for public site |

All tables use Row Level Security (RLS). Public can read published data; authenticated admins have full access.

---

*Last updated: April 2026*
