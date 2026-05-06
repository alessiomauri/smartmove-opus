# Collections

Curated property lists. Two types serve different audiences:

- **Community collections** — public, indexable, shareable. E.g. "Top 10 villas in Sierra Blanca", "Beachfront apartments". Marketing surface.
- **Personal collections** — recipient-specific shortlists assembled by the agent. E.g. "John & Sarah — your Marbella shortlist". Includes a `recipient_name` and a personalised `message`. `noindex` so they don't appear in search.

---

## Schema

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md#collections-2-rows--collection_properties-7-rows).

`collections`:
- `id` (uuid PK), `slug` (unique)
- `title`, `message` (intro)
- `type` (`community | personal`)
- `cover_image`
- `recipient_name` (personal only)
- `is_published`
- `view_count` (incremented on visit)

`collection_properties` junction:
- `collection_id` → `collections.id`
- `property_id` → `properties.id`
- `sort_order`

Both have CASCADE deletes.

---

## Public Page (`/collection/[slug]`)

`src/app/collection/[slug]/page.tsx` — Server Component, `generateStaticParams`, `generateMetadata`.

Conditional indexing in metadata:
```ts
robots: collection.type === 'personal' ? { index: false } : undefined
```

Renders:
- Hero with `cover_image` + `title` + `message`
- For personal: subtle "For [recipient_name]" addressing
- Property grid using shared `PropertyCard` (sorted by `sort_order`)

Also has an `opengraph-image.tsx` route that auto-generates a custom OG image for each collection (combines title + first property image).

---

## Admin

`/admin/collections` lists all collections.

`CollectionForm.tsx`:
- Title, slug (auto-generated), type (community/personal)
- Message (rich text-ish intro)
- Recipient name (only for personal)
- Cover image picker
- `CollectionPropertyPicker` — search-as-you-type for properties; click to add; drag to reorder; click to remove
- Published toggle

On save, `createCollection` / `updateCollection` server actions:
1. Upsert the `collections` row
2. Diff the `collection_properties` rows: insert new pairs, update existing `sort_order`, delete removed ones
3. `revalidatePath('/admin/collections')`, `revalidatePath('/collection/${slug}')`

The `CollectionPropertyPicker` uses `useAdminCollection` and `useAdminProperties` hooks for the live property search.

---

## Sharing & Sending

For personal collections, the agent typically:
1. Creates the collection with the buyer's name + a custom message
2. Adds 5–10 properties matching the buyer's brief
3. Copies the URL (`/collection/john-shortlist-2026`)
4. Sends via WhatsApp / email

The buyer sees a polished personal page they can browse and favourite from. View count increments on each visit so the agent knows engagement.

---

## SEO

- Community collections: indexable, included in sitemap with priority 0.7
- Personal collections: `noindex, nofollow`, excluded from sitemap

Both types still emit OpenGraph + Twitter card so the link previews well in WhatsApp / Slack / email.

---

## Recreating Collections

1. Create `collections` + `collection_properties` tables per schema doc
2. Copy `src/types/collection.ts` (if one exists, else add it)
3. Copy `src/lib/actions/collections.ts` (CRUD + property linking)
4. Copy `src/app/collection/[slug]/page.tsx` and `opengraph-image.tsx`
5. Copy `src/app/admin/collections/*` and the form / picker components
