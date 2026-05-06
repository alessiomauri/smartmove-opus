# Real Estate Listing Website - Project Specification

This document contains everything needed to recreate this real estate listing website. Use this file in a new Claude Code instance to build a copy with your own customizations.

---

## Tech Stack

- **Framework:** Next.js 14+ (App Router) with TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (for images)
- **Authentication:** Supabase Auth
- **Package Manager:** npm

---

## Project Structure

```
/src
  /app
    /page.tsx                         # Homepage with property grid
    /property/[slug]/page.tsx         # Property detail page
    /favourites/page.tsx              # My favourites page
    /favourites/[shareId]/page.tsx    # Shared favourites view
    /admin
      /page.tsx                       # Admin dashboard
      /login/page.tsx                 # Admin login
      /properties/new/page.tsx        # Create new property
      /properties/[id]/edit/page.tsx  # Edit property
    /layout.tsx                       # Root layout
    /globals.css                      # Global styles
  /components
    /ui/                              # Reusable UI components (Lightbox, etc.)
    /property/                        # Property page sections
    /admin/                           # Admin components
    Header.tsx                        # Site header
    PropertyCard.tsx                  # Property card for grid
    PropertyGrid.tsx                  # Grid layout
    FilterBar.tsx                     # Search and filters
    FilterPanel.tsx                   # Advanced filter panel
    FavouriteButton.tsx               # Heart icon toggle
  /hooks
    useProperties.ts                  # Fetch published properties
    useAdminProperties.ts             # Admin CRUD operations
    useAdminProperty.ts               # Single property editing
    useFavourites.ts                  # localStorage favourites
  /lib
    supabase.ts                       # Browser Supabase client
    supabase-server.ts                # Server Supabase client
    storage.ts                        # Image upload utilities
    utils.ts                          # Helper functions
    favourites.ts                     # Favourites encode/decode for sharing
    /actions
      properties.ts                   # Server actions for CRUD
      auth.ts                         # Auth server actions
  /types
    property.ts                       # TypeScript interfaces
  /middleware.ts                      # Route protection for /admin/*
```

---

## Design System

### Colors (Customize these for your fork)
```css
/* Primary Brand Colors */
--color-primary: #0f6c74;        /* Teal - main brand color */
--color-primary-dark: #0a4f55;   /* Darker teal for hover states */
--color-primary-light: #76b3a8;  /* Light teal accent */

/* Neutral Colors */
--color-dark: #2E2E2E;           /* Dark gray - header, text */
--color-gray-50: #f9fafb;        /* Background */
--color-gray-100: #f3f4f6;       /* Cards, borders */

/* Accent */
--color-accent: #0085f2;         /* Bright blue for links */

/* Status Colors */
--color-available: #10b981;      /* Green */
--color-sold: #ef4444;           /* Red */
--color-reserved: #f59e0b;       /* Yellow/Orange */
--color-under-offer: #8b5cf6;    /* Purple */
--color-coming-soon: #3b82f6;    /* Blue */
```

### Typography
- Font: Inter (or similar modern sans-serif)
- Headings: Bold, dark gray (#2E2E2E)
- Body: Regular, gray-600/700

### Design Principles
- Minimalist luxury aesthetic
- Generous whitespace
- High-quality imagery focus
- Rounded corners (lg/xl)
- Subtle shadows and borders

---

## Database Schema (Supabase SQL)

Run this in Supabase SQL Editor to create your database:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for property status
CREATE TYPE property_status AS ENUM ('available', 'sold', 'reserved', 'under_offer', 'coming_soon');

-- Create properties table
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status property_status DEFAULT 'available',
  price NUMERIC,
  price_on_request BOOLEAN DEFAULT false,
  location TEXT,
  area TEXT,
  description TEXT,

  -- Features
  bedrooms INTEGER,
  bathrooms INTEGER,
  interior_size NUMERIC,
  terrace_size NUMERIC,
  plot_size NUMERIC,
  orientation TEXT,
  has_pool BOOLEAN DEFAULT false,
  parking_spaces INTEGER,

  -- Additional features (array)
  features TEXT[] DEFAULT '{}',

  -- Images
  hero_image TEXT,
  gallery_images TEXT[] DEFAULT '{}',
  floor_plan_images TEXT[] DEFAULT '{}',

  -- Location coordinates
  latitude NUMERIC,
  longitude NUMERIC,
  location_description TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published BOOLEAN DEFAULT false
);

