/**
 * Tiny typed accessor for the `sync_state` key/value table.
 *
 * Keys in use:
 *  - 'resales_watermark'   : { watermark: 'YYYY-MM-DD HH:MM:SS',
 *                              run_id, updated_at }
 *    Max LastUpdated from the last fully-successful incremental run.
 *    NEVER wall-clock — a failed night must not move the window past
 *    the updates it missed.
 *  - 'resales_full_import' : { status: 'idle'|'running'|'done'|'failed',
 *                              page, query_id, total_count, pages_done,
 *                              rows_done, max_last_updated, started_at,
 *                              updated_at, error? }
 *    Cursor for the chunked one-time import; survives function timeouts.
 *  - 'resales_reconcile'   : { status, page, query_id, refs: string[],
 *                              started_at, updated_at, last_completed_at }
 *    Cursor + accumulated live reference set for the weekly sweep.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const WATERMARK_KEY = 'resales_watermark';
export const FULL_IMPORT_KEY = 'resales_full_import';
export const RECONCILE_KEY = 'resales_reconcile';
/** Snapshot of the own-properties reference set from the last run. */
export const OWN_REFS_KEY = 'resales_own_refs';

export async function getSyncState<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  key: string
): Promise<T | null> {
  const { data, error } = await supabase
    .from('sync_state')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) {
    console.error(`sync_state read ${key}:`, error.message);
    return null;
  }
  return (data?.value as T) ?? null;
}

export async function setSyncState(
  supabase: SupabaseClient,
  key: string,
  value: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('sync_state').upsert(
    {
      key,
      value: { ...value, updated_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
  if (error) {
    // State persistence failing is serious (watermark wouldn't advance) —
    // surface loudly; callers treat the run as partial.
    throw new Error(`sync_state write ${key}: ${error.message}`);
  }
}
