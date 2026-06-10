/**
 * Weekly reference-set reconciliation — catches what incremental misses.
 *
 * The nightly delta walk only sees rows Resales *touched*. Two drift
 * cases slip through:
 *
 *  1. A reference leaves the feed without a final update (withdrawn,
 *     agency excluded, expired) — our row stays published forever.
 *  2. A reference exists upstream but never landed here (missed night,
 *     filter hiccup) — we never show it.
 *
 * The sweep walks the full inventory collecting REFERENCES ONLY
 * (chunked + cursor-persisted like the full import), then diffs:
 *
 *  - In DB, not live, last seen >15 days ago (past the sold tail)
 *    → unpublish, stamp removed_at, cleanse R2 images.
 *  - Live, not in DB → fetch via PropertyDetails (EN+ES) and ingest
 *    through the normal mapping pipeline (capped per run).
 *
 * The delta lands in resales_sync_runs (trigger='reconcile').
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  searchProperties,
  propertyDetails,
  RESALES_LANG,
  type ResalesEnvelope,
  type ResalesProperty,
} from './resales';
import { mapToRow, type ResalesPropertyRaw } from './resales-mapping';
import { hashContent } from './resales-hash';
import { createThrottle, type Throttle } from './resales-throttle';
import { getSyncState, setSyncState, RECONCILE_KEY } from './sync-state';
import { purgeImages } from './cloudflare-images';
import { revalidateTag } from 'next/cache';
import { PROPERTIES_TAG, DEVELOPMENTS_TAG } from '@/lib/cache';
import { pingIndexNow, entityUrls } from '@/lib/indexnow';

export interface ReconcileState extends Record<string, unknown> {
  status: 'idle' | 'walking' | 'done' | 'failed';
  page: number;
  query_id: string | null;
  refs: string[];
  total_count: number | null;
  started_at: string | null;
  last_completed_at: string | null;
  error: string | null;
}

export const FRESH_RECONCILE: ReconcileState = {
  status: 'idle',
  page: 1,
  query_id: null,
  refs: [],
  total_count: null,
  started_at: null,
  last_completed_at: null,
  error: null,
};

export interface DbRefRow {
  id: string;
  source_id: string;
  slug: string | null;
  last_synced_at: string | null;
  published: boolean | null;
  removed_at: string | null;
  kind: 'p' | 'd';
}

/**
 * Pure diff — exported for tests.
 *
 * toRemove: rows absent from the live set whose last sighting is older
 * than the sold-tail window and that aren't already marked removed.
 * toIngest: live references with no DB row at all.
 */
export function computeReconcileDiff(
  dbRows: DbRefRow[],
  liveRefs: ReadonlySet<string>,
  now: Date,
  tailDays = 15
): { toRemove: DbRefRow[]; toIngest: string[] } {
  const cutoff = new Date(now.getTime() - tailDays * 24 * 60 * 60 * 1000).toISOString();
  const dbRefs = new Set(dbRows.map((r) => r.source_id));

  const toRemove = dbRows.filter(
    (r) =>
      !liveRefs.has(r.source_id) &&
      r.removed_at == null &&
      (r.last_synced_at == null || r.last_synced_at < cutoff)
  );
  const toIngest = [...liveRefs].filter((ref) => !dbRefs.has(ref));
  return { toRemove, toIngest };
}

/** PostgREST caps responses at 1000 rows — page the full ref dump. */
async function fetchAllDbRefs(supabase: SupabaseClient): Promise<DbRefRow[]> {
  const out: DbRefRow[] = [];
  for (const [table, kind] of [
    ['properties', 'p'],
    ['developments', 'd'],
  ] as const) {
    let fromIdx = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('id, source_id, slug, last_synced_at, published, removed_at')
        .eq('source', 'resales_online')
        .order('source_id', { ascending: true })
        .range(fromIdx, fromIdx + pageSize - 1);
      if (error) throw new Error(`db refs ${table}: ${error.message}`);
      for (const r of data ?? []) out.push({ ...(r as Omit<DbRefRow, 'kind'>), kind });
      if (!data || data.length < pageSize) break;
      fromIdx += pageSize;
    }
  }
  return out;
}

export interface ReconcileChunkResult {
  done: boolean;
  state: ReconcileState;
  summary?: {
    liveRefs: number;
    dbRefs: number;
    removed: number;
    ingested: number;
    ingestSkipped: number;
    errors: string[];
  };
}

/**
 * Process one chunk of the reconciliation walk. When the walk finishes,
 * runs the diff + apply phase in the same invocation (diff is DB-only,
 * ingest is capped) and stamps last_completed_at.
 */
