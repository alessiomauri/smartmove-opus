 # Opus Continuity Notes — Smartmove Marbella

**Purpose:** orientation for any Opus 4.8 session working in this folder. Written 2026-06-26 after a full read of both project handovers, the architecture brief, and the master prompts file. Read this first, then the two HANDOVER files (see §2). Keep this file current.

---

## 1. Why this folder exists (the fable → Opus parallel track)

This folder, **`smartmove-web-opus`**, is a **working copy** made on 2026-06-26 so the project can continue on **Opus 4.8** while the Fable model is blocked.

- The **original** repo (`~/Desktop/smartmove-web`) is left **frozen** as Fable's baseline. If Fable returns, Alessio continues there. Do **not** assume the original tracks changes made here, and never edit the original from this track.
- This copy is checked out on a dedicated git branch: **`opus-4.8`** (original stays on `main`, in sync with GitHub `alessiomauri/smartmove-new`). Anything committed/pushed here stays on `opus-4.8`, so Fable's `main` line is never disturbed. The two tracks can be compared or merged later via git since they share history.
- The copy excludes `node_modules` and `.next` (regenerable). **Before running it: `npm install`** in this folder. Env files and local secrets (`.env.local`, `*.local`) were copied so it can actually run. (Note: `workers/*/node_modules` contains a partial leftover copy — Git-ignored and harmless; if you build the Cloudflare workers, reinstall their deps.)
- The briefs/prompts live in a sibling copy: **`~/Desktop/smartmove-web-briefs-opus`** (original: `~/Desktop/smartmove-web-briefs`).

**Bottom line:** work here, on `opus-4.8`. Leave `~/Desktop/smartmove-web` and `~/Desktop/smartmove-web-briefs` untouched.

---

## 2. The canonical documents & read order

Read in this order before doing real work:

1. **`HANDOVER.md`** (this repo root, ~20.6k words) — the **engineering audit** by the Claude Code instance: schema, enums, 18 migrations, exact env var names, feature flags, load-bearing workarounds, per-subsystem reference. Authoritative on committed code.
2. **`../smartmove-web-briefs-opus/HANDOVER.md`** (~52KB) — the **strategy / cowork handover**: decisions, design history, the "why," and running-prod state from Alessio's Vercel screenshots.
3. **`../smartmove-web-briefs-opus/SMARTMOVE_BRIEF.md`** — the original architecture brief (goals, inherited Marbella Live foundation, net-new features).
4. **`../smartmove-web-briefs-opus/SMARTMOVE_NEXT_PROMPTS.md`** — the master prompts + standards file (Prompts 1–6, curation model, SEO/GEO standards, verification standard). Single source of truth for prompts.
5. Supporting briefs in the same folder: `MIGRATION_301_MAP.md`, `FUTURE_COPILOT_AND_SELECTION_ENGINE.md`, `RESALES_API_REFERENCE.md`, `RESALES_API_GAPS.md`, `RESALES_PROPERTY_PAGE_DESIGN_BRIEF.md`, `RESALES_SYNC_PROMPT.md`, `RELAY_AND_GO_LIVE_PROMPT.md`, `SMARTMOVE_UPGRADE_PLAYBOOK.md`.
6. In-repo docs: `docs/` (SYNC.md, LEADS.md, QUIZZES.md, ARCHITECTURE.md, SEO.md, etc.) and the repo `CLAUDE.md` (Verification standard).

The third folder, **`~/Desktop/marbella-live-v2/docs`**, is the documentation of the **inherited foundation** (Marbella Live, which Smartmove forked from). It is reference for what was ported/adapted — not a separate backlog. Ignore any feature there that already exists in this codebase.

---

## 3. Source-of-truth precedence (when documents disagree)

Both handovers agree on this hierarchy — apply it:

