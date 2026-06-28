# Prompt 5 — Portability Map (Opus → original, if cherry-picking)

Purpose: if Fable returns and you want to lift individual Opus features into the original
(`smartmove-new` / `main`) rather than adopt the whole Opus entity, this maps each feature to its
migration(s), key files, dependencies, and how hard it is to port in isolation.

All work is in 5 commits on `opus-4.8` (`smartmove-opus` repo):
`d39392c` migrations · `d978124` lib/actions · `c1e31da` admin UI + agent workspace ·
`67a7bf3` cleanup · `9e25b80` docs.

## Migrations (9, additive, file-based — `supabase/migrations/`)

| File | Adds | Sensitivity |
|---|---|---|
| `…120000_events.sql` | `events` log table | safe (new table) |
| `…130000_curated_lists.sql` | `curated_lists` + `curated_list_items` (+2 seeds) | safe |
| `…140000_roles_and_lead_rls.sql` | `user_roles` + SECURITY DEFINER resolvers; **swaps leads RLS** | ⚠️ changes existing `leads` policies + bootstraps existing users to admin |
| `…150000_notification_email.sql` | `site_settings.notification_email` | safe |
| `…160000_dev_overrides.sql` | `developments.overrides` jsonb | safe |
| `…170000_selection_rails.sql` | `email_selections.lead_id/status/sent_at` | safe (extends existing) |
| `…180000_agent_title.sql` | `agents.title` | safe |
| `…100000_lead_geo.sql` | `leads.geo_country/_country_code/_city` | safe |
| `…110000_agent_selection_rls.sql` | role-scopes `email_selections`/junction | ⚠️ changes existing policies |

## Features → files → port difficulty

**Inventory at scale (Phase A)** — server-paginated/searched/sorted/filtered admin list, aggregate
counts, bulk actions.
- Files: `src/app/admin/inventory/*`, `src/lib/actions/inventory.ts`, the shared
  `src/components/admin/PropertyAdminTable.tsx`. Migration: `events`.
- Includes the **featured-toggle cache fix** (`setPropertyFeatured` busts `PROPERTIES_TAG`) — the
  bug behind the original's stuck homepage curation.
- Port difficulty: **easy**, high value. Depends on `events`/`logEvent` (port that first).

**Curation tools (Phase B)** — featured-by-ref (preview→confirm), Top-20 drag-rank lists,
`/admin/listings` split, real `featured_order`.
- Files: `src/lib/actions/curation.ts`, `src/app/admin/curation/*`,
  `src/components/admin/DragRankList.tsx`, `src/lib/actions/listings.ts`, `src/app/admin/listings/*`.
  Migration: `curated_lists`.
- Port difficulty: **easy/standalone**. This + the Phase A toggle fix is the minimal "fix the
  homepage curation on the original" port.

**Roles + agent isolation (Phase C)** — `user_roles`, RLS-scoped leads, proxy role gate, Team
account creation, lead assignment, per-role dashboards.
- Files: `src/lib/roles.ts`, `src/lib/supabase-service.ts`, `src/proxy.ts` (role gate),
  `src/app/admin/team/*`, `src/app/agent/*`, `src/app/admin/page.tsx` (command center),
  `assignLead` action. Migration: `roles_and_lead_rls` ⚠️.
- Port difficulty: **hard / all-or-nothing**. Adopting it changes the original's auth from binary
  to role-scoped and rewrites `leads` RLS (drops "Authenticated full leads", bootstraps existing
  users to admin). Port the whole of C together; don't cherry-pick partially.

**Notifications (Phase D)** — channel-adapter module, env-gated on `RESEND_API_KEY`, new-lead +
assignment emails, logged to `events`.
- Files: `src/lib/integrations/notifications.ts`, wiring in `/api/leads` + `assignLead`,
  `NotificationEmailControl`/`setNotificationEmail`. Migration: `notification_email`.
