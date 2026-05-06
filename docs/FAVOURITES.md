# Favourites

Client-side, anonymous, shareable. No login, no server-side state.

---

## Storage

Favourites live entirely in `localStorage` under a single key. The `FavouritesContext` (in `src/contexts/FavouritesContext.tsx`) wraps the app and exposes:

```ts
{
  favourites: string[];          // Property IDs (UUIDs) or slugs
  favouriteCount: number;
  isFavourite: (id: string) => boolean;
  toggleFavourite: (id: string) => void;
  clearFavourites: () => void;
}
```

The provider is mounted in `src/app/layout.tsx` so it's available everywhere.

---

## UI Touchpoints

- **`<FavouriteButton propertyId={id} size="sm" />`** — heart toggle on every PropertyCard, top-left corner
- **Header heart icon** — shows a teal badge with the count when > 0
- **`/favourites` page** — shows all favourited properties, fetched via `usePropertiesByIds(favourites)` hook

---

## Sharing

Users can share their favourites list by URL. The pattern:

1. On `/favourites`, click "Share my list" → calls a helper that base64-encodes the array of IDs
2. Generates URL: `/favourites/${shareId}` where `shareId` is the encoded string
3. Recipient clicks link → `/favourites/[shareId]/page.tsx` decodes the IDs, fetches those properties via `getPropertiesByIds`, renders the same grid

The share URL is pure — no DB row needed. Recipients see a snapshot of whatever was shared, even if the sender later removes properties from their own list.

### URL encoding

Base64url-encoded JSON array of IDs. Example:
```
['uuid-1', 'uuid-2'] → JSON.stringify → btoa → URL-safe → "WyJ1dWlkLTEi..."
URL: /favourites/WyJ1dWlkLTEi...
```

Helpers in `src/hooks/useFavourites.ts`.

---

## Data Fetching

Two hooks, both `'use client'`:

- **`useFavourites()`** — reads/writes localStorage, returns the IDs + helpers
- **`usePropertiesByIds(ids: string[])`** — given an array of IDs (or slugs — auto-detects via UUID regex), fetches those properties from Supabase

`usePropertiesByIds` is one of the few places client-side Supabase queries still happen. The query is split:
1. Filter `ids` into valid UUIDs vs potential slugs (via `isValidUUID` regex)
2. Query by UUID with `.in('id', validUUIDs)`
3. Query by slug with `.in('slug', potentialSlugs)`
4. Merge results

This dual approach handles both legacy share URLs (which used slugs) and current ones (UUIDs).

---

## Robots / SEO

Favourites pages are personal/transient — they shouldn't be indexed.

- `/favourites` — set `robots: { index: false }` in metadata (or relies on `robots.ts` disallow rule)
- `/favourites/[shareId]` — same

`robots.ts` includes `Disallow: /favourites/` to keep these out of search engines.

---

## SEO Sitemap

Favourites pages are excluded from `sitemap.ts`.

---

## Recreating Favourites

1. Copy `src/contexts/FavouritesContext.tsx`
2. Mount the provider in your root layout
3. Copy `src/hooks/useFavourites.ts` (storage + share URL helpers)
4. Copy `src/components/FavouriteButton.tsx`
5. Copy `src/hooks/useProperties.ts` (specifically `usePropertiesByIds`)
6. Copy `src/app/favourites/page.tsx` and `src/app/favourites/[shareId]/page.tsx`
7. Add disallow rules in `robots.ts`

Total cost: ~200 lines of code. No backend, no schema, no auth.