- **Committed code** (schema, migrations, file layout, enums, exact env var names, do-not-revert workarounds): the **repo audit (`HANDOVER.md` here)** wins.
- **Strategy, design history, the "why," and Vercel env vars + running prod state** (the repo audit is blind to Vercel env): the **cowork handover** wins.
- **Runtime state of the live system** (what's deployed, what the live site/relay actually serves, Vercel env): the **live system + Alessio's direct observation** outrank BOTH documents and any reasoning. When unsure, hit the live endpoint / query the live DB, and state plainly what is VERIFIED vs ASSUMED.

Reconciled facts (both docs agree): live DB ≈ **8,977 properties** (8,390 published, 587 pending-review), **461 developments**, **45 areas**, 2 quizzes, 7 test leads. HEAD `6d2b947`, working tree clean, 18 migrations. Supabase ref `vhsttqejskvofqxgddho` (the `tvuhxqcpunavphakuzhm` in `docs/DATABASE_SCHEMA.md` is stale). Prod URL `smartmove-new.vercel.app`.

Reconciled disagreement — **Upstash rate limit**: the repo audit says "not armed/not provisioned"; the cowork handover says Alessio confirmed `UPSTASH_REDIS_REST_URL` + `_TOKEN` ARE in Vercel Production (screenshot). Cowork wins on Vercel env → **treat as armed**; confirm with a real 6th-submit 429 only if it matters.

---

## 4. The #1 OPEN ISSUE — sandbox vs production (CONTESTED; do NOT resolve from docs)

**The two handovers disagree about whether the Resales feed is in sandbox or production mode, and whether the prod DB / public site holds sandbox or real data. This is unresolved. Do not mark it resolved from any document — verify against the live system, and it's Alessio's go-live call.**

- The **repo audit** states `RESALES_SANDBOX=true` on the relay and that the **sandbox dataset (~8,600 rows) is currently in the prod DB**; it lists the sandbox→production flip as the one remaining go-live gate. (It read this partly from a code default of `"true"`.)
- The **cowork handover** reports the live relay `/healthz` returned `{"ok":true,"sandbox":false,...}` (~15 days uptime) — i.e. production mode — and frames the real symptom as: **admin shows real listings, but the public site (`smartmove-new.vercel.app`) shows sandbox-looking listings.** It explicitly notes the repo audit may have been misled by the code default.

These don't fully reconcile. There is **one** `properties` table; admin (service-role) and public (anon, `published=true`) read the same rows, so a clean "two datasets" split should be impossible. Leading hypotheses (rank by WHERE the sandbox listings appear): (H1, strong, if homepage/featured only) **stale featured picks** — `is_featured`/`featured_order` are sync-protected, so rows featured during sandbox testing persist as homepage picks; fix = un-feature, feature real listings. (H2, if also in `/properties` search) **stale public ISR/deploy cache**; fix = force revalidate/redeploy. (H3) leftover sandbox rows never cleaned. (H4) curation/search filter surfacing a different set.

**Diagnostic to run against the LIVE system before trusting on-site data or doing go-live** (Alessio + a code session): (a) via service-role, count `properties` by `source` + `published` and sample a few `published=true` rows — are they sandbox or real? (tells you data vs cache problem); (b) re-check relay `/healthz` and the Vercel production deploy alias + last revalidation, force a full revalidate/redeploy, recheck public; (c) compare one specific reference on public vs admin. **This is live-system work — surface it to Alessio; don't flip production data without his explicit go-ahead.**

The actual go-live flip (Alessio's call, once the above is understood): on the VPS set `RESALES_SANDBOX=false` in `/etc/resales-relay/env` + `systemctl restart resales-relay`; in the DB `DELETE FROM properties WHERE source='resales_online'` and clear `sync_state` (watermark, full_import, own_refs); then `/admin/resales` → Start full import (immediate-ack drain runs unattended; one Resume after any deploy). Production feed ≈ 8,657 rows.

---

## 5. Hard constraints & do-not-revert workarounds (never break)

Full list in the repo `HANDOVER.md` §11 and `docs/SYNC.md` — **read §11 before touching sync, search, or caching.** The load-bearing ones:

- **Monday CRM stays DISCONNECTED** — never set `MONDAY_API_TOKEN` / `MONDAY_BOARD_ID` (wrapper no-ops while unset). The real Monday board is Alessio's live work.
- **Credentials only in relay env / worker secrets / Vercel env — never in the repo.** Resales `p1`/`p2` are scrubbed from every response (`scrub.mjs`/`scrub.ts`, parity-tested).
- **Never add `RegisterLead`** to the Resales allowlist — leads stay in-house.
- **No agent names from the Resales feed**, and **no "Resales Online"/"listing agency"** references on public surfaces.
- **MLS rows never reach curated surfaces** (homepage/featured/Top-20/quiz results) without explicit admin whitelist. `SYNC_PROTECTED_FIELDS` (`pending_review, published, rejected, hide_price_drop, slug, price_drop_at, removed_at, is_featured, featured_order`) are never written on update and excluded from the content hash.
- **Two-tier index policy:** Tier-1 (featured listings, all dev pages, areas, guides, blog, facet pages, homepage) get full SEO; **MLS resale detail pages are `noindex,follow` and out of the sitemap**; IndexNow pings Tier-1 only.
- **Relay systemd deliberately omits `MemoryDenyWriteExecute`** (V8 JIT needs W^X; re-adding SIGTRAP-crashes it). **Watermark is never wall-clock.** **R2 image keys are index-based → purge-the-prefix + lazy refill, never diff.** **Global `<Toaster>` in the locale layout** (its absence was the silent share/lead/quiz bug). **`immutable_join_text()`** backs the `features_text` generated column. **Feature-token matching covers BOTH dialects** (manual `'Private Pool'` vs MLS `'Pool: Private'`). **`revalidateTag` in route handlers, `updateTag` in server actions** (not interchangeable). **Immediate-ack + deadline-drain** sync/reconcile continuation (never reintroduce awaited child fetches). **`pin_category` lives in data, never special-cased in the renderer.** **`/s/`, `/c/`, `/admin` bypass the i18n middleware.** **Source-aware location fuzzing** — Resales listings never expose an exact pin.

**Prod-secret gotcha:** local `.env.local` `SYNC_CRON_SECRET` ≠ Vercel prod value, so local scripts hitting prod admin routes 401. For one-off prod data ops, write via the service-role Supabase client + empty-commit redeploy (`revalidateTag` only fires on prod). Never pull prod env down.

---

## 6. Verified current state (what's shipped)

Live on `smartmove-new.vercel.app` (HEAD `6d2b947`): full Resales delta-sync pipeline (watermark, content-hash skip, price/status history, image-manifest purge, weekly reconciliation, chunked full-import) through the **fixed-IP Hetzner relay** + Cloudflare image-proxy worker; **publish gate** (review-by-exception, ~7,628 published / 572 held); URL-synced `/properties` search + **16 curated SEO facet pages** + similar-properties + two-tier index policy + short links (`/s/`, `/c/`); **lead pipeline** (hardened `/api/leads`, interim CRM `/admin/leads`, copy-card-to-email; Monday built but disconnected); **quiz engine** (`which-coast` live, `which-development` draft) with PostHog + first-party funnels; **location nesting** (`resales_location_mapping`, ~91% mapped) feeding canonical area search; MapLibre + self-hosted Protomaps map. The new visual **designs exist in Claude Design but are NOT yet ported** to the live site (it still runs the older design).

Schema groundwork already in the DB for Prompt 5: `agents`, `email_selections` + `email_selection_properties`, `collections` + `collection_properties`, `short_links` (all exist; mostly 0 rows). **Reconcile before creating new tables** — Prompt 5's "selection rails" should extend `email_selections`, not create a parallel `selections` table.

---

## 7. Immediate next steps (reconciled, ordered)

0. **Resolve the sandbox-vs-public-data discrepancy (§4)** — diagnostic against the live system; do not assume; do not flip prod data without Alessio.
1. **Resend** — Alessio creates the account + adds `RESEND_API_KEY` to Vercel Production (prerequisite for Prompt 5 emails).
2. **Prompt 5 — admin rebuild** (full spec in `SMARTMOVE_NEXT_PROMPTS.md`): roles (admin + agent isolation, verify don't assume), manual lead assignment, notifications module (Resend now / WhatsApp later), per-role dashboards, `/admin/inventory` vs `/admin/listings` split with server-side TanStack pagination (20k rows < 1s), dev-content overrides, curation tools (featured-by-ref, Top-20 drag-rank, location-mapping screen), Team screen, copy-for-email everywhere, selection rails (extend existing tables). **The last big functionality prompt.**
3. **Design port** — tokens first (extract Claude Design palette/type/spacing → Tailwind `@theme`), then page-by-page from the actual Claude Design HTML (resales property → dev detail → search pages → featured → homepage → standard header). After Prompt 5, because 3 & 5 change page structure.
4. **Then:** mobile pass → general New Developments landing page → content/SEO pages (golf YES, selling YES, schools YES; golden-visa NO new page, 301) → domain migration when DNS lands (`MIGRATION_301_MAP.md`; it's a 7-year-old domain — migration of SEO equity, #1 risk is losing rankings).

Smaller open items: arm/verify Upstash; work the 572 gate-held queue; 4 zero-coverage area mappings (finca-cortesin, la-alqueria, palo-alto, real-de-la-quinta) + ~80 pending; el-chaparral hero photo; ES translation pass; flip `which-development` quiz live once devs are public; price-drop badge UI (data ready, waiting on design); UptimeRobot on relay `/healthz`. Parked post-launch: auto-selection engine + CRM Copilot (`FUTURE_COPILOT_AND_SELECTION_ENGINE.md`).

---

## 8. Working method (how Alessio runs this)

- **Verification standard (binding, in repo `CLAUDE.md`):** backend checks never close a UI feature — drive it in a real browser (Preview/Playwright), click the control, assert the visible outcome, screenshot. Data features: spot-check rendered values against the DB.
- **STOP before production data flips** (sandbox→prod, full import, deleting rows) — those are Alessio's explicit decisions.
- Alessio is product-deep but relies on the assistant for architecture. He's concise, fast, often on mobile. Be direct, recommend a default, catch SEO/curation/brand-leak violations proactively, use AskUserQuestion for genuine forks.
- Preview MCP is broken in this env (`uv_cwd` EPERM) — use Playwright for browser verification. Tests: `npm run test:resales-sync`, `npm run test:resales-parser`.

---

## 9. Where things live

- **This working copy:** `~/Desktop/smartmove-web-opus` (branch `opus-4.8`). Briefs copy: `~/Desktop/smartmove-web-briefs-opus`.
- **Frozen originals (Fable baseline — do not edit):** `~/Desktop/smartmove-web` (`main`), `~/Desktop/smartmove-web-briefs`. Inherited-foundation docs: `~/Desktop/marbella-live-v2/docs`.
- **Infra:** Vercel `smartmove-new` (GitHub `alessiomauri/smartmove-new`); Supabase `vhsttqejskvofqxgddho`; Cloudflare R2 + image-proxy + protomaps-tiles workers + idle resales-proxy worker; **Resales relay** Hetzner VPS `167.233.98.46` / `https://167-233-98-46.sslip.io` (`/healthz` unauthenticated); PostHog EU; Upstash `sacred-cub-105510`; Resend (not yet set up).
- **Exact env var names, schema, migrations, feature flags, key file paths:** repo `HANDOVER.md` §7–§15.
