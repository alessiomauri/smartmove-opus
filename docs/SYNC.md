# Resales Delta Sync — How It Works & Runbook

Implementation of `RESALES_SYNC_PROMPT.md`. Last updated 2026-06-10.

## The one-paragraph version

Nightly at 03:00 a Vercel cron walks Resales' `SearchProperties` sorted
by `LastUpdated DESC` and stops at the first row older than the
**watermark** (the max `LastUpdated` from the last successful run, minus
a 10-minute overlap). Every mapped row is **content-hashed**; rows whose
hash matches the stored `content_hash` are skipped with a batched
`last_synced_at` touch — a no-change night writes **zero** rows and
invalidates **zero** caches. Changed rows get a field-stripped UPDATE
that can never overwrite admin decisions; price and status transitions
land in history tables; image-manifest changes purge the R2 prefix so
the lazy proxy refills. A weekly reconciliation sweep catches silent
removals and missed references.

## Key pieces

| Piece | File |
|---|---|
| Orchestrator (hashing, watermark, history, batching) | `src/lib/integrations/resales-sync.ts` |
| Hash + watermark math + protected fields | `src/lib/integrations/resales-hash.ts` |
| Pacing + backoff (env-tunable) | `src/lib/integrations/resales-throttle.ts` |
| Cursor/watermark persistence | `src/lib/integrations/sync-state.ts` (table `sync_state`) |
| Sync route (incremental + chunked full import) | `src/app/api/admin/resales/sync/route.ts` |
| Weekly reconciliation | `src/lib/integrations/resales-reconcile.ts` + `…/reconcile/route.ts` |
| R2 cleanse | image worker `DELETE /{p\|d}/{ref}` + `purgeImages()` in `cloudflare-images.ts` |
| Price-drop gating | `src/lib/price-drop.ts` (+ `site_settings.show_price_drop_badges`, `properties.hide_price_drop`) |
| Tests | `npm run test:resales-sync` (and `test:resales-parser`) |

## Invariants (do not break)

