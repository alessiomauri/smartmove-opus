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
import {
  evaluatePublishGate,
  loadPublishGateConfig,
  type PublishGateConfig,
  type GateRow,
} from './resales-publish-gate';
import { getSyncState, setSyncState, WATERMARK_KEY, OWN_REFS_KEY } from './sync-state';
import { revalidateTag } from 'next/cache';
import { PROPERTIES_TAG, DEVELOPMENTS_TAG } from '@/lib/cache';
import { pingIndexNow, entityUrls } from '@/lib/indexnow';
import { NEW_DEVELOPMENTS_PUBLIC } from '@/app/[locale]/new-developments/feature-flag';

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
  /** URLs submitted to IndexNow (0 when INDEXNOW_KEY unset or no writes). */
  indexnowPinged: number;
  soldTailHits: number;
  /** Publish-gate outcomes (MLS property rows evaluated this run). */
  gatePublished: number;
  gateHeld: number;
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
  /**
   * Wall-clock stop (epoch ms). The walk exits cleanly when reached —
   * treated like a page cap (status 'partial', cursor.done=false) so the
   * caller resumes. Lets a single invocation drain MANY pages within the
   * serverless time budget and still finalize its run row before any
   * platform kill.
   */
  deadlineMs?: number;
  /** Persisted after every page — lets a chunked caller resume. */
  onPageComplete?: (cursor: {
    nextPage: number;
    queryId: string | null;
    maxLastUpdated: string | null;
    rowsSeen: number;
  }) => Promise<void>;
  /** R2 purge hook; return true when the purge succeeded. */
  purgeImages?: (kind: 'p' | 'd', reference: string) => Promise<boolean>;
  /**
   * Own-property reference fetcher (filter-membership detection — see
   * resales-own.ts). Shares the run's throttle. When absent (samples /
   * offline modes) the mapper falls back to the per-row OwnProperty
   * flag; when present but failing, inserts default to MLS/pending and
   * the error is recorded.
   */
  fetchOwnRefs?: (throttle: Throttle) => Promise<Set<string>>;
  /**
   * Publish gate for MLS property rows. `undefined` (default) loads the
   * live config from site_settings.publish_gate; `null` disables the
   * gate for this run; tests inject a config directly. A failed config
   * load runs with the gate inactive (rows stay pending — safe) and the
   * error lands in the run row.
   */
  publishGate?: PublishGateConfig | null;
  /** Injectable for tests; defaults to env-tuned throttle. */
  throttle?: Throttle;
  /**
   * Dry run: plan everything against real reads, write NOTHING except
   * the sync_runs observability row. Counts report what WOULD happen;
   * watermark/cache/IndexNow/history/row writes are all skipped. Used
   * by the live-API probe (`scripts/probe-resales.mjs --direct`).
   */
  dryRun?: boolean;
}

// ────────────────────────────────────────── pure batch planner

export interface ExistingRow {
  id: string;
  source_id: string;
  slug: string | null;
  content_hash: string | null;
  rejected: boolean | null;
  price: number | null;
  status: string | null;
  source_image_urls: string[] | null;
  /** Properties only — drive the publish-gate re-check on update. */
  pending_review?: boolean | null;
  published?: boolean | null;
  removed_at?: string | null;
  /** Tier-1 marker — IndexNow only pings featured listings. */
  is_featured?: boolean | null;
}

