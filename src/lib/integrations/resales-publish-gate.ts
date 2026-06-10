/**
 * Publish gate — review-by-exception for Resales MLS rows.
 *
 * At ~8k+ MLS rows, per-row manual review inverts: rows that pass a
 * rule-driven quality/staleness gate AUTO-PUBLISH into the full-search
 * inventory; only failures stay in the review queue, with the failing
 * rule keys recorded on the row (`publish_gate_failures`) so the queue
 * shows WHY each was held.
 *
 * Scope guarantees (Alessio's rules):
 *  - The gate controls `published` (+ its `pending_review` companion)
 *    ONLY. Ingestion is never filtered — failers are still upserted and
 *    keep feeding price/status history and reconciliation.
 *  - Admin reject is permanent and overrides everything (rejected rows
 *    are skipped before the gate ever sees them).
 *  - Admin unpublish/approve decisions are never overridden: the gate
 *    re-evaluates ONLY rows in the untouched-held state
 *    (pending_review=true ∧ published=false ∧ not rejected).
 *  - The gate NEVER unpublishes: once a row is published (by gate or by
 *    admin), only an admin can take it down.
 *  - The gate never touches is_featured / featured_order — auto-publish
 *    only makes rows visible in the full-search inventory, never on
 *    curated surfaces.
 *
 * Config lives in site_settings.publish_gate (JSONB, single row id=1)
 * so thresholds are editable without a deploy; missing keys fall back
 * to DEFAULT_PUBLISH_GATE, unknown keys are ignored. Each rule is one
 * small function in GATE_RULES — add future rules (excluded types,
 * max days since LastUpdated, …) by adding an entry there and, if it
 * needs a threshold, a config key.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface PublishGateConfig {
  /** Master switch. false ⇒ gate inactive: MLS inserts stay pending (pre-gate behaviour). */
  enabled: boolean;
  /** Minimum photos in the source manifest. 0 disables the rule. */
  min_photos: number;
  /** Minimum asking price in EUR. 0 disables the rule. POA rows fail it. */
  min_price: number;
  /** Require a non-empty (canonical EN) description. */
  require_description: boolean;
  /**
   * Staleness floor on the numeric part of the Resales reference
   * ("R5361961" → 5361961). Low numbers = listings created years ago.
   * 0 disables the rule. Unparseable references fail it (held for a
   * human look — review-by-exception).
   */
  min_reference_number: number;
  /** Require a non-empty location. */
  require_location: boolean;
}

export const DEFAULT_PUBLISH_GATE: PublishGateConfig = {
  enabled: true,
  min_photos: 4,
  min_price: 150_000,
  require_description: true,
  min_reference_number: 4_000_000,
  require_location: true,
};

/** The row fields the rules consult — satisfied by both the mapper's
 * PropertyInsertRow and a DB row selected with these columns. */
export interface GateRow {
  source_id: string;
  price?: number | null;
  description?: string | null;
  location?: string | null;
  source_image_urls?: string[] | null;
}

/** "R5361961" / "r5361961A" → 5361961; null when no digits found. */
export function referenceNumber(sourceId: string | null | undefined): number | null {
  const m = /^[A-Za-z]*(\d+)/.exec(sourceId ?? '');
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * One rule = one function. Return null to pass, or a short human detail
 * ("2 photos < 4") to fail. A rule whose threshold disables it must
 * return null. Keys are what lands in `publish_gate_failures`.
 */
type GateRule = (row: GateRow, cfg: PublishGateConfig) => string | null;

export const GATE_RULES: Record<string, GateRule> = {
  min_photos: (row, cfg) => {
    if (cfg.min_photos <= 0) return null;
    const n = row.source_image_urls?.length ?? 0;
    return n >= cfg.min_photos ? null : `${n} < ${cfg.min_photos}`;
  },
  min_price: (row, cfg) => {
    if (cfg.min_price <= 0) return null;
    if (row.price == null || row.price <= 0) return 'no price (POA)';
    return row.price >= cfg.min_price ? null : `${row.price} < ${cfg.min_price}`;
  },
  require_description: (row, cfg) => {
    if (!cfg.require_description) return null;
    return (row.description ?? '').trim().length > 0 ? null : 'empty description';
  },
  min_reference_number: (row, cfg) => {
    if (cfg.min_reference_number <= 0) return null;
    const n = referenceNumber(row.source_id);
    if (n == null) return `unparseable reference "${row.source_id}"`;
    return n >= cfg.min_reference_number ? null : `${n} < ${cfg.min_reference_number}`;
  },
  require_location: (row, cfg) => {
    if (!cfg.require_location) return null;
    return (row.location ?? '').trim().length > 0 ? null : 'empty location';
  },
};

export interface GateVerdict {
  pass: boolean;
  /** Failing rule keys — exactly what's stored on the row. */
  failures: string[];
  /** "rule: detail" strings for logs/reports. */
  details: string[];
}

export function evaluatePublishGate(row: GateRow, cfg: PublishGateConfig): GateVerdict {
  const failures: string[] = [];
  const details: string[] = [];
  for (const [key, rule] of Object.entries(GATE_RULES)) {
    const detail = rule(row, cfg);
    if (detail !== null) {
      failures.push(key);
      details.push(`${key}: ${detail}`);
    }
  }
  return { pass: failures.length === 0, failures, details };
}

/** Defaults ← stored partial; unknown keys ignored, wrong types ignored. */
export function mergeGateConfig(stored: unknown): PublishGateConfig {
  const cfg = { ...DEFAULT_PUBLISH_GATE };
  if (stored && typeof stored === 'object') {
    for (const key of Object.keys(cfg) as Array<keyof PublishGateConfig>) {
      const v = (stored as Record<string, unknown>)[key];
      if (typeof v === typeof cfg[key]) {
        (cfg as Record<string, unknown>)[key] = v;
      }
    }
  }
  return cfg;
}

/**
 * Load the live config. Returns null when the gate is disabled —
 * callers treat null as "inactive" (MLS inserts stay pending, exactly
 * the pre-gate behaviour). Throws on read errors so callers can decide
 * loudness.
 */
export async function loadPublishGateConfig(
  supabase: SupabaseClient
): Promise<PublishGateConfig | null> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('publish_gate')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw new Error(`site_settings.publish_gate read failed: ${error.message}`);
  const cfg = mergeGateConfig(data?.publish_gate);
  return cfg.enabled ? cfg : null;
}