1. **The watermark is never wall-clock.** It only advances after a run
   with zero errors that reached its stop boundary. A failed night ⇒
   the next run re-covers the same window. (The old `now − 25h` window
   silently lost any update in a failed night's window.)
2. **The sync never overrides admin decisions on UPDATE**:
   `pending_review`, `published`, `rejected`, `hide_price_drop`, `slug`
   (`SYNC_PROTECTED_FIELDS`). Approving/unpublishing/rejecting a
   listing, hiding its badge, or its public URL all survive any number
   of upstream edits. These fields are also excluded from the hash, so
   admin actions don't make rows look "changed". The ONE deliberate
   exception is the publish gate (below): on rows **no admin has
   touched** (pending ∧ unpublished ∧ not rejected/removed) it may flip
   published/pending_review forward — it can never override an admin
   decision and never unpublishes.
3. **R2 image keys are index-based** (`p/<ref>/<n>.jpg`), so a manifest
   change purges the whole prefix and lets the proxy lazily refill —
   never diff individual indices.
4. **Pacing stays boring.** Resales has no hard limits but monitors for
   unusual activity. Default 2.5 req/s ±20% jitter, exponential backoff
   on errors. Tune via `RESALES_REQS_PER_SEC` / `RESALES_MAX_RETRIES`.

## Schedules

| When | What | Route |
|---|---|---|
| 03:00 daily | Incremental delta (or full-import continuation if one is mid-flight) | `GET /api/admin/resales/sync` |
| 04:30 Sunday | Reference-set reconciliation | `GET /api/admin/resales/reconcile` |

Vercel sends `Authorization: Bearer ${CRON_SECRET}`. Both routes also
accept `x-smartmove-cron-secret: ${SYNC_CRON_SECRET}` on POST (used by
the self-chaining continuation calls and any external scheduler).

## Full-import runbook (one-time bootstrap, ~50k rows)

1. Ensure the relay has production `p1`/`p2` and `RESALES_SANDBOX=false`,
   and the image worker has `PURGE_SECRET`.
2. `/admin/resales` → **Start full import**. The button returns
   immediately ("started — running in the background"); the work happens
   in `after()`. Watch progress in the "Sync state" card or `sync_state`.
3. How it runs (immediate-ack + deadline drain): each invocation drains
   pages until the feed end OR a wall-clock deadline
   (`RESALES_DRAIN_BUDGET_MS`, default 230s — well under the 300s
   function limit), persisting the cursor in
   `sync_state.resales_full_import` **after every page**. If not done, it
   fires ONE continuation (`POST {mode:'full-import', _continuation:true}`
   with the cron secret) and exits. The continuation immediate-acks, so
   the chain is **linear and non-nesting** — each invocation lives only
   for its own drain, and its run row always finalizes before any kill.
   (This replaced the original `after()`→`await fetch(child)` design,
   which nested the awaits, blew maxDuration, and left run rows stuck
   `running`.)
4. If a link dies (deploy, crash, network blip): nothing is lost. The
   cursor persists; the nightly cron resumes a `running` import
   automatically (it takes over once the heartbeat goes stale), or click
   **Resume full import**. A QueryId expiry mid-walk restarts the walk
   from page 1 — hash-skips make it cheap (TTL ≥60 min, so rare).
5. Concurrency: full import is gated on `sync_state` freshness, not the
   run-row lock. A manual click while a drain is actively heartbeating is
   skipped ("already draining"); once stale (>8 min) a resume/cron takes
   over. Stale `running` run rows auto-fail at the same 8-min TTL.
6. On completion the import seeds the watermark from the max
   `LastUpdated` observed; nightly incremental takes over automatically.

## Reading `resales_sync_runs`

`rows_seen` (feed rows inspected) → `rows_skipped_unchanged` (hash
matches — the big number on a healthy night) → `rows_updated` /
`rows_inserted` (actual writes) + `price_changes`, `status_changes`,
`soft_deleted` (reconciliation removals), `images_purged`, `api_calls`,
`duration_ms`, `watermark_before/after`.

Healthy night: `seen` small (tens–hundreds), `skipped` ≈ overlap rows,
writes ≈ real-world changes, watermark advanced.

## Failure runbook

| Symptom | Meaning | Action |
|---|---|---|
| Run `failed`, `error_summary: Resales … 401` | Worker proxy lacks valid p1/p2 | Fix Worker secrets; rerun — watermark didn't move, nothing lost |
| Run `partial` with `errors_count > 0` | Some rows errored; the rest committed | Inspect `error_summary`; rerun is idempotent |
| Run stuck `running` | Function died mid-run | Auto-flipped to `failed` after 20 min (TTL in route + admin page); rerun |
| Cron run `success` with `rows_seen: 0` for days | Nothing changed — or auth/filter quietly broke | Spot-check with **Sync reference** on a known ref |
| Watermark not advancing | Runs ending `partial` (cap hit or errors) | Raise `maxPages` / fix errors; until then each night safely re-covers the window |
| Import paused with error banner | Chunk failed; cursor intact | **Resume full import** or wait for the nightly cron |

## Publish gate (review-by-exception)

At ~8k+ MLS rows, per-row review inverts: rows passing a rule-driven
gate AUTO-PUBLISH into the full-search inventory; only failures wait in
the queue, each carrying its failing rule keys
(`properties.publish_gate_failures`) so the queue shows WHY. Engine:
`src/lib/integrations/resales-publish-gate.ts` — one small function per
rule in `GATE_RULES`; add future rules there.

Config: `site_settings.publish_gate` (JSONB, editable without deploy —
missing keys fall back to code defaults):

| Key | Default | Meaning |
|---|---|---|
| `enabled` | true | Master switch; off ⇒ MLS inserts stay pending (pre-gate behaviour) |
| `min_photos` | 4 | Source-manifest photo floor (0 disables) |
| `min_price` | 150000 | EUR floor; POA rows fail (0 disables) |
| `require_description` | true | Non-empty canonical description |
| `min_reference_number` | 4000000 | Staleness floor on the R-ref's numeric part (0 disables; unparseable refs are held) |
| `require_location` | true | Non-empty location |

Where it applies:
- **Sync INSERT** (MLS property rows; own rows bypass — filter-5
  membership already publishes them): pass ⇒ published immediately
  (sold rows clear review but stay unpublished), fail ⇒ pending with
  rules recorded.
- **Sync UPDATE**, only for untouched-held rows (pending ∧ unpublished
  ∧ not rejected/removed): upstream fixing the data publishes the row;
  still-failing rows get their failure record refreshed. The gate never
  unpublishes and never touches admin-reviewed rows.
- **Bulk pass**: `POST /api/admin/resales/publish-gate` (admin session
  or cron secret; `{dryRun:true}` to preview) or the "Run publish gate"
  button — re-evaluates everything still held. Run it after editing
  thresholds. Developments (446 rows) stay manual-review.

Hard rules: admin **reject is permanent** (rejected rows are skipped
before the gate sees them); the gate **never touches
is_featured/featured_order** — auto-published rows appear in
full-search inventory only, never curated surfaces; ingestion is never
filtered (held rows keep feeding history + reconciliation).

First bulk pass (2026-06-10, production backlog): scanned 8,200 held →
**published 7,628 / held 572** (min_reference_number 281, min_price
193, min_photos 142; description/location 0). R-number distribution at
the time: p10 = 4.69M, only 287 of 8,215 rows below the 4M floor.

## Price-drop badges

`price_drop_at` is stamped by the sync on a price decrease (cleared on
increase); history lives in `property_price_history`. The public
`price_drop` flag is computed server-side and is `true` only when ALL
hold: site-wide toggle ON (`/admin/resales`) + listing not opted out
(property edit form → "Price-drop badge") + drop within 30 days. Both
gates also apply to any future alert emails. Nothing in the UI renders
the badge yet — the data and gating are ready for when design lands.

## Known-good run (smoke test, 2026-06-10)

Captured from `resales_sync_runs` — four consecutive runs of the full
orchestrator against the real DB (samples fetcher; live sandbox was
IP-blocked at the time, see RESALES_API_GAPS.md probe findings):

| Time (UTC) | Run | status | seen | skipped | updated | inserted | price Δ | indexnow | duration |
|---|---|---|---|---|---|---|---|---|---|
| 10:49:14 | A — steady state | success | 19 | 15 | **0** | **0** | 0 | 0 | 702ms |
| 10:49:15 | B — immediate rerun | success | 19 | 15 | **0** | **0** | 0 | 0 | 534ms |
| 10:49:45 | C — one upstream price change staged | success | 19 | 14 | **1** | 0 | **1** | 0 | 848ms |
| 10:50:03 | D — convergence | success | 19 | 15 | **0** | **0** | 0 | 0 | 616ms |

Run C also wrote exactly one `property_price_history` row
(`150000 → 92000`) and stamped `price_drop_at` — acceptance criterion 2
end-to-end. (seen 19 = 15 unique mappable + 3 duplicate occurrences
across overlapping sample files, deduped last-wins + 1 sold-tail touch.)

Pending against LIVE sandbox (blocked by the IP whitelist — see the
probe section in RESALES_API_GAPS.md): watermark seeding (samples carry
no `LastUpdated`) and the P_QueryId TTL probe. `scripts/probe-resales.mjs`
re-run completes both automatically once credentials work.

## Known-good run — LIVE sandbox through the relay (2026-06-10)

First full live exercise of the pipeline (sandbox `P_sandbox=true`,
8,660-row dataset, via the fixed-IP relay):

| Run | status | pages | seen | skipped | updated | inserted | own/MLS split | watermark |
|---|---|---|---|---|---|---|---|---|
| 1 — first full walk | success | 217 | 8,658 | 991¹ | 0 | 7,667 | 15 approved / 7,652 pending | **seeded → `2026-06-10 14:57:32`** |
| 2 — immediate rerun | success | 1 | 7² | 6 | **0** | **0** | — | unchanged |

¹ 991 = rows inserted by an earlier partial walk (killed mid-run by a
fractional-bathrooms schema bug, since fixed) — hash-skipped on resume,
proving kill-and-rerun convergence on live data.
² seen = 6 overlap-window rows (all hash-skipped) + 1 stop-boundary row
(fetched, inspected, walk stops — counted as seen by design). Zero
writes, zero cache invalidations.

Also verified live: own-detection via filter-5 membership (own rows
published, MLS rows pending_review — spot-checked both); image pipeline
end-to-end (published own listing → image-proxy → R2 lazy fill →
**1600×960 actual pixels** served with etag + edge cache; all 11,894
synced source URLs carry the w1600 marker). Run 1's paced walk: 218 API
calls in ~95s ≈ 2.5 req/s on the nose.

Caveat discovered: the image worker resolves source URLs with the anon
key, so UNPUBLISHED rows 404 through the proxy (RLS hides them). No
public surface shows unpublished rows, so this is correct behaviour —
but admin review UIs should use the raw source URLs for thumbnails.

## Acceptance criteria → where they're enforced

| Criterion | Enforcement |
|---|---|
| No-change night ⇒ zero row writes, zero invalidations | `planBatch` (tested), `revalidateTag` only fires when writes > 0 |
| One price change ⇒ 1 update + 1 history insert + targeted invalidation | `planBatch` + orchestrator history block (tested) |
| Kill mid-run, rerun ⇒ identical state | watermark only advances on success; hashing makes re-walks idempotent |
| 50k import without timeouts | ≤60-page chunks, cursor in `sync_state`, self-chaining `after()` calls |