-- Create index for faster slug lookups
CREATE INDEX idx_properties_slug ON properties(slug);
CREATE INDEX idx_properties_published ON properties(published);
CREATE INDEX idx_properties_status ON properties(status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read published properties
CREATE POLICY "Allow public read of published properties"
ON properties FOR SELECT
USING (published = true);

-- Allow authenticated users full access
CREATE POLICY "Allow authenticated full access"
ON properties FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
```

---

## Storage Setup (Supabase)

1. Create a storage bucket named `property-images`
2. Set it to **Public**
3. Run these RLS policies:

```sql
-- Storage RLS policies for property-images bucket
CREATE POLICY "Allow all uploads to property-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'property-images');

CREATE POLICY "Allow all reads from property-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-images');

CREATE POLICY "Allow all deletes from property-images"
ON storage.objects FOR DELETE
USING (bucket_id = 'property-images');

CREATE POLICY "Allow all updates to property-images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'property-images');
```

---

## Environment Variables

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Key Features

### 1. Homepage
- Responsive property grid (1-3 columns)
- Property cards with: hero image, name, price, location, specs, status badge
- Filters: status, area, price range, features (pool, parking, etc.)
- Search by property name
- Sort by: price (asc/desc), newest, name
- Favourite toggle on each card

### 2. Property Detail Page
- **Sticky header** with anchor navigation (Overview, Gallery, Floor Plans, Location)
- **Hero section:** Full-viewport image with property name overlay
- **Overview:** Two columns - feature icons left, description right (with "Read More" expansion)
- **Gallery:** 2x3 image grid with "View All" lightbox
- **Floor Plans:** Dedicated section for floor plan images
- **Location:** Map embed + location description
- Favourite button

### 3. Favourites System
- Stored in localStorage (no account required)
- Heart icon toggle on property cards
- Dedicated favourites page
- **Shareable link:** Generates URL with encoded property IDs
- Shared view displays selected properties (read-only)

### 4. Admin Panel
- **Login:** Supabase Auth (email/password)
- **Dashboard:** Property list with search, filter by status
- **Property Form:**
  - Basic info (name, price, location, status)
  - Features (beds, baths, sizes, amenities)
  - Rich text description
  - Image uploads (hero, gallery, floor plans) with drag-and-drop
  - Location coordinates
  - Publish toggle
- **Actions:** Edit, delete, toggle published status
- **Route protection:** Middleware redirects unauthenticated users

---

## TypeScript Interfaces

```typescript
// Property status enum
export type PropertyStatus = 'available' | 'sold' | 'reserved' | 'under_offer' | 'coming_soon';

// Main property interface
export interface Property {
  id: string;
  name: string;
  slug: string;
  status: PropertyStatus;
  price: number | null;
  price_on_request: boolean;
  location: string;
  area: string;
  description: string;

  // Features
  bedrooms: number | null;
  bathrooms: number | null;
  interior_size: number | null;
  terrace_size: number | null;
  plot_size: number | null;
  orientation: string | null;
  has_pool: boolean;
  parking_spaces: number | null;
  features: string[];

  // Images
  hero_image: string;
  gallery_images: string[];
  floor_plan_images: string[];

  // Location
  latitude: number | null;
  longitude: number | null;
  location_description: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
  published: boolean;
}

// Filter options
export interface PropertyFilters {
  status?: PropertyStatus | 'all';
  area?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  features?: string[];
  search?: string;
}

// Sort options
export type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'name';
```

---

## Key Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "@supabase/ssr": "^0.1.0",
    "lucide-react": "^0.300.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.0.0"
  }
}
```

---

## Implementation Notes

### Supabase Client Setup
- **Browser client** (`/lib/supabase.ts`): Use `createBrowserClient` from `@supabase/ssr`
- **Server client** (`/lib/supabase-server.ts`): Use `createServerClient` with cookies

### Image Upload Flow
1. User selects/drops files in ImageUploader component
2. Files uploaded to Supabase Storage bucket
3. Public URL returned and stored in property form state
4. URLs saved to database on form submit

### Favourites Sharing
1. Property IDs stored in localStorage
2. "Share" button encodes IDs to base64
3. URL format: `/favourites/[encodedIds]`
4. Shared page decodes IDs and fetches properties

### Middleware Protection
- Intercepts requests to `/admin/*` (except `/admin/login`)
- Checks for valid Supabase session
- Redirects to login if not authenticated

---

## Customization Points for Your Fork

When creating your fork, consider changing:

1. **Brand name** - Update header, titles, metadata
2. **Color scheme** - Edit Tailwind config and component classes
3. **Logo** - Replace in Header component
4. **Property types** - Modify status options, feature lists
5. **Currency** - Update formatPrice utility function
6. **Language** - All UI text is in components (not i18n)
7. **Map provider** - Currently placeholder, add Google Maps/Mapbox
8. **Additional fields** - Extend property schema as needed

---

## Quick Start for Fork

1. Create new Next.js project: `npx create-next-app@latest my-fork --typescript --tailwind --app`
2. Install Supabase: `npm install @supabase/supabase-js @supabase/ssr`
3. Install icons: `npm install lucide-react`
4. Create Supabase project and run SQL schema
5. Add environment variables
6. Build components following structure above
7. Customize colors, branding, and features

---

## Original Project Reference

This specification was generated from the Marbella Live V2 project. The original implementation includes all features described above with a luxury real estate aesthetic targeting the Marbella, Spain market.
