/**
 * Resales sync orchestration — delta-sync edition.
 *
 * Pure-ish library that glues the parser (`resales-mapping.ts`) to the
 * Supabase writes. Caller supplies a `fetcher` so the same pipeline runs
 * against the live API (via the Worker proxy), saved samples, or a
 * single PropertyDetails response.
 *
 * What "delta" means here (RESALES_SYNC_PROMPT):
 *
 *  HASHING   Every mapped row gets a SHA-256 over its normalized feed
 *            content (resales-hash.ts). Rows whose hash matches the
 *            stored `content_hash` are SKIPPED — their `last_synced_at`
 *            is touched in one batched UPDATE per page. A no-change
 *            night writes zero rows.
 *
 *  WATERMARK The incremental walk reads `sort=LastUpdated DESC` and
 *            stops at the first row older than `watermark − 10min`.
 *            The watermark (max LastUpdated seen) is persisted in
 *            `sync_state` and advances ONLY after a fully-successful
 *            run — never wall-clock, so a failed night never skips the
 *            updates it missed. The overlap re-reads a few rows; the
 *            hash makes that free.
 *
 *  ADMIN-OWNED FIELDS  Updates strip `pending_review`, `published`,
 *            `rejected`, `hide_price_drop`, `slug` (see
 *            SYNC_PROTECTED_FIELDS) — the sync can never undo an
 *            admin's approval, unpublish decision, badge opt-out, or
 *            change a live URL. The old blind upsert reset approved
 *            MLS rows to pending on every upstream edit.
 *
 *  HISTORY   Price changes insert into `property_price_history` (and
 *            maintain `price_drop_at`: set on decrease, cleared on
 *            increase). Status transitions insert into
 *            `property_status_history`. Both reference the run id.
 *
 *  IMAGES    When a row's `source_image_urls` manifest changes, the
 *            R2 prefix for that reference is purged via the image
 *            worker (caller-supplied `purgeImages`) and the lazy proxy
 *            refills on demand. R2 keys are index-based, so a partial
 *            diff is unsafe — purge-and-refill is the correct move.
 *
 *  RESUMABILITY  A QueryId expiring mid-walk restarts the walk once
 *            from page 1 (cheap — hashing skips everything already
 *            processed). Kill-and-rerun converges to the same state.
 *
 * Sync semantics preserved from SMARTMOVE_BRIEF §4.1: upsert by
 * (source='resales_online', source_id); own = auto-publish, MLS =
 * pending review (on INSERT only); 15-day sold-tail flips status while
 * keeping the row published.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  mapToRow,
  isSoldTail,
  type ResalesPropertyRaw,
  type AnyInsertRow,
} from './resales-mapping';
import {
  hashContent,
  stripProtectedFields,
  subtractOverlap,
  maxWatermark,
  isValidWatermark,
} from './resales-hash';
import { createThrottle, type Throttle } from './resales-throttle';
import { getSyncState, setSyncState, WATERMARK_KEY } from './sync-state';
import { updateTag } from 'next/cache';
import { PROPERTIES_TAG, DEVELOPMENTS_TAG } from '@/lib/cache';

export type SyncTrigger =
  | 'cron'
  | 'manual'
  | 'single-ref'
  | 'probe'
  | 'samples'
  | 'reconcile'
  | 'full-import';

export interface SyncReport {
  runId: string | null;
  trigger: SyncTrigger;
  startedAt: string;
  finishedAt: string;
  status: 'success' | 'partial' | 'failed';
  pagesWalked: number;
  rowsSeen: number;
  rowsSkippedUnchanged: number;
  rowsUpdated: number;
  rowsInserted: number;
  priceChanges: number;
  statusChanges: number;
  imagesPurged: number;
  apiCalls: number;
  soldTailHits: number;
  watermarkBefore: string | null;
  watermarkAfter: string | null;
  errorsCount: number;
  errors: string[];
  message: string;
  /** Resume info for chunked callers (full import). */
  cursor: { nextPage: number; queryId: string | null; done: boolean };
  /** Back-compat aggregate (updated + inserted). */
  upserted: number;
  pending: number;
  approved: number;
}