export interface PlannedUpdate {
  id: string;
  reference: string;
  kind: 'p' | 'd';
  /** Public slug of the existing row — drives the IndexNow ping. */
  slug: string | null;
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
  /** Publish-gate outcomes this batch (MLS property rows only). */
  gatePublished: number;
  gateHeld: number;
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
 *
 * `gateCfg` (when non-null) applies the publish gate to MLS property
 * rows: passing INSERTS auto-publish; failing inserts stay pending with
 * the failing rule keys recorded. Changed rows still in the
 * untouched-held state (pending ∧ unpublished ∧ not rejected/removed)
 * are RE-evaluated — upstream fixing the data publishes the row, and a
 * still-failing row gets its failure record refreshed. The gate never
 * unpublishes and never sees admin-touched rows.
 */
export function planBatch(
  mapped: Array<{ kind: 'p' | 'd'; reference: string; currency: string; entry: AnyInsertRow }>,
  existingBySourceId: Map<string, ExistingRow>,
  nowIso: string,
  gateCfg: PublishGateConfig | null = null
): BatchPlan {
  const plan: BatchPlan = {
    inserts: [],
    updates: [],
    touchIds: { properties: [], developments: [] },
    skippedUnchanged: 0,
    skippedRejected: 0,
    gatePublished: 0,
    gateHeld: 0,
  };

  // Dedupe within the batch — the same reference can appear twice with
  // different shapes (overlapping sample files; live pages reshuffling
  // mid-walk). Without this, two occurrences ping-pong the stored hash
  // and the row re-updates forever. Last occurrence wins (later = newer).
  const byKey = new Map<string, (typeof mapped)[number]>();
  for (const m of mapped) byKey.set(`${m.kind}:${m.reference}`, m);
  const deduped = [...byKey.values()];

  for (const m of deduped) {
    const row = m.entry.row as unknown as Record<string, unknown>;
    const hash = hashContent(row);
    const existing = existingBySourceId.get(`${m.kind}:${m.reference}`);

    if (!existing) {
      const insertRow: Record<string, unknown> = { ...row, content_hash: hash };
      // Publish gate — MLS property inserts only (own rows arrive with
      // pending_review=false from the mapper and bypass the gate).
      if (gateCfg && m.kind === 'p' && row.pending_review === true) {
        const verdict = evaluatePublishGate(row as unknown as GateRow, gateCfg);
        insertRow.publish_gate_checked_at = nowIso;
        if (verdict.pass) {
          // Mirror the own-row auto-publish guard: sold rows clear
          // review but stay unpublished.
          insertRow.published = row.status !== 'sold';
          insertRow.pending_review = false;
          insertRow.publish_gate_failures = null;
          plan.gatePublished += 1;
        } else {
          insertRow.publish_gate_failures = verdict.failures;
          plan.gateHeld += 1;
        }
      }
      plan.inserts.push({ kind: m.kind, reference: m.reference, row: insertRow });
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

    // Publish-gate re-check, ONLY for rows no admin has touched
    // (pending ∧ unpublished; rejected rows never reach here, removed
    // rows wait for reconciliation). This is the single deliberate
    // exception to "updates never write published/pending_review":
    // it can only ever move an untouched row forward, never override
    // an admin decision and never unpublish.
    if (
      gateCfg &&
      m.kind === 'p' &&
      existing.pending_review === true &&
      existing.published === false &&
      !existing.removed_at
    ) {
      const verdict = evaluatePublishGate(row as unknown as GateRow, gateCfg);
      payload.publish_gate_checked_at = nowIso;
      if (verdict.pass) {
        payload.published = row.status !== 'sold';
        payload.pending_review = false;
        payload.publish_gate_failures = null;
        plan.gatePublished += 1;
      } else {
        payload.publish_gate_failures = verdict.failures;
        plan.gateHeld += 1;
      }
    }

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
      slug: existing.slug,
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
  let indexnowPinged = 0;
  let soldTailHits = 0;
  let gatePublished = 0;
  let gateHeld = 0;
  // Public URLs of rows actually written this run — fed to IndexNow.
  const changedUrls: string[] = [];
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

  // ── Own-property set: filter membership decides own vs MLS on INSERT ──
  let ownRefs: Set<string> | null = null;
  if (opts.fetchOwnRefs) {
    try {
      ownRefs = await opts.fetchOwnRefs(throttle);
      if (!opts.dryRun) {
        await setSyncState(opts.supabase, OWN_REFS_KEY, {
          refs: [...ownRefs],
          count: ownRefs.size,
          run_id: runId,
        });
      }
    } catch (ownErr) {
      // Conservative: unknown ownership ⇒ everything inserts as
      // MLS/pending. Loud in the run row; nothing auto-publishes.
      ownRefs = new Set();
      errors.push(
        `own-refs fetch failed (inserts default to pending): ${
          ownErr instanceof Error ? ownErr.message : ownErr
        }`
      );
    }
  }

  // ── Publish gate: resolve once per run (injected by tests, loaded
  // from site_settings otherwise). Load failure ⇒ gate inactive (MLS
  // inserts stay pending — the safe pre-gate behaviour), error recorded.
  let gateCfg: PublishGateConfig | null = null;
  if (opts.publishGate !== undefined) {
    gateCfg = opts.publishGate;
  } else {
    try {
      gateCfg = await loadPublishGateConfig(opts.supabase);
    } catch (gateErr) {
      errors.push(
        `publish-gate config load failed (gate inactive this run): ${
          gateErr instanceof Error ? gateErr.message : gateErr
        }`
      );
    }
  }

  let queryId: string | null = opts.initialQueryId ?? null;
  let page = opts.startPage ?? 1;
  let done = false;
  let stopReached = false; // hit a row older than effectiveSince
  let restarted = false;   // one free restart on QueryId expiry
  let maxLastUpdated: string | null = null;
  const nowIso = () => new Date().toISOString();

  try {
    while (
      !done &&
      !stopReached &&
      pagesWalked < maxPages &&
      (!opts.deadlineMs || Date.now() < opts.deadlineMs)
    ) {
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
          const entry = mapToRow(
            raw,
            ownRefs ? { autoApprove: ownRefs.has(raw.Reference) } : {}
          );
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
        // developments carry price ranges, not a single price/status —
        // the planner only consults price/status for property rows.
        // pending_review/published/removed_at drive the publish-gate
        // re-check (properties only).
        const cols =
          kind === 'p'
            ? 'id, source_id, slug, content_hash, rejected, price, status, source_image_urls, pending_review, published, removed_at, is_featured'
            : 'id, source_id, slug, content_hash, rejected, source_image_urls';
        const { data: existingRows, error: exErr } = await opts.supabase
          .from(table)
          .select(cols)
          .eq('source', 'resales_online')
          .in('source_id', refs);
        if (exErr) {
          errors.push(`existing lookup ${table}: ${exErr.message}`);
          continue;
        }
        for (const r of existingRows ?? []) {
          const row = r as unknown as ExistingRow;
          existingBySourceId.set(`${kind}:${row.source_id}`, {
            ...row,
            price: row.price ?? null,
            status: row.status ?? null,
          });
        }
      }

      // ── Plan + execute ──
      const stamp = nowIso();
      const plan = planBatch(mapped, existingBySourceId, stamp, gateCfg);
      rowsSkippedUnchanged += plan.skippedUnchanged;
      gatePublished += plan.gatePublished;
      gateHeld += plan.gateHeld;

      // Inserts (upsert for race safety across concurrent runs)
      for (const [kind, table] of [
        ['p', 'properties'],
        ['d', 'developments'],
      ] as const) {
        const rows = plan.inserts.filter((i) => i.kind === kind).map((i) => i.row);
        if (rows.length === 0) continue;
        if (opts.dryRun) {
          rowsInserted += rows.length;
          for (const r of rows) {
            if (r.pending_review) pendingCount += 1;
            else approvedCount += 1;
          }
          continue;
        }
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
            // IndexNow RESCOPE (two-tier policy): ping Tier-1 only.
            // Property inserts are never featured at birth → never
            // pinged; development pages are Tier-1 once their surface
            // is public.
            if (
              kind === 'd' &&
              NEW_DEVELOPMENTS_PUBLIC &&
              r.published === true &&
              typeof r.slug === 'string'
            ) {
              changedUrls.push(...entityUrls(kind, r.slug));
            }
          }
        }
      }

      // Updates — per row (changed rows are few by design), protected
      // fields already stripped by the planner.
      for (const u of plan.updates) {
        if (opts.dryRun) {
          rowsUpdated += 1;
          if (u.priceChange) priceChanges += 1;
          if (u.statusChange) statusChanges += 1;
          continue;
        }
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
        // Tier-1 pings only: featured listings + (public) dev pages.
        if (u.slug) {
          const existingRow = existingBySourceId.get(`${u.kind}:${u.reference}`);
          if (u.kind === 'p' && existingRow?.is_featured) {
            changedUrls.push(...entityUrls('p', u.slug));
          } else if (u.kind === 'd' && NEW_DEVELOPMENTS_PUBLIC) {
            changedUrls.push(...entityUrls('d', u.slug));
          }
        }

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
        if (ids.length === 0 || opts.dryRun) continue;
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
          .select('id, source_id, slug, status, is_featured')
          .eq('source', 'resales_online')
          .in('source_id', soldTailRefs);
        const toFlip = (tailRows ?? []).filter((r) => r.status !== 'sold');
        const toTouch = opts.dryRun ? [] : (tailRows ?? []).filter((r) => r.status === 'sold').map((r) => r.id);
        if (opts.dryRun) {
          soldTailHits += toFlip.length;
          statusChanges += toFlip.length;
          toFlip.length = 0;
        }
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
          if (r.slug && r.is_featured) changedUrls.push(...entityUrls('p', r.slug));
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
    if (wroteSomething && !opts.dryRun) {
      revalidateTag(PROPERTIES_TAG, 'max');
      revalidateTag(DEVELOPMENTS_TAG, 'max');
      // IndexNow: exactly the URLs this run wrote — a no-change night
      // sends zero pings (env-gated; never throws).
      indexnowPinged = await pingIndexNow(changedUrls);
    }

    // Incomplete walk (hit the page cap OR the wall-clock deadline before
    // the feed end / stop boundary) = partial coverage. The caller reads
    // the cursor to resume; the run row records 'partial' = "more to do".
    const incompleteWalk = !done && !stopReached;
    const status: SyncReport['status'] =
      errors.length === 0 ? (incompleteWalk ? 'partial' : 'success') : 'partial';

    // ── Watermark advance: full success only, never backwards ──
    let watermarkAfter = watermarkBefore;
    if (opts.useWatermark && opts.dryRun) {
      // Dry runs REPORT the observed candidate regardless of status —
      // the caller knows a capped/partial live run would not persist it.
      watermarkAfter = maxWatermark(maxLastUpdated, watermarkBefore) ?? watermarkBefore;
    } else if (opts.useWatermark && status === 'success') {
      const candidate = maxWatermark(maxLastUpdated, watermarkBefore);
      if (candidate && candidate !== watermarkBefore) {
        if (opts.dryRun) {
          // (unreachable — dry runs handled above; kept for clarity)
          watermarkAfter = candidate;
        } else {
          try {
            await setSyncState(opts.supabase, WATERMARK_KEY, {
              watermark: candidate,
              run_id: runId,
            });
            watermarkAfter = candidate;
          } catch (wmErr) {
            errors.push(wmErr instanceof Error ? wmErr.message : String(wmErr));
          }
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
          indexnow_pinged: indexnowPinged,
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
      indexnowPinged,
      soldTailHits,
      gatePublished,
      gateHeld,
      watermarkBefore,
      watermarkAfter,
      errorsCount: errors.length,
      errors: errors.slice(0, 10),
      message:
        (finalStatus === 'success'
          ? `Seen ${rowsSeen}, skipped ${rowsSkippedUnchanged} unchanged, updated ${rowsUpdated}, inserted ${rowsInserted} across ${pagesWalked} page(s).`
          : `Sync ${finalStatus} — ${rowsUpdated + rowsInserted} written, ${rowsSkippedUnchanged} skipped, ${errors.length} error(s).`) +
        (gatePublished + gateHeld > 0
          ? ` Gate: ${gatePublished} published, ${gateHeld} held.`
          : ''),
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
      indexnowPinged,
      soldTailHits,
      gatePublished,
      gateHeld,
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
