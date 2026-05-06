# Marbella Live V2 - Development Guide

## Project Overview

**Marbella Live** is a luxury real estate listing website for properties in Marbella, Spain. Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, and Supabase.

**GitHub Repository:** https://github.com/alessiomauri/Marbella-Live

**Local Path:** `/Users/alessiomauri/Desktop/marbella-live-v2`

**Live Site:** https://marbella.live (deployed on Vercel)

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 16 | React framework with App Router + Turbopack |
| TypeScript | Type safety |
| Tailwind CSS v4 | Styling |
| Supabase | Database (PostgreSQL), Storage, Auth |
| Lucide React | Icons |
| shadcn/ui | UI component library |
| Sonner | Toast notifications |
| @dnd-kit | Drag-and-drop (image reorder, collection property order) |
| cheerio | HTML parsing for scraper |
| @react-pdf/renderer | PDF brochure generation |

---

## Design System

### Brand Colors

```css
--teal: #3c9ba7          /* Primary brand color - rgb(60, 155, 167) */
--teal-dark: #2d8a95     /* Hover state for teal */
--teal-light: #4aabb7    /* Lighter teal accent */
--admin-teal: #0f6c74    /* Admin panel buttons/accents */
--bone: #faf9f8          /* Background - very subtle off-white */
--text-dark: #2e2e2e     /* Primary text - rgb(46, 46, 46) */
```

### Typography

- **Gloock** - Serif font for property names and headings (elegant, distinctive)
- **Geist/Jost** - Sans-serif for body text (modern, clean)

Both fonts loaded from Google Fonts in `globals.css`.

### Design Philosophy

- **Minimalist luxury** - Generous whitespace, high-quality imagery
- **Glass morphism** - Frosted glass effects on headers with backdrop-blur
- **Subtle animations** - Smooth transitions, hover effects that enhance without distracting
- **Teal accents** - Consistent brand color throughout for interactive elements

---

## File Structure

```
/src
  /app
    page.tsx                          # Homepage - property grid with filters + sort
    layout.tsx                        # Root layout with fonts, FavouritesProvider, JSON-LD
    globals.css                       # All CSS including animations
    /property/[slug]/page.tsx         # Individual property detail page (SSR, SEO)
    /property/[slug]/opengraph-image.tsx  # Dynamic OG image for social sharing
    /collection/[slug]/page.tsx       # Public curated collection page (SSG)
    /collection/[slug]/CollectionPageClient.tsx  # Client component for collection UI
    /collection/[slug]/opengraph-image.tsx  # Dynamic OG image for collections
    /favourites/page.tsx              # User's saved favourites
    /favourites/[shareId]/page.tsx    # Shared favourites view (read-only)
    /admin
      page.tsx                        # Admin dashboard - property list with sort/filter/featured
      login/page.tsx                  # Admin authentication
      /properties/new/page.tsx        # Create new property
      /properties/[id]/edit/page.tsx  # Edit existing property
      /collections/page.tsx           # Admin collections list
      /collections/new/page.tsx       # Create new collection
      /collections/[id]/edit/page.tsx # Edit existing collection
    /api/admin
      /scrape/route.ts                # Property scraper API
      /import-images/route.ts         # Image import to Supabase storage
    /api/property/[slug]/brochure     # PDF brochure generation

  /components
    PropertyCard.tsx                  # Card with hover effects + sold/unavailable treatment
    PropertyGrid.tsx                  # Grid layout with loading skeletons
    FilterBar.tsx                     # Search, filters, sort (inline desktop + mobile panel)
    FavouriteButton.tsx               # Heart icon toggle for favourites
    FavouritePropertyCard.tsx         # Horizontal card for favourites/personal collections
    ShareModal.tsx                    # Share URL modal with social buttons
    /property
      PropertyHeader.tsx              # Sticky header on property pages + ShareButton
      ShareButton.tsx                 # WhatsApp/copy link sharing dropdown
      HeroSection.tsx                 # Full-screen hero image with title
      FeaturesSection.tsx             # Property specs with icons
      GallerySection.tsx              # Image gallery with lightbox
      FloorPlanSection.tsx            # Floor plan images
      LocationSection.tsx             # Map and location description
    /admin
      AdminHeader.tsx                 # Admin nav (Dashboard, Collections, Add Property)
      PropertyForm.tsx                # Full property edit form with scraper + social tab
      CollectionForm.tsx              # Collection create/edit form
      CollectionPropertyPicker.tsx    # Searchable property selector with drag-to-reorder
      SocialContentGenerator.tsx      # WhatsApp/Instagram content generator
      ImageUploader.tsx               # Drag & drop image upload
    /ui
      Lightbox.tsx                    # Full-screen image viewer

  /hooks
    useProperties.ts                  # Fetch, filter, sort properties (with featured priority)
    useAdminProperties.ts             # Admin property list
    useAdminProperty.ts               # Single property for editing
    useAdminCollections.ts            # Admin collections list with counts
    useAdminCollection.ts             # Single collection for editing
    useFavourites.ts                  # Favourites state management

  /contexts
    FavouritesContext.tsx              # React context for favourites (localStorage)

  /lib
    supabase.ts                       # Supabase client (browser)
    supabase-server.ts                # Supabase client (server, with cookies)
    supabase-static.ts                # Supabase client (static/build-time, no cookies)
    utils.ts                          # Helpers: formatPrice, formatNumber, cn, slugify
    mock-data.ts                      # Sample properties for development
    storage.ts                        # Image upload utilities
    /actions
      auth.ts                         # Server actions for authentication
      properties.ts                   # Server actions for property CRUD
      collections.ts                  # Server actions for collection CRUD
      features.ts                     # Feature options from DB

  /types
    property.ts                       # Property, PropertyFilters, SortOption, etc.
    collection.ts                     # Collection, CollectionWithProperties, etc.

  middleware.ts                       # Protect /admin/* routes
```

