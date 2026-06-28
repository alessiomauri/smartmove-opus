# Smartmove Marbella — Engineering Handover

**Generated:** 2026-06-26 · **Branch:** `main` · **HEAD:** `6d2b947` · working tree clean
**Production:** https://smartmove-new.vercel.app (Vercel) · **Supabase project ref:** `vhsttqejskvofqxgddho`
**Live data (as of this report):** 8,977 properties (8,390 published, 587 pending-review), 461 developments, 45 areas, 2 quizzes, 7 leads (test rows).

This document is the factual map of the codebase: schema, env vars, migrations, feature flags, known issues, and a per-subsystem reference. §0–§6 are the orientation/narrative; §7–§15 are the verified reference sections (extracted by a 9-way parallel audit of the live DB + source on 2026-06-26).

---

## §0 — TL;DR: current state

A Next.js 16 (App Router, Turbopack) luxury real-estate site for **Smartmove Marbella**, deployed on Vercel, backed by Supabase (Postgres + RLS + Storage), with a Resales Online MLS sync pipeline that runs through a **fixed-IP relay on a Hetzner VPS** and a **Cloudflare image-proxy worker**. Bilingual EN/ES via `next-intl`.

**What works and is live in production:**
- Full Resales delta-sync pipeline (watermark, content-hash skip, history, reconciliation, chunked full-import) — **but still pointed at the Resales SANDBOX** (`RESALES_SANDBOX=true` on the relay). The sandbox dataset (~8,600 rows) is currently in the prod DB.
- Publish gate (review-by-exception) — 7,628 MLS rows auto-published, 572 held.
- URL-synced `/properties` search + 16 curated SEO facet pages + similar-properties + two-tier index policy + short links (`/s/`, `/c/`).
- Lead pipeline (hardened `/api/leads`, interim CRM at `/admin/leads`, copy-card-to-email). Monday CRM is **built but deliberately disconnected**.
- Quiz engine (`which-coast` LIVE, `which-development` DRAFT) with PostHog + first-party funnel tracking.
- Location nesting (`resales_location_mapping`) feeding canonical area search.

**The single biggest pending decision:** the **sandbox → production flip** for Resales (see §5, item 1). Everything else is incremental.

---

## §1 — Stack at a glance

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| i18n | `next-intl` v4, localized pathnames, `localePrefix: 'as-needed'` (EN default, ES prefixed) |
| Styling | Tailwind (CSS-variable design tokens in `src/app/globals.css`; gold `#cbaa65`, ink, paper) |
| DB / auth / storage | Supabase (Postgres, RLS, Storage buckets, service-role + anon/cookie clients) |
| Hosting | Vercel (prod `smartmove-new.vercel.app`); ISR + `revalidateTag`/`updateTag`; `after()` for post-response work |
| Edge | Cloudflare Workers — `resales-proxy` (idle fallback) + `image-proxy` (R2 lazy cache) |
| Relay | Plain-Node HTTP relay on Hetzner VPS `167.233.98.46`, host `167-233-98-46.sslip.io`, Caddy TLS, hardened systemd |
| Maps | MapLibre GL JS over self-hosted Protomaps tiles (swapped from Leaflet — see commits `b49e338`, `8ef090d`) |
| Analytics | PostHog (EU), GA4 + Meta Pixel (consent-gated), Vercel Speed Insights |
| Rate limiting | Upstash Ratelimit + Redis (env-gated; **not yet armed in prod**) |
| Tests | `npm run test:resales-sync`, `npm run test:resales-parser` (node tsx assertion suites) — no Jest/Vitest |
| Browser verification | Playwright (Chromium) — installed; **Preview MCP is broken in this env (`uv_cwd` EPERM)** so use Playwright |

---

## §2 — Run / build / migrate / test

```bash
# Dev
npm run dev                      # next dev (Turbopack)

# Build (runs scripts/generate-indexnow-key.mjs first, then next build)
NEXT_TELEMETRY_DISABLED=1 npm run build

# Local production server (the harness blocks plain `next start` via the Preview MCP;
# run it as a backgrounded node process on a free port)
INDEXNOW_KEY="" PORT=3810 npm run start   # node node_modules/next/dist/bin/next start -p 3810

# Typecheck (the map deps must be installed: npm install)
npx tsc --noEmit

# Logic tests (pure, run against saved Resales samples — no DB needed)
npm run test:resales-sync        # 60+ assertions: hashing, watermark, planBatch, publish gate,
                                 #   curation guard, reconcile diff, canonical area filter
npm run test:resales-parser

# DB migrations (Supabase CLI; project already linked to vhsttqejskvofqxgddho)
echo "Y" | npx supabase db push           # apply pending migrations
npx supabase migration list                # see applied vs local
```

**Gotcha — local vs prod secrets:** `.env.local`'s `SYNC_CRON_SECRET` does **not** match the Vercel production value, so local scripts hitting prod admin routes get **401**. For one-off prod data ops from this machine, write via the **service-role Supabase client** (key is in `.env.local`) and then flush prod ISR with an empty-commit redeploy (`revalidateTag` only fires on prod). Do **not** pull prod env values down.

**Browser verification pattern (per CLAUDE.md, see §6):** build → `npm run start` on a free port → drive with Playwright (`permissions: ['clipboard-read','clipboard-write']`), assert URL params + visible counts + clipboard, screenshot. This is mandatory before claiming any UI feature works.

---

## §3 — External services & where credentials live

| Service | Identifier / host | Secrets location |
|---|---|---|
| Supabase | project `vhsttqejskvofqxgddho` | `.env.local` (anon + service-role) and Vercel env |
| Vercel | prod `smartmove-new.vercel.app` | Vercel dashboard env; crons in `vercel.json` |
| Resales relay (VPS) | Hetzner `167.233.98.46`, `https://167-233-98-46.sslip.io`, `ssh root@167.233.98.46` (key auth) | `/etc/resales-relay/env` (mode `0640`): `p1`/`p2`, `RESALES_SANDBOX`, `x-smartmove-secret` |
| Resales credentials | production key P1=`1022230` | `workers/resales-proxy/.dev.vars` (NEVER in repo) + the VPS env |
| Cloudflare image-proxy | `*.workers.dev` (edge cache live despite stale code comment) | `wrangler` secrets; `PURGE_SECRET` |
| PostHog | EU host `https://eu.i.posthog.com` | `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` (already in Vercel) |
| Upstash Redis | **not provisioned yet** | would be `UPSTASH_REDIS_REST_URL` + `_TOKEN` in Vercel |
| Monday CRM | **deliberately disconnected** | `MONDAY_API_TOKEN` left UNSET → wrapper no-ops |

**Hard credential rules (preserve verbatim):** Resales `p1`/`p2` never in the repo, never echoed in argv/output; the relay + worker scrub credentials from every response (`parsedparameters` echoes p1/p2 in error bodies); the production key whitelists **one** IP = the VPS (`167.233.98.46`); the Mac's IP is no longer whitelisted, so `--direct` probe mode 001s. **Never add `RegisterLead`** to the Resales allowlist (leads stay in-house). Own-detection is **filter-5 membership only**, never `AgencyRef`.

---

## §4 — What was built this engagement (chronological, with commit hashes)

Earliest → latest. Each line is a shipped, deployed, verified unit of work.

1. **Optimization pass + Resales sync hardening** (`679e2ae`…`969907b`): watermark (fixed the wall-clock data-loss bug), content hashing, price/status history with visibility gating, image cleanse, weekly reconciliation, chunked resumable full-import, observability + tests + docs. Own-detection rewritten to **filter-5 membership** (`17e0c73`).
2. **Fixed-IP relay on Hetzner VPS** (`fd9a582`, `5fe8107`): Resales whitelists one static IP per key and won't accommodate Cloudflare's egress pool, so a plain-node relay (Caddy TLS + hardened systemd + credential scrub) sits between the worker and Resales. Traffic repointed to it; CF worker kept as idle fallback.
3. **Area-photo regression fix** (`71ce82c`, `35f0857`): the "Seed areas" admin button was clobbering admin-managed fields (hero_image, published, display_order). Seeders made content-only/admin-safe; compile-time select-list guards added.
4. **Curation guard** (`b7870e4`): Resales rows never reach curated surfaces (homepage/featured) unless explicitly featured by admin; `is_featured`/`featured_order` added to `SYNC_PROTECTED_FIELDS` + `HASH_EXCLUDED_FIELDS`.
5. **Map engine swap** (`b49e338`, `8ef090d`, merged via `1143b83`): Leaflet → MapLibre GL JS over self-hosted Protomaps.
6. **Full-import self-chaining fix** (`c68433f`, `0d88d19`): the original `after()`→`await fetch(child)` continuation nested awaits, blew `maxDuration` (300s), and left run rows stuck `running`. Replaced with **immediate-ack + deadline-bounded drain** (each invocation drains pages to a wall-clock deadline, persists cursor per page, fires ONE non-nesting continuation). Verified ~50 unattended chain links / 217 pages to `done`. Same fix applied to the reconcile route.
7. **Publish gate** (`1fdb082`, `b2c6722`): review-by-exception rule engine (config in `site_settings.publish_gate` JSONB — min_photos 4, min_price 150k, require_description, min_reference_number 4M, require_location). Bulk pass: 8,200 held → **7,628 published / 572 held**.
8. **Location auto-mapping** (`75a478f`): `resales_location_mapping` nests every Resales location under a curated area (name-match + OSM Nominatim geocode; listing-GPS medians turned out unavailable for MLS rows). 16-area audit; CSV report for review.
9. **Benalmádena = 45th area** (`89c37ef`): unpublished placeholder + `area_region` enum value + "Mijas & East" cluster; family of feed locations mapped to it.
10. **Curated-universe cache fix** (`da4ee53`): the publish gate grew `getCachedPublishedProperties` past `unstable_cache`'s 2MB limit, silently disabling caching (88 build warnings). Fixed by filtering to the curated universe in SQL (`source != 'resales_online' OR is_featured`).
11. **Lead pipeline** (`2e60d9c`): capture forms (property viewing+brochure, dev 4-intent sidebar, contact page, footer slim), hardened `/api/leads` (Upstash rate limit env-gated, honeypot field `company`, signed mount-time HMAC min-2s token), form-view tracking, interim CRM dashboard, copy-card-to-email (email-safe table card + ClipboardItem).
12. **Quiz engine** (`bd07ecf`): DB-defined quizzes + one renderer + contact-before-results gate + curation rule + admin CRUD/stats/duplicate/preview + funnel events.
13. **PostHog wiring** (`6a93a5d`): init against the existing EU token, mirror quiz + lead funnels (`window.posthog` seam), memory-persistence until cookie consent.
14. **Search platform** (`a6ff903`): URL-synced `/properties` (server-paginated 24/page, transition pending, closest-matches zero-state), 16 curated facet pages (AI-SEO answer-first + schema), two-tier index policy (MLS detail noindex + out of sitemap; IndexNow rescoped to Tier-1), geo-ranked similar properties, dev search same pattern, short links.
15. **Canonical area-filter fix** (`3b270a5`): search/facets were `ilike`-ing the raw feed `Location` column — nested custom areas (Marbella East, Nueva Andalucía, Benahavís via accents) returned ~0. Rewired through `area-resolve.ts` (parent_area descendants + approved mappings + accent-safe). 45-area audit confirmed.
16. **Share fixes + browser verification** (`d852328`): "Share this search" did nothing because sonner's `<Toaster>` was per-route — globalized it; hardened handlers (never-silent, visible manual-copy fallback); added facet-page share. Added **CLAUDE.md Verification standard** (real-browser proof mandatory).
17. **Filter sheet completion** (`ed5915d`, `6d2b947`): feature chips weren't wired into the URL-sync adapter (the reported bug); added Type/Beds/free-text to the sheet; made `q` accent-safe via the area resolver; burst-aware history.

---

## §5 — TOP PRIORITY next steps (ordered)

