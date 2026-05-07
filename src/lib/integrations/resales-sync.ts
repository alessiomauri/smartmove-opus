/**
 * Resales sync orchestration.
 *
 * Pure-ish library that glues the parser (`resales-mapping.ts`) to the
 * Supabase upsert. Caller supplies a `fetcher` so the same pipeline runs
 * against:
 *   - the live Resales API (via the Cloudflare Worker proxy)
 *   - the saved sample JSONs (offline development / seeding)
 *
 * Returns a `SyncReport` with counts the admin dashboard renders.
 *
 * Sync semantics (per SMARTMOVE_BRIEF §4.1):
 *   - Upsert by (source = 'resales_online', source_id) — the parser sets
 *     these so the Supabase composite-unique index handles conflicts.
 *   - Approval workflow: own properties auto-publish; MLS-sourced rows
 *     land with pending_review=true and aren't visible until approved.
 *     The parser already encodes this on each row.
 *   - Sold-tail rows (Status=Sold + no Price) flip the existing row's
 *     status to 'sold' and keep it published for ~15 days.
 *   - All upserts honour rejected=true (admin already said no to this
 *     reference, don't re-introduce it).
 *
 * The sync_runs row is created up front, updated on completion. If the
 * orchestrator throws, the run stays in 'running' until cleaned up;
 * the dashboard surfaces stale runs as 'failed' after a TTL.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { mapToRow, isSoldTail, type ResalesPropertyRaw } from './resales-mapping';
import { updateTag } from 'next/cache';
import { PROPERTIES_TAG, DEVELOPMENTS_TAG } from '@/lib/cache';

export type SyncTrigger = 'cron' | 'manual' | 'single-ref' | 'probe' | 'samples';

export interface SyncReport {
  runId: string | null;
  trigger: SyncTrigger;
  startedAt: string;
  finishedAt: string;
  status: 'success' | 'partial' | 'failed';
  pagesWalked: number;
  upserted: number;
  pending: number;
  approved: number;
  soldTailHits: number;
  errorsCount: number;
  errors: string[];
  message: string;
}

/** A page of Resales properties, plus pagination state for follow-ups. */
export interface ResalesPage {
  properties: ResalesPropertyRaw[];
  /** Total count from the API's QueryInfo; -1 when unknown (sample mode). */
  totalCount: number;
  /** P_QueryId for the next page request (live mode). Empty when no more. */
  queryId: string | null;
  /** True when this is the last page. */
  done: boolean;
}

/** Caller-supplied page fetcher. */
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
  /** Stop after this many pages — safety cap for cron / dev runs. */
  maxPages?: number;
  /** When set, only properties with LastUpdated > this are upserted. */
  modifiedSince?: string | null;
  /** Optional ID of the admin user that triggered this run. */
  triggeredBy?: string | null;
  /** Single-reference mode populates this. */
  reference?: string | null;
}

export async function runResalesSync(opts: SyncOpts): Promise<SyncReport> {
  const startedAt = new Date().toISOString();
  const pageSize = opts.pageSize ?? 50;
  const maxPages = opts.maxPages ?? 200;
  const errors: string[] = [];
  let pagesWalked = 0;
  let upserted = 0;
  let pending = 0;
  let approved = 0;
  let soldTailHits = 0;

  // 1. Open a sync_runs row up front. The dashboard streams from this.
  const { data: runRow } = await opts.supabase
    .from('resales_sync_runs')
    .insert({
      trigger: opts.trigger,
      reference: opts.reference ?? null,
      status: 'running',
      started_at: startedAt,
      triggered_by: opts.triggeredBy ?? null,
    })
    .select('id')
    .single();

  const runId = runRow?.id ?? null;

  let queryId: string | null = null;
  let page = 1;
  let totalCount = -1;
  let done = false;

  try {
    while (!done && pagesWalked < maxPages) {
      const result = await opts.fetchPage({ page, queryId, pageSize });
      pagesWalked += 1;
      totalCount = result.totalCount;

      for (const raw of result.properties) {
        try {
          // Sold-tail rows: just flip the existing row's status. No upsert
          // of the rest of the fields (they're stripped by Resales).
          if (isSoldTail(raw)) {
            const { error: tailErr } = await opts.supabase
              .from('properties')
              .update({
                status: 'sold',
                last_synced_at: new Date().toISOString(),
              })
              .eq('source', 'resales_online')
              .eq('source_id', raw.Reference);
            if (tailErr) {
              errors.push(`sold-tail update ${raw.Reference}: ${tailErr.message}`);
            } else {
              soldTailHits += 1;
            }
            continue;
          }

          // Modified-since gate (live mode only — sample fetcher passes
          // through everything).
          if (
            opts.modifiedSince &&
            (raw as { LastUpdated?: string }).LastUpdated &&
            (raw as { LastUpdated?: string }).LastUpdated! < opts.modifiedSince
          ) {
            done = true;
            break;
          }

          const mapped = mapToRow(raw);
          const table = mapped.kind === 'development' ? 'developments' : 'properties';

          // Skip rows the admin has already rejected.
          const { data: existing } = await opts.supabase
            .from(table)
            .select('rejected, pending_review')
            .eq('source', 'resales_online')
            .eq('source_id', raw.Reference)
            .maybeSingle();
          if (existing?.rejected) continue;

          const { error: upsertErr } = await opts.supabase
            .from(table)
            .upsert(mapped.row, { onConflict: 'source,source_id' });

          if (upsertErr) {
            errors.push(`${table} ${raw.Reference}: ${upsertErr.message}`);
            continue;
          }

          upserted += 1;
          if (mapped.row.pending_review) pending += 1;
          else approved += 1;
        } catch (rowErr) {
          errors.push(
            `${raw.Reference}: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`
          );
        }
      }

      queryId = result.queryId;
      page += 1;
      if (result.done) done = true;
    }

    // Cache invalidation — public pages flip immediately.
    if (upserted > 0 || soldTailHits > 0) {
      updateTag(PROPERTIES_TAG);
      updateTag(DEVELOPMENTS_TAG);
    }

    const status: SyncReport['status'] =
      errors.length === 0
        ? 'success'
        : errors.length < upserted
          ? 'partial'
          : 'failed';

    const finishedAt = new Date().toISOString();
    if (runId) {
      await opts.supabase
        .from('resales_sync_runs')
        .update({
          finished_at: finishedAt,
          status,
          pages_walked: pagesWalked,
          upserted,
          pending,
          approved,
          soft_deleted: 0,
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
      status,
      pagesWalked,
      upserted,
      pending,
      approved,
      soldTailHits,
      errorsCount: errors.length,
      errors: errors.slice(0, 10),
      message:
        status === 'success'
          ? `Synced ${upserted} record(s) across ${pagesWalked} page(s) (total ${totalCount === -1 ? 'unknown' : totalCount}).`
          : `Sync ${status} — ${upserted} synced, ${errors.length} error(s).`,
    };
  } catch (fatal) {
    const finishedAt = new Date().toISOString();
    const message = fatal instanceof Error ? fatal.message : String(fatal);
    if (runId) {
      await opts.supabase
        .from('resales_sync_runs')
        .update({
          finished_at: finishedAt,
          status: 'failed',
          pages_walked: pagesWalked,
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
      upserted,
      pending,
      approved,
      soldTailHits,
      errorsCount: errors.length + 1,
      errors: [...errors, `FATAL: ${message}`],
      message: `Sync aborted: ${message}`,
    };
  }
}