- Port difficulty: **easy/standalone** (no-ops without the key). Logs to `events` (optional dep).

**Dev-content overrides (Phase E)** — `developments.overrides` jsonb, sync never touches it,
override-else-feed.
- Files: `src/lib/dev-overrides.ts`, `src/lib/actions/dev-overrides.ts`, dev edit
  `DevOverridesEditor`, public dev page applies `resolveDevOverrides`; `resales-hash.ts` adds
  `overrides` to protected + hash-excluded sets. Migration: `dev_overrides`.
- Port difficulty: **easy/standalone**.

**Selection rails (Phase F)** — first-class selections on `email_selections` (draft→sent),
selection editor on the lead row.
- Files: `src/lib/actions/selections.ts`, `SelectionEditor`; reuses existing Prompt-2
  `buildEmailSelection` + `src/lib/email-card.ts` + `copy-email-selection.ts`. Migration:
  `selection_rails`.
- Port difficulty: **medium**. Standalone unless agents use it — agent access needs the Phase H
  selection RLS (which needs Phase C roles).

**Team profiles + copy-for-email on lists (Phase G)** — rich agent profiles; per-row + bulk
copy-for-email on inventory/listings; branding + dead-code cleanup; public dev developer-credit
removed; `/admin/developments` paginated.
- Files: Team profile editor + `updateAgentProfile`, copy-for-email integration on
  `PropertyAdminTable`. Migration: `agent_title`.
- Port difficulty: **easy** (profiles/copy standalone; the dev-credit removal is a 1-liner worth
  porting regardless — it's a brand-leak fix).

**Agent workspace + lead context + geo (Phase H)** — rich per-lead view (timing, source page,
funnel/quiz answers, phone+flag, location), geo capture from Vercel headers, source-property
auto-seeded into selections.
- Files: agent workspace (reuses `LeadsTable` on `/agent`), geo capture in `/api/leads` (`after()`),
  phone-flag helper, `selections.ts` `resolveLeadProperty`+auto-seed, nav back-links on all
  sub-pages. Migrations: `lead_geo`, `agent_selection_rls` ⚠️.
- Port difficulty: **medium**; the agent-facing parts depend on Phase C roles + the selection RLS.

## Port order / entanglements

1. `events` + `logEvent` first (many actions attribute to it).
2. `user_roles` + resolvers (Phase C) before any RLS-dependent feature (agent isolation, agent
   selections, agent workspace).
3. The two ⚠️ RLS migrations modify existing `leads`/`email_selections` policies — on the original
   they change the access model; review the inline ⚠️ blocks and keep a down-path (re-add the old
   "Authenticated full" policy) before applying.
4. Cleanly standalone, lift any time: **curation + featured-toggle fix**, **dev overrides**,
   **notifications**, **geo capture**, the **dev developer-credit removal**.

## Cleanest "just fix the original's homepage" port (no role/RLS changes)
Phase A featured-toggle cache fix + Phase B curation tools (featured-by-ref + Top-20). Standalone,
no auth changes — gives the original real curation without touching its RLS.

⚠️ The homepage "Villa Amara" issue has TWO causes — fixing the original needs both:
1. **Data:** the manual seed row is `published=true`, and the homepage curated filter
   (`source != 'resales_online' OR is_featured`) surfaces any published manual row. Unpublish it.
2. **Code:** `HomeHero.tsx` had a hardcoded `featured ?? { name: 'Villa Amara, Sierra Blanca', … }`
   fallback, so the hero rendered the placeholder even with curation empty. Removed in Opus
   (commit `8ac6b28`: hide the hero card when nothing is curated). The **original still has this
   hardcoded fallback** — port that change too, or its hero shows Villa Amara regardless of the DB.

Cache note: curate via the admin UI (fires `updateTag`, reflects immediately). A direct-DB edit
bypasses cache invalidation and needs a manual flush/redeploy.
