# Property Scraper System - Implementation Guide

This document explains how the property scraper system works in Marbella Live, so it can be replicated in another project or maintained by a new developer/AI session.

## Overview

The scraper extracts property data (title, description, price, specs, features, images, floor plans) from competitor real estate listing URLs and imports everything into the admin panel, including downloading and re-hosting all images in Supabase storage.

## Architecture

```
User pastes URL in admin form
        |
        v
POST /api/admin/scrape          <-- Extracts all data from HTML
        |
        v
PropertyForm receives data       <-- Pre-fills all form fields
        |
        v
POST /api/admin/import-images    <-- Downloads images from source URLs,
        |                            uploads to Supabase storage
        v
Form updated with Supabase URLs  <-- Gallery + floor plans populated
```

## Files

### 1. `src/app/api/admin/scrape/route.ts` - Scraper API

**Endpoint:** `POST /api/admin/scrape`
**Input:** `{ url: string }`
**Output:** `ScrapedProperty` object with all extracted data

#### Two extraction strategies:

**A. Inertia.js Extractor** (for Turnkey Marbella / thehills sites)
- Detects `data-page` attribute on HTML elements (Inertia.js framework)
- Parses the JSON directly - contains ALL property data: title, description, price, specs, gallery images, floor plans, features, location
- No headless browser needed - data is server-rendered into the HTML
- Handles Turnkey-specific formats: `"6 + 3"` bathrooms, `"13.800.000 EUR"` prices, European number format for sizes (`"1.785"` = 1785 m2)

**B. Generic HTML Scraper** (for all other sites)
- Cascading selector strategy: tries specific selectors first, falls back to generic patterns
- **Name:** h1/h2 tags, `.property-title`, `<title>` tag
- **Description:** `.description-text`, `[class*="description"] p`, `<p>` tags sorted by length, OG/meta description
- **Price:** `[class*="price"]`, `data-price` attributes, `<li>` elements starting with "Price", `<strong>` tags with EUR, regex scan for EUR amounts in page text. Handles European (`4.750.000`) and US (`4,750,000`) formats
- **Specs:** JSON-LD structured data, `data-original-value` attributes (Drumelia), `.detail-item` elements (costadelsales), `.feature` divs (MovingMarbella pattern: `"335 Built"`), `<li>` and `<strong>` elements with regex patterns, full page text fallback
- **Images:** OG image, JSON-LD images, all `<img>` tags (src, data-src, data-lazy-src, srcset), `<picture>` sources, background images in style attributes, data-image/data-photo attributes, image URLs in inline scripts, anchor tags linking to images. Filters out logos/icons/social/tracking images. Skips thumbnails and tiny images
- **Floor plans:** Looks for `floorplan`/`floor-plan`/`plano` in img src, class names, and anchor hrefs
- **Features:** Amenity cards, feature list selectors, description text keyword matching using `KNOWN_FEATURES` list
- **Location:** JSON-LD address, location/address class elements, Marbella area name detection from page text

#### Feature Normalization

`FEATURE_ALIASES` maps 100+ scraped feature name variants to canonical database names:
- `"Smart home system"` / `"domotic"` / `"home automation"` -> `"Smart Home"`
- `"Panoramic view"` / `"panoramic views"` -> `"Panoramic View"`
- `"Fully fitted kitchen"` -> `"Open Plan Kitchen"`
- etc.

`normalizeFeature()` also filters out useless features like "Close to golf", "Excellent condition", "Amenities near".

#### Site-specific handling:
- **turnkeymarbella.es / thehills1.es / keyreadymarbella.com**: Inertia.js `data-page` JSON extraction
- **drumelia.com**: `data-original-value` attributes on `<span>` elements for specs
- **movingmarbella.com**: `.feature` div text parsing (`"335 Built"`, `"1.006 Plot"`)
- **listingsmarbella.com**: Standard HTML + JSON-LD
- **epic-13.com**: Redirects to keyreadymarbella.com (Inertia.js)

### 2. `src/app/api/admin/import-images/route.ts` - Image Import API

**Endpoint:** `POST /api/admin/import-images`
**Input:** `{ urls: string[] }`
**Output:** `{ uploaded: string[], total, success, failed }`

- Downloads images from external URLs server-side (avoids CORS)
- Validates: must be image content-type, >5KB (skip placeholders), <15MB
- Uploads to Supabase storage bucket `property-images` under `uploads/` prefix
- Processes in batches of 5 for concurrency control
- Returns public Supabase URLs for each successfully uploaded image
- Uses anon key (works without service role key)

### 3. `src/components/admin/PropertyForm.tsx` - Form Integration

The `handleScrape()` function:
1. Calls `/api/admin/scrape` with the URL
2. Pre-fills form fields (only fills empty fields, won't overwrite existing data)
3. Kicks off image import in background:
   - Shows progress bar with batch-by-batch updates
   - Gallery images and floor plan images imported separately
   - Sets first gallery image as hero
   - Updates `gallery_images` and `floor_plan_images` arrays on completion

### 4. `src/lib/actions/features.ts` - Feature Database

- `getFeatureOptions()` - fetches all features from `feature_options` table
- `addFeatureOption(name, category)` - adds a custom feature

### 5. Database: `feature_options` table

```sql
CREATE TABLE feature_options (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  category text DEFAULT 'Other',
  created_at timestamptz DEFAULT now()
);
```

101 features across 8 categories: Views, Pool & Water, Wellness & Leisure, Entertainment, Living, Technology & Systems, Outdoor, Parking & Access.

SQL migration file: `supabase-migration-features.sql`

## Dependencies

- `cheerio` - HTML parsing for the scraper
- `@supabase/supabase-js` - Image upload to storage
- `sonner` - Toast notifications for progress feedback
- `@dnd-kit/core` + `@dnd-kit/sortable` - Drag-and-drop image reordering

No headless browser dependencies needed (puppeteer was removed - Inertia.js sites serve data in HTML).

## How to Replicate in Another Project

1. Copy the three API files: `scrape/route.ts`, `import-images/route.ts`
2. Copy `src/lib/actions/features.ts`
3. Run `supabase-migration-features.sql` in Supabase SQL Editor
4. Create a `property-images` storage bucket in Supabase (public access)
5. Install dependencies: `npm install cheerio sonner`
6. Add the scraper UI to your property form (URL input + handleScrape function)
7. Adapt the `FEATURE_ALIASES` map and `MARBELLA_AREAS` list to your market
8. Update the `ScrapedProperty` interface fields to match your property schema

## Adding Support for New Sites

1. Fetch the site's HTML and inspect the structure
2. Check for Inertia.js (`data-page` attribute) or JSON-LD structured data first
3. If neither, identify the CSS selectors/patterns for specs, features, images
4. Add site-specific extraction logic in `scrapeProperty()` if needed
5. Add any new feature name variants to `FEATURE_ALIASES`
