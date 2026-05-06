# Marbella Live Documentation

This folder contains the complete technical and design documentation for the Marbella Live luxury real estate website. Each document is self-contained and can be read independently to recreate that part of the system in another project.

For a single-document overview tying everything together, see **[FULL_SITE_REPORT.md](./FULL_SITE_REPORT.md)**.

---

## Foundations

| Document | Purpose |
|---|---|
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Brand colours, typography, spacing, shapes, animations, tone |
| [TECH_STACK.md](./TECH_STACK.md) | Every dependency, why it's installed, how it's used |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Render strategy (ISR + tag cache), server vs client split, routing |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Every Supabase table, columns, RLS policies, storage buckets |

## Public-Site Features

| Document | Purpose |
|---|---|
| [PROPERTIES.md](./PROPERTIES.md) | Property model, homepage listings, detail page, filters, status |
| [AREAS.md](./AREAS.md) | Area system, hierarchy, micro-locations, /areas index, /areas/[slug] |
| [MAP_SYSTEM.md](./MAP_SYSTEM.md) | Leaflet integration, pin categories, palette, popups, fit-bounds |
| [BLOG.md](./BLOG.md) | Blog categories, post detail page, related properties |
| [COLLECTIONS.md](./COLLECTIONS.md) | Curated property lists (community + personal) |
| [FAVOURITES.md](./FAVOURITES.md) | localStorage favourites, shareable URLs |
| [DEVELOPMENTS.md](./DEVELOPMENTS.md) | New-build developments (admin-only, public routes hidden behind feature flag) |

## Admin & Operations

| Document | Purpose |
|---|---|
| [ADMIN_PANEL.md](./ADMIN_PANEL.md) | Full admin flow: properties, areas, blog, collections, dashboard |
| [AUTH.md](./AUTH.md) | Supabase Auth, middleware admin protection, login flow |
| [GOING_PUBLIC_CHECKLIST.md](./GOING_PUBLIC_CHECKLIST.md) | **READ BEFORE LAUNCH.** Step-by-step flip from info-mode to public listings. |
| [SCRAPER_SYSTEM_GUIDE.md](./SCRAPER_SYSTEM_GUIDE.md) | URL → property scraping (Inertia.js + generic HTML) |
| [PDF_BROCHURE_GUIDE.md](./PDF_BROCHURE_GUIDE.md) | PDF brochure generation (react-pdf + sharp) |

## Cross-Cutting Systems

| Document | Purpose |
|---|---|
| [IMAGE_SYSTEM.md](./IMAGE_SYSTEM.md) | Supabase storage buckets, Next/Image proxy, blur placeholders |
| [SEO.md](./SEO.md) | Metadata API, JSON-LD schemas, sitemap, robots, Spanish keywords, hreflang |
| [PERFORMANCE.md](./PERFORMANCE.md) | ISR + tag-based revalidation, bundle splitting, image perf, dev vs prod |
| [ANALYTICS.md](./ANALYTICS.md) | Vercel Analytics, GA4, Meta Pixel, Search Console, cookie consent |

## Reference Material (older guides, kept for completeness)

| Document | Purpose |
|---|---|
| [WEBSITE_FEATURES_GUIDE.md](./WEBSITE_FEATURES_GUIDE.md) | High-level feature inventory (older, partly superseded by per-feature docs) |
| [PROJECT_SPEC_FOR_FORK.md](./PROJECT_SPEC_FOR_FORK.md) | Original project spec (historical) |
| [CLAUDE_SESSION_GUIDE.md](./CLAUDE_SESSION_GUIDE.md) | Notes for AI-assisted development sessions |
| [COLLECTIONS_GUIDE.md](./COLLECTIONS_GUIDE.md) | Older collections spec (see COLLECTIONS.md for current) |

---

## How to use this documentation

- **Recreating a single subsystem in another project**: read the relevant feature doc end-to-end, then DATABASE_SCHEMA.md for the tables you need, then ARCHITECTURE.md if you need to understand how it plugs into Next.js routing/caching.
- **Changing the brand identity**: read DESIGN_SYSTEM.md.
- **Onboarding a new dev**: read FULL_SITE_REPORT.md, then drill into individual docs as needed.
- **Auditing what's installed and why**: TECH_STACK.md.

Generated 2026-04-16. Keep these in sync when you change architecture, add new features, or change the brand. The source of truth for "what's done vs next" lives in `~/.claude/projects/-Users-alessiomauri-Desktop-marbella-live-v2/memory/project_status.md`.
