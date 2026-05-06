# Blog System

Long-form content for SEO + audience building. Currently 7 posts seeded; categories cover the buyer journey end-to-end.

---

## Categories

Defined as the `blog_category` Postgres enum:

| Slug | Use |
|---|---|
| `buying-guide` | "How to buy a property in Marbella" — buyer education |
| `selling-guide` | Vendor-side guidance |
| `area-guide` | Deep dives on specific neighbourhoods (complement to the `/areas` pages) |
| `market-report` | Pricing trends, transaction volumes |
| `lifestyle` | Restaurants, schools, golf, beaches |
| `investment` | Yields, ROI, regulatory changes |

`BLOG_CATEGORY_LABELS` map in `src/types/blog.ts` provides display strings.

---

## Schema

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md#blog_posts-7-rows) for full column list.

Key columns:
- `slug` (PK), `title`, `excerpt`, `content` (markdown)
- `category` (enum), `keywords[]`
- `hero_image`, `hero_image_alt`
- `published_at`, `updated_at_date` (date columns, separate from `created_at`/`updated_at` timestamptz)
- `reading_time` (free-text, e.g. "5 min read")
- `featured`, `published`

---

## Routes

### `/blog` (Index)

`src/app/blog/page.tsx` — Server Component, ISR `revalidate = 3600`.

- Fetches `getPublishedBlogPosts()`
- Generates `Blog` JSON-LD listing all posts (good for site-level SEO)
- Renders the post cards in a grid

Layout: featured posts up top (large cards), then the rest in a 3-column grid. Filter chips for categories.

### `/blog/[slug]` (Detail)

`src/app/blog/[slug]/page.tsx` — Server Component, ISR `revalidate = 3600`, `generateStaticParams` for all published slugs.

- Fetches the post via `getBlogPostBySlug`
- Generates rich `generateMetadata`:
  - `type: 'article'`
  - `publishedTime`, `modifiedTime`, `authors`
  - `section: BLOG_CATEGORY_LABELS[category]`
  - Spanish keyword variants appended to `keywords`
  - hreflang for en-US / es-ES / x-default
- Generates `BlogPosting` JSON-LD with full article schema
- Renders hero image, title, meta (date, reading time, category), content (markdown rendered), share button

The markdown renderer is currently a simple paragraph splitter — for real markdown rendering, a future enhancement is to add `react-markdown` + `remark-gfm`.

---

## Admin

Covered in [ADMIN_PANEL.md](./ADMIN_PANEL.md#blog-admin-adminblog).

Quick form: slug, title, category, hero, excerpt, markdown content, keywords, featured/published toggles.

Saves invalidate the relevant paths but DO NOT yet have a `revalidateTag('blog')` pattern (acceptable for now since blog updates are rare; can be added when content velocity increases).

---

## Seed Data

`src/lib/blog-data.ts` contains 7 starter posts (placeholder content for the categories). Seeded via the `/admin/seed` page.

For real launch, replace with hand-written content — buyer guides, area deep-dives, market reports — to drive long-tail SEO traffic.

---

## SEO

Each post page emits:
- Standard metadata (title, description, canonical, hreflang)
- OpenGraph as `article` type with all article fields
- Twitter card
- `BlogPosting` JSON-LD including `datePublished`, `dateModified`, `image`, `author`, `articleBody`, `articleSection`, `keywords`, `inLanguage`

Posts are included in `sitemap.xml` with priority 0.7 (above generic pages, below properties/areas).

---

## Recreating the Blog

1. Create `blog_posts` table per [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md). Add the `blog_category` enum.
2. Create `blog-images` storage bucket (public read).
3. Copy `src/types/blog.ts`, `src/lib/blog-data.ts`, `src/lib/actions/blog.ts`.
4. Copy `src/app/blog/page.tsx` and `src/app/blog/[slug]/page.tsx`.
5. Copy `src/app/admin/blog/*` and `src/components/admin/BlogForm.tsx`.
6. Seed via `/admin/seed`.