---

## Key Features

### 1. Homepage (`/`)

**Header (Glass Morphism):**
- Sticky header with frosted glass effect
- Animated gradient border at top, floating orb decorations
- Logo: "Marbella Live" in Gloock font, teal color
- Inline filters on desktop (search, location, status, price, features, **sort**)
- Favourites link with badge count
- Mobile: separate filter panel with full-screen overlay

**Property Grid:**
- Responsive: 1 col mobile, 2 tablet, 3 desktop
- Cards with hover effects: lift, image zoom, teal accents
- **Featured properties always appear first** (star badge in admin)
- **Sold/Under Offer/Reserved** properties shown desaturated with diagonal status ribbon
- Staggered fade-in animation on load

**Sorting:**
- Sort dropdown: Newest, Price High/Low, Name A-Z
- **Default sort controlled by admin** via `site_settings` table
- Featured properties override sort (always pinned to top)

### 2. Property Detail Page (`/property/[slug]`)

**Sections:** PropertyHeader > HeroSection > FeaturesSection > GallerySection > FloorPlanSection > LocationSection > Footer

**SEO:** Server-rendered with dynamic metadata, split OG/SEO descriptions (short for WhatsApp, full for Google), dynamic OG image generation on edge runtime.

**Sharing:** ShareButton with WhatsApp share + copy link + native Web Share API on mobile.

### 3. Favourites System

- Stored in localStorage (no account needed)
- `FavouritesContext` provides state across app
- Heart button on property cards
- `/favourites` page with share functionality
- Encoded shareable links: `/favourites/[base64EncodedIds]`

### 4. Admin-Curated Collections

See `COLLECTIONS_GUIDE.md` for full documentation.

Two types: **Community** (editorial picks for audience) and **Personal** (tailored for individual clients).

- Admin creates collections with title, message, ordered properties
- Public pages at `/collection/[slug]` with distinct layouts per type
- Dynamic OG images for WhatsApp link previews
- View count tracking
- WhatsApp share + copy link