// ────────────────────────────────── bulk pass over the held backlog

export interface GateBacklogReport {
  dryRun: boolean;
  /** Untouched-held rows scanned (pending ∧ unpublished ∧ not rejected ∧ not removed). */
  scanned: number;
  /** Passers published (status ≠ sold). */
  published: number;
  /** Passers whose status is sold — review cleared, left unpublished. */
  passedSold: number;
  held: number;
  /** Held rows failing each rule (a row can count toward several). */
  byRule: Record<string, number>;
  /** Held rows failing ONLY that rule — the tuning signal. */
  onlyRule: Record<string, number>;
  /** Slugs of newly published rows — caller pings IndexNow / revalidates. */
  publishedSlugs: string[];
  errors: string[];
}

/**
 * One pass over every untouched-held Resales property: passers publish,
 * failers get their failing rules recorded (and stay pending). Safe to
 * re-run any time — after threshold edits, re-running applies the new
 * rules to everything still held. Pure DB work (no Next.js APIs), so
 * it runs from the admin route, a script, or a cron alike; CACHE
 * INVALIDATION IS THE CALLER'S JOB when published > 0.
 */
export async function runPublishGateBacklog(
  supabase: SupabaseClient,
  opts: { dryRun?: boolean; config?: PublishGateConfig | null } = {}
): Promise<GateBacklogReport | { skipped: string }> {
  const cfg =
    opts.config !== undefined ? opts.config : await loadPublishGateConfig(supabase);
  if (!cfg) return { skipped: 'publish gate disabled (site_settings.publish_gate.enabled=false)' };

  const report: GateBacklogReport = {
    dryRun: opts.dryRun ?? false,
    scanned: 0,
    published: 0,
    passedSold: 0,
    held: 0,
    byRule: {},
    onlyRule: {},
    publishedSlugs: [],
    errors: [],
  };

  // Collect verdicts in memory first (8k rows ≈ a few MB), then write in
  // grouped batches — publishers share one payload; failers share one
  // payload per failure-signature.
  const toPublish: Array<{ id: string; slug: string | null }> = [];
  const toClearSold: string[] = [];
  const toHold = new Map<string, string[]>(); // signature → ids

  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('properties')
      .select('id, source_id, slug, status, price, description, location, source_image_urls')
      .eq('source', 'resales_online')
      .eq('pending_review', true)
      .eq('published', false)
      .or('rejected.is.null,rejected.eq.false')
      .is('removed_at', null)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) {
      report.errors.push(`backlog page @${from}: ${error.message}`);
      break;
    }
    for (const row of data ?? []) {
      report.scanned += 1;
      const verdict = evaluatePublishGate(row as GateRow, cfg);
      if (verdict.pass) {
        if (row.status === 'sold') toClearSold.push(row.id);
        else toPublish.push({ id: row.id, slug: row.slug ?? null });
      } else {
        const sig = [...verdict.failures].sort().join(',');
        const ids = toHold.get(sig) ?? [];
        ids.push(row.id);
        toHold.set(sig, ids);
        for (const rule of verdict.failures) {
          report.byRule[rule] = (report.byRule[rule] ?? 0) + 1;
        }
        if (verdict.failures.length === 1) {
          const only = verdict.failures[0];
          report.onlyRule[only] = (report.onlyRule[only] ?? 0) + 1;
        }
      }
    }
    if (!data || data.length < PAGE) break;
  }

  report.published = toPublish.length;
  report.passedSold = toClearSold.length;
  report.held = [...toHold.values()].reduce((n, ids) => n + ids.length, 0);
  report.publishedSlugs = toPublish.map((p) => p.slug).filter((s): s is string => !!s);

  if (opts.dryRun) return report;

  const stamp = new Date().toISOString();
  const chunked = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  for (const ids of chunked(toPublish.map((p) => p.id), 500)) {
    const { error } = await supabase
      .from('properties')
      .update({
        published: true,
        pending_review: false,
        publish_gate_failures: null,
        publish_gate_checked_at: stamp,
      })
      .in('id', ids);
    if (error) report.errors.push(`publish batch: ${error.message}`);
  }

  for (const ids of chunked(toClearSold, 500)) {
    const { error } = await supabase
      .from('properties')
      .update({
        pending_review: false,
        publish_gate_failures: null,
        publish_gate_checked_at: stamp,
      })
      .in('id', ids);
    if (error) report.errors.push(`clear-sold batch: ${error.message}`);
  }

  for (const [sig, ids] of toHold) {
    for (const chunk of chunked(ids, 500)) {
      const { error } = await supabase
        .from('properties')
        .update({
          publish_gate_failures: sig.split(','),
          publish_gate_checked_at: stamp,
        })
        .in('id', chunk);
      if (error) report.errors.push(`hold batch (${sig}): ${error.message}`);
    }
  }

  return report;
}