/** A page of Resales properties, plus pagination state for follow-ups. */
export interface ResalesPage {
  properties: ResalesPropertyRaw[];
  totalCount: number;
  queryId: string | null;
  done: boolean;
}

export type PageFetcher = (input: {
  page: number;
  queryId: string | null;
  pageSize: number;
}) => Promise<ResalesPage>;

interface SyncOpts {
  supabase: SupabaseClient;
  trigger: SyncTrigger;
  fetchPage: PageFetcher;
  pageSize?: number;
  /** Stop after this many pages THIS invocation (chunk size for full import). */
  maxPages?: number;
  /**
   * Explicit lower bound override (admin custom runs). When null/absent
   * and `useWatermark` is true, the persisted watermark drives the stop
   * condition.
   */
  modifiedSince?: string | null;
  /**
   * Incremental mode: read + advance the sync_state watermark.
   * Full-import / samples / single-ref set this false.
   */
  useWatermark?: boolean;
  triggeredBy?: string | null;
  reference?: string | null;
  /** Chunk resume state (full import). */
  startPage?: number;
  initialQueryId?: string | null;
  /** Persisted after every page — lets a chunked caller resume. */
  onPageComplete?: (cursor: {
    nextPage: number;
    queryId: string | null;
    maxLastUpdated: string | null;
    rowsSeen: number;
  }) => Promise<void>;
  /** R2 purge hook; return true when the purge succeeded. */
  purgeImages?: (kind: 'p' | 'd', reference: string) => Promise<boolean>;
  /** Injectable for tests; defaults to env-tuned throttle. */
  throttle?: Throttle;
}

// ────────────────────────────────────────── pure batch planner

export interface ExistingRow {
  id: string;
  source_id: string;
  content_hash: string | null;
  rejected: boolean | null;
  price: number | null;
  status: string | null;
  source_image_urls: string[] | null;
}

export interface PlannedUpdate {
  id: string;
  reference: string;
  kind: 'p' | 'd';
  payload: Record<string, unknown>;
  priceChange: { old: number | null; next: number | null; currency: string } | null;
  statusChange: { old: string | null; next: string } | null;
  imagesChanged: boolean;
}

export interface BatchPlan {
  inserts: Array<{ kind: 'p' | 'd'; reference: string; row: Record<string, unknown> }>;
  updates: PlannedUpdate[];
  /** Row ids to batch-touch last_synced_at (hash-identical). */
  touchIds: { properties: string[]; developments: string[] };
  skippedUnchanged: number;
  skippedRejected: number;
}

function arraysEqual(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
  return true;
}

/**
 * Decide inserts / updates / skips for one page of mapped rows against
 * the existing DB rows. Pure — this is the function the acceptance
 * tests drive: no upstream change ⇒ zero inserts/updates; one price
 * change ⇒ exactly one update with exactly one priceChange.
 */
