# Admin-Curated Collections - Implementation Guide

This document explains the collections feature in Marbella Live, so it can be replicated in another project or maintained by a new developer/AI session.

## Overview

Collections let the admin create curated property selections and share them with clients or the community. There are two distinct types:

- **Community** — editorial picks shared with your audience (WhatsApp community, social media). Feels like a curated magazine feature. Indexed by Google.
- **Personal** — tailored recommendations for an individual client, with their name and a personal note. Feels like a private concierge service. Not indexed by Google.

## Architecture

```
Admin creates collection in /admin/collections/new
        |
        v
Selects type (Community/Personal) + properties + message
        |
        v
Publishes → generates URL: /collection/[slug]
        |
        v
Shares via WhatsApp or copy link
        |
        v
Visitor opens link → sees curated page with properties
        |
        v
View count incremented + visitor can save individual properties to their own favourites
```

## Database

### `collections` table

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| slug | TEXT UNIQUE | URL slug, e.g. `golden-mile-gems` |
| title | TEXT | Collection title |
| message | TEXT (nullable) | Editorial intro (community) or personal note (personal) |
| type | TEXT | `'community'` or `'personal'` |
| cover_image | TEXT (nullable) | Optional cover; falls back to first property's hero |
| recipient_name | TEXT (nullable) | Client name for personal collections |
| is_published | BOOLEAN | Whether the link is accessible |
| view_count | INTEGER | Incremented on each page view |
| created_at | TIMESTAMPTZ | Auto-set |
| updated_at | TIMESTAMPTZ | Auto-updated via trigger |

### `collection_properties` join table

| Column | Type | Purpose |
|--------|------|---------|
| collection_id | UUID FK | References collections(id) ON DELETE CASCADE |
| property_id | UUID FK | References properties(id) ON DELETE CASCADE |
| sort_order | INTEGER | Display order (0 = first) |
| UNIQUE(collection_id, property_id) | | No duplicates |

### RLS Policies

- **Public:** Can read published collections and their properties
- **Authenticated (admin):** Full CRUD on both tables

## Files

### Admin Side

| File | Purpose |
|------|---------|
| `src/app/admin/collections/page.tsx` | Collections list with table, search, publish toggle, delete |
| `src/app/admin/collections/new/page.tsx` | Create new collection |
| `src/app/admin/collections/[id]/edit/page.tsx` | Edit existing collection (client component) |
| `src/components/admin/CollectionForm.tsx` | Full form: type toggle, title, slug, message, recipient name, property picker, publish, share actions |
| `src/components/admin/CollectionPropertyPicker.tsx` | Searchable property grid + drag-to-reorder selected list using @dnd-kit |
| `src/components/admin/AdminHeader.tsx` | Contains "Collections" nav item |

### Public Side

| File | Purpose |
|------|---------|
| `src/app/collection/[slug]/page.tsx` | Server component: fetches data, generates metadata, increments views |
| `src/app/collection/[slug]/CollectionPageClient.tsx` | Client component: renders the full page UI |
| `src/app/collection/[slug]/opengraph-image.tsx` | Dynamic OG image (edge runtime) for WhatsApp/social previews |

### Shared

| File | Purpose |
|------|---------|
| `src/types/collection.ts` | TypeScript interfaces: Collection, CollectionWithProperties |
| `src/lib/actions/collections.ts` | Server actions: CRUD, toggle publish, increment views |
| `src/hooks/useAdminCollections.ts` | Client hook for admin list (with property counts) |
| `src/hooks/useAdminCollection.ts` | Client hook for single collection editing |

## Public Page Design

### Community Collection

- **Hero:** Large Gloock title + "Curated Selection" label + property count
- **Message:** Editorial paragraph below title
- **Layout:** Properties in 3-column `PropertyCard` grid (same as homepage)
- **Share:** WhatsApp + Copy Link buttons in hero area
- **CTA:** "Explore All Properties" button at bottom
- **SEO:** Indexed by Google, full metadata

### Personal Collection

- **Hero:** "Selected for **[Name]**" greeting in large type + "Marbella Live" brand badge
- **Message:** Personal note with teal left-border accent (letter-like feel)
- **Layout:** Properties as horizontal `FavouritePropertyCard` list (more intimate)
- **CTA:** Gentle "Interested in any of these? Let's talk." with WhatsApp button
- **SEO:** `noindex` — private by design

### Both Types Share:
- Glass morphism header with nav links (Properties, Favorites)
- Background gradient orbs
- Staggered fade-in animations
- Each property card has a working FavouriteButton
- Footer with Marbella Live branding
- View count incremented on load

## OG Image Generation

Dynamic OG image at `/collection/[slug]/opengraph-image`:
- Edge runtime using `ImageResponse` from `next/og`
- Shows collection title (or "Selected for [Name]")
- Background: cover image or first property's hero image
- "Curated Selection" or "Selected for You" tag
- Property count badge
- Marbella Live branding
- Mini thumbnail previews of additional properties (if >1)

## WhatsApp Share Text

**Community:**
```
Golden Mile Gems — Curated by Marbella Live

marbella.live/collection/golden-mile-gems
```

**Personal:**
```
Hi Maria, I've put together some properties I think you'll love.

marbella.live/collection/marias-selection
```

## How to Replicate

1. Run the migration SQL to create `collections` + `collection_properties` tables with RLS
2. Copy all files listed above
3. Add "Collections" to your admin nav
4. Ensure `@dnd-kit/core` and `@dnd-kit/sortable` are installed
5. Ensure `PropertyCard`, `FavouritePropertyCard`, and `FavouriteButton` components exist
6. Adapt the design (colors, fonts, layout) to your brand
7. Update the WhatsApp share text and CTA links

## Admin UX Notes

- The edit page is a **client component** (not server component) — this is required for Vercel deployment because server components can't reliably access the auth session for RLS-protected tables
- The `useAdminCollection` hook fetches the collection + ordered properties client-side
- Property picker shows all published properties; selected ones appear in a sortable list above
- Slug auto-generates from title but can be manually edited
- Share actions (WhatsApp, copy link, preview) only appear when editing + published