export async function runReconcileChunk(opts: {
  supabase: SupabaseClient;
  triggeredBy: string | null;
  pagesPerChunk?: number;
  restart?: boolean;
  /** Max PropertyDetails fetches per run — bounds the ingest phase. */
  ingestCap?: number;
  throttle?: Throttle;
}): Promise<ReconcileChunkResult> {
  const { supabase } = opts;
  const throttle = opts.throttle ?? createThrottle();
  const pagesPerChunk = Math.min(Math.max(opts.pagesPerChunk ?? 40, 1), 60);
  const ingestCap = Math.min(Math.max(opts.ingestCap ?? 200, 0), 500);
  const pageSize = 100; // refs-only walk: fewest round-trips allowed

  let state =
    (await getSyncState<ReconcileState>(supabase, RECONCILE_KEY)) ?? FRESH_RECONCILE;

  if (opts.restart || state.status === 'idle' || state.status === 'done' || state.status === 'failed') {
    state = { ...FRESH_RECONCILE, status: 'walking', started_at: new Date().toISOString(), refs: [] };
    await setSyncState(supabase, RECONCILE_KEY, state);
  }

  // ── Walk phase: collect live references ──
  let walked = 0;
  let done = false;
  let restarted = false;
  const liveRefs = new Set(state.refs);

  while (!done && walked < pagesPerChunk) {
    let env: ResalesEnvelope<ResalesProperty>;
    try {
      env = await throttle.run(`reconcile p${state.page}`, () =>
        searchProperties({
          pageSize,
          page: state.page,
          queryId: state.query_id ?? undefined,
          sortType: 3,
          showLastUpdateDate: true,
        })
      );
      if (env.transaction?.status === 'error') {
        throw new Error(`Resales transaction error: ${JSON.stringify(env.transaction)}`);
      }
    } catch (err) {
      if (state.query_id && !restarted) {
        // QueryId expired mid-walk → restart the walk; refs are a set,
        // re-collection is idempotent.
        restarted = true;
        state = { ...state, page: 1, query_id: null };
        await setSyncState(supabase, RECONCILE_KEY, state);
        continue;
      }
      state = { ...state, error: err instanceof Error ? err.message : String(err) };
      await setSyncState(supabase, RECONCILE_KEY, state);
      throw err;
    }

    walked += 1;
    for (const p of env.Property) liveRefs.add(p.Reference);

    const total = env.QueryInfo.PropertyCount;
    const perPage = env.QueryInfo.PropertiesPerPage || pageSize;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    done = state.page >= totalPages || env.Property.length === 0;

    state = {
      ...state,
      page: state.page + 1,
      query_id: env.QueryInfo.QueryId || null,
      total_count: total,
      refs: [...liveRefs],
      error: null,
    };
    await setSyncState(supabase, RECONCILE_KEY, state);
  }

  if (!done) {
    return { done: false, state };
  }

  // ── Diff + apply phase ──
  const startedAt = new Date().toISOString();
  const { data: runRow } = await supabase
    .from('resales_sync_runs')
    .insert({
      trigger: 'reconcile',
      status: 'running',
      started_at: startedAt,
      triggered_by: opts.triggeredBy,
    })
    .select('id')
    .single();
  const runId = runRow?.id ?? null;
  const errors: string[] = [];
  let removed = 0;
  let ingested = 0;
  const changedUrls: string[] = [];

  const dbRows = await fetchAllDbRefs(supabase);
  const diff = computeReconcileDiff(dbRows, liveRefs, new Date());

  // Removals: unpublish + stamp + cleanse images.
  for (const row of diff.toRemove) {
    const table = row.kind === 'p' ? 'properties' : 'developments';
    const { error } = await supabase
      .from(table)
      .update({ published: false, removed_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error) {
      errors.push(`remove ${row.source_id}: ${error.message}`);
      continue;
    }
    removed += 1;
    if (row.slug) changedUrls.push(...entityUrls(row.kind, row.slug));
    try {
      await purgeImages(row.kind, row.source_id);
    } catch (e) {
      errors.push(`purge ${row.source_id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Ingest missing references (capped; remainder caught next run or by
  // the nightly incremental once Resales touches them).
  const toIngestNow = diff.toIngest.slice(0, ingestCap);
  for (const ref of toIngestNow) {
    try {
      const env = await throttle.run(`details ${ref}`, () =>
        propertyDetails({
          reference: ref,
          langs: [RESALES_LANG.en, RESALES_LANG.es],
          showGPSCoords: true,
          showDecree218: true,
        })
      );
      const raw = (Array.isArray(env.Property) ? env.Property[0] : env.Property) as
        | ResalesPropertyRaw
        | undefined;
      if (!raw) continue;
      const entry = mapToRow(raw);
      const table = entry.kind === 'development' ? 'developments' : 'properties';
      const row = entry.row as unknown as Record<string, unknown>;
      const { error } = await supabase
        .from(table)
        .upsert({ ...row, content_hash: hashContent(row) }, { onConflict: 'source,source_id' });
      if (error) errors.push(`ingest ${ref}: ${error.message}`);
      else {
        ingested += 1;
        if (typeof row.slug === 'string') {
          changedUrls.push(...entityUrls(entry.kind === 'development' ? 'd' : 'p', row.slug));
        }
      }
    } catch (e) {
      errors.push(`ingest ${ref}: ${e instanceof Error ? e.message : e}`);
    }
  }

  let indexnowPinged = 0;
  if (removed + ingested > 0) {
    revalidateTag(PROPERTIES_TAG, 'max');
    revalidateTag(DEVELOPMENTS_TAG, 'max');
    // Unpublished URLs are pinged too — IndexNow is how engines learn
    // to recrawl (and then drop) a page that just went away.
    indexnowPinged = await pingIndexNow(changedUrls);
  }

  const finishedAt = new Date().toISOString();
  if (runId) {
    await supabase
      .from('resales_sync_runs')
      .update({
        finished_at: finishedAt,
        status: errors.length === 0 ? 'success' : 'partial',
        rows_seen: liveRefs.size,
        rows_inserted: ingested,
        soft_deleted: removed,
        images_purged: removed,
        indexnow_pinged: indexnowPinged,
        api_calls: throttle.apiCalls,
        duration_ms: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
        errors_count: errors.length,
        error_summary: errors.slice(0, 10).join('\n') || null,
      })
      .eq('id', runId);
  }

  // Reset the accumulator — refs lists are bulky and single-use.
  state = {
    ...FRESH_RECONCILE,
    status: 'done',
    last_completed_at: finishedAt,
  };
  await setSyncState(supabase, RECONCILE_KEY, state);

  return {
    done: true,
    state,
    summary: {
      liveRefs: liveRefs.size,
      dbRefs: dbRows.length,
      removed,
      ingested,
      ingestSkipped: diff.toIngest.length - toIngestNow.length,
      errors: errors.slice(0, 10),
    },
  };
}