export function planBatch(
  mapped: Array<{ kind: 'p' | 'd'; reference: string; currency: string; entry: AnyInsertRow }>,
  existingBySourceId: Map<string, ExistingRow>,
  nowIso: string
): BatchPlan {
  const plan: BatchPlan = {
    inserts: [],
    updates: [],
    touchIds: { properties: [], developments: [] },
    skippedUnchanged: 0,
    skippedRejected: 0,
  };

  for (const m of mapped) {
    const row = m.entry.row as unknown as Record<string, unknown>;
    const hash = hashContent(row);
    const existing = existingBySourceId.get(`${m.kind}:${m.reference}`);

    if (!existing) {
      plan.inserts.push({
        kind: m.kind,
        reference: m.reference,
        row: { ...row, content_hash: hash },
      });
      continue;
    }

    if (existing.rejected) {
      plan.skippedRejected += 1;
      continue;
    }

    if (existing.content_hash === hash) {
      plan.skippedUnchanged += 1;
      (m.kind === 'p' ? plan.touchIds.properties : plan.touchIds.developments).push(existing.id);
      continue;
    }

    // Changed row → UPDATE with sync-owned fields only.
    const payload: Record<string, unknown> = {
      ...stripProtectedFields(row),
      content_hash: hash,
      last_synced_at: nowIso,
    };

    let priceChange: PlannedUpdate['priceChange'] = null;
    let statusChange: PlannedUpdate['statusChange'] = null;

    if (m.kind === 'p') {
      const newPrice = (row.price ?? null) as number | null;
      const oldPrice = existing.price ?? null;
      if (newPrice !== oldPrice) {
        priceChange = { old: oldPrice, next: newPrice, currency: m.currency };
        if (oldPrice != null && newPrice != null) {
          if (newPrice < oldPrice) payload.price_drop_at = nowIso;
          else if (newPrice > oldPrice) payload.price_drop_at = null;
        }
      }
      const newStatus = (row.status ?? null) as string | null;
      if (newStatus && newStatus !== existing.status) {
        statusChange = { old: existing.status, next: newStatus };
      }
    }

    plan.updates.push({
      id: existing.id,
      reference: m.reference,
      kind: m.kind,
      payload,
      priceChange,
      statusChange,
      imagesChanged: !arraysEqual(
        existing.source_image_urls,
        (row.source_image_urls as string[] | undefined) ?? []
      ),
    });
  }

  return plan;
}

// ────────────────────────────────────────── orchestrator

