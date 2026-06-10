/**
 * Own-property detection — filter-membership based.
 *
 * AgencyRef values are historically inconsistent and the per-row
 * `OwnProperty` flag depends on filter configuration, so neither is
 * trusted for the own-vs-MLS decision. Instead, Resales filter
 * RESALES_OWN_FILTER_ID (default 5, configured in the Resales admin
 * with the "Only own properties" flag) returns exactly Smartmove's own
 * listings. Membership in that reference set is the discriminator:
 *
 *   own (member)     → auto-publish on insert
 *   MLS (non-member) → pending_review on insert
 *
 * The set is fetched once at the start of each sync run (refs only,
 * paced by the run's shared throttle) and snapshotted into sync_state
 * for observability. AgencyRef stays on rows as metadata only.
 *
 * Failure mode is conservative: if the set can't be fetched, the run
 * records the error and inserts default to MLS/pending — nothing
 * auto-publishes that shouldn't. (Approval flags are insert-only; the
 * update path never touches them, so a mis-classified insert waits for
 * an admin, it doesn't flap.)
 */

import { searchProperties } from './resales';
import type { Throttle } from './resales-throttle';

export function ownFilterId(): number {
  return Number(process.env.RESALES_OWN_FILTER_ID || '') || 5;
}

/**
 * Walk the own-properties filter collecting references only.
 * Paced by the caller's throttle so the whole run shares one budget.
 */
export async function fetchOwnReferenceSet(throttle: Throttle): Promise<Set<string>> {
  const filterId = ownFilterId();
  const refs = new Set<string>();
  const pageSize = 100;
  let page = 1;
  let queryId: string | null = null;

  // Own inventory is small (tens of listings) — hard cap at 50 pages
  // (5,000 refs) as a runaway guard.
  for (let i = 0; i < 50; i++) {
    const env = await throttle.run(`own-refs p${page}`, () =>
      searchProperties({
        agencyFilterId: filterId,
        pageSize,
        page,
        queryId: queryId ?? undefined,
      })
    );
    if (env.transaction?.status === 'error') {
      throw new Error(
        `own-filter ${filterId} transaction error: ${JSON.stringify(
          (env.transaction as { errordescription?: unknown }).errordescription ?? {}
        )}`
      );
    }
    for (const p of env.Property ?? []) refs.add(p.Reference);

    const total = env.QueryInfo.PropertyCount;
    const perPage = env.QueryInfo.PropertiesPerPage || pageSize;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (page >= totalPages || (env.Property ?? []).length === 0) break;
    queryId = env.QueryInfo.QueryId || null;
    page += 1;
  }

  return refs;
}