1. **Resales sandbox → production flip** (Alessio's call; the one real go-live gate). On the VPS: set `RESALES_SANDBOX=false` in `/etc/resales-relay/env`, restart the unit. In the DB: `DELETE FROM properties WHERE source='resales_online'` and clear `sync_state` (`resales_watermark`, `resales_full_import`, `resales_own_refs`). Then `/admin/resales` → Start full import (immediate-ack drain runs unattended; one Resume click after any deploy). Production feed ≈ 8,657 rows. **Until this is done, all on-site MLS data is sandbox data.**
2. **Arm the Upstash rate limit** on `/api/leads`: create a free Upstash Redis DB, add `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` to Vercel, redeploy. Currently env-gated off (fails open).
3. **Work the publish-gate held queue (572)** and the **location-mapping review** (80 medium/low + 4 zero-coverage areas: finca-cortesin, la-alqueria, palo-alto, real-de-la-quinta — each needs one admin mapping). Review CSV at `~/Desktop/smartmove-web-briefs/resales-location-mapping-report.csv`.
4. **el-chaparral hero photo** missing (no source asset anywhere) — needs a new photo uploaded.
5. **ES translation pass** — i18n scaffolding is live (`/es/...`, `leadForm`/quiz strings present in `messages/es.json` but currently English copy); a real Spanish editorial pass is outstanding. Facet pages already have hand-written ES.
6. **Gmail paste check** for copy-card-to-email (one manual QA; Outlook caveats documented in `docs/LEADS.md`).
7. **Flip `which-development` quiz to LIVE** once the developments surface is public (`NEW_DEVELOPMENTS_PUBLIC`), since its result cards need published developments.
8. **Price-drop badge UI** — data + 3-gate computation are ready; nothing renders the badge yet (waiting on design).

---

## §6 — Operational & security constraints (must-preserve)

- **CLAUDE.md Verification standard** (repo root, loaded every session): *"Backend verification alone never closes a user-facing feature. Before claiming anything works: verify in a real browser (Preview/Playwright) — navigate as a user, find the control, click it, assert the visible outcome, screenshot it. Debriefs must include UI-level evidence for anything with UI. Data features: spot-check rendered values against the DB, not just that the query runs."*
- **STOP before production data flips** (Resales sandbox→prod, full import) — Alessio's explicit decision.
- The full §11 list of **do-not-revert workarounds** is load-bearing (relay W^X / no MemoryDenyWriteExecute; `revalidateTag` vs `updateTag`; immediate-ack continuation; global Toaster; `immutable_join_text` generated column; dual-dialect feature tokens; `SYNC_PROTECTED_FIELDS`; never-wall-clock watermark; source-aware location fuzzing; no `RegisterLead`; `pin_category` in data not code; `/s/`+`/c/` middleware bypass). **Read §11 before touching sync, search, or caching.**

---
---

# Reference sections (verified 2026-06-26)

The remainder of this document is the per-area reference extracted directly from the live database and source tree.

## Table of contents

- §0 TL;DR · §1 Stack · §2 Run/build/migrate/test · §3 External services · §4 What was built · §5 Next steps · §6 Constraints
- [§7 — Database schema (tables, columns, enums, RLS, indexes, RPCs)](#7-database-schema-tables-columns-enums-rls-indexes-rpcs)
- [§8 — Environment variables (exact names)](#8-environment-variables-exact-names)
- [§9 — Migration list (chronological)](#9-migration-list-chronological)
- [§10 — Feature flags & config switches](#10-feature-flags-config-switches)
- [§11 — TODOs, known issues & do-not-revert workarounds](#11-todos-known-issues-donotrevert-workarounds)
- [§12 — Resales sync + relay + image-proxy subsystem](#12-resales-sync-relay-imageproxy-subsystem)
- [§13 — Leads pipeline + quiz engine](#13-leads-pipeline-quiz-engine)
- [§14 — Search + facets + short links + location mapping](#14-search-facets-short-links-location-mapping)
- [§15 — Routes, tech stack, infra & docs](#15-routes-tech-stack-infra-docs)

---


---

# §7 — Database schema (tables, columns, enums, RLS, indexes, RPCs)

# Smartmove Marbella — Database Schema Reference

Reconstructed from `supabase/migrations/*` and **verified by live introspection** against the production Supabase project via the service-role key (column sets and RPC signatures confirmed; live row counts noted per table). Source of truth: 19 migration files in `/Users/alessiomauri/Desktop/smartmove-web/supabase/migrations/`.

**Conventions across the whole schema**
- All tables have RLS **enabled**. The **service role bypasses RLS entirely** — the cron/sync paths and most write APIs use it.
- The recurring admin policy is `auth.role() = 'authenticated'` for `FOR ALL` (both `USING` and `WITH CHECK`) — i.e. any logged-in admin can do everything.
- "Anon" = the public website (unauthenticated `anon` Postgres role).
- Timestamps are `timestamptz` unless noted.

---

## Postgres ENUM types

| Enum | Values | Used by |
|---|---|---|
| `property_status` | `available`, `sold`, `reserved`, `under_offer`, `coming_soon` | `properties.status` |
| `area_region` | `Marbella`, `Estepona`, `Benahavis`, `Mijas`, `Fuengirola`, `Torremolinos`, `Malaga`, `Casares`, `Manilva`, `San Roque`, `Benalmadena` | `areas.region` |
| `blog_category` | `buying-guide`, `selling-guide`, `area-guide`, `market-report`, `lifestyle`, `investment` | `blog_posts.category` |
| `development_status` | `off_plan`, `under_construction`, `key_ready`, `completed`, `sold_out` | `developments.status` |
| `development_source` | `manual`, `resales_online` | `developments.source` |

> Note: `Benalmadena` was appended to `area_region` later (migration `..._benalmadena_region.sql`). Many other status/source/type fields are **plain `text` with CHECK constraints**, not true enums (see each table).

---

## `properties`
**Purpose:** Core listings table — owns + MLS (Resales) synced properties. *(live: 8,977 rows)*

**Key columns**
- `id uuid PK` (`gen_random_uuid()`)
- `name text NOT NULL`, `slug text UNIQUE NOT NULL`
- `status property_status NOT NULL DEFAULT 'available'`
- `price numeric`, `price_on_request boolean DEFAULT false`
- `location text`, `area text`, `micro_location text`, `description text`
- `bedrooms integer`, `bathrooms numeric` *(was `integer`; widened to numeric for MLS "2.5" values)*
- `interior_size`, `terrace_size`, `plot_size numeric`, `orientation text`, `has_pool boolean DEFAULT false`, `parking_spaces integer`
- `features text[] DEFAULT '{}'`
- `hero_image text NOT NULL`, `gallery_images text[]`, `floor_plan_images text[]`, `hero_image_blur text`
- `latitude`, `longitude numeric`, `location_description text`
- `property_type text DEFAULT 'villa'`, `is_featured boolean DEFAULT false`, `featured_order int DEFAULT 0`
- **Locale JSONB:** `descriptions`, `feature_labels`, `property_type_labels` (shape `{"en":…,"es":…}`)
- **Sync metadata:** `source text DEFAULT 'manual'`, `source_id text`, `source_agency_ref text`, `last_synced_at`, `source_image_urls text[]`, `content_hash text`, `own_property boolean DEFAULT true`
- **Approval workflow:** `pending_review boolean DEFAULT false`, `approved_at`, `rejected boolean DEFAULT false`
- **Resales detail fields:** `resales_type_id`, `resales_subtype_id text`, `community_fees_year`, `basura_tax_year`, `ibi_fees_year numeric`, `energy_rated`, `co2_rated text`, `decree_218 boolean`, `built_year text`, `completion_date date`
- **Publish gate:** `publish_gate_failures text[]` (failing rule keys; NULL = passed/not evaluated), `publish_gate_checked_at`
- **Price-drop:** `hide_price_drop boolean NOT NULL DEFAULT false` (admin-owned; sync never writes), `price_drop_at timestamptz`
- `removed_at timestamptz` (reconciliation marker — left the Resales feed)
- `assigned_agent_id uuid → agents(id) ON DELETE SET NULL`
- **Generated column:** `features_text text GENERATED ALWAYS AS (immutable_join_text(features)) STORED` — flat `' · '`-joined projection of `features[]` for substring search
- `created_at`, `updated_at` (auto via trigger), `published boolean DEFAULT false`

**CHECK constraints**
- `property_type IN ('villa','apartment','plot_with_project','townhouse','penthouse')`
- `source IN ('manual','resales_online','scraper')`

**Foreign keys:** `assigned_agent_id → agents(id)`

**RLS**
- **SELECT (anon):** `"Anon read published properties"` — `published = true`
- **ALL (authenticated):** `"Authenticated full properties"`
- (Legacy duplicate from initial migration: `"Public can read published properties"` and `"Admins can do everything"`.)

**Indexes:** `idx_properties_status`, `idx_properties_area`, `idx_properties_published`, `idx_properties_slug`, `idx_properties_featured (is_featured, featured_order)`, `properties_source_idx UNIQUE (source, source_id)`, `idx_properties_pending_review (partial WHERE pending_review)`, `idx_properties_last_synced`, `idx_properties_published_created (published, created_at DESC)`, `idx_properties_gate_failures GIN (publish_gate_failures) partial`, `idx_properties_search_type_price (property_type, price) WHERE published`, `idx_properties_search_area (area) WHERE published`

**Trigger:** `update_properties_updated_at` → `update_updated_at_column()` (sets `updated_at = now()` BEFORE UPDATE).

---

## `developments`
**Purpose:** New-build / off-plan projects (own + Resales synced). *(live: 461 rows)*

**Key columns**
- `id uuid PK`, `slug text UNIQUE NOT NULL`, `name text NOT NULL`, `developer text`
- `status development_status NOT NULL DEFAULT 'off_plan'`
- `source development_source NOT NULL DEFAULT 'manual'`, `source_id text`, `last_synced_at`, `content_hash text`
- SEO/content: `title`, `meta_description`, `subtitle`, `short_description`, `description`, `descriptions jsonb` (locale)
- Ranges: `price_from`, `price_to numeric`, `price_on_request boolean`, `bedrooms_from/to int`, `bathrooms_from/to numeric`, `size_from/to`, `terrace_size_from/to numeric`
- `total_units int`, `units_available int`, `unit_types text[]`, `completion_date date`, `delivery_phases text`
- Location: `location`, `area`, `micro_location`, `latitude`, `longitude`, `location_description`
- Media: `hero_image`, `hero_image_blur`, `hero_image_alt`, `gallery_images text[]`, `masterplan_images text[]`, `floor_plan_images text[]`, `brochure_pdf`, `source_image_urls text[]`
- `amenities text[]`, `keywords text[]`, `payment_terms jsonb DEFAULT '{}'`
- Workflow (same as properties): `pending_review`, `approved_at`, `rejected`, `own_property boolean DEFAULT true`, `removed_at`
- `is_featured boolean`, `featured_order int`, `published boolean DEFAULT false`
- `assigned_agent_id uuid → agents(id) ON DELETE SET NULL`
- `created_at`, `updated_at`

**Foreign keys:** `assigned_agent_id → agents(id)`

**RLS**
- **SELECT (anon):** `"Anon read published developments"` — `published = true`
- **ALL (authenticated):** `"Authenticated full developments"`

**Indexes:** `developments_source_idx UNIQUE (source, source_id)`, `idx_developments_published`, `idx_developments_featured (is_featured, featured_order)`, `idx_developments_published_created (published, created_at DESC)`, `idx_developments_search (price_from) WHERE published`

---

## `areas`
**Purpose:** 45 curated area/location guide pages (Marbella, Estepona, micro-locations). *(live: 45 rows)*

**Key columns**
- `slug text PRIMARY KEY`, `name text NOT NULL`, `region area_region NOT NULL`
- `pin_category text NOT NULL DEFAULT 'micro'` CHECK `IN ('main','micro','resort','airport')`
- `parent_area text`, `is_micro_location boolean DEFAULT false`
- SEO/content: `title`, `meta_description`, `heading`, `subheading`, `description` (all `text`, default `''`)
- **Locale JSONB:** `descriptions`, `subheadings`, `headings`
- `property_types text[]`, `highlights text[]`, `nearby_areas text[]`, `keywords text[]`
- `coordinates_lat`, `coordinates_lng numeric DEFAULT 0`, `price_range text`
- `hero_image`, `hero_image_alt text`, `hero_image_blur text`
- `display_order int DEFAULT 0`, `published boolean DEFAULT true`, `created_at`, `updated_at`

**RLS**
- **SELECT (anon):** `"Anon read areas"` — `USING (true)` (all rows public, even unpublished)
- **ALL (authenticated):** `"Authenticated full areas"`

---

## `leads`
**Purpose:** Lead capture from all contact forms / funnels (interim CRM via `/admin/leads`; Monday integration scaffolded but disconnected). *(live: 7 rows)*

**Key columns**
- `id uuid PK`
- `source text NOT NULL` — CHECK (current set): `'contact-form','viewing-request','brochure-request','email-selection-click','newsletter','two-step-landing','quiz-area','quiz-dev','other'`
- `source_detail text`
- Contact: `name text NOT NULL`, `email text NOT NULL`, `phone text`
- Funnel: `bedrooms`, `budget_tier`, `purchase_timeline`, `contact_method`, `message text`
- Context FKs: `property_id → properties(id) ON DELETE SET NULL`, `development_id → developments(id) ON DELETE SET NULL`, `assigned_agent_id → agents(id) ON DELETE SET NULL`, `property_reference text` (unlinked Resales ref)
- Tracking: `utm_source`, `utm_medium`, `utm_campaign`, `utm_id`, `language text`
- Monday CRM: `monday_item_id text`, `monday_synced_at`, `monday_sync_skipped boolean DEFAULT false`
- `status text NOT NULL DEFAULT 'new'` — CHECK (current): `'new','called','selection_sent','closed'` + legacy `'contacted','qualified','converted','lost'`
- `notes text`, `submitted_at timestamptz NOT NULL DEFAULT now()`, `created_at`, `updated_at`

**Foreign keys:** `property_id`, `development_id`, `assigned_agent_id` (all `ON DELETE SET NULL`)

**RLS**
- **INSERT (anon + authenticated):** `"Anon insert leads"` — `TO anon, authenticated WITH CHECK (true)` (public lead capture). Backed by explicit grants: `GRANT INSERT ON leads TO anon` and `GRANT SELECT(id) ON leads TO anon` (for `.single()`/return=representation).
- **ALL (authenticated):** `"Authenticated full leads"` — reads/updates are admin-only.

**Indexes:** `idx_leads_status`, `idx_leads_submitted_at (submitted_at DESC)`, `idx_leads_assigned_agent`, `idx_leads_monday_pending (partial)`, `idx_leads_status_submitted (status, submitted_at DESC)`

---

## `lead_form_events`
**Purpose:** Form-impression ("view") tracking; conversion = leads / views per form. Written via service role only (`/api/leads/track`). *(live: 48 rows)*

**Key columns**
- `id uuid PK`, `form text NOT NULL`, `event text NOT NULL` CHECK `IN ('view')`
- `path text` (no query strings/PII), `detail text` (property/dev ref), `created_at`

**RLS:** **SELECT (authenticated)** only — `"Authenticated read form events"`. No anon/insert policies (service-role writes).

**Indexes:** `idx_lead_form_events_form_created (form, created_at DESC)`

---

## `sync_state`
**Purpose:** Key/value store for the Resales sync watermark + import cursors. *(live)*

**Key columns:** `key text PRIMARY KEY`, `value jsonb NOT NULL DEFAULT '{}'`, `updated_at timestamptz NOT NULL DEFAULT now()`

**RLS:** **ALL (authenticated)** — `"Authenticated full sync_state"`. Cron path uses service role.

---

## `resales_sync_runs`
**Purpose:** Audit log of every Resales sync attempt (admin dashboard + debugging). *(live, many rows)*

**Key columns**
- `id uuid PK`
- `trigger text NOT NULL` — CHECK (current): `'cron','manual','single-ref','probe','samples','reconcile','full-import'`
- `reference text` (single-ref mode), `started_at NOT NULL DEFAULT now()`, `finished_at`
- `status text NOT NULL DEFAULT 'running'` CHECK `IN ('running','success','partial','failed')`
- Counters: `pages_walked`, `upserted`, `pending`, `approved`, `soft_deleted`, `errors_count`, `indexnow_pinged` (all `int DEFAULT 0`), `error_summary text`, `query_id text`
- Extended metrics: `rows_seen`, `rows_skipped_unchanged`, `rows_updated`, `rows_inserted`, `price_changes`, `status_changes`, `images_purged`, `api_calls` (`int DEFAULT 0`), `duration_ms int`, `watermark_before text`, `watermark_after text`
- `triggered_by uuid → auth.users(id) ON DELETE SET NULL`

**Foreign keys:** `triggered_by → auth.users(id)`

**RLS:** **SELECT (authenticated)** `"Authenticated read runs"`; **INSERT (authenticated)** `"Authenticated insert runs"`. No UPDATE policy (service role updates the run row).

**Indexes:** `idx_resales_runs_started (started_at DESC)`

---

## `property_price_history`
**Purpose:** Every price change captured from sync day one. *(live: 494 rows)*

**Key columns:** `id bigint GENERATED ALWAYS AS IDENTITY PK`, `property_id uuid NOT NULL → properties(id) ON DELETE CASCADE`, `old_price numeric`, `new_price numeric`, `currency text NOT NULL DEFAULT 'EUR'`, `changed_at NOT NULL DEFAULT now()`, `sync_run_id uuid → resales_sync_runs(id) ON DELETE SET NULL`

**RLS:** **ALL (authenticated)** `"Authenticated full price history"`.

**Indexes:** `idx_price_history_property (property_id, changed_at DESC)`

---

## `property_status_history`
**Purpose:** Every status transition captured from sync day one. *(live: 5 rows)*

**Key columns:** `id bigint GENERATED ALWAYS AS IDENTITY PK`, `property_id uuid NOT NULL → properties(id) ON DELETE CASCADE`, `old_status text`, `new_status text NOT NULL`, `changed_at NOT NULL DEFAULT now()`, `sync_run_id uuid → resales_sync_runs(id) ON DELETE SET NULL`

**RLS:** **ALL (authenticated)** `"Authenticated full status history"`.

**Indexes:** `idx_status_history_property (property_id, changed_at DESC)`

---

## `site_settings`
**Purpose:** Single-row (`id=1`) global config. *(live: 1 row)*

**Key columns**
- `id int PRIMARY KEY CHECK (id = 1)`
- `default_sort text NOT NULL DEFAULT 'newest'` CHECK `IN ('newest','price_asc','price_desc','name')`
- `show_price_drop_badges boolean NOT NULL DEFAULT false` (site-wide price-drop kill switch)
- `publish_gate jsonb NOT NULL DEFAULT '{"enabled":true,"min_photos":4,"min_price":150000,"require_description":true,"min_reference_number":4000000,"require_location":true}'`
- `updated_at`

**RLS:** **SELECT (anon)** `"Anon read site_settings"` — `USING (true)`; **ALL (authenticated)** `"Authenticated full site_settings"`.

---

## `resales_locations`
**Purpose:** Reference list of Resales location names for the filter UI (weekly sync). *(live: 0 rows — currently empty)*

**Key columns:** `id uuid PK`, `name text NOT NULL UNIQUE`, `province text`, `area text`, `parent_name text`, `display_order int DEFAULT 0`, `synced_at timestamptz DEFAULT now()`

**RLS:** **SELECT (anon)** `"Anon read locations"` — `USING (true)`; **ALL (authenticated)** `"Authenticated locations"`.

---

## `resales_location_mapping`
**Purpose:** Nests each distinct Resales `(Location, SubLocation)` pair under a curated `areas` slug (auto-mapped by `scripts/map-resales-locations.mjs`, hand-tunable). *(live: 223 rows)*

**Key columns**
- `id uuid PK`, `location text NOT NULL`, `sublocation text NOT NULL DEFAULT ''` (empty string, not NULL, so UNIQUE pair has no NULL quirks)
- `proposed_area_slug text → areas(slug) ON UPDATE CASCADE ON DELETE SET NULL` (NULL = unmapped)
- `confidence text NOT NULL` CHECK `IN ('high','medium','low','unmapped')`
- `match_method text` (`'name:sublocation' | 'name:location' | 'geo' | NULL`)
- Evidence: `listing_count int NOT NULL DEFAULT 0`, `gps_listing_count int NOT NULL DEFAULT 0`, `median_distance_km numeric`
- `approved boolean NOT NULL DEFAULT false`, `created_at`, `updated_at`
- `UNIQUE (location, sublocation)`

**Foreign keys:** `proposed_area_slug → areas(slug)`

**RLS:** **SELECT (anon)** `"Anon read approved location mappings"` — `approved = true` (public data layer joins only approved); **ALL (authenticated)** `"Authenticated manage location mappings"`.

---

## `resales_features`
**Purpose:** Reference feature taxonomy for the filter UI (weekly sync). *(live: 0 rows — currently empty)*

**Key columns:** `id uuid PK`, `category text NOT NULL`, `name text NOT NULL`, `parameter_name text NOT NULL` (e.g. `'1Pool1'`), `display_order int`, `labels jsonb DEFAULT '{}'` (locale), `active boolean DEFAULT true`, `synced_at`, `UNIQUE (category, name)`

**RLS:** **SELECT (anon)** `"Anon read features"` — `USING (true)`; **ALL (authenticated)** `"Authenticated features"`.

---

## `resales_property_types`
**Purpose:** Reference property-type taxonomy for the filter UI (weekly sync). *(live: 0 rows — currently empty)*

**Key columns:** `id uuid PK`, `type_id text NOT NULL UNIQUE` (e.g. `'1-1'`), `parent_type_id text`, `labels jsonb DEFAULT '{}'` (locale), `active boolean DEFAULT true`, `synced_at`

**RLS:** **SELECT (anon)** `"Anon read types"` — `USING (true)`; **ALL (authenticated)** `"Authenticated types"`.

---

## `quizzes`
**Purpose:** Data-driven quiz definitions (one renderer consumes any row; questions/options/result config in JSONB). *(live: 2 rows)*

**Key columns:** `id uuid PK`, `slug text NOT NULL UNIQUE`, `title text NOT NULL`, `status text NOT NULL DEFAULT 'draft'` CHECK `IN ('live','draft')`, `intro jsonb NOT NULL DEFAULT '{}'`, `questions jsonb NOT NULL DEFAULT '[]'`, `result jsonb NOT NULL DEFAULT '{}'`, `created_at`, `updated_at`

**RLS:** **SELECT (anon)** `"Anon read live quizzes"` — `status = 'live'`; **ALL (authenticated)** `"Authenticated manage quizzes"`.

---

## `quiz_events`
**Purpose:** First-party quiz funnel events (no PII/cookies); powers completion + drop-off stats. Written via service role only. *(live: 23 rows)*

**Key columns:** `id uuid PK`, `quiz_slug text NOT NULL`, `event text NOT NULL` CHECK `IN ('start','answer','contact_view','complete')`, `step int`, `question_id text`, `answer_id text`, `run_id text` (random per-run, not a user id), `created_at`

**RLS:** **SELECT (authenticated)** only `"Authenticated read quiz events"`. No anon/insert policy (service-role writes).

**Indexes:** `idx_quiz_events_slug_event (quiz_slug, event, created_at DESC)`

---

## `short_links`
**Purpose:** One table for `/s/{code}` (search) and `/c/{code}` (collection) short links. *(live: 6 rows)*

**Key columns**
- `id uuid PK`
- `code text NOT NULL UNIQUE` CHECK `code ~ '^[a-z0-9-]{3,40}$'` (random base36 or admin slug)
- `target text NOT NULL` CHECK `target LIKE '/%'` (same-origin path only)
- `kind text NOT NULL DEFAULT 'search'` (`'search' | 'collection' | …`)
- `context jsonb`, `hits int NOT NULL DEFAULT 0`, `created_at`

**RLS:** **ALL (authenticated)** `"Authenticated manage short links"` only. Resolution/minting go through service-role routes; the `bump_short_link` RPC handles the public hit increment.

**Indexes:** `idx_short_links_code (code)`

---

## `collections`
**Purpose:** Shareable property collections (community + personal-recipient). *(live: 0 rows)*

**Key columns:** `id uuid PK`, `slug text UNIQUE NOT NULL`, `title text NOT NULL`, `message text`, `type text NOT NULL DEFAULT 'community'` CHECK `IN ('community','personal')`, `cover_image text`, `recipient_name text`, `is_published boolean DEFAULT false`, `view_count int DEFAULT 0`, `created_at`, `updated_at`

**RLS:** **SELECT (anon)** `"Anon read published collections"` — `is_published = true`; **ALL (authenticated)** `"Authenticated full collections"`. View counter incremented via the `increment_collection_views` SECURITY DEFINER RPC (anon has no UPDATE grant).

---

## `collection_properties`
**Purpose:** Ordered join: collections ↔ properties. *(live: 0 rows)*

**Key columns:** `id uuid PK`, `collection_id uuid NOT NULL → collections(id) ON DELETE CASCADE`, `property_id uuid NOT NULL → properties(id) ON DELETE CASCADE`, `sort_order int DEFAULT 0`, `created_at`, `UNIQUE (collection_id, property_id)`

**RLS:** **SELECT (anon)** `"Anon read collection_properties"` — `USING (true)`; **ALL (authenticated)** `"Authenticated full collection_properties"`.

---

## `agents`
**Purpose:** Sales agents (profiles + optional auth link). *(live: 0 rows)*

**Key columns:** `id uuid PK`, `slug text UNIQUE NOT NULL`, `name text NOT NULL`, `photo text`, `email text`, `phone text`, `whatsapp text`, `languages text[]`, `bios jsonb DEFAULT '{}'` (locale), `active boolean DEFAULT true`, `display_order int DEFAULT 0`, `user_id uuid` (optional link to `auth.users` — **no FK constraint**), `created_at`, `updated_at`

**RLS:** **SELECT (anon)** `"Anon read active agents"` — `active = true`; **ALL (authenticated)** `"Authenticated full agents"`.

**Referenced by:** `properties.assigned_agent_id`, `developments.assigned_agent_id`, `leads.assigned_agent_id`, `email_selections.agent_id` (all `ON DELETE SET NULL`).

---

## `blog_posts`
**Purpose:** Blog / guide content (locale-aware). *(live: 7 rows)*

**Key columns:** `slug text PRIMARY KEY`, `title text NOT NULL`, `meta_description text DEFAULT ''`, `category blog_category NOT NULL DEFAULT 'lifestyle'`, `excerpt text`, `content text`, `keywords text[]`, `published_at date DEFAULT CURRENT_DATE`, `updated_at_date date DEFAULT CURRENT_DATE`, `reading_time text DEFAULT '5 min read'`, `featured boolean DEFAULT false`, `hero_image text`, `hero_image_alt text`, `localised jsonb DEFAULT '{}'` (per-locale `{title,excerpt,content}`), `published boolean DEFAULT false`, `created_at`, `updated_at`

**RLS:** **SELECT (anon)** `"Anon read published blog"` — `published = true`; **ALL (authenticated)** `"Authenticated full blog"`.

**Indexes:** `idx_blog_published_featured_date (published, featured DESC, published_at DESC)`

---

## `email_selections`
**Purpose:** Agent-curated property selections for email campaigns. *(live: 0 rows)*

**Key columns:** `id uuid PK`, `agent_id uuid → agents(id) ON DELETE SET NULL`, `name text NOT NULL`, `intro_text text`, `layout text DEFAULT 'single-column'` CHECK `IN ('single-column','two-up-grid','hero-grid')`, `property_ids uuid[] DEFAULT '{}'`, `send_count int DEFAULT 0`, `last_sent_at`, `recipient_summary text`, `notes text`, `created_at`, `updated_at`

**RLS:** **ALL (authenticated)** only `"Authenticated full email_selections"` — fully admin-only (no anon read).

---

## `email_selection_properties`
**Purpose:** Optional ordered junction for email selections (future use). *(live: 0 rows)*

**Key columns:** `id uuid PK`, `selection_id uuid NOT NULL → email_selections(id) ON DELETE CASCADE`, `property_id uuid NOT NULL → properties(id) ON DELETE CASCADE`, `sort_order int DEFAULT 0`, `created_at`, `UNIQUE (selection_id, property_id)`

**RLS:** **ALL (authenticated)** only `"Authenticated full esp"`.

---

## `feature_options`
**Purpose:** Admin-editable master list of property features, grouped by category (seeded with ~57 defaults). *(live: 57 rows)*

**Key columns:** `id uuid PK`, `name text NOT NULL UNIQUE`, `category text DEFAULT 'Other'`, `created_at`

**RLS:** **SELECT (anon)** `"Anyone can read feature_options"` — `USING (true)`; **ALL (authenticated)** `"Authenticated users can manage feature_options"`.

---

## Custom functions / RPCs

All four confirmed **callable** via live introspection.

| Function | Signature | Volatility / security | Purpose |
|---|---|---|---|
| `update_updated_at_column()` | `() RETURNS trigger` | plpgsql | Trigger fn: sets `NEW.updated_at = now()`. Attached to `properties` (`update_properties_updated_at`). |
| `increment_collection_views(p_slug text)` | `RETURNS void` | SQL, **SECURITY DEFINER**, `search_path=public` | Atomic, race-free `view_count + 1` on published collections. `EXECUTE` granted to `anon, authenticated`; revoked from PUBLIC. |
| `publish_gate_breakdown()` | `RETURNS TABLE(rule text, held bigint)` | SQL **STABLE**, SECURITY INVOKER | Held-by-rule breakdown for admin dashboard: `unnest(publish_gate_failures)` over `source='resales_online' AND pending_review AND NOT published AND NOT rejected AND removed_at IS NULL`, grouped by rule. *(live sample: min_reference_number=282, min_price=207, min_photos=144)* |
| `immutable_join_text(arr text[])` | `RETURNS text` | SQL **IMMUTABLE PARALLEL SAFE** | Wraps `array_to_string(arr, ' · ')` to be IMMUTABLE so it can back the `properties.features_text` **generated** column. |
| `bump_short_link(p_code text)` | `RETURNS text` | SQL (VOLATILE) | Atomic `hits + 1` for `/s/`,`/c/` redirects; returns the link `target`. |

---

## Storage buckets (Supabase Storage)
Created in the backfill migration (all `public = true`): `property-images`, `area-images`, `blog-images`, `development-images`. (Bucket policies were noted as run via the dashboard in the initial migration; not in version-controlled SQL.)

## Cross-cutting notes for the next engineer
- **Three reference tables are currently empty in prod** (`resales_locations`, `resales_features`, `resales_property_types`) — they're populated by a weekly Resales sync that has not run / not landed data yet. The filter UI must degrade gracefully when they're empty.
- **`agents` is empty**, so every `assigned_agent_id` is currently NULL.
- **`agents.user_id`** is a bare `uuid` with **no FK** to `auth.users` (comment says "optional link") — don't assume referential integrity there.
- **Two layers of properties RLS policies** coexist (legacy `"Public can read published properties"`/`"Admins can do everything"` from the initial migration + the canonical `"Anon read…"`/`"Authenticated full…"`). They are equivalent in effect (published-read + authenticated-all).
- **`bathrooms` family is `numeric`**, not integer (fractional MLS values). `bedrooms` stays integer.
- **Generated column** `properties.features_text` is `STORED` and depends on `immutable_join_text` — dropping that function requires dropping the column first.
- Migration `20260612091000_quiz_seeds.sql` is **data-only** (seeds the 2 launch quizzes); no DDL.


---

# §8 — Environment variables (exact names)

# Smartmove Marbella — Environment Variables (exhaustive)

All entries below are **actually referenced in source** (`src/`, `workers/*/src`, `relay/resales-relay/*`, `scripts/`) or declared in a `wrangler.toml [vars]` / `.dev.vars`. Variables that appear only as **placeholders in `.env.example`** with **no code consumer** are flagged explicitly in the *Documented-but-unused* section so a future engineer doesn't chase phantom config.

Legend: **Req** = required, **Opt** = optional. Defaults shown where the code supplies one. "Worker secret" = set via `wrangler secret put`, not in Vercel.

---

## Supabase

| EXACT name | Where used (file) | Purpose | Req/Opt (+default) | NEXT_PUBLIC? |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/**` (browser+server Supabase clients), `scripts/*` | Supabase project REST/realtime base URL | Req | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/**` Supabase client | Public anon key for RLS-scoped reads | Req | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/**` admin/server actions, `scripts/*` | Server-only service-role key; powers admin sync + one-off prod ops (RLS bypass) | Req (server) | No |
| `SUPABASE_URL` | `workers/image-proxy/src/index.ts` (`Env.SUPABASE_URL`) | Worker-side source-URL lookup fallback (REST) | Opt (worker secret) | No |
| `SUPABASE_ANON_KEY` | `workers/image-proxy/src/index.ts` (`Env.SUPABASE_ANON_KEY`) | Worker-side anon key for the same lookup | Opt (worker secret) | No |

> Note: the image-proxy worker uses the **non-prefixed** `SUPABASE_URL` / `SUPABASE_ANON_KEY` (worker secrets), distinct from the Next.js `NEXT_PUBLIC_*` pair.

---

## Resales API + Relay/Proxy

**Next.js app side** (talks only to the proxy/relay, never to Resales directly):

| EXACT name | Where used (file) | Purpose | Req/Opt (+default) | NEXT_PUBLIC? |
|---|---|---|---|---|
| `RESALES_PROXY_URL` | `src/lib/integrations/resales.ts:108`; `scripts/probe-resales.mjs` | Base URL of the proxy. **Currently points at the fixed-IP VPS relay** (`https://167-233-98-46.sslip.io`), not the Worker — Resales whitelists one static IP. | Req (server) — throws if unset | No |
| `RESALES_PROXY_SECRET` | `src/lib/integrations/resales.ts:126`; `scripts/probe-resales.mjs`; `workers/resales-proxy/src/index.ts`; `relay/.../server.mjs` | Shared secret sent as `x-smartmove-secret`; relay/worker 401 without a match | Req (server + relay/worker) — throws if unset | No |
| `RESALES_REQS_PER_SEC` | `src/lib/integrations/resales-throttle.ts:58` | Steady request pacing against Resales | Opt — **default 2.5** | No |
| `RESALES_MAX_RETRIES` | `src/lib/integrations/resales-throttle.ts:61` | Retry ceiling on transient failures | Opt — **default 4** | No |
| `RESALES_DRAIN_BUDGET_MS` | `src/app/api/admin/resales/sync/route.ts:19`; `.../reconcile/route.ts:109` | Per-invocation time budget to drain the sync queue (keeps serverless fn under limit) | Opt — **default 230000** (230s) | No |
| `RESALES_OWN_FILTER_ID` | `src/lib/integrations/resales-own.ts:29` | Resales "only own properties" filter id; membership decides own (auto-publish) vs MLS (pending review) | Opt — **default 5** | No |
| `RESALES_SAMPLES_DIR` | `src/app/api/admin/resales/seed-samples/route.ts:48` | Local dir of sample payloads for the seed-samples admin route | Opt (dev) — falls back to a built-in path | No |

**Relay / Worker side** (`relay/resales-relay/server.mjs`, `workers/resales-proxy/`):

| EXACT name | Where used (file) | Purpose | Req/Opt (+default) | NEXT_PUBLIC? |
|---|---|---|---|---|
| `RESALES_P1` | `relay/.../server.mjs:31`; `workers/resales-proxy/src/index.ts:26`; worker `.dev.vars` | Resales credential p1 (sent as query param, scrubbed from responses) | Req (relay/worker secret) | No |
| `RESALES_P2` | `relay/.../server.mjs:32`; `workers/resales-proxy/src/index.ts:27`; worker `.dev.vars` | Resales credential p2 (rotated 2026-06-10) | Req (relay/worker secret) | No |
| `RESALES_BASE` | `relay/.../server.mjs:34`; `workers/resales-proxy/wrangler.toml [vars]` | Resales API base | Opt — **default `https://webapi.resales-online.com/V6`** | No |
| `RESALES_SANDBOX` | `relay/.../server.mjs:35`; worker `wrangler.toml [vars]` + `.dev.vars` | `P_sandbox` toggle (string `"true"`/`"false"`) | Opt — **default `"true"`** | No |
| `ALLOWED_ENDPOINTS` | `workers/resales-proxy/src/index.ts:31` + `wrangler.toml [vars]` | Comma-separated endpoint allow-list; `RegisterLead` deliberately excluded | Req for worker (effectively empty ⇒ all rejected) | No |
| `PORT` | `relay/.../server.mjs:27` | Relay listen port | Opt — **default 8787** | No |

> Relay secrets are loaded by systemd from `EnvironmentFile=/etc/resales-relay/env` (see `relay/resales-relay/resales-relay.service`). Worker secrets are `wrangler secret put`. **`RESALES_REQS_PER_SEC`, `RESALES_MAX_RETRIES`, `RESALES_DRAIN_BUDGET_MS`, `RESALES_OWN_FILTER_ID` live ONLY in the Next.js app** — they are not read by the relay or worker.

---

## Cloudflare image proxy + purge

| EXACT name | Where used (file) | Purpose | Req/Opt (+default) | NEXT_PUBLIC? |
|---|---|---|---|---|
| `NEXT_PUBLIC_IMAGE_PROXY_URL` | `src/lib/integrations/cloudflare-images.ts:13`; `.env.local`, `.vercel/.env.development.local` | Public image-proxy Worker URL used by `next/image` + purge calls. Empty in dev ⇒ picsum fallback; **must be set in prod (code refuses picsum)** | Req in prod / Opt in dev | Yes |
| `IMAGE_PROXY_PURGE_SECRET` | `src/lib/integrations/cloudflare-images.ts:57` | Sent as `x-purge-secret` on `DELETE /{p|d}/{id}`; **must equal the Worker's `PURGE_SECRET`** | Opt (purge silently skipped if unset) | No |
| `PURGE_SECRET` | `workers/image-proxy/src/index.ts:37,157,160` | Worker-side counterpart authorising R2 prefix cleanse | Opt (worker secret; purge endpoint 403s if unset) | No |
| `IMAGES_BUCKET` | `workers/image-proxy/src/index.ts:25`; `wrangler.toml` | R2 binding `smartmove-property-images` | Req (binding) | No |
| `ALLOWED_ORIGINS` | `workers/image-proxy/src/index.ts:26` + `wrangler.toml [vars]`; also `workers/protomaps-tiles/wrangler.toml` | Allowed source origins for lazy fetch (image-proxy) / CORS (tiles, empty ⇒ `*`) | Opt | No |
| `CF_IMAGES_DELIVERY` | `workers/image-proxy/src/index.ts:27` + `wrangler.toml [vars]` | Cloudflare Images delivery URL prefix (currently `""`, unused path) | Opt (default `""`) | No |
| `SOURCE_URLS` | `workers/image-proxy/src/index.ts:28,196` | Optional KV namespace for source-URL lookups (commented out in wrangler) | Opt (binding) | No |

**protomaps-tiles worker** (`workers/protomaps-tiles/`): `TILES_BUCKET` (R2 binding, Req), `ALLOWED_ARCHIVES` (`[vars]`, default `costa-del-sol.pmtiles`), `ALLOWED_ORIGINS` (`[vars]`, empty ⇒ `*`).

---

## IndexNow

| EXACT name | Where used (file) | Purpose | Req/Opt (+default) | NEXT_PUBLIC? |
|---|---|---|---|---|
| `INDEXNOW_KEY` | `src/lib/indexnow.ts:55`; `scripts/generate-indexnow-key.mjs:15` | Key for instant search-engine pings; key file `/public/{key}.txt` generated at build. Unset ⇒ pings silently skipped | Opt | No |

---

## Cron / secrets

| EXACT name | Where used (file) | Purpose | Req/Opt (+default) | NEXT_PUBLIC? |
|---|---|---|---|---|
| `SYNC_CRON_SECRET` | `src/app/api/admin/resales/sync/route.ts:92`; `.../reconcile/route.ts:33`; also fallback for `LEAD_FORM_SECRET` | Protects `/api/admin/resales/sync` & reconcile; sent as `x-smartmove-cron-secret` by Vercel Cron + admin button | Req (server) | No |
| `CRON_SECRET` | `src/app/api/admin/resales/sync/route.ts:92`; `.../reconcile/route.ts:33` | Vercel-native cron secret; **checked first**, falls back to `SYNC_CRON_SECRET` (`process.env.CRON_SECRET \|\| process.env.SYNC_CRON_SECRET`) | Opt | No |
| `LEAD_FORM_SECRET` | `src/lib/lead-protection.ts:32` | HMAC secret for lead-form anti-spam token; **falls back to `SYNC_CRON_SECRET`** if unset (throws if neither set) | Opt (with fallback) | No |

> **GOTCHA (documented):** the local `.env.local` `SYNC_CRON_SECRET` does **NOT** match the Vercel production value. Local scripts hitting prod admin routes (`/api/admin/resales/*`) therefore **401**. For one-off prod operations, **do not** call the prod admin route from local — instead use the **service-role Supabase DB client directly and redeploy**. (Recorded in MEMORY: *publish-gate-and-prod-secret-mismatch*.)

---

## Leads / Upstash

| EXACT name | Where used (file) | Purpose | Req/Opt (+default) | NEXT_PUBLIC? |
|---|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` | `src/lib/lead-protection.ts:70` | Upstash Redis REST URL for lead rate-limiting; unset (local dev) ⇒ rate-limit gracefully no-ops | Opt | No |
| `UPSTASH_REDIS_REST_TOKEN` | `src/lib/lead-protection.ts:71` | Upstash REST token (pairs with URL) | Opt | No |
| `LEADS_RATE_LIMIT_PER_MIN` | `src/lib/lead-protection.ts:76` | Lead submissions allowed per minute per identity | Opt — **default 5** | No |

---

## PostHog / Analytics

| EXACT name | Where used (file) | Purpose | Req/Opt (+default) | NEXT_PUBLIC? |
|---|---|---|---|---|
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | `src/components/PostHogInit.tsx:26` | PostHog project token; **absent ⇒ PostHog no-ops** | Opt | Yes |
| `NEXT_PUBLIC_POSTHOG_HOST` | `src/components/PostHogInit.tsx:32` | PostHog ingestion host | Opt — **default `https://eu.i.posthog.com`** | Yes |
| `NEXT_PUBLIC_GA_ID` | `src/components/Analytics.tsx:37`; `src/components/CookieBanner.tsx:23` | Google Analytics measurement id (consent-gated) | Opt | Yes |
| `NEXT_PUBLIC_META_PIXEL_ID` | `src/components/Analytics.tsx:38`; `CookieBanner.tsx:23` | Meta Pixel id (consent-gated) | Opt | Yes |
| `NEXT_PUBLIC_GSC_VERIFICATION` | `src/app/[locale]/layout.tsx:103` | Google Search Console verification meta tag | Opt | Yes |

---

## Monday CRM (designed-but-disabled at launch)

| EXACT name | Where used (file) | Purpose | Req/Opt (+default) | NEXT_PUBLIC? |
|---|---|---|---|---|
| `MONDAY_API_TOKEN` | `src/lib/**` Monday wrapper (`process.env.MONDAY_API_TOKEN`) | Monday API token; **leave empty until explicitly connected — wrapper no-ops when unset** | Opt (disabled) | No |
| `MONDAY_BOARD_ID` | `src/lib/**` Monday wrapper | Target board id | Opt (disabled) | No |
| `MONDAY_GROUP_ID` | **`.env.example:40` only — no code consumer found** | Intended target group id; not yet read by any source | Opt / unused | No |

---

## Site / Vercel

| EXACT name | Where used (file) | Purpose | Req/Opt (+default) | NEXT_PUBLIC? |
|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `src/app/sitemap.ts:57`, `robots.ts:4`, `[locale]/page.tsx:34`, layout/metadata | Canonical base for metadata, sitemaps, OG, canonical URLs | Opt — **default `https://smartmove.live`** | Yes |
| `VERCEL_PROJECT_PRODUCTION_URL` | `src/app/api/admin/resales/sync/route.ts:439` | Production host used to build self-callback URLs during sync chaining | Opt (Vercel-injected) | No |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | `sync/route.ts:459`; `reconcile/route.ts:125` | Adds `x-vercel-protection-bypass` header so internal self-calls pass deployment protection | Opt (Vercel) | No |
| `NODE_ENV` | `src/lib/integrations/cloudflare-images.ts` and others | Standard dev/prod branch (e.g. picsum-fallback guard) | Opt (runtime-provided) | No |

---

## Booking / Contact

| EXACT name | Where used (file) | Purpose | Req/Opt (+default) | NEXT_PUBLIC? |
|---|---|---|---|---|
| `NEXT_PUBLIC_BOOKING_URL` | `src/components/quiz/QuizRunner.tsx:353` | Quiz "book a call" CTA href; **falls back to WhatsApp URL, then `null`** | Opt | Yes |
| `NEXT_PUBLIC_WHATSAPP_URL` | `src/components/quiz/QuizRunner.tsx:354` | WhatsApp deep-link; fallback for booking CTA | Opt | Yes |

---

## Documented-but-unused (in `.env.example`, NO code consumer found)

These appear in `/Users/alessiomauri/Desktop/smartmove-web/.env.example` (and some in `.env.local`) but are **not referenced anywhere in `src/`, `workers/*/src`, `relay/`, or `scripts/`**. They are stale placeholders or reserved for a not-yet-built path — flag before relying on them:

| EXACT name | Appears in | Status |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | `.env.example:31`, `.env.local` | No consumer. Old zone-purge approach was abandoned (purge now via Worker `IMAGE_PROXY_PURGE_SECRET`; see comment in `cloudflare-images.ts`). |
| `CLOUDFLARE_ZONE_ID` | `.env.example:32`, `.env.local` | No consumer (same dead zone-purge path). |
| `CLOUDFLARE_ACCOUNT_ID` | `.env.example:33`, `.env.local`, `.vercel/.env.development.local` | No consumer in code. |
| `META_CAPI_ACCESS_TOKEN` | `.env.example:71` | No consumer (server-side Meta CAPI not wired). |
| `META_CAPI_PIXEL_ID` | `.env.example:72` | No consumer. |
| `MONDAY_GROUP_ID` | `.env.example:40`, `.env.local` | No consumer (Monday disabled). |

---

## Key source files for the next engineer

- Resales client / proxy contract: `/Users/alessiomauri/Desktop/smartmove-web/src/lib/integrations/resales.ts`
- Throttle/retry/filter tunables: `/Users/alessiomauri/Desktop/smartmove-web/src/lib/integrations/resales-throttle.ts`, `/Users/alessiomauri/Desktop/smartmove-web/src/lib/integrations/resales-own.ts`
- Sync/reconcile cron auth + Vercel self-call: `/Users/alessiomauri/Desktop/smartmove-web/src/app/api/admin/resales/sync/route.ts`, `/Users/alessiomauri/Desktop/smartmove-web/src/app/api/admin/resales/reconcile/route.ts`
- Lead protection (LEAD_FORM_SECRET fallback, Upstash, rate limit): `/Users/alessiomauri/Desktop/smartmove-web/src/lib/lead-protection.ts`
- Image purge: `/Users/alessiomauri/Desktop/smartmove-web/src/lib/integrations/cloudflare-images.ts`
- IndexNow: `/Users/alessiomauri/Desktop/smartmove-web/src/lib/indexnow.ts`
- Workers: `/Users/alessiomauri/Desktop/smartmove-web/workers/{resales-proxy,image-proxy,protomaps-tiles}/{src/index.ts,wrangler.toml}`; resales-proxy `.dev.vars` (contains real sandbox P1/P2 — sensitive)
- Relay: `/Users/alessiomauri/Desktop/smartmove-web/relay/resales-relay/server.mjs` (+ `resales-relay.service` loads `/etc/resales-relay/env`)
- Env templates: `/Users/alessiomauri/Desktop/smartmove-web/.env.example`, `.env.local`, `.vercel/.env.development.local`


---

# §9 — Migration list (chronological)

# Supabase Migrations — Ordered List

Applied chronologically by filename timestamp (`supabase db push`). 18 migrations total.

1. **`20260506145137_initial_schema.sql`** — Creates the `property_status` enum and the core `properties` table (with features, images, location, pricing); adds status/area/published/slug indexes, an `updated_at` trigger, RLS (public read of published, authenticated full access), and seeds one sample property (Villa Amara).

2. **`20260506145138_feature_options.sql`** — Creates the `feature_options` table (name/category) with RLS (public read, authenticated manage) and seeds ~60 default property features grouped by category (Views, Pool & Water, Wellness, etc.).

3. **`20260507130306_marbella_live_backfill.sql`** — Brings the DB to Marbella Live parity: adds enums (`area_region`, `blog_category`, `development_status`, `development_source`), extra `properties` columns (property_type, micro_location, is_featured, etc.), and creates `areas`, `blog_posts`, `collections`, `collection_properties`, `developments`, `site_settings`; enables RLS on `properties` and creates the four public storage buckets.

4. **`20260507130307_smartmove_additions.sql`** — Net-new Smartmove schema: locale JSONB fields on properties/areas/blog_posts/developments, Resales sync + approval-workflow columns on `properties`/`developments`, and new tables `agents`, `leads`, `email_selections`, `email_selection_properties`, `resales_features`, `resales_locations`, `resales_property_types`, `resales_sync_runs`.

5. **`20260507133810_fix_resales_upsert_index.sql`** — Replaces the partial unique indexes on `(source, source_id)` for `properties` and `developments` with full unique indexes so Supabase `ON CONFLICT` upserts can target them.

6. **`20260507143517_fix_leads_anon_insert.sql`** — Recreates the `leads` anon-insert RLS policy explicitly `TO anon, authenticated` with a permissive `WITH CHECK (true)` so public contact forms can insert leads.

7. **`20260507143855_grant_anon_leads.sql`** — Grants `INSERT` and `SELECT(id)` on `leads` to the `anon` role (the `id` select is needed for `.single()` / `return=representation`).

8. **`20260610120000_perf_indexes_and_view_counter.sql`** — Adds composite `(published, created_at DESC)`-style indexes for hot list queries on properties/developments/blog_posts, and creates the `increment_collection_views(text)` SECURITY DEFINER function for an atomic, race-free collection view counter.

9. **`20260610150000_sync_hardening.sql`** — Resales sync hardening: creates `sync_state` key/value table, adds `content_hash` columns, creates `property_price_history` and `property_status_history` tables, adds price-drop gating columns (`hide_price_drop`, `price_drop_at`, `removed_at`, `show_price_drop_badges`), adds per-run metrics columns to `resales_sync_runs`, and widens its `trigger` CHECK constraint.

10. **`20260610170000_indexnow_pinged.sql`** — Adds the `indexnow_pinged` int column to `resales_sync_runs` (observability for how many changed URLs each run submitted to IndexNow).

11. **`20260610190000_fractional_bathrooms.sql`** — Converts `properties.bathrooms` and `developments.bathrooms_from`/`bathrooms_to` from integer to `numeric` to accept fractional MLS bathroom counts (e.g. "2.5").

12. **`20260610230000_publish_gate.sql`** — Adds the rule-driven publish gate: a `publish_gate` JSONB config on `site_settings`, `publish_gate_failures`/`publish_gate_checked_at` columns on `properties`, a GIN index on the failures array, and the `publish_gate_breakdown()` function for the admin held-by-rule dashboard.

13. **`20260611000000_resales_location_mapping.sql`** — Creates the `resales_location_mapping` table nesting each Resales (location, sublocation) pair under a curated area, with confidence/match-method/evidence columns and RLS (public read of approved rows, authenticated manage).

14. **`20260611010000_benalmadena_region.sql`** — Adds the value `'Benalmadena'` to the `area_region` enum (45th curated area's region).

15. **`20260611020000_leads_workflow.sql`** — Replaces the `leads` status CHECK with the call-first workflow (new/called/selection_sent/closed plus legacy values), adds a `(status, submitted_at DESC)` index, and creates the `lead_form_events` table (form-view impressions, service-role written) with authenticated-read RLS.

16. **`20260612090000_quizzes.sql`** — Creates the `quizzes` table (JSONB-driven definitions with live/draft status) and the `quiz_events` funnel table, both with RLS, and extends the `leads` source CHECK to include `quiz-area`/`quiz-dev`.

17. **`20260612091000_quiz_seeds.sql`** — Seeds the two launch quizzes as ordinary rows: `which-coast` (live, area-result) and `which-development` (draft, development-result), each a full 7-question JSONB definition (`ON CONFLICT (slug) DO NOTHING`).

18. **`20260612120000_search_and_short_links.sql`** — Server-side search + short links: adds filtered search indexes on properties/developments, an `immutable_join_text()` helper plus a generated `features_text` column, creates the `short_links` table (with code/target CHECK constraints and RLS) and the atomic `bump_short_link(text)` hit-counter function.

---

**How migrations are applied:** via `supabase db push` (the Supabase CLI), which applies any migration files in `supabase/migrations/` not yet recorded in the remote `supabase_migrations` history, in filename-timestamp order. The local repo is linked to Supabase project ref **`vhsttqejskvofqxgddho`**.

Migration files are located at `/Users/alessiomauri/Desktop/smartmove-web/supabase/migrations/`.


---

# §10 — Feature flags & config switches

# Feature Flags & Config Switches — Handover Reference

All file paths are absolute from repo root `/Users/alessiomauri/Desktop/smartmove-web`.

---

## 1. `NEW_DEVELOPMENTS_PUBLIC` — compile-time TS constant

**Defined:** `src/app/[locale]/new-developments/feature-flag.ts:5`
```ts
export const NEW_DEVELOPMENTS_PUBLIC = true;
```
**Effective value:** `true` (active from day one per brief §3.15).

**Read at (every importer):**
| File:line | What it gates |
|---|---|
| `src/app/[locale]/new-developments/page.tsx:21` | `robots` metadata (index vs noindex) on the index page |
| `src/app/[locale]/new-developments/page.tsx:40` | `if (!NEW_DEVELOPMENTS_PUBLIC) notFound()` — 404s the index route when off |
| `src/app/[locale]/new-developments/[slug]/page.tsx:41` | `robots` metadata on the detail page |
| `src/app/[locale]/new-developments/[slug]/page.tsx:66` | `if (!NEW_DEVELOPMENTS_PUBLIC) notFound()` — 404s detail route when off |
| `src/app/sitemap.ts:117` | Whether `/new-developments` index URL is emitted into the sitemap |
| `src/app/sitemap.ts:167` | Whether per-development URLs are emitted into the sitemap |
| `src/lib/integrations/resales-sync.ts:653` | IndexNow ping for newly-inserted development pages (Tier-1 only) |
| `src/lib/integrations/resales-sync.ts:687` | IndexNow ping for updated development pages |

---

## 2. `PROPERTIES_PUBLIC` — NOT A REAL FLAG

There is **no `PROPERTIES_PUBLIC` constant defined or read anywhere.** It appears only in two stale code comments describing a future state:
- `src/app/[locale]/areas/[slug]/AreaPageClient.tsx:250` — comment "Auto-reverts to the property grid above when `PROPERTIES_PUBLIC=true`"
- `src/components/admin/AdminHeader.tsx:27` — comment "becomes redundant once `PROPERTIES_PUBLIC = true`"

The actual equivalent gate is the `showProperties` prop on the area page, which is now **hardcoded `true`** at `src/app/[locale]/areas/[slug]/page.tsx:257` (passed into `AreaPageClient`, read at `AreaPageClient.tsx:182, 227, 251`). The "info mode" branch (`!showProperties`) is therefore dead in practice. No env or DB switch backs it.

---

## 3. `site_settings.show_price_drop_badges` (DB column, JSONB row id=1)

**Default:** OFF (`?? false` everywhere it's read). Helper logic in `src/lib/price-drop.ts`.

**Written at:** `src/lib/actions/settings.ts:23` (`setShowPriceDropBadges` server action), invoked from the admin toggle `src/app/admin/resales/PriceDropToggle.tsx:23`. Write invalidates `SITE_SETTINGS_TAG`.

**Read at:**
| File:line | Context |
|---|---|
| `src/lib/cache.ts:56` + `:67` | `getCachedPublishedProperties` — feeds `withPriceDropFlag(rows, settings?.show_price_drop_badges ?? false)` |
| `src/lib/queries.ts:59` + `:69` | `getPropertyBySlugCached` — `isPriceDropVisible(row, settings?.show_price_drop_badges ?? false)` |
| `src/app/admin/resales/page.tsx:58` + `:200` | Reads value to render `<PriceDropToggle enabled={... ?? false} />` |

**Double-gate:** site-wide flag AND per-listing `properties.hide_price_drop` (admin-owned; sync never writes it). Window: 30 days (`PRICE_DROP_WINDOW_DAYS`, `src/lib/price-drop.ts:17`). `price_drop` is only ever computed server-side, so a suppressed listing never leaks the fact in its payload.

---

## 4. `site_settings.publish_gate` (JSONB on row id=1) — review-by-exception gate

**Schema + defaults:** `src/lib/integrations/resales-publish-gate.ts:55-62`
```ts
export const DEFAULT_PUBLISH_GATE = {
  enabled: true,
  min_photos: 4,
  min_price: 150_000,            // EUR; POA rows fail
  require_description: true,
  min_reference_number: 4_000_000, // staleness floor on numeric ref
  require_location: true,
};
```
Missing keys fall back to defaults via `mergeGateConfig` (`:138`); unknown/wrong-type keys ignored. **Effective value = whatever's stored in the DB row merged over these defaults** — editable without deploy. `loadPublishGateConfig` (`:157`) returns `null` when `enabled=false`, which all callers treat as "gate inactive → MLS inserts stay pending" (pre-gate behaviour).

Rules live one-per-function in `GATE_RULES` (`:89-114`); a threshold of `0` disables that rule. Failing rule keys are recorded on `properties.publish_gate_failures`.

**Scope guarantees (documented `:11-23`):** gate controls `published`/`pending_review` only; never filters ingestion; never overrides admin reject/unpublish/approve; **never unpublishes**; never touches `is_featured`/`featured_order`.

**Read / invoked at:**
| File:line | Context |
|---|---|
| `src/lib/integrations/resales-sync.ts:488` | `loadPublishGateConfig()` once per sync run (injectable for tests; load failure → gate inactive, error recorded) |
| `src/lib/integrations/resales-sync.ts:303` | `evaluatePublishGate` on **MLS inserts** (`pending_review===true` only) |
| `src/lib/integrations/resales-sync.ts:352` | `evaluatePublishGate` re-check on **updates**, only for untouched-held rows (`pending ∧ unpublished ∧ not removed`) |
| `src/lib/integrations/resales-publish-gate.ts:198` | `runPublishGateBacklog` — bulk pass over the held backlog |
| `src/app/api/admin/resales/publish-gate/route.ts:50` | Admin "Run publish gate" button → `runPublishGateBacklog` |
| `src/app/admin/resales/page.tsx:58, 161-177` | Reads `publish_gate` JSON and renders each key:value as a chip; `enabled:false` chip turns red |

**Per-threshold effective values (from defaults; live value depends on DB):** `enabled=true`, `min_photos=4`, `min_price=150000`, `require_description=true`, `min_reference_number=4000000`, `require_location=true`. Per memory note (`publish-gate-and-prod-secret-mismatch.md`), the gate is live in prod (8,200 → 7,628 published / 572 held).

---

## 5. `site_settings.default_sort` (DB column on row id=1)

**Default:** `'newest'` (`?? 'newest'` fallback). Type `SortOption`.

**Written at:** `src/app/admin/page.tsx:104` (admin settings UI direct Supabase update).

**Read at:**
| File:line | Context |
|---|---|
| `src/lib/cache.ts:200, 204` | `getCachedDefaultSort()` — cached 1h, `SITE_SETTINGS_TAG`-invalidated |
| `src/app/[locale]/page.tsx:16` | Homepage fetches it, passes `defaultSort={defaultSort}` to `HomeListingsClient` (`page.tsx:124`) |
| `src/app/[locale]/HomeListingsClient.tsx:28` | `const activeSort = sort ?? defaultSort` (URL `?sort` overrides) |
| `src/app/admin/page.tsx:92, 95` | Admin reads current value to populate the sort selector |

---

## 6. `RESALES_SANDBOX` (relay-side env)

**Production path is the VPS relay** (`relay/resales-relay/`, `https://167-233-98-46.sslip.io`), NOT the Cloudflare Worker — the Worker is an idle fallback (`workers/resales-proxy/wrangler.toml:1-5` note; Worker egress IP isn't whitelisted by Resales).

**Defined:** env var in `/etc/resales-relay/env` on the VPS (not in repo). Default `'true'`.

**Read at:**
| File:line | Context |
|---|---|
| `relay/resales-relay/server.mjs:35` | Destructured from `process.env`, defaults `'true'` |
| `relay/resales-relay/server.mjs:106` | `upstream.searchParams.set('P_sandbox', RESALES_SANDBOX)` — injected into every Resales call |
| `relay/resales-relay/server.mjs:80` | `/healthz` reports `sandbox: RESALES_SANDBOX === 'true'` |
| (fallback Worker) `workers/resales-proxy/src/index.ts:63` | Same `P_sandbox` injection; value from `wrangler.toml:22` `RESALES_SANDBOX = "true"` |

**Effective value:** `true` (sandbox). Go-live flip is a one-line ops command, not a deploy (`relay/resales-relay/README.md:33, 61`):
```bash
ssh root@167.233.98.46 'sed -i "s/RESALES_SANDBOX=true/RESALES_SANDBOX=false/" /etc/resales-relay/env && systemctl restart resales-relay'
```
Per memory (`resales-api-ip-whitelist-blocker.md`), sandbox sync is verified end-to-end; only the sandbox→prod flip remains (Alessio's call).

---

## 7. `MONDAY_API_TOKEN` no-op gating

**File:** `src/lib/integrations/monday.ts`. The wrapper is fully built but env-gated and inert at launch (brief §4.5).

**Gate function:** `isEnabled()` at `monday.ts:49-54` — reads `process.env.MONDAY_API_TOKEN` AND `process.env.MONDAY_BOARD_ID`; if **either** is unset returns `{ enabled: false }`.

**Read/enforced at every exported fn:**
| File:line | Function |
|---|---|
| `monday.ts:61` | `createLead` → `if (!cfg.enabled) return disabled()` (`{ ok:true, skipped:true, reason:'monday-disabled' }`) |
| `monday.ts:77` | `updateLead` → same `disabled()` short-circuit |
| `monday.ts:90` | `updateLeadStatus` → same `disabled()` short-circuit |

**Effective value:** disabled/no-op (env unset). Lead surfaces always write the local `leads` table first, then call this wrapper which currently no-ops. Even when enabled, the implementations return `{ ok:false, error:'... not yet implemented' }` — so the integration is inert in two layers. Note: `RegisterLead` is deliberately excluded everywhere.

---

## 8. `quizzes.status` (`'live' | 'draft'`) — public render vs admin preview

**Type:** `QuizStatus = 'live' | 'draft'` (`src/lib/quiz.ts:14`). Gating is **RLS-backed**: the anon/static Supabase client only returns `live` rows.

**Public render gate:**
| File:line | Context |
|---|---|
| `src/lib/cache.ts:220` | `getCachedLiveQuizzes` — `.eq('status', 'live')`; feeds homepage `QuizEntryCards` and `generateStaticParams` |
| `src/lib/cache.ts:237` | `getCachedQuizBySlug` — anon RLS; **drafts come back `null`** |
| `src/app/[locale]/quiz/[slug]/page.tsx:54-63` | Public page: tries cached (live-only) fetch first |

**Admin-preview escape hatch:** `src/app/[locale]/quiz/[slug]/page.tsx:55-62` — if cache returns null AND `?preview=1` AND an authenticated user, re-fetches with the cookie client (`supabase.from('quizzes').select('*').eq('slug', slug)`), bypassing the live-only restriction. Otherwise `notFound()` (`:63`).

**Admin side:**
| File:line | Context |
|---|---|
| `src/lib/actions/quizzes.ts:21` | Validates `['live','draft'].includes(quiz.status)` on save |
| `src/lib/actions/quizzes.ts:63` | New quizzes default `status: 'draft'` |
| `src/app/admin/quizzes/page.tsx:88-92` | Renders status badge (green=live, grey=draft) |
| `src/app/admin/quizzes/page.tsx:116` | Preview link appends `?preview=1` only for `draft` quizzes |
| `src/app/admin/quizzes/[slug]/QuizEditor.tsx:118, 126-127` | Status `<select>` + draft-aware preview link |

---

## 9. Two-tier index policy switch (MLS vs featured → noindex)

**Decision logic (single line):** `src/app/[locale]/property/[slug]/page.tsx:111`
```ts
const tier1 = !(property.source === 'resales_online' && !property.is_featured);
```
**Rule:** A property is **Tier-2 (noindex,follow)** iff it's `source === 'resales_online'` AND NOT `is_featured`. Everything else (own listings, OR featured Resales rows) is **Tier-1 (index,follow)**. Facet pages are the indexed wrappers for the MLS universe.

**Read/applied at:**
| File:line | Context |
|---|---|
| `src/app/[locale]/property/[slug]/page.tsx:120-129` | `robots.index` + `robots.googleBot.index` = `tier1` in page metadata |
| `src/lib/integrations/resales-sync.ts:647-657` | IndexNow ping on **insert**: only `kind==='d'` (dev) pages pinged — property inserts are never featured at birth, so never pinged |
| `src/lib/integrations/resales-sync.ts:682-689` | IndexNow ping on **update**: properties pinged only if `existingRow?.is_featured`; devs pinged if `NEW_DEVELOPMENTS_PUBLIC` |

**Related curated-surface gate (homepage):** `src/app/[locale]/page.tsx:30-32` filters out Resales rows that aren't featured, so MLS rows never flood "Featured this week" even though they're published into full-search inventory.

The `/properties` search routes use a separate, simpler index policy: param URLs are noindex,follow with canonical (`src/app/[locale]/properties/page.tsx:40`); clean facet pages are index,follow (`src/app/[locale]/properties/[facet]/page.tsx:41`).

---

## 10. Other booleans / config switches that gate behavior

| Switch | Defined / Read | Effective |
|---|---|---|
| **`INDEXNOW_KEY`** (env) | Read `src/lib/indexnow.ts:55` — `pingIndexNow` returns `0` (silent no-op) when unset. Gates all IndexNow submissions across the sync. | No-op when unset (local dev); set in prod per memory. |
| **`x-smartmove-secret` / `RESALES_PROXY_SECRET`** (env) | Inbound auth on relay `relay/resales-relay/server.mjs:48-56`; Worker `workers/resales-proxy/src/index.ts:44-47`. 401 on mismatch. | Required; must match Vercel env. |
| **`ALLOWED_ENDPOINTS`** (env allow-list) | Relay `server.mjs:45`; Worker `index.ts:51-54`; `wrangler.toml:24`. Blocks any endpoint not listed (403). RegisterLead deliberately excluded. | `SearchProperties,PropertyDetails,SearchFeatures,SearchLocations,SearchPropertyTypes,FeaturedProperties` |
| **`SYNC_CRON_SECRET` / `CRON_SECRET`** (env) | Auth gate on all admin resales routes: `src/app/api/admin/resales/sync/route.ts:92,122`, `.../reconcile/route.ts:33,43,118`, `.../publish-gate/route.ts:24`, `.../seed-samples/route.ts:28`. | Required. Per memory, local value ≠ Vercel prod value (causes 401 from local). |
| **`MONDAY_BOARD_ID`** (env) | Co-gates Monday with the token — `monday.ts:51-52`. | Unset → Monday disabled. |
| **`properties.rejected`** (DB, admin) | Permanent skip before the publish gate ever runs: `resales-publish-gate.ts:233`, `resales-sync.ts:321`. | Admin-owned, overrides everything. |
| **`properties.pending_review` / `published` / `removed_at`** (DB) | Compose the "untouched-held" state the gate is allowed to re-evaluate: `resales-publish-gate.ts:230-235`, `resales-sync.ts:345-351`. | Sync-managed; admin decisions never overridden. |
| **`NEXT_PUBLIC_GSC_VERIFICATION`** (env) | `src/app/[locale]/layout.tsx:103` — emits Google site-verification meta only when set. | Optional. |
| **`showProperties` prop** (area page) | Hardcoded `true` at `src/app/[locale]/areas/[slug]/page.tsx:257`; read in `AreaPageClient.tsx:182,227,251`. The `!showProperties` "info mode" branch is effectively dead. | Always `true`. |

---

### Quick "where to flip each switch"
- **NEW_DEVELOPMENTS_PUBLIC** → edit `src/app/[locale]/new-developments/feature-flag.ts` (code deploy).
- **show_price_drop_badges / default_sort / publish_gate thresholds** → DB `site_settings` row id=1, via admin UI (`/admin/resales`, `/admin`); no deploy.
- **RESALES_SANDBOX** → VPS env file `/etc/resales-relay/env` + service restart (ops command, no deploy).
- **MONDAY_API_TOKEN / MONDAY_BOARD_ID / INDEXNOW_KEY** → Vercel env vars.
- **quizzes.status** → admin quiz editor (DB), RLS enforces live-only public reads.
- **Two-tier noindex** → not a switch; derived per-row from `source`/`is_featured` at `property/[slug]/page.tsx:111`.


---

# §11 — TODOs, known issues & do-not-revert workarounds

# TODOs, Known Issues & Do-Not-Revert Workarounds — Smartmove Marbella

Compiled from a full sweep of `src/`, `workers/`, `relay/`, `scripts/`, `docs/`, the three SYNC/LEADS/QUIZZES runbooks, and the user's three memory files. File:line citations verified against current code.

---

## (a) Explicit code TODOs / FIXMEs

No `FIXME`, `HACK`, or `XXX` markers exist in source (the `XXX` hits are all `G-XXXXXXXXXX` GA-ID placeholders in docs/examples). All real TODOs are admin/editorial wiring gaps, not code defects:

| Location | TODO | Intent |
|---|---|---|
| `src/app/[locale]/areas/AreasIndexClient.tsx:48-54` (also `:335`) | "No region-level photo field exists on the `Area` model yet (admin TODO)" | Region-mode rail uses a hardcoded `flagshipSlug` per cluster as a stand-in for a real `region_photo_url`. |
| `docs/MAP_SYSTEM.md:294`, `:299-320` ("Known TODOs") | Four map TODOs (see list b) | Custom tile-worker domain; `region_photo_url` admin field; `pin_category` not editable in `AreaForm.tsx` (requires manual SQL UPDATE); property-detail native mini-map not built (currently a Google Maps iframe in `LocationSection.tsx`). |
| `workers/image-proxy/README.md:36` | "Phase 4 — TODO in `src/index.ts`" | Image-proxy source-URL resolution to a Supabase RPC lookup is a planned phase, not done. |
| `docs/PERFORMANCE.md:57` | List query includes "short version only via TODO" of `description` | Listing-grid projection deliberately excludes heavy fields; the short-description path is flagged. |
| `docs/ANALYTICS.md:142` | "Add a 'Cookie settings' link in the footer that re-shows the banner (currently TODO)" | Consent banner re-open affordance not yet wired. |
| `docs/BLOG.md:74` | Blog saves "DO NOT yet have a `revalidateTag('blog')` pattern" | Accepted for now (low content velocity); uses `revalidatePath` only. |

---

## (b) Documented known issues / pending items

**Resales sync / go-live (from `docs/SYNC.md` + memory `resales-api-ip-whitelist-blocker`):**
- **Sandbox → production flip is the ONLY remaining go-live step.** Relay still runs `RESALES_SANDBOX=true`. Flip requires Alessio's call: set `RESALES_SANDBOX=false` in `/etc/resales-relay/env` on the VPS (`167.233.98.46`) + restart unit, then run the full import from `/admin/resales`. **Before the flip:** clean sandbox rows (`DELETE FROM properties WHERE source='resales_online'`) and reset `sync_state` watermark/own_refs.
- **572 gate-held listings.** First publish-gate bulk pass (2026-06-10) scanned 8,200 held → published 7,628, **held 572** (min_reference_number 281, min_price 193, min_photos 142). `docs/SYNC.md:161-164`. Developments (446 rows) stay manual-review.
- **80 medium/low location mappings + zero-coverage areas.** `resales_location_mapping` confidence tiers: medium = geocode 2–5 km / coarse fallback, low = >5 km, unmapped = no evidence (correct for inland villages — "unmapped = no guide link, never an error"). Review CSV: `~/Desktop/smartmove-web-briefs/resales-location-mapping-report.csv`. Listing-GPS medians unavailable (Resales hides GPS on MLS rows for this key). `docs/SYNC.md:166-189`.
- **Watermark seeding + P_QueryId TTL probe** were pending against live sandbox (samples carry no `LastUpdated`); since verified live (QueryId TTL ≥60 min). `docs/SYNC.md:219-222`.
- **Price-drop badges not rendered.** `price_drop_at` data + 3-gate computation are ready, but nothing in the UI renders the badge yet — waiting on design. `docs/SYNC.md:192-199`.

**Leads / infra:**
- **Upstash rate limit not yet armed in prod.** `/api/leads` Upstash sliding-window limiter is env-gated; without `UPSTASH_REDIS_REST_URL`/`_TOKEN` it is skipped (and **fails open** on Redis errors). To arm: create a free Upstash Redis db, add both env vars in Vercel, redeploy. `docs/LEADS.md:23-28`; `src/lib/lead-protection.ts:67-71`.
- **Monday CRM deliberately disconnected.** `MONDAY_API_TOKEN` left unset ⇒ wrapper no-ops; `/admin/leads` is the interim CRM and the source of truth. `docs/LEADS.md:99`.

**IndexNow:**
- **Gate-published MLS rows are NOT pinged to IndexNow** by design — they are Tier-2 (noindex, out of sitemap); pinging would invite indexing of pages deliberately hidden. `indexnowPinged` is hardcoded `0` in `src/app/api/admin/resales/publish-gate/route.ts:62-65`.
- IndexNow is env-gated by `INDEXNOW_KEY` (unset ⇒ silent no-op); ownership proven by a `public/{key}.txt` file written at build (`scripts/generate-indexnow-key.mjs`). The "SiteVerificationNotCompleted" state from the task brief is the unset-key / un-generated-key-file condition — no such error string exists in the code; it is the absence of the key file. `src/lib/indexnow.ts:6-8`.

**Image proxy (memory `image-proxy-edge-cache-on-workers-dev`):**
- **Stale code comment:** `workers/image-proxy/src/index.ts` claims the Cache API is a no-op without a custom domain — **this is wrong**; edge caching is live on `*.workers.dev` (verified `cf-cache-status: HIT`). An etag was added to the miss path and purge path.
- **Empty `source_image_urls` rows 404 by design** (negative-cached 300s). If images go missing site-wide, check whether the nightly sync is populating `source_image_urls`.
- **el-chaparral**: the area exists in `src/lib/areas-data.ts:517-534` and is referenced as a `nearbyAreas` entry by 4 other areas; the "missing photo" caveat from the brief corresponds to areas whose `hero_image` is empty (which the cluster fallback chain in `AreasIndexClient.tsx` / `MAP_SYSTEM.md:280-292` handles by falling through to the next area with a hero, then Marbella overview).

**ES translation pass pending:** no Spanish-content TODO marker is in the tree; the i18n scaffold is live (`/es/contacto`, `/es` routing in `proxy.ts`), but a full ES editorial/translation pass is not evidenced as complete in any doc — treat as outstanding.

---

## (c) Load-bearing workarounds — DO NOT REVERT

1. **Relay systemd has NO `MemoryDenyWriteExecute`.** `relay/resales-relay/resales-relay.service:30-31`: *"no MemoryDenyWriteExecute — V8's JIT requires W^X memory and node crashes with SIGTRAP under it."* Every other hardening directive is present; this one is intentionally omitted. Re-adding it kills the relay.

2. **`immutable_join_text()` wrapper for the `features_text` generated column.** `supabase/migrations/20260612120000_search_and_short_links.sql:20-26`. `array_to_string` is not `IMMUTABLE` (Postgres rejects it in a generated column), so it is wrapped in a custom `IMMUTABLE PARALLEL SAFE` SQL function. The `features_text text GENERATED ALWAYS AS (immutable_join_text(features)) STORED` column is what the search ILIKE filters hit — do not inline `array_to_string` or drop the column.

3. **Feature-token matching must cover BOTH dialects in `features_text`.** `src/lib/search.ts:38-46`: manual rows carry bare labels (`'Private Pool'`), MLS rows carry `'Category: Value'` (`'Pool: Private'`). Each `FEATURE_TOKENS` entry ORs multiple substrings for this reason — vocabulary verified against the live DB. Simplifying to single tokens silently breaks MLS-row filtering (this was "the bug" per commit `ed5915d`).

4. **`revalidateTag` (not `updateTag`) inside route handlers.** Server actions use `updateTag(<TAG>)` (Next 16's read-your-own-writes variant — `docs/ARCHITECTURE.md:57-59`, `src/lib/queries.ts:28-29`). But the publish-gate **route handler** correctly imports and calls `revalidateTag(PROPERTIES_TAG, 'max')` (`src/app/api/admin/resales/publish-gate/route.ts:3,67`) — `updateTag` is a server-action-only API. Swapping these by symbol-matching breaks cache invalidation.

5. **Immediate-ack + deadline-drain continuation pattern** (sync + reconcile). `docs/SYNC.md:74-85`; `src/app/api/admin/resales/sync/route.ts:293-473`. Each invocation drains pages until a wall-clock deadline (`RESALES_DRAIN_BUDGET_MS`, default 230s), persists the cursor after every page, then fires **ONE** continuation (`POST {mode:'full-import', _continuation:true}` + cron secret) and exits. The chain is **linear and non-nesting**. This explicitly **replaced** the original `after()`→`await fetch(child)` design that nested awaits, blew `maxDuration`, and left run rows stuck `running`. Do not reintroduce awaited child fetches.

6. **Global `Toaster` in the locale layout.** `src/app/[locale]/layout.tsx:212-215` (and admin layout `:31`). Root cause of silent share/lead/quiz failures was a missing global toast host (commit `d852328`). Share buttons, lead forms, and quizzes fire toasts and must never fail silently (`SearchClient.tsx:110`, `CopyUrlButton.tsx:9`). Removing the global `<Toaster>` re-breaks every never-silent handler.

7. **`SYNC_PROTECTED_FIELDS` — sync must NEVER write these on UPDATE.** `src/lib/integrations/resales-hash.ts:44-66`: `pending_review`, `published`, `rejected`, `hide_price_drop`, `slug`, `price_drop_at`, `removed_at`, `is_featured`/`featured_order`. Also excluded from the content hash so admin actions don't make rows look "changed." The ONE deliberate exception is the publish gate moving untouched-held rows forward. `docs/SYNC.md:33-48`.

8. **Watermark is never wall-clock.** `src/lib/integrations/sync-state.ts:8`, `docs/SYNC.md:35-38`. It advances only after a zero-error run that reached its stop boundary; a failed night re-covers the same window. The old `now − 25h` window silently lost updates in a failed night.

9. **Source-aware location fuzzing.** `src/components/property/LocationSection.tsx:32-39`: partner (Resales) listings must NOT expose exact pins even when coordinates exist (`isPartnerListing = property.source === 'resales_online'` ⇒ `hasCoordinates` forced false). Per SMARTMOVE_BRIEF — bulk inventory gets fuzzed location.

10. **`NEVER add RegisterLead`** to the Resales client/Worker/relay allowlist. `src/lib/integrations/monday.ts:14`, `resales.ts:17`, `workers/resales-proxy/wrangler.toml:23` + `README.md:42`, `relay/resales-relay/server.mjs:12`. Smartmove leads go to Monday CRM only (brief §4.5); a `registerLead` wrapper must not exist.

11. **`pin_category` lives in DATA, never special-cased in the renderer.** `docs/MAP_SYSTEM.md:246-262`: if you write `if (slug === 'nueva-andalucia')` in `AreasMap.tsx`, fix the `pin_category` DB row instead. Nesting (`parent_area`) and visual treatment are decoupled by design.

12. **Short-link routes bypass i18n middleware.** `src/proxy.ts:16-22`: `/s/{code}` and `/c/{code}` are locale-agnostic route handlers; the i18n middleware must not rewrite them into the locale tree (`NextResponse.next()` early return). Same for `/admin`.

**Production ops gotcha (memory `publish-gate-and-prod-secret-mismatch`):** local `.env.local` `SYNC_CRON_SECRET` ≠ Vercel prod value, so local scripts calling prod admin routes get **401**. Prod is self-consistent (continuations/cron read prod env). For one-off prod data ops from this machine: write via the service-role Supabase client, then flush prod ISR with an empty-commit redeploy (`revalidateTag` only works on prod). Never pull prod env values.

---

**Memory files summarized (3):**
- `image-proxy-edge-cache-on-workers-dev.md` — Cache API works on `*.workers.dev` (HITs confirmed); code comment claiming no-op is wrong; MD5 etag added to miss/purge paths; worker version `bb872de8` with secret-gated DELETE cleanse; many rows have empty `source_image_urls` (404 by design).
- `resales-api-ip-whitelist-blocker.md` — RESOLVED: Resales whitelists one static IP per key; fixed-IP node relay on Hetzner `167.233.98.46` via Caddy/sslip.io; live 8,658-row sandbox walk verified (hash-skip resume, watermark seeding, own-vs-MLS via filter-5). Only the sandbox→prod flip remains (Alessio's call). Bathrooms columns made numeric (MLS sends "2.5").
- `publish-gate-and-prod-secret-mismatch.md` — Publish gate shipped (commit `1fdb082`); 8,200 scanned → 7,628 published / 572 held; config in `site_settings.publish_gate` JSONB; local `SYNC_CRON_SECRET` ≠ prod → 401 from local scripts; use service-role DB + redeploy for prod ops.


---

# §12 — Resales sync + relay + image-proxy subsystem

# Resales Sync + Relay + Image-Proxy — Subsystem Reference

A single-source handover for the Resales Online ingest pipeline. Three cooperating systems: the **delta sync** (Next.js orchestrator + admin routes), the **fixed-IP relay** (Hetzner VPS that holds the whitelisted egress IP), and the **image-proxy worker** (R2-backed lazy CDN). Every claim below is grounded in the actual source files cited inline.

---

## 1. DELTA SYNC

The nightly ingest. A no-change night writes **zero rows** and invalidates **zero caches**.

### 1.1 Topology & data flow

```
Vercel Cron (03:00) ─GET Bearer CRON_SECRET─▶ /api/admin/resales/sync
                                                 │
                            runResalesSync() ── resales-sync.ts
                                 │  fetchPage ──▶ resales.ts ──▶ RESALES_PROXY_URL (the relay)
                                 │  mapToRow  ──▶ resales-mapping.ts
                                 │  hashContent ─▶ resales-hash.ts
                                 │  watermark r/w ─▶ sync-state.ts (table sync_state)
                                 │  publish gate ─▶ resales-publish-gate.ts
                                 │  own refs ─────▶ resales-own.ts (filter id 5)
                                 │  R2 purge ─────▶ cloudflare-images.ts ─DELETE─▶ image-proxy worker
                                 └─ writes properties / developments / *_history / resales_sync_runs
```

### 1.2 Watermark — never wall-clock, 10-minute overlap

**Files:** `resales-hash.ts` (math), `sync-state.ts` (persistence), `resales-sync.ts` (use).

- The incremental walk fetches `SearchProperties` with `p_SortType=3` (= `LastUpdated DESC`) and `p_ShowLastUpdateDate=true` (`sync/route.ts` `livePageFetcher`). Rows arrive newest-first.
- **Stop condition:** the walk halts at the first row whose `LastUpdated < effectiveSince` (`resales-sync.ts:552`). Everything older is already in the DB. That stop-boundary row is still counted as `rowsSeen` by design.
- The **watermark** is the max `LastUpdated` observed on the last *fully-successful* run, persisted in `sync_state` under key `resales_watermark` (`WATERMARK_KEY`) as `{ watermark, run_id, updated_at }`. The format is `'YYYY-MM-DD HH:MM:SS'` and **lexicographic comparison IS chronological** for this format (`WATERMARK_RE` in `resales-hash.ts:115`).
- **Lower bound = `subtractOverlap(watermark, 600)`** — the watermark minus a **10-minute** overlap (`resales-hash.ts:137`). The overlap absorbs clock skew between Resales' stamps and our observation; hashing makes the re-read rows free (skip, no write).
- **Advance discipline (the core invariant):** the watermark advances ONLY when `status === 'success'` (zero errors AND the walk reached its stop boundary / feed end) and only forward via `maxWatermark` (`resales-sync.ts:819`). On `partial`/`failed` it is left untouched (`watermark_after: watermarkBefore` on the fatal path, `:925`). **A failed night re-covers the same window next time — it never skips the updates it missed.** This replaced an old `now − 25h` wall-clock window that silently lost any update landing in a failed night.
- Override: an explicit `modifiedSince` (admin custom run) bypasses the watermark and sets `useWatermark=false`.

### 1.3 Content hashing + `HASH_EXCLUDED_FIELDS`

**File:** `resales-hash.ts`.

- Every mapped row is SHA-256-hashed over a **deterministic** serialization (`stableStringify` sorts object keys recursively and drops `undefined` to mirror `JSON.stringify`). Hash answers exactly one question: *did the FEED CONTENT change since we last wrote it?*
- A row whose `content_hash` matches the stored value is **skipped**; its `last_synced_at` is bumped in one batched UPDATE per table (`plan.touchIds`, `resales-sync.ts:726`).
- **`HASH_EXCLUDED_FIELDS`** (excluded from the hash input, `resales-hash.ts:25`):
  - `last_synced_at`, `content_hash` — volatile / self-referential.
  - `hero_image` — derived from `NEXT_PUBLIC_IMAGE_PROXY_URL`; an env change must not dirty 50k rows.
  - `pending_review`, `published`, `rejected`, `hide_price_drop` — admin-owned state, not feed content (an admin approving must not make the row look "changed").
  - `is_featured`, `featured_order` — curation is admin-owned (Resales rows never reach curated surfaces unless explicitly whitelisted).
  - `publish_gate_failures`, `publish_gate_checked_at` — sync-owned bookkeeping, derived (recording *why* a row is held must not dirty it).

### 1.4 `SYNC_PROTECTED_FIELDS` — admin decisions survive every upstream edit

**File:** `resales-hash.ts:56`, applied via `stripProtectedFields()` in the planner (`resales-sync.ts:334`).

On UPDATE the sync NEVER writes: `pending_review`, `published`, `rejected`, `hide_price_drop`, `slug`, `price_drop_at`, `removed_at`, `is_featured`, `featured_order`.

- Rationale: the old blind upsert reset an approved MLS listing to pending+unpublished on every upstream edit. Now approve / unpublish / reject / hide-badge decisions and the public URL (`slug` is identity — a feed-side rename must not 404 an indexed page) all survive. `price_drop_at` / `removed_at` are maintained by dedicated logic, not the generic field copy.
- **The ONE deliberate exception** is the publish gate re-check (§1.9): it may move an *untouched-held* row (pending ∧ unpublished ∧ not rejected/removed) forward to published. It can never override an admin decision and never unpublishes.

### 1.5 Price & status history

**File:** `resales-sync.ts` planner + orchestrator.

- **Price** (property rows only): when `row.price !== existing.price`, a `priceChange` is planned. On apply, one row is inserted into `property_price_history` (`old_price`, `new_price`, `currency`, `changed_at`, `sync_run_id`). The `price_drop_at` column is **stamped on a decrease, cleared on an increase** (`resales-sync.ts:374`).
- **Status** (property rows only): when `newStatus && newStatus !== existing.status`, a row is inserted into `property_status_history` (`old_status`, `new_status`, `changed_at`, `sync_run_id`).
- Both reference the run id so history is traceable to the run that wrote it.

### 1.6 Image-manifest purge

**Files:** `resales-sync.ts` (detection), `cloudflare-images.ts` (`purgeImages`), image-proxy `DELETE` path.

- A row's image manifest is its `source_image_urls` array. The planner sets `imagesChanged` via `arraysEqual` (order-sensitive element compare, `resales-sync.ts:247`).
- On a changed manifest the orchestrator calls `opts.purgeImages(kind, reference)` → `purgeImages()` → `DELETE {WORKER_URL}/{p|d}/{ref}` with header `x-purge-secret: IMAGE_PROXY_PURGE_SECRET`.
- **Why purge-and-refill, not diff:** R2 keys are **index-based** (`p/<ref>/<n>.jpg`), so a partial diff is unsafe (index shift corrupts the mapping). Purge the whole prefix; the lazy proxy refills on demand. This is invariant #3 in `docs/SYNC.md`.

### 1.7 Weekly reconciliation

**Files:** `resales-reconcile.ts` + `reconcile/route.ts`. Cron: **Sunday 04:30** (`vercel.json`).

The nightly delta only sees rows Resales *touched*. Two drift cases slip through, caught here:

1. A reference leaves the feed without a final update (withdrawn / agency excluded / expired) → our row stays published forever.
2. A reference exists upstream but never landed here (missed night / filter hiccup) → we never show it.

Mechanics:
- **Refs-only walk** of the full inventory (`p_SortType=3`, `pageSize=100`), chunked + cursor-persisted in `sync_state.resales_reconcile` (`RECONCILE_KEY`), self-chaining like the full import. Default `pagesPerChunk=600` (raised from 60 — the walk is light, the deadline is the real stop); `deadlineMs` default 230s drains the whole feed in one invocation for any realistic size (≈575 pages / 23k rows at 2.5 req/s).
- **Diff** (`computeReconcileDiff`, pure/tested): `toRemove` = in DB, NOT live, `removed_at` null, and `last_synced_at < now − 15 days` (the sold-tail window, `tailDays=15`). `toIngest` = live ref with no DB row.
- **Apply:** removals → `published=false` + `removed_at` stamp + R2 image cleanse (`purgeImages`). Ingests → `PropertyDetails` (EN+ES, GPS, decree218) through the normal mapper, **capped** at `ingestCap` (default 200, max 500) per run; remainder caught next run or by the nightly once Resales touches them.
- Own-vs-MLS membership is fetched for the ingest inserts; on failure inserts default to MLS/pending. The delta lands in `resales_sync_runs` with `trigger='reconcile'` (also writes `soft_deleted`, `images_purged`). Removed/unpublished URLs ARE pinged to IndexNow (that is how engines learn to recrawl and drop a vanished page).

### 1.8 FULL-IMPORT — immediate-ack + deadline-drain self-chaining

**File:** `sync/route.ts`. State: `sync_state.resales_full_import` (`FULL_IMPORT_KEY`).

The one-time ~50k-row bootstrap. The design that replaced the broken one:

- **`kickFullImport()` does NOT do the work synchronously.** It claims the import in `sync_state` (heartbeating `updated_at`), schedules the drain in `after()`, and returns **immediately** (`ok, started:true`).
- **`drainFullImport()`** (inside `after()`) resumes from the cursor, walks pages until the feed end OR a wall-clock deadline (`DRAIN_BUDGET_MS`, default **230_000ms**, well under `maxDuration = 300`), persisting the cursor **after every page** via `onPageComplete` (heartbeat). If not done, it fires **ONE** continuation (`POST {mode:'full-import', _continuation:true}` with `x-smartmove-cron-secret`) and exits.
- **Why this replaced `after() → await fetch(child)`:** the original design awaited the child's *full response* inside `after()`, so each parent stayed alive for the entire downstream chain, blew `maxDuration`, got killed mid-flight, and left its run row stuck `running`. With immediate-ack, every continuation fetch returns in ~100ms → the chain is **linear and non-nesting**; each invocation lives only for its own drain and its run row always finalizes before any platform kill. (Reconcile route carries the identical fix — see its `execute()` comment.)
- **Concurrency** is gated on `sync_state` freshness (`isImportFresh`, < `STALE_MS` = 8 min), NOT the run-row lock: continuation → always proceeds; manual/cron → skipped while a drain heartbeats, takes over when stale. `MAX_CHUNKS = 200` is the hard ceiling on continuations.
- **Backstop:** the nightly cron `GET` checks for a `running` import first and resumes it (`kickFullImport`) instead of running the delta — so a stalled import always moves.
- **On completion:** `status='done'`, and the watermark is **seeded** from `max_last_updated` observed (page 1 of the DESC walk = the global max). Nightly incremental takes over automatically.
- **Resumability detail:** a `QueryId` expiring mid-walk triggers ONE free restart from page 1 (`resales-sync.ts:522`); hash-skips make the re-walked prefix free. Stale `running` run rows are auto-failed at the 8-min TTL (`failStaleRunRows`).

### 1.9 Own-detection via filter id 5 (`RESALES_OWN_FILTER_ID`)

**File:** `resales-own.ts`.

- AgencyRef values are historically inconsistent and the per-row `OwnProperty` flag depends on filter config, so neither is trusted for own-vs-MLS. Instead, Resales filter **`RESALES_OWN_FILTER_ID` (default 5)** — configured in the Resales admin with "Only own properties" — returns exactly Smartmove's own listings.
- `fetchOwnReferenceSet(throttle)` walks that filter collecting **references only** (`pageSize=100`, hard cap 50 pages / 5,000 refs), paced by the run's shared throttle. The set is snapshotted into `sync_state.resales_own_refs` (`OWN_REFS_KEY`) for observability.
- **Membership is the discriminator, on INSERT only:** member → `autoApprove` → `pending_review=false`, auto-publish (`published = status !== 'sold'`); non-member → MLS → `pending_review=true`. Passed to `mapToRow(raw, { autoApprove: ownRefs.has(ref) })`.
- **Conservative failure:** if the set can't be fetched, the run records the error, `ownRefs = new Set()`, and every insert defaults to MLS/pending — nothing auto-publishes that shouldn't. Because approval flags are insert-only, a mis-classified insert waits for an admin; it doesn't flap.

### 1.10 Sold-tail

`isSoldTail(raw)` (`resales-mapping.ts:311`) detects the 15-day limited-shape sold record (no Price). The orchestrator flips `status='sold'` only where it actually changed, inserts a `property_status_history` row, and batch-touches `last_synced_at` on already-sold rows. The row stays published (per `SMARTMOVE_BRIEF §4.1`).

### 1.11 Publish gate integration

**File:** `resales-publish-gate.ts`. Config in `site_settings.publish_gate` (JSONB, id=1, editable without deploy). Bulk route: `publish-gate/route.ts`.

Review-by-exception for the ~8k+ MLS backlog: rows passing a rule-driven gate **auto-publish into the full-search inventory**; only failures stay in the queue with their failing rule keys recorded in `publish_gate_failures`.

- **Rules** (`GATE_RULES`, one function each; defaults in `DEFAULT_PUBLISH_GATE`): `min_photos` (4), `min_price` (150000 EUR; POA fails), `require_description` (true), `min_reference_number` (4_000_000 — staleness floor on the numeric part of the R-ref; unparseable refs are held), `require_location` (true). A threshold of 0 / false disables that rule. `mergeGateConfig` falls back to defaults for missing/wrong-typed keys.
- **Three application points:**
  1. **Sync INSERT** (MLS property rows only; own rows arrive `pending_review=false` and bypass): pass ⇒ `published = status !== 'sold'`, `pending_review=false`; fail ⇒ pending, `publish_gate_failures` recorded. (`planBatch:302`)
  2. **Sync UPDATE**, the single deliberate `SYNC_PROTECTED_FIELDS` exception: re-evaluated ONLY for untouched-held rows (`pending_review=true ∧ published=false ∧ !removed_at`). Upstream fixing the data publishes; still-failing rows refresh their failure record. (`planBatch:345`)
  3. **Bulk pass** `runPublishGateBacklog()` via `POST /api/admin/resales/publish-gate` (`{dryRun:true}` previews): one pass over every untouched-held row, grouped batch writes (publishers share a payload, holders grouped by failure-signature). **Cache invalidation is the caller's job**; the route revalidates `PROPERTIES_TAG` when `published > 0` and deliberately sends **NO IndexNow ping** (gate-published MLS rows are Tier-2: noindex, out of sitemap).
- **Hard scope guarantees:** the gate controls `published`/`pending_review` ONLY; ingestion is never filtered (failers still upsert and feed history/reconciliation); admin reject is permanent and skipped before the gate sees it; the gate never unpublishes; it never touches `is_featured`/`featured_order`.
- **Config-load failure** ⇒ gate inactive for that run (MLS inserts stay pending — the safe pre-gate behaviour), error recorded in the run row.
- First production pass (2026-06-10): scanned 8,200 held → **published 7,628 / held 572**.

### 1.12 Throttle

**File:** `resales-throttle.ts`. Resales has no hard rate limit but monitors for "unusual or high activity." Goal: never look unusual. Default **2.5 req/s** (`RESALES_REQS_PER_SEC`) with ±20% jitter; retryable failures (429/5xx, network, Resales `transaction.status==='error'`) back off exponentially up to `RESALES_MAX_RETRIES` (default 4). The own-refs walk and the main walk share one throttle = one budget per run.

### 1.13 Admin routes summary

| Route | Methods / auth | Purpose |
|---|---|---|
| `sync/route.ts` | `GET` Bearer `CRON_SECRET` (cron); `POST` `x-smartmove-cron-secret`=`SYNC_CRON_SECRET` OR admin session | Incremental delta + chunked full import (`mode:'full-import'`) |
| `reconcile/route.ts` | `GET` Bearer `CRON_SECRET`; `POST` secret OR admin session | Weekly ref-set reconciliation (immediate-ack + drain) |
| `publish-gate/route.ts` | `POST` secret OR admin session | Bulk gate pass; `{dryRun:true}` previews |
| `sync-reference/route.ts` | `POST` admin session only | Single-ref spot-fix: one `PropertyDetails` (EN+ES) → one upsert |
| `seed-samples/route.ts` | `POST` secret OR admin session | Dev-only: seed from saved sample JSONs; fails on Vercel by design |

`SUPABASE_SERVICE_ROLE_KEY` is used for secret-authed (cron/continuation) runs; manual admin runs ride the admin session.

---

## 2. RELAY — fixed-IP Hetzner VPS

**Files:** `relay/resales-relay/` (`server.mjs`, `scrub.mjs`, `Caddyfile`, `resales-relay.service`, `setup.sh`, `README.md`).

### 2.1 Why it exists

Resales whitelists **exactly ONE static IP per key** — no ranges, no accommodation for Cloudflare Workers' shared egress pool (confirmed by Resales support 2026-06-10). The original Cloudflare proxy worker (`workers/resales-proxy/`) therefore can't reach the live API. Production traffic instead goes through a single-IP VPS the key's whitelist points at. The worker stays deployed as an idle fallback should Resales ever support IP ranges (its `wrangler.toml` header documents the repoint path).

### 2.2 Deployment facts

| | |
|---|---|
| Host | Hetzner VPS **`167.233.98.46`** |
| Hostname | **`https://167-233-98-46.sslip.io`** (sslip.io magic DNS resolves the dashed IP without owning a zone; Let's Encrypt via Caddy) |
| App points at it via | `RESALES_PROXY_URL` (Vercel Production + Preview + `.env.local`) |
| Service | `systemd: resales-relay` — non-root user `resales-relay`, `Restart=always`, `RestartSec=3` |
| Listener | node `127.0.0.1:8787` (localhost only; Caddy is the sole public entry) |
| Credentials | `/etc/resales-relay/env` (mode 0640, `root:resales-relay`) — never in the repo |
| Health | `GET /healthz` (unauthenticated): `{ok, sandbox, uptime_s}` |
| Firewall | UFW: 22 (ssh) / 80 (ACME) / 443 (TLS) only; fail2ban on sshd; unattended-upgrades on |
| Mode | `RESALES_SANDBOX=true` until go-live (flip in env file, `systemctl restart resales-relay`) |

### 2.3 Caddy TLS

`Caddyfile`: one site block `167-233-98-46.sslip.io { encode gzip; reverse_proxy 127.0.0.1:8787 }`. Caddy terminates TLS (automatic Let's Encrypt) and reverse-proxies to the node listener. Migrating to a real subdomain later is documented inline: add an A record, replace the hostname, `systemctl reload caddy` (new cert auto-issues), update `RESALES_PROXY_URL`. The relay itself is hostname-agnostic.

### 2.4 Hardened systemd unit

`resales-relay.service` runs `Type=simple`, `User/Group=resales-relay`, `EnvironmentFile=/etc/resales-relay/env`, `ExecStart=/usr/bin/node /opt/resales-relay/server.mjs`. Hardening: `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, `PrivateDevices`, `ProtectKernel{Tunables,Modules}`, `ProtectControlGroups`, `RestrictSUIDSGID`, `RestrictNamespaces`, `LockPersonality`, `RestrictAddressFamilies=AF_INET AF_INET6`, empty `CapabilityBoundingSet`/`AmbientCapabilities`, `SystemCallArchitectures=native`. **Deliberately no `MemoryDenyWriteExecute`** — V8's JIT needs W^X memory, node crashes with SIGTRAP under it (documented in the unit). `setup.sh` is idempotent (installs node/caddy/ufw/fail2ban/unattended-upgrades, creates the service user, enables everything).

### 2.5 Behavioural parity with the worker

`server.mjs` is a **1:1 port** of `workers/resales-proxy/src/index.ts` — zero npm deps (`node:http` + global fetch):

- **Inbound auth:** `x-smartmove-secret` must equal `RESALES_PROXY_SECRET` (constant-time-ish compare in the relay; plain compare in the worker). Mismatch → 401.
- **Endpoint allowlist** (`ALLOWED_ENDPOINTS`): `SearchProperties, PropertyDetails, SearchFeatures, SearchLocations, SearchPropertyTypes, FeaturedProperties` — **`RegisterLead` is intentionally never present** (Smartmove pushes no leads to Resales). Non-listed → 403.
- **Outbound:** appends `?p1=…&p2=…&P_sandbox=…` to the upstream `https://webapi.resales-online.com/V6/<endpoint>` call. Credentials never appear in browser network panels, server logs, or referrer headers.
- **GET-only** (plus OPTIONS/healthz); other methods → 405.
- Never logs `upstream` URLs or response bodies (both can carry creds); upstream failure returns a generic `502 Upstream unreachable` with no detail. 30s upstream timeout (`AbortSignal.timeout`).

### 2.6 Credential scrub parity

**Probe finding (2026-06-10):** when `transaction.status==='error'`, Resales echoes the request's query params back under `parsedparameters` — **including `p1`/`p2` in clear text**. Both `scrub.mjs` (relay) and `scrub.ts` (worker) run two passes on **every** response body before it leaves: (1) **value pass** — replace every literal occurrence of the live secret strings (length ≥ 4); (2) **key pass** — deep-rewrite any `"p1"`/`"p2"` JSON members to `[redacted]` (covers a caller smuggling their own p1/p2). The two implementations are kept in sync; the parity suite `workers/resales-proxy/test-scrub.mjs` runs identical assertions against both.

---

## 3. IMAGE-PROXY worker

**Files:** `workers/image-proxy/src/index.ts`, `wrangler.toml`; app side `cloudflare-images.ts`.

### 3.1 Routes & flow

- **Read:** `GET /{p|d}/{id}/{index}` (`ROUTE_RE = /^\/(p|d)\/([\w-]+)\/(\d+)$/`). R2 key = `${kind}/${id}/${index}.jpg`.
- **Purge:** `DELETE /{p|d}/{id}` (`PURGE_RE`), secret-gated.

Serve order:
1. **Edge cache** (`caches.default`) — checked first. Active on `*.workers.dev` (verified empirically 2026-06-10; the old comment claiming the Cache API needs a custom domain was wrong). Edge entries carry an etag, so an `if-none-match` that matches returns **304 without touching R2**.
2. **R2 hit** → `r2Response`, honours conditional requests (304 on etag match), and back-fills the edge cache via `ctx.waitUntil`.
3. **Miss** → `resolveSourceUrl` (KV `SOURCE_URLS` if bound, else Supabase PostgREST lookup of `source_image_urls[index]`, column chosen by id shape: UUID→`id`, `R\d+`→`source_id`, else `slug`). Origin checked against `ALLOWED_ORIGINS` (`media-webapi.resales-online.com, cdn.resales-online.com, picsum.photos`). Fetch upstream (cache-buster `?z=`/`?v=` stripped), **serve bytes immediately**, persist to R2 in the background (`ctx.waitUntil` — first byte is no longer delayed by the upload). Unknown id → negative-cached `404` for 300s; upstream non-OK → `502` cached 120s.

### 3.2 R2 lazy cache + etag invariant

R2 objects are stored with `Cache-Control: public, max-age=31536000, immutable`. **Etag = quoted MD5 hex of the bytes** computed on the miss path — chosen specifically because that is exactly what R2 reports as `httpEtag` for a single-part upload, so the **miss-path etag and every later R2-hit etag are identical**. Without this the year-long edge entry created on a miss would be unrevalidatable (no etag → no 304s until eviction). This is the key correctness invariant of the worker.

### 3.3 Purge DELETE path

`handlePurge`: requires `PURGE_SECRET` configured (else 501) and header `x-purge-secret` matching it (else 401). Lists every R2 object under `${kind}/${id}/` (paginated by cursor), deletes them in batches, and **evicts the matching edge-cache entries** (cache key = the public GET URL, `.jpg` stripped). Returns `{ok, deleted, prefix}`. This is the only safe response to an index-based key scheme when a manifest changes (purge-everything + lazy refill) and the full cleanse when a reference leaves the feed. Called from `purgeImages()` in `cloudflare-images.ts`; `PURGE_SECRET` must equal `IMAGE_PROXY_PURGE_SECRET` on Vercel.

### 3.4 Config (`wrangler.toml`)

R2 binding `IMAGES_BUCKET` → bucket `smartmove-property-images`. `workers_dev = true`. Vars: `ALLOWED_ORIGINS`, `CF_IMAGES_DELIVERY` (empty). Secrets via `wrangler secret put`: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (source-URL lookup fallback), `PURGE_SECRET`. App reads `NEXT_PUBLIC_IMAGE_PROXY_URL` to build `/{kind}/{id}/{index}` URLs (production throws if unset rather than serving picsum placeholders).

**Known caveat (`docs/SYNC.md`):** the worker resolves source URLs with the anon key, so **unpublished rows 404 through the proxy** (RLS hides them). No public surface shows unpublished rows so this is correct, but admin review UIs must use raw source URLs for thumbnails.

---

## 4. Cron schedule, auth headers, key invariants

### 4.1 Cron (`vercel.json`)

| Schedule | Cron expr | Path |
|---|---|---|
| Daily 03:00 | `0 3 * * *` | `/api/admin/resales/sync` (incremental, or full-import continuation if mid-flight) |
| Sunday 04:30 | `30 4 * * 0` | `/api/admin/resales/reconcile` |

`RESALES_DRAIN_BUDGET_MS` defaults to 230_000 (under `maxDuration=300`). `STALE_MS` = 8 min (run-row TTL + import-heartbeat freshness). Note: `docs/SYNC.md` mentions a "20 min" auto-fail in the failure runbook table, but the code constant is **8 min** (`STALE_MS = 8 * 60 * 1000`).

### 4.2 Auth headers (exhaustive)

| Surface | Header | Secret |
|---|---|---|
| Vercel Cron `GET` (sync, reconcile) | `Authorization: Bearer …` | `CRON_SECRET` (falls back to `SYNC_CRON_SECRET`) |
| `POST` cron / self-chained continuation / external scheduler (sync, reconcile, publish-gate, seed-samples) | `x-smartmove-cron-secret: …` | `SYNC_CRON_SECRET` |
| Admin manual `POST` | Supabase session cookie | — (`auth.getUser()`) |
| App → relay/worker (every Resales call) | `x-smartmove-secret: …` | `RESALES_PROXY_SECRET` |
| Sync → image worker purge | `x-purge-secret: …` | `IMAGE_PROXY_PURGE_SECRET` (= worker `PURGE_SECRET`) |
| Self-call through Vercel protection (optional) | `x-vercel-protection-bypass` | `VERCEL_AUTOMATION_BYPASS_SECRET` |

### 4.3 Key invariants (do not break)

1. **Watermark is never wall-clock** — advances only after a zero-error run that reached its stop boundary; never backwards.
2. **Sync never overrides admin decisions on UPDATE** (`SYNC_PROTECTED_FIELDS`); those fields are also hash-excluded. The publish gate is the ONE forward-only exception, on untouched-held rows.
3. **R2 keys are index-based** → manifest change purges the whole prefix + lazy refill; never diff individual indices.
4. **Pacing stays boring** — 2.5 req/s ±20% jitter, exponential backoff (`RESALES_REQS_PER_SEC` / `RESALES_MAX_RETRIES`).
5. **No-change night ⇒ zero writes, zero cache invalidations, zero IndexNow pings** (`revalidateTag`/`pingIndexNow` fire only when `rowsInserted + rowsUpdated + soldTailHits > 0`).
6. **Image-proxy etag = R2 single-part MD5 httpEtag** — miss-path and R2-hit etags must stay identical for revalidation to work.
7. **`RegisterLead` is never in the endpoint allowlist** (relay + worker).
8. **Credentials never leave the relay/worker unscrubbed** — value + key scrub on every response body, kept in parity via `test-scrub.mjs`.

---

### File index

- Orchestrator: `/Users/alessiomauri/Desktop/smartmove-web/src/lib/integrations/resales-sync.ts`
- Hash/watermark/protected-fields: `/Users/alessiomauri/Desktop/smartmove-web/src/lib/integrations/resales-hash.ts`
- State persistence: `/Users/alessiomauri/Desktop/smartmove-web/src/lib/integrations/sync-state.ts`
- Own-detection: `/Users/alessiomauri/Desktop/smartmove-web/src/lib/integrations/resales-own.ts`
- Throttle: `/Users/alessiomauri/Desktop/smartmove-web/src/lib/integrations/resales-throttle.ts`
- Reconcile: `/Users/alessiomauri/Desktop/smartmove-web/src/lib/integrations/resales-reconcile.ts`
- Publish gate: `/Users/alessiomauri/Desktop/smartmove-web/src/lib/integrations/resales-publish-gate.ts`
- API client: `/Users/alessiomauri/Desktop/smartmove-web/src/lib/integrations/resales.ts`
- Image helpers/purge: `/Users/alessiomauri/Desktop/smartmove-web/src/lib/integrations/cloudflare-images.ts`
- Routes: `/Users/alessiomauri/Desktop/smartmove-web/src/app/api/admin/resales/{sync,reconcile,publish-gate,sync-reference,seed-samples}/route.ts`
- Resales proxy worker: `/Users/alessiomauri/Desktop/smartmove-web/workers/resales-proxy/src/{index.ts,scrub.ts}` + `wrangler.toml`
- Image proxy worker: `/Users/alessiomauri/Desktop/smartmove-web/workers/image-proxy/src/index.ts` + `wrangler.toml`
- Relay: `/Users/alessiomauri/Desktop/smartmove-web/relay/resales-relay/{server.mjs,scrub.mjs,Caddyfile,resales-relay.service,setup.sh,README.md}`
- Cron config: `/Users/alessiomauri/Desktop/smartmove-web/vercel.json`
- Runbook: `/Users/alessiomauri/Desktop/smartmove-web/docs/SYNC.md`


---

# §13 — Leads pipeline + quiz engine

# Leads Pipeline + Quiz Engine — Engineering Reference

Implements **SMARTMOVE_BRIEF §4.5** (leads) and **SMARTMOVE_NEXT_PROMPTS Prompt 6** (quizzes). Monday CRM is intentionally **disconnected**; `/admin/leads` is the interim CRM and the local `leads` table is the single source of truth.

---

## PART 1 — LEAD PIPELINE

### 1.1 One pipeline, every surface

Every capture surface posts the same JSON to `POST /api/leads`. They all render the one component `src/components/leads/LeadForm.tsx` (except the quiz gate, which inlines its own form but hits the same endpoint).

| Surface | Component / file | `source` | `source_detail` | variant |
|---|---|---|---|---|
| Property page — "Request a viewing" (sticky form column after gallery) | `src/components/property/LeadCaptureSection.tsx` | `viewing-request` | listing ref (`property.source_id ‖ slug`) | `viewing` |
| Property page — brochure email-gate (success reveals `/api/property/[slug]/brochure`) | same file | `brochure-request` | listing ref | `brochure` |
| Development page — 4-intent sidebar (Register early interest / Download the brochure / Book a virtual presentation / Schedule a viewing) | `src/components/leads/DevLeadActions.tsx`, mounted in `src/app/[locale]/new-developments/[slug]/page.tsx` | `viewing-request` (3 intents) / `brochure-request` (brochure) | `<ref> · intent:<label>` | `viewing` / `brochure` |
| `/contact` (+ `/es/contacto`) | `src/app/[locale]/contact/page.tsx` | `contact-form` | `contact-page` | `contact` |
| Footer slim form (site-wide) | `src/components/SiteFooter.tsx` (L105) | `contact-form` | `footer` | `contact-slim` |
| Newsletter | `NewsletterForm` (pre-existing) | `newsletter` | page path | — |
| Quiz completion gate | `src/components/quiz/QuizRunner.tsx` | `quiz-area` / `quiz-dev` | `<slug> · <match slugs>` | inline form |

**4-intent detail (`DevLeadActions`):** four buttons all open the SAME mini `LeadForm`; the chosen action travels as an `intent` label. The intent is double-stamped — prepended to the `message` as `[<label>]` (LeadForm L115) AND appended to `source_detail` as `intent:<label>` (LeadForm L125). `key={intent.key}` resets form state per intent. The brochure intent renders `variant="brochure"` with the dev's `brochure_pdf` as `brochureUrl`.

### 1.2 Hardened `/api/leads` — `src/app/api/leads/route.ts`

POST flow, in order:
1. **Rate limit** (`isRateLimited`) → friendly **429** if over.
2. Parse JSON (**400** on bad JSON) → **zod** `LeadSchema.safeParse` (**400** + issue list on failure). Schema enumerates every writable column; `source` enum includes `quiz-area`/`quiz-dev`; `language` enum is 14 locales.
3. **Honeypot:** if `data['company']` non-empty → `fakeSuccess()` (200 with a random UUID `leadId`, **writes nothing**).
4. **Token verdict** (`verifySubmitToken(data._ts)`): `'invalid'` → **400** "Form session expired — reload"; `'too-fast'` → `fakeSuccess()` (silent drop); `'ok'` → proceed.
5. **DB write first** (durable record) via **service-role** client (`getServiceRoleClient`). Anti-spam fields (`_ts`, `company`) are stripped; columns explicitly enumerated; `status:'new'`, `language` defaults `'en'`, `submitted_at` set. **500** "Could not save lead" if insert fails.
6. **Monday push runs in `after()`** (Next.js `after`, post-response) — the public form never waits on Monday. Result handling: `skipped` → set `monday_sync_skipped:true`; `ok` + `itemId` → set `monday_item_id` + `monday_synced_at`. Failures are caught and logged; the row stays queued via the `idx_leads_monday_pending` partial index.
7. Returns `{ ok:true, leadId: row.id }`.

**Why service role** (documented in-file): INSERT-then-SELECT-id read-back, plus writing Monday-sync columns, without granting anon SELECT/UPDATE (which would leak every lead). Zod + explicit column enumeration keep the attack surface to what the validator allows.

**Never-silent:** real errors surface as 400/429/500 with copy; only bot signals (honeypot, too-fast) get the indistinguishable fake-200.

### 1.3 Anti-spam — `src/lib/lead-protection.ts`

Three independent layers; a bot must beat all three:

- **Rate limit:** Upstash sliding window per IP, default **5/min** (`LEADS_RATE_LIMIT_PER_MIN`). **Env-gated** — without `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` the limiter is `null` and skipped (local dev needs no Redis). **Fails OPEN** on Redis errors ("a lead beats a limit"). Singleton limiter; `clientIp()` reads `x-forwarded-for` then `x-real-ip`. `isRateLimited(req, keySuffix)` lets the track endpoints use separate buckets (`:track`, `:quiz-track`).
- **Honeypot:** `HONEYPOT_FIELD = 'company'` — a visually-hidden `company` input (looks legit to autofill bots). Filled ⇒ fake success.
- **Min time-to-submit (signed HMAC token):** `mintSubmitToken()` returns `` `<epoch-ms>.<hmac>` `` (HMAC-SHA256, stateless/unforgeable). `verifySubmitToken()` checks format (`/^\d{10,16}$/` ts, `/^[0-9a-f]{64}$/` mac), `timingSafeEqual` on the MAC, then age: `< 0 ‖ > MAX_TOKEN_AGE_MS (6h)` → `'invalid'`; `< MIN_SUBMIT_MS (2_000)` → `'too-fast'`; else `'ok'`. Secret = **`LEAD_FORM_SECRET`** falling back to **`SYNC_CRON_SECRET`** (no new prod env var).

**Token mint route — `src/app/api/leads/token/route.ts`:** `GET` returns `{ token }` with `cache-control: no-store`, `dynamic='force-dynamic'`. Must be a runtime fetch because the form pages are ISR-cached — a render-time stamp would be hours stale. Every lead form fetches this **on mount** (`LeadForm` L75, `QuizRunner` L74).

### 1.4 Form-view tracking & conversion

- **`src/app/api/leads/track/route.ts`:** `POST` → `lead_form_events` via service role. Zod `{ form, path?, detail? }`; strips query string from `path` (`split('?')[0]`); rate-limited with `:track` suffix; no cookies/PII. `event` is hard-checked to `'view'` in the DB.
- **Client beacon (`LeadForm` L80-98):** module-level `seenViews` Set dedupes one view per `source:sourceDetail` per page load. Fires `navigator.sendBeacon` (falls back to `fetch keepalive`), wrapped so tracking never breaks the form. Mirrors `phCapture('lead_form_view', …)` to PostHog.
- **Conversion = leads ÷ views.** The dashboard header computes 7-day conversion as `subs7d / views7d` (leads counted by `submitted_at`, views by `lead_form_events.created_at`). PostHog also receives `lead_form_submit` / `lead_form_error` for contact-screen drop-off.

### 1.5 Interim CRM — `/admin/leads`

**`page.tsx`** (`dynamic='force-dynamic'`, auth-gated → `/admin/login`): fetches up to 300 leads newest-first with optional `status`/`source`/`from`/`to` filters; runs 6 parallel queries for header counts (**New today**, **New this week**, **Awaiting call** = `status='new'`, **7-day form conversion** with submit/view subtext). Resolves `property_reference` → public slug via the `properties.source_id` map so rows deep-link to listings.

**`LeadsTable.tsx`** (call-first design):
- **NEW rows are loud** — 2px gold border, tinted `#fdf6e7` background, gold glow, pulse dot — the same-hour-callback rule depends on it.
- **Status pipeline, one click each:** `new → called → selection_sent → closed` via `updateLeadStatus` server action + `router.refresh()`; toasts via `sonner`. `statusColor()` tints each pill.
- **Click-to-act (expanded row):** `tel:` + `wa.me/<digits>?text=<pre-filled greeting incl. ref>` + `mailto:`. The whole row expands to everything submitted (message, context, bedrooms, budget, timeline, preferred contact, language, UTM) — advisor reads it before dialing.
- **Filters:** status / source / date range, pushed to URL; **Clear** resets.
- Quiz leads (`quiz-area`/`quiz-dev`) get the same new-lead glow + callback treatment; `sourceBadgeColor` (in `lead-status.ts`) tints `quiz*` sources amber.

**`src/lib/lead-status.ts`:** `LEAD_STATUSES = ['new','called','selection_sent','closed']`, labels, and `sourceBadgeColor()`.
**`src/lib/actions/leads.ts`:** `updateLeadStatus` (re-validates status against `LEAD_STATUSES` at runtime — server actions get untyped data; `requireAdmin()` gate) and `buildEmailSelection` (below).

### 1.6 Copy-card-to-email (selection emails)

Admin-only; **the app never sends email** — clipboard only.

- **`buildEmailSelection({ ids?, references?, leadId? })`** (`src/lib/actions/leads.ts`): looks up properties by row `id` (admin multi-select) and/or by Resales `source_id` (lead rows carry `property_reference`), both capped at **20**. Preserves the admin's `ids` selection order. Returns `{ html, text, count }`.
- **`src/lib/email-card.ts`** — the email-safe twin of the React card. **600px fixed-width table, every style inlined**, Georgia serif stack, no web fonts/JS/hover, absolute CDN images (Gmail-proxy-friendly), gold hairline, bulletproof padded `<a>` button. Every link carries `utm_source=selection&utm_medium=email&utm_campaign=property-selection` **+ `lead=<id>`** when copied from a lead row, so clicks tie back to the lead. Known caveats documented (Outlook/Word squares corners & ignores `max-width` — fixed 600px keeps it sane). Exports `renderEmailCards` (HTML, 24px spacers, paper-tinted wrapper) and `renderEmailCardsText` (text/plain fallback).
- **`src/components/admin/copy-email-selection.ts`** — `copySelectionToClipboard(build)` writes a single `ClipboardItem` with **both** `text/html` and `text/plain`. Critically, it hands the `ClipboardItem` **promises of blobs** so the clipboard write starts inside the user gesture (Chrome transient-activation rule) while the server action is still building HTML. Falls back to `writeText(text)` on older browsers.
- **Entry points:** lead row "Copy card for email" (`LeadsTable.copyCard`, uses that lead's `property_reference` + `leadId`); and the admin property list floating bar (multi-select → "Copy for email"). `/c` collection codes are the short-link side of the same selection system.

### 1.7 Monday integration — `src/lib/integrations/monday.ts` (DISCONNECTED, no-op gate)

Wrapper is fully designed but **env-gated and inert at launch**. `isEnabled()` requires both `MONDAY_API_TOKEN` **and** `MONDAY_BOARD_ID`; unset ⇒ every function returns `disabled()` = `{ ok:true, skipped:true, reason:'monday-disabled' }` **with no network call**. `createLead` / `updateLead` / `updateLeadStatus` are stubs returning "not yet implemented" once enabled (implementation pending a column-mapping env JSON). **Hard rule in-file: never add `Resales.RegisterLead`** — the lead pipeline lives entirely inside Smartmove's ecosystem. To arm later: drop the env vars, no code change to capture surfaces.

### 1.8 Leads schema & RLS

- **Table** (`20260507130307_smartmove_additions.sql` L121): `leads` with origin (`source`/`source_detail`), contact, funnel fields (`bedrooms`,`budget_tier`,`purchase_timeline`,`contact_method`,`message`), property/dev/agent context, UTM, `language`, Monday-sync columns, `status`, audit timestamps. RLS: **anon INSERT** (`WITH CHECK true`), **authenticated full**. Indexes incl. `idx_leads_monday_pending` (partial: `monday_item_id IS NULL AND monday_sync_skipped=false`).
- **Anon grants** (`20260507143517` + `20260507143855`): recreate "Anon insert leads" `TO anon, authenticated`; `GRANT INSERT` + `GRANT SELECT(id)` on `leads TO anon` (id read-back for `.single()`); `NOTIFY pgrst` schema reload.
- **Workflow migration** (`20260611020000_leads_workflow.sql`): swaps the status CHECK to `new/called/selection_sent/closed` **+ legacy** `contacted/qualified/converted/lost` (still readable, unused by UI); adds `idx_leads_status_submitted`; creates **`lead_form_events`** (`form`, `event CHECK('view')`, `path`, `detail`, `created_at`) — service-role write only, authenticated SELECT.
- **Quiz migration** (`20260612090000`) extends `leads_source_check` to add `quiz-area`/`quiz-dev`.

---

## PART 2 — QUIZ ENGINE

### 2.1 Model — quizzes are DATA

Definitions live in the `quizzes` table (JSONB). **One renderer** (`QuizRunner.tsx`) consumes any row. **Adding a quiz = inserting a row** (admin: Duplicate → reshape → flip live). Two seed quizzes: **`which-coast` (live)**, **`which-development` (draft)** — the dev quiz stays draft until the developments surface goes public (zero published devs + `NEW_DEVELOPMENTS_PUBLIC` off).

### 2.2 Types & scoring — `src/lib/quiz.ts` (pure)

- **`QuizDefinition`**: `{ slug, title, status('live'|'draft'), intro, questions[], result }`. `QuizQuestion`: `{ id, kind('photo'|'cards'|'slider'), text, sub?, core?, options[] }`. `QuizOption`: `{ id, label, sublabel?, photo?, weights{target→score}, record?, feedback? }`. `core` ∈ `budget|timeline|purpose|party|area_pref` records onto the lead for cross-quiz comparability.
- **`scoreAnswers(questions, answers)`**: sums chosen options' `weights` per target → `Map`.
- **`resolveAreaMatches`** (kind `area`): targets are **area slugs**; ranks top-N against the **published** areas pool (curation by construction — unmatched slugs vanish); **pads** sparse results with editorially-safe defaults (`marbella, estepona, nueva-andalucia, la-cala-de-mijas`) so results never look empty.
- **`resolveDevelopmentMatches`** (kind `development`): developments churn, so quizzes score stable **criteria tokens** `crit:<dim>:<val>`. Each published dev is scored by real fields: `crit:status:<key_ready|under_construction|off_plan>` ×2, `crit:budget:b1..b5` (price_from bands via `BUDGET_RANGES`) ×2, `crit:cluster:west|centre|east` (regex over area+location), `crit:goal:yield` (east/coastal) / `crit:goal:growth` (centre/hillside). Only devs with `score > 0` surface.
- **`resolvePhoto`**: resolves `area:<slug>` token → that area's `hero_image`, or passes a URL through. **`listingsForArea`**: name-matched curated listings (max 3) for an area result card.

**Curation rule (hard):** result cards only surface published areas, published developments, and curated listings — enforced both in `quiz/[slug]/page.tsx` (pools come from curated fetchers) and again in the resolvers.

### 2.3 The renderer — `src/components/quiz/QuizRunner.tsx`

Stages: `intro → questions → contact → results`.

- **Funnel order** (7 questions): photo-led **identity** questions first, **qualifying** (purpose/timeline/budget) last, right before the gate.
- **Question screens:** one per screen, zero typing — photo/cards taps or slider buttons. Each pick records the answer, fires `trackQuiz('answer', …)`, shows a brief **reactive feedback** line, then advances (1100ms if feedback, else 350ms). Back nav supported.
- **Matches computed CLIENT-SIDE** (`useMemo` over `scoreAnswers` + resolver) as answers accumulate — so the teaser is real and results render instantly.
- **Contact-BEFORE-results gate** styled as the FINAL STEP (progress reads "Your matches are ready"): real matches shown **blurred/masked** (first 2 chars + `•••••`) behind the form. Fields: name + email + **phone REQUIRED** (`digits.length < 7`) — call-first; persuasion is framing, never field removal.
- **Instant payoff:** "Show my matches →" sets `stage='results'` and scrolls up **immediately**; the lead **posts in the background** (fire-and-forget `void fetch`) to the hardened `/api/leads` with `source: quiz-area|quiz-dev`, `source_detail: <slug> · <match slugs>`, the full Q→A set + match line in `message`, `budget_tier`/`purchase_timeline` from the `core` questions, `contact_method:'phone'`, the mount-time `_ts` token, and the honeypot. No spinner between submit and payoff.
- **Results:** area cards link to area guides + up to 3 curated listings; dev cards link to the project. Orientation-call CTA is **swappable**: `NEXT_PUBLIC_BOOKING_URL` (Cal.com) → `NEXT_PUBLIC_WHATSAPP_URL` → `/contact` fallback.

### 2.4 Public route — `src/app/[locale]/quiz/[slug]/page.tsx`

`revalidate=3600`; `generateStaticParams` prebuilds live quizzes; `generateMetadata` from the quiz. Loads the quiz via `getCachedQuizBySlug` (anon RLS → **live rows only**); **draft preview** re-fetches with the cookie client only when `?preview=1` **and** an authenticated admin (else `notFound`). Builds the three **curated pools** (`getPublishedAreasCached`, `getCachedPublishedProperties`, `getCachedPublishedDevelopments`) and hands them to `QuizRunner`.

### 2.5 Instrumentation — `src/lib/quiz-track.ts` + `/api/quiz/track`

`trackQuiz(slug, event, extra)` — events `start | answer | contact_view | complete` with `step/questionId/answerId` and a per-page-load `run_id` (drop-off without a user id). Two sinks, one call: first-party beacon → `quiz_events` (sendBeacon/fetch fallback), and `phCapture` mirror to `window.posthog` (same event names `quiz_start`…; silent no-op until PostHog mounted). **`/api/quiz/track/route.ts`:** zod-validated, rate-limited (`:quiz-track`), service-role insert into `quiz_events`, no PII/cookies. `phCapture` is also the shared seam used by `LeadForm`.

### 2.6 Admin panel — `/admin/quizzes`

- **`page.tsx`** (auth-gated, force-dynamic): lists every quiz with status pill + funnel stats — **Starts / Reached gate / Completed / Completion% / Leads** (aggregated from `quiz_events` and quiz-sourced `leads`). Per row: **Edit**, **Preview** (drafts get `?preview=1`), **Duplicate**.
- **`[slug]/QuizEditor.tsx`** — pragmatic structured editor (plain admin forms, not a page builder). Edits everything the engine reads: title/intro/status; questions add/remove/**reorder (↑↓)**; option label/sublabel/recorded-answer/feedback; photo (URL or **area-token picker** from published areas); per-answer **matching weights** (target+score rows); result copy + match count. Save = whole-definition write via `saveQuiz`. `[slug]/page.tsx` loads the quiz + published-area options.
- **`DuplicateQuizButton.tsx`** → `duplicateQuiz`.
- **`src/lib/actions/quizzes.ts`** — `saveQuiz` (auth + validates slug `^[a-z0-9-]{3,60}$`, title, status, ≥1 question each with id/text/≥2 options; updates row; `updateTag(QUIZZES_TAG)` so live edits refresh public caches immediately) and `duplicateQuiz` (clones as **draft** with a collision-safe `-copy[-n]` slug, returns the new slug). The homepage `QuizEntryCards.tsx` renders one card per live row (zero-code add/remove).

### 2.7 Quiz schema & RLS

- **`20260612090000_quizzes.sql`:** `quizzes` (`slug` unique, `title`, `status CHECK('live'|'draft') default 'draft'`, `intro/questions/result` JSONB, timestamps). RLS: **anon SELECT where `status='live'`**, **authenticated FOR ALL**. `quiz_events` (`quiz_slug`, `event CHECK(start|answer|contact_view|complete)`, `step`, `question_id`, `answer_id`, `run_id`, `created_at`) — service-role write, authenticated SELECT, index `(quiz_slug, event, created_at DESC)`. Extends `leads_source_check` with `quiz-area`/`quiz-dev`.
- **`20260612091000_quiz_seeds.sql`:** seeds `which-coast` (live, area-kind, 7 questions: `saturday`/`terrace` photo → `area_pref`/`party`/`purpose` cards → `timeline`/`budget` slider; area-slug weights) and `which-development` (draft, development-kind, 7 questions: `view`/`building` photo → `timeline`/`goal` slider → `area_pref`/`purpose` cards → `budget` slider; `crit:*` weights). `ON CONFLICT (slug) DO NOTHING`. Notably the dev quiz folds *party* into purpose `record` strings and off-plan/payment appetite into the keys-when slider to keep the 7-question cap while covering all four dev-module topics.

### Env summary (both systems)

| Var | Required? | Purpose |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | recommended in prod | arms the lead rate limit |
| `LEADS_RATE_LIMIT_PER_MIN` | optional (5) | window size |
| `LEAD_FORM_SECRET` | optional (falls back to `SYNC_CRON_SECRET`) | submit-token HMAC |
| `MONDAY_API_TOKEN` / `MONDAY_BOARD_ID` | **leave unset** | Monday stays disconnected |
| `NEXT_PUBLIC_SITE_URL` | yes | absolute email-card URLs |
| `NEXT_PUBLIC_BOOKING_URL` → `NEXT_PUBLIC_WHATSAPP_URL` | optional | quiz results CTA (else `/contact`) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | leads/track/quiz-track inserts |

### Key file paths
- Leads API: `src/app/api/leads/{route,token/route,track/route}.ts`
- Lead libs: `src/lib/lead-protection.ts`, `src/lib/lead-status.ts`, `src/lib/email-card.ts`, `src/lib/actions/leads.ts`, `src/lib/integrations/monday.ts`
- Lead UI: `src/components/leads/{LeadForm,DevLeadActions}.tsx`, `src/components/property/LeadCaptureSection.tsx`, `src/components/admin/copy-email-selection.ts`, `src/app/admin/leads/{page,LeadsTable}.tsx`
- Quiz: `src/lib/quiz.ts`, `src/lib/quiz-track.ts`, `src/app/api/quiz/track/route.ts`, `src/components/quiz/QuizRunner.tsx`, `src/components/QuizEntryCards.tsx`, `src/app/[locale]/quiz/[slug]/page.tsx`, `src/app/admin/quizzes/**`, `src/lib/actions/quizzes.ts`
- Docs: `docs/LEADS.md`, `docs/QUIZZES.md`
- Migrations: `supabase/migrations/{20260507130307_smartmove_additions,20260507143517_fix_leads_anon_insert,20260507143855_grant_anon_leads,20260611020000_leads_workflow,20260612090000_quizzes,20260612091000_quiz_seeds}.sql`


---

# §14 — Search + facets + short links + location mapping

# Search Platform, Facets, Short Links & Location Mapping — Engineering Reference

Smartmove Marbella. All paths relative to repo root `/Users/alessiomauri/Desktop/smartmove-web`. Verified against actual source; line numbers cited where load-bearing.

---

## 1. URL-Synced Search (`/properties`)

The **full-inventory** search surface — the only place all 8k+ published rows are browsable. The cached curated-universe (`getCachedPublishedProperties`) deliberately excludes bulk MLS and is too small for this; search queries SQL directly, filtered + paginated.

**File map:**
- `src/lib/search.ts` — server query, param parsing, relax ladder, feature tokens
- `src/app/[locale]/properties/page.tsx` — server page (parse → `searchPropertiesPaged` → `SearchClient`)
- `src/components/search/SearchClient.tsx` — client shell, URL writes, share
- `src/components/search/Pagination.tsx` — numbered, server-rendered links
- `src/components/FilterBar.tsx` — the actual filter UI (adapter in SearchClient)

### URL contract (short names, defaults omitted for tidy shareable URLs)
`?area=&type=&beds=&minp=&maxp=&feat=&q=&status=&sort=&page=`

| Param | Meaning | Notes |
|---|---|---|
| `area` | Area filter | Canonical resolution (§2); ≤60 chars; falls back to `ilike area` if unrecognized |
| `type` | Property type | Validated against `['villa','apartment','townhouse','penthouse','plot_with_project']` |
| `beds` | Min bedrooms | `gte('bedrooms', …)`; positive int |
| `minp`/`maxp` | Price band | `gte`/`lte` on `price` |
| `feat` | Comma-separated feature **slugs**, AND semantics | ≤200 chars, capped at 8 slugs (`search.ts:196`) |
| `q` | Free-text name/location/area/reference | ≤60 chars; area-expanded (see below) |
| `status` | `available\|sold\|reserved\|under_offer\|coming_soon` | Omitted = all |
| `sort` | `new` (default) \| `price_asc` \| `price_desc` | `new` → `order created_at desc` |
| `page` | 1-based | Server pagination |

`parseSearchParams` (`search.ts:97`) canonicalizes junk-in/defaults-out. `searchParamsString` (`:117`) serializes back, **omitting defaults** (`sort=new`, `page=1`) so URLs stay clean. Returns `''` when empty.

### `PAGE_SIZE` & server pagination
`PAGE_SIZE = 24` (`search.ts:17`). `runPropertyQuery` uses `.range(from, from+pageSize-1)` with `from = (page-1)*pageSize` and `count: 'exact'`. `pages = Math.ceil(total/PAGE_SIZE)`. Pagination links are plain server-rendered `<Link>` (window `1 … 4 5 [6] 7 8 … 24`, `Pagination.tsx:42`) so back/forward/refresh restore state for free.

### Transition pending (no spinners)
`SearchClient` uses `useTransition`. On pending, the grid wrapper gets `opacity-55 transition-opacity` (`SearchClient.tsx:214`) — brief mandates no "Loading…". Local mirror state (`useState(filters)`) makes typing feel instant; the URL follows debounced 350ms (`push`, `:43–60`). `router.push`/`router.replace` always use `{ scroll: false }`.

### Zero-state closest-matches relax ladder
`searchPropertiesPaged` (`search.ts:243`) never dead-ends. When `total === 0`, it walks a ladder dropping the **most-specific constraint first**, returning the first 3 hits with `closest.dropped[]`:
1. drop `feature`
2. drop `feature, bedrooms`
3. drop `feature, bedrooms, price`
4. drop `feature, bedrooms, price, type` (keeps only `area` + `sort`)

UI renders a gold "we relaxed: …" banner (`SearchClient.tsx:201`). Developments have a parallel ladder (`search.ts:332`).

### Accent-safe free-text `q` expansion
When `q` is set (`search.ts:208`), it ORs `name/location/area/source_id` ilike. **Additionally**, `q` is run through the canonical area resolver (`resolveAreaFilter(f.q)`); if it resolves to a known area, the exact `location.in.(…)` and `area.in.(…)` clauses are appended — so `"benahavis"` matches `'Benahavís'` rows. `%` and `,` are stripped for PostgREST safety.

### Feature matching (the chip bug, now fixed)
`FEATURE_TOKENS` (`search.ts:47`) maps slug → `{label, tokens[]}`. Tokens cover **both feed dialects**: manual rows carry bare labels (`'Private Pool'`), MLS rows carry `'Category: Value'` (`'Pool: Private'`, `'Views: Sea'`). Each selected slug ORs its tokens over `features_text ilike`; **chained `.or()` calls AND together** in PostgREST → multiple features AND. Unknown slugs fall back to raw substring (keeps the broad `golf` facet working). `featSlugsToLabels`/`featureLabelsToFeatParam` round-trip slug↔label. The earlier bug: FilterBar wrote `filters.features[]` which wasn't mapped — `onFiltersChange` (`SearchClient.tsx:79`) now maps every field.

### Burst-aware history
`SearchClient.tsx:96–100`: typing in `q` is the only continuous input. A typing **burst** gets **one** history entry — first keystroke `router.push`, rest `router.replace` — so the back button undoes the whole burst, not each character. Discrete controls (chips, selects) always **push** (`onSortChange` is `immediate`). Detection: compares `searchParamsString` of next vs local with `q` blanked; `lastWriteWasTyping` ref tracks the burst. Any filter change resets `page: 1`.

### Share (never-silent)
`shareSearch` (`SearchClient.tsx:114`): mints a short link via `POST /api/short-links` (falls back to the long URL on failure), copies to clipboard, toasts success. On **any** clipboard rejection (Safari focus, permissions) it renders a visible manual-copy `<input>` — the share flow never fails silently. Toaster is a global `sonner` instance (see commit `d852328`).

---

## 2. Canonical Area Filtering (`src/lib/area-resolve.ts`)

**An `area` param means "everything mapped under this area"** via the same location-nesting system the map and `/areas` pages use — never a raw `Location` string match (this was the bug being fixed).

Three match dimensions, computed in `buildAreaFilterIndex` (`:59`):
1. **The area itself + ALL descendant areas** — recurses `areas.parent_area` (Marbella pulls Nueva Andalucía, Marbella East, their micros). `descendants(slug)` (`:68`).
2. **Approved `resales_location_mapping` pairs** under those slugs → projected to the **EXACT** `properties.location` strings the sync writes: `"Location, SubLocation"` or bare `"Location"` (`:76`). Only `approved && proposed_area_slug` rows count. Deduped.
3. **Curated/manual rows** whose `area` column carries our area **NAMES** directly (`areaNames`, `:92`).

`AreaFilterEntry` = `{ slug, slugs[], areaNames[], locationStrings[] }`.

**Diacritic-safe lookup:** `normalizeAreaKey` (`:44`) does NFD → strip combining marks → lowercase → `[^a-z0-9]→-`. The index keys on **both** normalized slug and normalized name, so `"Benahavís" ≡ "benahavis" ≡ "benahavis"`. `resolveAreaEntry` (`:104`) is a single map lookup.

**Query assembly** (`search.ts:171`): if resolved, ORs `location.in.(…quoted…)` + `area.in.(…quoted…)`; if the entry maps to nothing yet, forces `id = 0000…` (empty result, not unfiltered). If **unresolved**, falls back to `ilike('area', %param%)` so exploratory text still works. PostgREST value quoting via `pgQuoted` (`search.ts:143` — wraps in `"…"`, strips embedded quotes).

`area-resolve.ts` is a **pure builder** (testable with fixtures); the cached DB wrapper is `getCachedAreaFilterIndex` (§6 below). Note: `cache.ts` returns `{ areas, mappings, entries }` as plain data because `unstable_cache` can't serialize a `Map` — the search layer rebuilds the index from the rows each call.

---

## 3. Facet Pages (`src/lib/facets.ts`, `src/app/[locale]/properties/[facet]/page.tsx`)

Config-driven curated landing pages — **Tier-1**, the only indexed wrappers over the full search.

### `FACETS` — 16 entries
Each `FacetDef` = `{ slug, filters (Partial of area/type/maxp/feat/beds), en, es }` where each locale copy is `{ title, h1, meta, intro, faq? }`. Built via the `f(slug, filters, en, es)` helper.

Slugs (all 16): `villas-in-marbella`, `apartments-in-marbella`, `penthouses-in-marbella`, `apartments-puerto-banus`, `penthouses-puerto-banus`, `villas-nueva-andalucia`, `apartments-nueva-andalucia`, `villas-in-estepona`, `apartments-in-estepona`, `villas-in-benahavis`, `penthouses-nueva-andalucia`, `villas-under-2m-marbella`, `villas-under-3m-marbella`, `villas-under-2m-estepona`, `apartments-under-2m-puerto-banus`, **`golf-properties`**.

> **`golf-properties` (`facets.ts:215`)** — filter `{ feat: 'golf' }` (the broad raw-substring fallback). The **old site's `/golf-properties/` carries 7 years of equity and 301s here on migration day — keep this slug stable.**

### TWO-TIER INDEX POLICY (decided 10 Jun)
- **Tier-1 (indexed):** the 16 facet pages, base `/properties`, and admin-featured listings.
- **Tier-2 (noindex,follow):**
  - **MLS detail pages** — `property/[slug]/page.tsx:111`: `tier1 = !(source==='resales_online' && !is_featured)`; `robots.index = tier1` (syndicated content duplicated across the MLS; facets are the indexed wrapper). Also **excluded from the sitemap** (`sitemap.ts:74`: `.or('source.neq.resales_online,is_featured.eq.true')`).
  - **Param URLs on `/properties`** — `properties/page.tsx:40`: any searchParams → `robots {index:false, follow:true}` **and a canonical** to the nearest facet (or base `/properties`). Canonical computed via `nearestFacet(f)`.

**`nearestFacet`** (`facets.ts:241`): scored match — exact type+area+price first, then type+area, then type-only / golf-via-feature, else `null` (→ base `/properties`). Diacritic-normalized area comparison; wrong-type or wrong-area facets are skipped (`continue`), never canonical. `siblingFacets` (`:279`) gives lateral cross-links (same area OR same type OR same feat, excl self, max 6).

### Facet page rendering (`[facet]/page.tsx`)
- `export const revalidate = 3600` (ISR hourly); `generateStaticParams` from `FACETS`.
- Loads live results via `searchPropertiesPaged({...facet.filters, sort:'new', page:1})`.
- **AI-SEO answer-first:** `copy.intro` (2–3 extractable sentences) rendered under the H1, with **live dated counts** injected around it (`result.total.toLocaleString` + `as of {Month Year}` / Spanish dated string, `:66–70`) plus a "from €{cheapest}" computed from the rendered rows (`cheapest()`, `:205`).
- **Schema graph** (three `ld+json` blocks): `BreadcrumbList` (Home → Properties → facet), `ItemList` (first 12 rows, `numberOfItems = result.total`), and `FAQPage` (only when `copy.faq` present). Visible FAQ `<details>` mirror the schema.
- "See all N properties" CTA links to `/properties` + `searchParamsString(facet.filters)` — interacting moves the user onto the dynamic surface.
- `CopyUrlButton` (`src/components/search/CopyUrlButton.tsx`) shares the pretty facet URL directly (no short link needed — a facet *is* a clean shareable search). Same never-silent contract.

### IndexNow rescope to Tier-1 only
`src/lib/indexnow.ts` builds localized URLs (`entityUrls`) and batch-pings Bing/Yandex (`pingIndexNow`, env-gated by `INDEXNOW_KEY`; Google uses sitemap+ISR, doesn't consume IndexNow). **Rescoped to Tier-1** in `src/lib/integrations/resales-sync.ts` (`:647`): property pages are pinged **only when `is_featured`** (`:657`, `:686`, `:765`); dev pages ping once their surface is public. A no-change night sends zero pings.

---

## 4. Similar Properties (`src/lib/similar.ts`)

`getSimilarProperties(subject, max=6)`. One indexed query: same `property_type`, `published`, exclude self, `±30%` price band (`gte 0.7×`, `lte 1.3×`; skipped when `price_on_request`), `order created_at desc limit 150`. Candidates ranked **in process** (no PostGIS):
- **Subject has GPS** → geo-distance ranking via `haversineKm` (`:14`): nearest first; coordless candidates after, **same-area coordless ahead of the rest**; recency preserved within groups (`:46–56`).
- **No GPS** → same-area first, then everything else (`:59`).

Cached with the detail page's ISR.

---

## 5. Short Links

**Table `short_links`** — one table, one code style for everything shared. Columns used: `code`, `target` (same-origin path), `kind` (`'search'|'collection'`), `context` (jsonb, nullable). RPC `bump_short_link(p_code)` resolves a code → target and increments a hit counter, returning the target path.

### Redirect handlers (both 302, both noindex)
- **`src/app/s/[code]/route.ts`** — searches/general. `dynamic = 'force-dynamic'`. Validates `^[a-z0-9-]{3,40}$`, calls `bump_short_link`, 302s to the stored same-origin path; **unknown codes land on `/properties`** (not a 404 wall). Sets `X-Robots-Tag: noindex`.
- **`src/app/c/[code]/route.ts`** — collections (e.g. `/c/sierra-blanca-collection`). Identical mechanism; unknown code → `/`. Long-form `/collection/[slug]` stays canonical; these are share handles. Noindex.

Both use a **service-role** Supabase client.

### Minting API (`src/app/api/short-links/route.ts`, POST)
- **Rate-limited** (`isRateLimited(req, ':short-links')`, 429 on trip) — public minting is allowed (the Share button is public) but tightly bounded.
- **Zod `MintSchema`:** `target` must match `^\/[^\s]*$` (same-origin path, ≤600); `kind ∈ {search,collection}` default `search`; optional `context`; optional admin `code` (`^[a-z0-9-]{3,40}$`).
- **Protocol-smuggling paranoia** on top of regex: rejects `//` and `://` (`:61`).
- **Random codes:** `randomCode(7)` from base32-ish alphabet `abcdefghjkmnpqrstuvwxyz23456789` (no `0/O/1/l/i`), via `crypto.getRandomValues`.
- **Custom slugs are admin-only** — require an authenticated user (`createServerSupabaseClient().auth.getUser()`, else 403).
- **Dedup:** for non-custom, same `target`+`kind` returns the existing code (`reused: true`) so repeat shares stay stable.
- **Insert with retry:** up to 5 attempts; on unique violation (`23505`) custom → 409 "slug taken", random → retry.

### Proxy bypass (`src/proxy.ts:17–22`)
`/s/` and `/c/` are locale-agnostic route handlers; the proxy short-circuits them with `NextResponse.next()` **before** the next-intl middleware so they aren't rewritten into the `/[locale]/…` tree. (Same pattern as `/admin`.) This is the Next 16 `proxy.ts` convention replacing the old `middleware.ts`.

---

## 6. Location Auto-Mapping (`scripts/map-resales-locations.mjs`)

Proposes a parent area for every distinct Resales `(Location, SubLocation)` pair. Run: `npx tsx scripts/map-resales-locations.mjs [--dry-run]`. Needs `.env.local` (service role + Resales proxy). **Nothing user-facing changes** — feeds the `area-resolve` index.

### Two passes
1. **NAME MATCH (free):** `norm()` = NFD/accent-strip/lowercase/space-collapse, compared against curated area **names AND slugs** (`areaLookup`). **SubLocation match beats Location match** (more specific). One safe fallback: leading English `"The "` stripped (`"The Golden Mile" ≡ "Golden Mile"`); Spanish articles are **not** stripped (`"La Quinta"` protected). A pair whose sub doesn't match falls to geo, keeping its bare-Location name match as a **coarse** fallback (`coarseSlug`).
2. **GEO EVIDENCE — Nominatim, not GPS.** The spec's first choice (median GpsX/GpsY of the pair's listings) is **empirically unavailable**: synced rows carry no coords and a 1,039-call PropertyDetails sweep returned GPS for OWN listings only. So it **geocodes the location NAME** via OSM Nominatim (`≤1 req/s`, identifying UA, viewbox-bounded to the Costa del Sol `west -5.75 … north 36.95`; hits outside the box = wrong-town misses, discarded), then assigns the nearest area **centroid** (`areas.coordinates_lat/lng`) by haversine.
   - **Query escalation:** `"{target}, {context}Málaga, Spain"` → `"{target}, Costa del Sol, Spain"` → `"{target}, Spain"`. Province dropped last because the west end (Sotogrande, La Alcaidesa) is **Cádiz**, not Málaga.
   - **Confidence tiers:** `<2km high · 2–5km medium · >5km low`. Geocode miss → coarse Location-name fallback (`medium`) or `unmapped`. Inland villages land low/unmapped **by design** — they genuinely sit outside the coastal areas and must not nest falsely.
   - **Resilience:** 1.1s sleep between calls, geocode cache, abort after 5 consecutive HTTP failures (re-run safe — upserts idempotent).

### Pair reconstruction (`:150`)
The sync stored `area = Location` and `location = "Location, SubLocation"` (or bare). Script reverses this; collapses `"X, X"` self-duplicates into the bare pair.

### Upsert into `resales_location_mapping` (`:289`)
Conflict key `(location, sublocation)`. Columns: `proposed_area_slug`, `confidence`, `match_method`, `listing_count`, `gps_listing_count`, `median_distance_km`, `approved`, `updated_at`.
- **Admin edits win:** a row with `approved === true` is **never** clobbered (`keepAdmin`, `:291`) — re-runs refresh evidence only.
- High-confidence proposals default `approved = true`.
- **Stale cleanup:** pairs no longer in the data are deleted **unless approved** (`:317`). Batched in 500s.

### Audit output
- **CSV** sorted confidence-ascending (`unmapped → low → medium → high`) so review starts where a human is needed: `~/Desktop/smartmove-web-briefs/resales-location-mapping-report.csv`.
- **Console SUMMARY:** per-tier location + listing tallies, review-queue size (`medium+low+unmapped`), and three spot-checks (Lomas de Marbella Club, Milla de Oro/Golden Mile, Nagüeles).

### Consumption — `getCachedAreaFilterIndex` (`src/lib/cache.ts:249`)
Loads `areas (slug,name,parent_area)` + `resales_location_mapping` filtered to `approved=true AND proposed_area_slug NOT NULL`. Returns `{ areas, mappings, entries }` as plain data (Map isn't serializable). `AREAS_TAG`-invalidated, `revalidate: 600` — approved-mapping edits land within 10 min. This is what `resolveAreaFilter` in `search.ts` rebuilds from.

> Related context — `getCachedPublishedProperties` (`cache.ts:43`) is the **curated-universe** cache (`source.neq.resales_online OR is_featured.eq.true`), deliberately excluding bulk MLS to stay under `unstable_cache`'s 2MB limit. Its docblock explicitly states the full-search surface must query SQL directly — which is exactly what `searchProperties*` in `search.ts` does.


---

# §15 — Routes, tech stack, infra & docs

# Smartmove Marbella — System Handover

> Repo root: `/Users/alessiomauri/Desktop/smartmove-web` · Branch `main` · Prod: `smartmove-new.vercel.app`
> Note: code/`vercel.json`/`next.config.ts` say `smartmove-*`; the older `docs/*.md` still carry the legacy "Marbella Live" name and a **stale Supabase ref** (`tvuhxqcpunavphakuzhm` in DATABASE_SCHEMA.md) — the live project is `vhsttqejskvofqxgddho` per `next.config.ts` and env.

## 1) Route map

### App shell / layouts
- `src/app/layout.tsx` — root passthrough (no `<html>`). Splits the tree so next-intl owns public and admin stays locale-agnostic.
- `src/app/[locale]/layout.tsx` — public, locale-aware `<html>/<body>` shell.
- `src/app/admin/layout.tsx` — admin shell (`robots: noindex`, sonner `<Toaster>`, SpeedInsights).
- `src/app/[locale]/favourites/layout.tsx` — favourites sub-layout.

### Public pages — `src/app/[locale]/**/page.tsx`
All public; rendered via the i18n tree. Localized path words come from `src/i18n/routing.ts` (`localePrefix: 'as-needed'`, locales `en`/`es`, default `en`; **shared slugs** across locales).

| File | EN path | ES path |
|---|---|---|
| `page.tsx` | `/` | `/` |
| `property/[slug]/page.tsx` | `/property/[slug]` | `/propiedad/[slug]` |
| `properties/page.tsx` | `/properties` | `/propiedades` |
| `properties/[facet]/page.tsx` | `/properties/[facet]` | `/propiedades/[facet]` |
| `areas/page.tsx` | `/areas` | `/zonas` |
| `areas/[slug]/page.tsx` | `/areas/[slug]` | `/zonas/[slug]` |
| `new-developments/page.tsx` | `/new-developments` | `/desarrollos-nuevos` |
| `new-developments/[slug]/page.tsx` | `/new-developments/[slug]` | `/desarrollos-nuevos/[slug]` |
| `blog/page.tsx` | `/blog` | `/blog` (shared) |
| `blog/[slug]/page.tsx` | `/blog/[slug]` | `/blog/[slug]` (shared) |
| `collection/[slug]/page.tsx` | `/collection/[slug]` | `/coleccion/[slug]` |
| `contact/page.tsx` | `/contact` | `/contacto` |
| `quiz/[slug]/page.tsx` | `/quiz/[slug]` | `/quiz/[slug]` (shared) |
| `favourites/page.tsx` | `/favourites` | `/favoritos` |
| `favourites/[shareId]/page.tsx` | `/favourites/[shareId]` | `/favoritos/[shareId]` |

> Italian (`/it`) is **not** wired yet — lands with the Phase-4 machine-translation pipeline.

### Admin pages — `src/app/admin/**/page.tsx`
Locale-agnostic; **all gated by Supabase session** via `proxy.ts` (`/admin/login` is the only unauthenticated admin page).

`admin/page.tsx` (dashboard) · `admin/login/page.tsx` · `admin/areas/page.tsx` · `admin/areas/[slug]/edit/page.tsx` · `admin/blog/page.tsx` · `admin/blog/new/page.tsx` · `admin/blog/[slug]/edit/page.tsx` · `admin/collections/page.tsx` · `admin/collections/new/page.tsx` · `admin/collections/[id]/edit/page.tsx` · `admin/developments/page.tsx` · `admin/developments/new/page.tsx` · `admin/developments/[id]/edit/page.tsx` · `admin/properties/new/page.tsx` · `admin/properties/[id]/edit/page.tsx` · `admin/leads/page.tsx` · `admin/quizzes/page.tsx` · `admin/quizzes/[slug]/page.tsx` · `admin/resales/page.tsx` · `admin/seed/page.tsx`

### API endpoints — `route.ts`, with auth model

| Endpoint | Methods | Auth model |
|---|---|---|
| `api/admin/resales/sync` | GET / POST | **Triple**: Vercel Cron `GET` w/ `Authorization: Bearer ${CRON_SECRET}`; admin Supabase session on POST; `x-smartmove-cron-secret: ${SYNC_CRON_SECRET}` (self-chaining continuations). Uses **service role** when secret-authed. `maxDuration 300` |
| `api/admin/resales/reconcile` | GET / POST | Same triple as sync (cron GET Sunday; admin/secret POST; self-chains). Service role when cron/secret. `maxDuration 300` |
| `api/admin/resales/publish-gate` | POST | Admin session **or** `x-smartmove-cron-secret` (service role). `maxDuration 300`. `{dryRun}` supported |
| `api/admin/resales/sync-reference` | POST | **Admin session only** (one PropertyDetails → one upsert) |
| `api/admin/resales/seed-samples` | POST | Admin session **or** secret header (service role). Dev-only — reads local sample JSONs, intentionally fails on Vercel |
| `api/admin/import-images` | POST | Admin Supabase session. `runtime nodejs`, `maxDuration 120`. URL-guarded (`validateExternalUrl`) |
| `api/admin/scrape` | POST | Admin Supabase session. `runtime nodejs`, `maxDuration 30`. cheerio + URL guard |
| `api/leads` | POST | **Public** — rate-limited + honeypot + signed `verifySubmitToken` (rejects <2s). Writes via **service role** (RLS bypass for INSERT+read-back & Monday columns) |
| `api/leads/token` | GET | Public — mints the signed submit token (`no-store`, `force-dynamic`) |
| `api/leads/track` | POST | Public — form-view beacons → `lead_form_events` (rate-limited, service role, no PII) |
| `api/quiz/track` | POST | Public — quiz funnel beacons → `quiz_events` (rate-limited, service role, no PII) |
| `api/short-links` | POST | **Public mint** (rate-limited, same-origin paths, random codes) — but **custom `code` requires admin session**. Service role |
| `s/[code]` | GET | Public 302 redirect to stored path; `X-Robots-Tag: noindex`; `bump_short_link` RPC; unknown → `/properties` |
| `c/[code]` | GET | Public 302 to shared collection; `noindex`; unknown → `/` |

### `src/proxy.ts` (Next 16 `proxy` convention, replaces `middleware.ts`)
Three branches, in order:
1. **`/admin` → `adminAuth()`** — `@supabase/ssr` server client checks `auth.getUser()`. No user + not `/admin/login` ⇒ redirect to `/admin/login`; logged-in on `/admin/login` ⇒ redirect to `/admin`.
2. **`/s/` and `/c/` → `NextResponse.next()`** — locale bypass so the intl middleware never rewrites short-links into the locale tree.
3. **Everything else → `intlMiddleware`** (next-intl: locale detection, localized pathname rewrites, hreflang).
`matcher: ['/((?!_next|_vercel|api|.*\\..*).*)']` — skips Next internals, Vercel beacons, `api`, and static files.

## 2) Tech stack

- **Framework / runtime:** Next.js **16.1.2** (App Router), React **19.2.3**, React-DOM 19.2.3, TypeScript ^5. Node `@types/node` ^20.
- **i18n:** `next-intl` ^4.11.0 (plugin wraps config in `next.config.ts`, request config `src/i18n/request.ts`).
- **Data / auth:** `@supabase/ssr` ^0.8.0 + `@supabase/supabase-js` ^2.90.1.
- **Rate-limit:** `@upstash/ratelimit` ^2.0.8 + `@upstash/redis` ^1.38.0.
- **UI:** Tailwind v4 (`@tailwindcss/postcss`), shadcn ^4.2.0, `lucide-react`, `clsx`, `tailwind-merge`, `tw-animate-css`, `sonner` (toasts), `@dnd-kit/*` (drag-drop).
- **Maps:** `maplibre-gl` ^5.24.0 + `@protomaps/basemaps` ^5.7.2 (self-hosted Protomaps; Leaflet replaced — see git history).
- **Images / PDF:** `sharp` ^0.34.5, `@react-pdf/renderer` ^4.3.2.
- **Analytics:** `posthog-js` ^1.386.6, `@vercel/speed-insights`, `@next/third-parties`.
- **Scraping / validation:** `cheerio` ^1.2.0, `zod` ^4.3.6.
- **Dev/test:** `playwright` ^1.60.0, `tsx`, `dotenv`, `eslint` ^9 / `eslint-config-next`.

**npm scripts** (`package.json`): `dev`, **`build` = `node scripts/generate-indexnow-key.mjs && next build`** (writes `public/{INDEXNOW_KEY}.txt` from env before building; no key ⇒ skip + runtime no-op), `start`, `lint`, `test:resales-parser` (`tsx scripts/test-resales-parser.mjs`), `test:resales-sync` (`tsx scripts/test-resales-sync.mjs`), `probe:resales`, `test:proxy-scrub`.

**tsconfig:** target ES2017, `strict`, `moduleResolution: bundler`, `noEmit`, path alias `@/* → ./src/*`. Excludes `node_modules`, `_legacy`, `workers`.

**next.config.ts highlights:** image `remotePatterns` pinned to exact hosts (`vhsttqejskvofqxgddho.supabase.co`, `smartmove-image-proxy.alessio-mauri030702.workers.dev`, `media-webapi.resales-online.com`, `cdn.resales-online.com`; dev-only picsum/unsplash). AVIF/WebP, `minimumCacheTTL` 31 days, `dangerouslyAllowSVG` with sandbox CSP. `poweredByHeader: false`, `reactStrictMode`. Security headers (nosniff, frame SAMEORIGIN, referrer policy) + cap on `public/` static asset caching. `optimizePackageImports` for lucide + dnd-kit.

## 3) External infrastructure

- **Vercel** — prod `smartmove-new.vercel.app`. Crons (`vercel.json`):
  | Schedule | Endpoint |
  |---|---|
  | `0 3 * * *` (03:00 daily) | `/api/admin/resales/sync` — incremental delta (or full-import continuation) |
  | `30 4 * * 0` (04:30 Sunday) | `/api/admin/resales/reconcile` — weekly reference-set reconciliation |

  Cron requests authenticate with `Authorization: Bearer ${CRON_SECRET}`.
- **Supabase** — project ref **`vhsttqejskvofqxgddho`** (`https://vhsttqejskvofqxgddho.supabase.co`). Storage bucket `property-images`. (DATABASE_SCHEMA.md's `tvuhxqcpunavphakuzhm` is stale.)
- **Cloudflare Workers** (`workers/`, all `workers_dev = true`):
  - **`smartmove-image-proxy`** — host `smartmove-image-proxy.alessio-mauri030702.workers.dev`. R2 bucket `smartmove-property-images`, lazy fetch + Cache API edge cache, `DELETE /{p|d}/{ref}` purge gated by `PURGE_SECRET` (= `IMAGE_PROXY_PURGE_SECRET` on Vercel). Allowed origins: `media-webapi.resales-online.com,cdn.resales-online.com,picsum.photos`.
  - **`smartmove-resales-proxy`** — `smartmove-resales-proxy.<account>.workers.dev`. **IDLE FALLBACK** (since 2026-06-10): Resales whitelists one static IP per key and Workers egress isn't it, so prod traffic goes through the VPS relay instead. Worker stays deployed in case Resales adds IP-range support. Base `https://webapi.resales-online.com/V6`, `RESALES_SANDBOX=true`, scoped `ALLOWED_ENDPOINTS` (no `RegisterLead`).
  - **`smartmove-map-tiles`** — R2 bucket `smartmove-map-tiles`, serves `costa-del-sol.pmtiles` via range reads (Protomaps basemap).
- **Hetzner VPS relay** — `167.233.98.46` / `https://167-233-98-46.sslip.io` (`ssh root@`). Fixed-IP relay holding production Resales `p1`/`p2` creds; the app's `RESALES_PROXY_URL` points here. This is the live path for all Resales API traffic. Per MEMORY: live sandbox sync verified end-to-end; only sandbox→prod flip remains (Alessio's call).
- **PostHog (EU)** — `src/components/PostHogInit.tsx`. `api_host` default `https://eu.i.posthog.com` (override `NEXT_PUBLIC_POSTHOG_HOST`), token `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` (absent ⇒ no-op), `autocapture: false` (explicit events only).

## 4) Documentation (`docs/*.md`)

| Doc | Summary |
|---|---|
| `INDEX.md` | Map of all docs; entry point, points to FULL_SITE_REPORT |
| `FULL_SITE_REPORT.md` | Single end-to-end report: what the site is, how built, what's live, what's next |
| `ARCHITECTURE.md` | Render strategy (ISR + tag cache), server/client split, routing — read before touching routing/data/perf |
| `TECH_STACK.md` | Full dependency inventory: why each is installed and where used |
| `DATABASE_SCHEMA.md` | Every Supabase table, columns, RLS, storage buckets (⚠️ carries stale project ref) |
| `DESIGN_SYSTEM.md` | Brand: colours, typography, spacing, shapes, animations, tone |
| `PROPERTIES.md` | Property model, listings, detail page, filters, status (public side) |
| `AREAS.md` | Area system: hierarchy, micro-locations, `/areas` index + `[slug]` |
| `MAP_SYSTEM.md` | Map (now MapLibre + Protomaps): pin categories, palette, popups, fit-bounds |
| `BLOG.md` | Blog categories, post detail, related properties |
| `COLLECTIONS.md` | Curated property lists (community + personal) — current spec |
| `COLLECTIONS_GUIDE.md` | Older collections spec (superseded by COLLECTIONS.md) |
| `FAVOURITES.md` | Client-side anonymous shareable favourites (localStorage, no login) |
| `DEVELOPMENTS.md` | Off-plan / new-build developments (range data; routes behind feature flag) |
| `ADMIN_PANEL.md` | Full admin flow: properties, areas, blog, collections, dashboard |
| `AUTH.md` | Supabase Auth + middleware admin protection + login (no public accounts) |
| `LEADS.md` | Lead pipeline (SMARTMOVE_BRIEF §4.5); Monday integration stays disconnected by default |
| `QUIZZES.md` | Prompt 6: DB-defined quizzes, gated results, funnel tracking |
| `SYNC.md` | Resales delta-sync runbook (watermark, hashing, history, chunked full import, relay) — last updated 2026-06-10 |
| `SCRAPER_SYSTEM_GUIDE.md` | URL→property scraping (Inertia.js + generic HTML) |
| `PDF_BROCHURE_GUIDE.md` | Auto-generated PDF brochures (react-pdf + sharp) |
| `IMAGE_SYSTEM.md` | Image flow: upload → storage → optimisation → render, blur placeholders |
| `SEO.md` | Metadata API, JSON-LD, sitemap, robots, Spanish keywords, hreflang |
| `PERFORMANCE.md` | ISR + tag revalidation, bundle splitting, image perf, dev vs prod |
| `ANALYTICS.md` | Trackers (PostHog/GA4/Meta Pixel); only one runs unconditionally |
| `GOING_PUBLIC_CHECKLIST.md` | **Read before launch** — flip listings from info-mode to live |
| `PHASE_2_HANDOFF.md` | What's done autonomously, what needs Alessio's hand, what's next |
| `WEBSITE_FEATURES_GUIDE.md` | High-level feature inventory (older, partly superseded) |
| `PROJECT_SPEC_FOR_FORK.md` | Original project spec for forking (historical) |
| `CLAUDE_SESSION_GUIDE.md` | Notes for AI-assisted dev sessions (legacy "Marbella Live" naming) |
| `design/` | Sub-folder: `DECISIONS.md`, `README.md`, `tokens.css`, `components/` |

### Verification standard (verbatim from `CLAUDE.md`)

> ## Verification standard
>
> Backend verification alone never closes a user-facing feature. Before
> claiming anything works: verify in a real browser (Preview/Playwright)
> — navigate as a user, find the control, click it, assert the visible
> outcome, screenshot it. Debriefs must include UI-level evidence for
> anything with UI. Data features: spot-check rendered values against
> the DB, not just that the query runs.

## 5) Recent git history (`git log --oneline -25`)

```
6d2b947 Filter sheet: add Type, Beds and free-text Search (+ accent-safe q, burst-aware history)
ed5915d Search filters: wire feature chips (the bug), status select, free-text q; push-history for back-nav — full browser matrix verified
d852328 Share: global Toaster (root cause), never-silent handlers, facet share, browser-verified
3b270a5 Search area filter: resolve through the canonical location-nesting system
a6ff903 Search platform: URL-synced /properties, facets, similar, two-tier IndexNow, short links (Prompt 3 + extensions)
6a93a5d PostHog: init against the existing EU project token, mirror all funnels
bd07ecf Quiz engine: DB-defined quizzes, gated results, admin panel (Prompt 6)
da4ee53 Curated-universe cache: fix 2MB unstable_cache overflow after publish gate
2e60d9c Lead pipeline: capture forms, /api/leads hardening, interim CRM, email cards
89c37ef Benalmádena: 45th area (unpublished placeholder) + region enum/cluster
75a478f Location auto-mapping: nest Resales locations under curated areas
b2c6722 Redeploy: flush ISR cache after publish-gate bulk pass
1fdb082 Publish gate: review-by-exception for MLS rows (rule engine + bulk pass)
0d88d19 Reconcile route: same immediate-ack fix (was clamped to 60 + nested chain)
c68433f Fix full-import self-chaining on Vercel: immediate-ack + deadline drain
1143b83 :wq Merge branch 'map-upgrade'
8ef090d docs/MAP_SYSTEM.md: rewrite for MapLibre + Protomaps + new rail
0289e8f Rail: lighter composition + new region state
b7870e4 Curation guard: Resales rows never reach curated surfaces unfeatured
a57b585 Rail hero photo: 21/9 → 3/2 with upward bias
b49e338 Map engine swap: Leaflet → MapLibre GL JS over self-hosted Protomaps
969907b Live sandbox smoke green: fractional baths fixed, watermark seeded live
35f0857 Seeders are admin-safe: content-only updates, never clobber curated fields
71ce82c Fix area-photo wipe: image-safe seed + compile-time select-list guards
5fe8107 Repoint Resales traffic to the VPS relay; CF worker documented as idle
```

### Key file paths
- Routing: `/Users/alessiomauri/Desktop/smartmove-web/src/i18n/routing.ts`, `src/i18n/request.ts`
- Proxy/auth gate: `/Users/alessiomauri/Desktop/smartmove-web/src/proxy.ts`
- Config: `/Users/alessiomauri/Desktop/smartmove-web/next.config.ts`, `tsconfig.json`, `vercel.json`, `package.json`
- Resales integration: `/Users/alessiomauri/Desktop/smartmove-web/src/lib/integrations/resales*.ts`, `sync-state.ts`
- Workers: `/Users/alessiomauri/Desktop/smartmove-web/workers/{image-proxy,resales-proxy,protomaps-tiles}/`
- Build hook: `/Users/alessiomauri/Desktop/smartmove-web/scripts/generate-indexnow-key.mjs`

**Two discrepancies worth flagging to the next engineer:** (a) `docs/DATABASE_SCHEMA.md` documents Supabase ref `tvuhxqcpunavphakuzhm` while the live project (per `next.config.ts` + env) is `vhsttqejskvofqxgddho`; (b) most `docs/*.md` still use the legacy "Marbella Live" product name rather than "Smartmove Marbella."