export async function runResalesSync(opts: SyncOpts): Promise<SyncReport> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const pageSize = opts.pageSize ?? 50;
  const maxPages = opts.maxPages ?? 200;
  const throttle = opts.throttle ?? createThrottle();
  const errors: string[] = [];

  let pagesWalked = 0;
  let rowsSeen = 0;
  let rowsSkippedUnchanged = 0;
  let rowsUpdated = 0;
  let rowsInserted = 0;
  let priceChanges = 0;
  let statusChanges = 0;
  let imagesPurged = 0;
  let soldTailHits = 0;
  let pendingCount = 0;
  let approvedCount = 0;

  // ── Watermark: resolve the lower bound for this walk ──
  let watermarkBefore: string | null = null;
  if (opts.useWatermark) {
    const state = await getSyncState<{ watermark?: string }>(opts.supabase, WATERMARK_KEY);
    if (state?.watermark && isValidWatermark(state.watermark)) {
      watermarkBefore = state.watermark;
    }
  }
  const effectiveSince =
    opts.modifiedSince ??
    (watermarkBefore ? subtractOverlap(watermarkBefore) : null);

  // 1. Open the sync_runs row up front — the dashboard streams from it.
  const { data: runRow } = await opts.supabase
    .from('resales_sync_runs')
    .insert({
      trigger: opts.trigger,
      reference: opts.reference ?? null,
      status: 'running',
      started_at: startedAt,
      triggered_by: opts.triggeredBy ?? null,
      watermark_before: watermarkBefore,
    })
    .select('id')
    .single();
  const runId = runRow?.id ?? null;

  let queryId: string | null = opts.initialQueryId ?? null;
  let page = opts.startPage ?? 1;
  let done = false;
  let stopReached = false; // hit a row older than effectiveSince
  let restarted = false;   // one free restart on QueryId expiry
  let maxLastUpdated: string | null = null;
  const nowIso = () => new Date().toISOString();

  try {
    while (!done && !stopReached && pagesWalked < maxPages) {
      let result: ResalesPage;
      try {
        result = await throttle.run(`SearchProperties p${page}`, () =>
          opts.fetchPage({ page, queryId, pageSize })
        );
      } catch (pageErr) {
        // Mid-walk failure with a session QueryId is most likely the
        // server-side query expiring. One fresh restart from page 1 —
        // hashing makes the re-walked prefix free.
        if (queryId && !restarted) {
          restarted = true;
          errors.push(
            `page ${page} failed (${pageErr instanceof Error ? pageErr.message : pageErr}); restarting with fresh query`
          );
          queryId = null;
          page = 1;
          continue;
        }
        throw pageErr;
      }
      pagesWalked += 1;

      // ── Split the page: sold-tails, stop-boundary, mappable rows ──
      const soldTailRefs: string[] = [];
      const mapped: Array<{
        kind: 'p' | 'd';
        reference: string;
        currency: string;
        entry: AnyInsertRow;
      }> = [];

      for (const raw of result.properties) {
        rowsSeen += 1;
        const lastUpdated = (raw as { LastUpdated?: string }).LastUpdated;
        if (lastUpdated) maxLastUpdated = maxWatermark(maxLastUpdated, lastUpdated);

        // Stop condition: rows are sorted LastUpdated DESC; the first
        // one older than the (overlap-adjusted) lower bound means
        // everything after it is already in the DB.
        if (effectiveSince && lastUpdated && lastUpdated < effectiveSince) {
          stopReached = true;
          break;
        }

        if (isSoldTail(raw)) {
          soldTailRefs.push(raw.Reference);
          continue;
        }

        try {
          const entry = mapToRow(raw);
          mapped.push({
            kind: entry.kind === 'development' ? 'd' : 'p',
            reference: raw.Reference,
            currency: raw.Currency ?? 'EUR',
            entry,
          });
        } catch (rowErr) {
          errors.push(
            `${raw.Reference}: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`
          );
        }
      }

      // ── Fetch existing rows for the page in ONE query per table ──
      const existingBySourceId = new Map<string, ExistingRow>();
      for (const [kind, table] of [
        ['p', 'properties'],
        ['d', 'developments'],
      ] as const) {
        const refs = mapped.filter((m) => m.kind === kind).map((m) => m.reference);
        if (refs.length === 0) continue;
        const { data: existingRows, error: exErr } = await opts.supabase
          .from(table)
          .select('id, source_id, content_hash, rejected, price, status, source_image_urls')
          .eq('source', 'resales_online')
          .in('source_id', refs);
        if (exErr) {
          errors.push(`existing lookup ${table}: ${exErr.message}`);
          continue;
        }
        for (const r of existingRows ?? []) {
          existingBySourceId.set(`${kind}:${r.source_id}`, r as unknown as ExistingRow);
        }
      }

      // ── Plan + execute ──
      const stamp = nowIso();
      const plan = planBatch(mapped, existingBySourceId, stamp);
      rowsSkippedUnchanged += plan.skippedUnchanged;

      // Inserts (upsert for race safety across concurrent runs)
      for (const [kind, table] of [
        ['p', 'properties'],
        ['d', 'developments'],
      ] as const) {
        const rows = plan.inserts.filter((i) => i.kind === kind).map((i) => i.row);
        if (rows.length === 0) continue;
        const { error: insErr } = await opts.supabase
          .from(table)
          .upsert(rows, { onConflict: 'source,source_id' });
        if (insErr) {
          errors.push(`insert batch ${table}: ${insErr.message}`);
        } else {
          rowsInserted += rows.length;
          for (const r of rows) {
            if (r.pending_review) pendingCount += 1;
            else approvedCount += 1;
          }
        }
      }

      // Updates — per row (changed rows are few by design), protected
      // fields already stripped by the planner.
      for (const u of plan.updates) {
        const table = u.kind === 'p' ? 'properties' : 'developments';
        const { error: updErr } = await opts.supabase
          .from(table)
          .update(u.payload)
          .eq('id', u.id);
        if (updErr) {
          errors.push(`${table} ${u.reference}: ${updErr.message}`);
          continue;
        }
        rowsUpdated += 1;

        if (u.priceChange) {
          priceChanges += 1;
          const { error: phErr } = await opts.supabase.from('property_price_history').insert({
            property_id: u.id,
            old_price: u.priceChange.old,
            new_price: u.priceChange.next,
            currency: u.priceChange.currency,
            changed_at: stamp,
            sync_run_id: runId,
          });
          if (phErr) errors.push(`price history ${u.reference}: ${phErr.message}`);
        }
        if (u.statusChange) {
          statusChanges += 1;
          const { error: shErr } = await opts.supabase.from('property_status_history').insert({
            property_id: u.id,
            old_status: u.statusChange.old,
            new_status: u.statusChange.next,
            changed_at: stamp,
            sync_run_id: runId,
          });
          if (shErr) errors.push(`status history ${u.reference}: ${shErr.message}`);
        }
        if (u.imagesChanged && opts.purgeImages) {
          try {
            if (await opts.purgeImages(u.kind, u.reference)) imagesPurged += 1;
          } catch (purgeErr) {
            errors.push(
              `image purge ${u.reference}: ${purgeErr instanceof Error ? purgeErr.message : purgeErr}`
            );
          }
        }
      }

      // Unchanged rows: one batched last_synced_at touch per table.
      for (const [table, ids] of [
        ['properties', plan.touchIds.properties],
        ['developments', plan.touchIds.developments],
      ] as const) {
        if (ids.length === 0) continue;
        const { error: touchErr } = await opts.supabase
          .from(table)
          .update({ last_synced_at: stamp })
          .in('id', ids);
        if (touchErr) errors.push(`touch ${table}: ${touchErr.message}`);
      }

      // Sold tails: flip status only where it actually changed; record
      // the transition. Already-sold rows just get the batched touch.
      if (soldTailRefs.length > 0) {
        const { data: tailRows } = await opts.supabase
          .from('properties')
          .select('id, source_id, status')
          .eq('source', 'resales_online')
          .in('source_id', soldTailRefs);
        const toFlip = (tailRows ?? []).filter((r) => r.status !== 'sold');
        const toTouch = (tailRows ?? []).filter((r) => r.status === 'sold').map((r) => r.id);
        for (const r of toFlip) {
          const { error: tailErr } = await opts.supabase
            .from('properties')
            .update({ status: 'sold', last_synced_at: stamp })
            .eq('id', r.id);
          if (tailErr) {
            errors.push(`sold-tail ${r.source_id}: ${tailErr.message}`);
            continue;
          }
          soldTailHits += 1;
          statusChanges += 1;
          await opts.supabase.from('property_status_history').insert({
            property_id: r.id,
            old_status: r.status,
            new_status: 'sold',
            changed_at: stamp,
            sync_run_id: runId,
          });
        }
        if (toTouch.length > 0) {
          await opts.supabase
            .from('properties')
            .update({ last_synced_at: stamp })
            .in('id', toTouch);
        }
      }

      queryId = result.queryId;
      page += 1;
      if (result.done) done = true;

      if (opts.onPageComplete) {
        await opts.onPageComplete({
          nextPage: page,
          queryId,
          maxLastUpdated,
          rowsSeen,
        });
      }
    }

    // ── Cache invalidation: only when something actually changed ──
    const wroteSomething = rowsInserted + rowsUpdated + soldTailHits > 0;
    if (wroteSomething) {
      updateTag(PROPERTIES_TAG);
      updateTag(DEVELOPMENTS_TAG);
    }

    // Capped before reaching the boundary = partial coverage. (For
    // chunked full-import calls the caller interprets the cursor; the
    // run row still records 'partial' to mean "more to do".)
    const cappedShort = !done && !stopReached && pagesWalked >= maxPages;
    const status: SyncReport['status'] =
      errors.length === 0 ? (cappedShort ? 'partial' : 'success') : 'partial';

    // ── Watermark advance: full success only, never backwards ──
    let watermarkAfter = watermarkBefore;
    if (opts.useWatermark && status === 'success') {
      const candidate = maxWatermark(maxLastUpdated, watermarkBefore);
      if (candidate && candidate !== watermarkBefore) {
        try {
          await setSyncState(opts.supabase, WATERMARK_KEY, {
            watermark: candidate,
            run_id: runId,
          });
          watermarkAfter = candidate;
        } catch (wmErr) {
          errors.push(wmErr instanceof Error ? wmErr.message : String(wmErr));
        }
      } else {
        watermarkAfter = candidate ?? watermarkBefore;
      }
    }

    const finishedAt = nowIso();
    const finalStatus: SyncReport['status'] = errors.length === 0 ? status : 'partial';
    if (runId) {
      await opts.supabase
        .from('resales_sync_runs')
        .update({
          finished_at: finishedAt,
          status: finalStatus,
          pages_walked: pagesWalked,
          upserted: rowsInserted + rowsUpdated,
          pending: pendingCount,
          approved: approvedCount,
          rows_seen: rowsSeen,
          rows_skipped_unchanged: rowsSkippedUnchanged,
          rows_updated: rowsUpdated,
          rows_inserted: rowsInserted,
          price_changes: priceChanges,
          status_changes: statusChanges,
          images_purged: imagesPurged,
          api_calls: throttle.apiCalls,
          duration_ms: Date.now() - startedMs,
          watermark_after: watermarkAfter,
          errors_count: errors.length,
          error_summary: errors.slice(0, 10).join('\n') || null,
          query_id: queryId,
        })
        .eq('id', runId);
    }

    return {
      runId,
      trigger: opts.trigger,
      startedAt,
      finishedAt,
      status: finalStatus,
      pagesWalked,
      rowsSeen,
      rowsSkippedUnchanged,
      rowsUpdated,
      rowsInserted,
      priceChanges,
      statusChanges,
      imagesPurged,
      apiCalls: throttle.apiCalls,
      soldTailHits,
      watermarkBefore,
      watermarkAfter,
      errorsCount: errors.length,
      errors: errors.slice(0, 10),
      message:
        finalStatus === 'success'
          ? `Seen ${rowsSeen}, skipped ${rowsSkippedUnchanged} unchanged, updated ${rowsUpdated}, inserted ${rowsInserted} across ${pagesWalked} page(s).`
          : `Sync ${finalStatus} — ${rowsUpdated + rowsInserted} written, ${rowsSkippedUnchanged} skipped, ${errors.length} error(s).`,
      cursor: { nextPage: page, queryId, done: done || stopReached },
      upserted: rowsInserted + rowsUpdated,
      pending: pendingCount,
      approved: approvedCount,
    };
  } catch (fatal) {
    const finishedAt = nowIso();
    const message = fatal instanceof Error ? fatal.message : String(fatal);
    if (runId) {
      await opts.supabase
        .from('resales_sync_runs')
        .update({
          finished_at: finishedAt,
          status: 'failed',
          pages_walked: pagesWalked,
          rows_seen: rowsSeen,
          rows_skipped_unchanged: rowsSkippedUnchanged,
          rows_updated: rowsUpdated,
          rows_inserted: rowsInserted,
          price_changes: priceChanges,
          status_changes: statusChanges,
          images_purged: imagesPurged,
          api_calls: throttle.apiCalls,
          duration_ms: Date.now() - startedMs,
          watermark_after: watermarkBefore, // never advanced on failure
          errors_count: errors.length + 1,
          error_summary: `FATAL: ${message}`,
        })
        .eq('id', runId);
    }
    return {
      runId,
      trigger: opts.trigger,
      startedAt,
      finishedAt,
      status: 'failed',
      pagesWalked,
      rowsSeen,
      rowsSkippedUnchanged,
      rowsUpdated,
      rowsInserted,
      priceChanges,
      statusChanges,
      imagesPurged,
      apiCalls: throttle.apiCalls,
      soldTailHits,
      watermarkBefore,
      watermarkAfter: watermarkBefore,
      errorsCount: errors.length + 1,
      errors: [...errors, `FATAL: ${message}`],
      message: `Sync aborted: ${message}`,
      cursor: { nextPage: page, queryId, done: false },
      upserted: rowsInserted + rowsUpdated,
      pending: pendingCount,
      approved: approvedCount,
    };
  }
}