### 5. Admin Panel (`/admin`)

**Dashboard:**
- Property table with search, status filter, sort (6 options)
- **Featured star toggle** per property (pins to top of public site)
- **Display settings** button: set default sort for public site
- Publish/unpublish toggle, edit, delete, view actions
- Stats row with Total, Featured, and per-status counts

**Property Form:**
- Basic info, features/specs, description, images (hero + gallery + floor plans)
- **Property scraper:** paste competitor URL, extracts all data + auto-imports images
- **Social content tab** (when editing): WhatsApp community post, quick share, Instagram caption generators
- Image drag-and-drop upload with reordering

**Collections Manager:**
- List view with type badges, property counts, view counts
- Create/edit form with type toggle, property picker with drag-to-reorder
- Publish toggle, share actions (WhatsApp + copy link + preview)

### 6. Property Scraper

See `SCRAPER_SYSTEM_GUIDE.md` for full documentation.

- Extracts data from competitor URLs (no headless browser needed)
- Inertia.js detection for Turnkey/thehills sites
- 100+ feature alias normalization map
- Auto-downloads and re-hosts images in Supabase storage

### 7. PDF Brochure Generation

See `PDF_BROCHURE_GUIDE.md` for documentation.

- Server-side PDF generation via `/api/property/[slug]/brochure`
- Cover page with hero image, gallery pages, specs

---

## Database Schema (Supabase)

### `properties` table
```sql
properties (
  id UUID PRIMARY KEY,
  name TEXT, slug TEXT UNIQUE, status TEXT, price NUMERIC,
  price_on_request BOOLEAN, location TEXT, area TEXT, description TEXT,
  bedrooms INT, bathrooms INT, interior_size NUMERIC, terrace_size NUMERIC,
  plot_size NUMERIC, orientation TEXT, has_pool BOOLEAN, parking_spaces INT,
  features TEXT[],
  hero_image TEXT, gallery_images TEXT[], floor_plan_images TEXT[],
  latitude NUMERIC, longitude NUMERIC, location_description TEXT,
  is_featured BOOLEAN DEFAULT false, featured_order INT DEFAULT 0,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
```

### `collections` table
```sql
collections (
  id UUID PRIMARY KEY, slug TEXT UNIQUE, title TEXT, message TEXT,
  type TEXT ('community'|'personal'), cover_image TEXT,
  recipient_name TEXT, is_published BOOLEAN, view_count INT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
```

### `collection_properties` (join table)
```sql
collection_properties (
  id UUID PRIMARY KEY, collection_id UUID, property_id UUID,
  sort_order INT, created_at TIMESTAMPTZ,
  UNIQUE(collection_id, property_id)
)
```

### `feature_options` table
```sql
feature_options (id UUID, name TEXT UNIQUE, category TEXT, created_at TIMESTAMPTZ)
```

### `site_settings` table
```sql
site_settings (id INT PRIMARY KEY CHECK(id=1), default_sort TEXT, updated_at TIMESTAMPTZ)
```

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_SITE_URL=https://marbella.live
```

---

## Development Commands

```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build
npm run start    # Start production server
```

---

## Quick Reference

| Task | File/Location |
|------|---------------|
| Change brand colors | `src/app/globals.css` |
| Modify homepage header | `src/app/page.tsx` |
| Edit property card design | `src/components/PropertyCard.tsx` |
| Add/change filter options | `src/components/FilterBar.tsx` |
| Property page sections | `src/components/property/` |
| Collection public page | `src/app/collection/[slug]/CollectionPageClient.tsx` |
| Admin collection form | `src/components/admin/CollectionForm.tsx` |
| Default sort setting | `site_settings` table via admin Display button |
| Featured properties | `is_featured` column toggled via admin star button |
| Social content generator | `src/components/admin/SocialContentGenerator.tsx` |
| Scraper logic | `src/app/api/admin/scrape/route.ts` |
| Image import | `src/app/api/admin/import-images/route.ts` |

---

*Last updated: April 2026*
