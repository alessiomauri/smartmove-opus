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
2. **The sync never writes admin-owned fields on UPDATE**:
   `pending_review`, `published`, `rejected`, `hide_price_drop`, `slug`
   (`SYNC_PROTECTED_FIELDS`). Approving/unpublishing/rejecting a
   listing, hiding its badge, or its public URL all survive any number
   of upstream edits. These fields are also excluded from the hash, so
   admin actions don't make rows look "changed".
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

1. Ensure the Worker proxy has production `p1`/`p2` and
   `RESALES_SANDBOX=false`, and the image worker has `PURGE_SECRET`.
2. `/admin/resales` → **Start full import**. Each invocation processes
   ≤40 pages (~2,000 rows) at ~2.5 req/s, persists its cursor in
   `sync_state.resales_full_import`, then **self-chains** the next chunk
   via `after()`. Leave the page; watch progress in the "Sync state"
   card or `sync_state`.
3. If a chunk dies (deploy, crash): nothing is lost. The nightly cron
   resumes a `running` import automatically, or click **Resume full
   import**. If the Resales `QueryId` expired between chunks, the walk
   restarts from page 1 — hash-skips make the re-walk cheap.
4. On completion the import seeds the watermark from the max
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

## Acceptance criteria → where they're enforced

| Criterion | Enforcement |
|---|---|
| No-change night ⇒ zero row writes, zero invalidations | `planBatch` (tested), `revalidateTag` only fires when writes > 0 |
| One price change ⇒ 1 update + 1 history insert + targeted invalidation | `planBatch` + orchestrator history block (tested) |
| Kill mid-run, rerun ⇒ identical state | watermark only advances on success; hashing makes re-walks idempotent |
| 50k import without timeouts | ≤60-page chunks, cursor in `sync_state`, self-chaining `after()` calls |
