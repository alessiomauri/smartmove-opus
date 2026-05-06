'use server';

/**
 * Resales Online integration — STUB.
 *
 * This file is the contract for the eventual sync. Today it throws
 * "Not configured" because we don't yet have credentials. When credentials
 * land, fill in the four marked sections and the rest of the app keeps
 * working unchanged.
 *
 * What we need from Resales Online:
 *  - API endpoint URL (their developments / new-build feed)
 *  - Auth method (typically: API key in header, or basic auth)
 *  - Agent / office ID
 *  - Their field schema (so we can map their fields → our `developments` columns)
 *
 * Once we have those, the implementation pattern is:
 *  1. Fetch the Resales feed (page through if it's paginated)
 *  2. For each remote development, map their fields → our `DevelopmentInput`
 *  3. Upsert into our `developments` table by `(source='resales_online', source_id=remote_id)`
 *  4. Optionally download their images → upload to our `development-images` bucket
 *  5. Mark `last_synced_at = now()` on every touched row
 *  6. Call `updateTag(DEVELOPMENTS_TAG)` so the public cache invalidates
 *
 * Sync strategy: triggered manually by the admin from the
 * /admin/developments page (a "Sync from Resales Online" button), OR on
 * a cron schedule via a Vercel Cron + protected API route.
 */

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { updateTag } from 'next/cache';
import { DEVELOPMENTS_TAG } from '@/lib/cache';

export interface SyncResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: { sourceId: string; message: string }[];
  message: string;
}

// ───────────────────────────────────────────────────────────── Public API

/**
 * Run a one-shot sync of new developments from Resales Online.
 * Currently a stub — throws until credentials + mapping are wired in.
 */
export async function syncDevelopmentsFromResales(): Promise<SyncResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to sync');

  // ─── PLACEHOLDER ───
  // When credentials arrive, replace this throw with the real implementation
  // following the four steps in the file-level docstring.
  throw new Error(
    'Resales Online sync is not yet configured. Add API credentials to .env.local ' +
    '(RESALES_API_URL, RESALES_API_KEY, RESALES_AGENT_ID), then implement the ' +
    'fetch + map + upsert in src/lib/integrations/resales.ts.'
  );

  // The expected shape of the success path (kept here as documentation):
  /*
  const remote = await fetchResalesDevelopments();
  let imported = 0, updated = 0, skipped = 0;
  const errors: SyncResult['errors'] = [];

  for (const r of remote) {
    try {
      const mapped = mapResalesToDevelopment(r);
      const existing = await findExistingBySourceId(supabase, mapped.source_id!);
      if (existing) {
        await supabase.from('developments').update({
          ...mapped,
          last_synced_at: new Date().toISOString(),
        }).eq('id', existing.id);
        updated++;
      } else {
        await supabase.from('developments').insert({
          ...mapped,
          last_synced_at: new Date().toISOString(),
        });
        imported++;
      }
    } catch (e) {
      errors.push({ sourceId: r.id, message: e instanceof Error ? e.message : String(e) });
    }
  }

  updateTag(DEVELOPMENTS_TAG);
  return {
    imported, updated, skipped, errors,
    message: `Synced ${imported + updated} development(s) from Resales Online`,
  };
  */
}

// ─────────────────────────────────────────────────────── Private helpers
// (Uncomment / implement when wiring up.)

/*
async function fetchResalesDevelopments(): Promise<ResalesDevelopment[]> {
  const url = process.env.RESALES_API_URL;
  const key = process.env.RESALES_API_KEY;
  const agentId = process.env.RESALES_AGENT_ID;
  if (!url || !key || !agentId) {
    throw new Error('Missing Resales Online env vars');
  }
  const res = await fetch(`${url}/developments?agent=${agentId}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Resales API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data; // adjust to actual response shape
}

function mapResalesToDevelopment(r: ResalesDevelopment): Partial<Development> {
  return {
    source: 'resales_online',
    source_id: r.id,
    name: r.name,
    developer: r.developer_name,
    status: mapResalesStatus(r.status),  // map their status enum to ours
    price_from: r.price_min,
    price_to: r.price_max,
    bedrooms_from: r.beds_min,
    bedrooms_to: r.beds_max,
    // … and so on, mapping every field
    // Image URLs likely need re-uploading to our bucket via /api/admin/import-images
    // so we don't hot-link Resales' CDN.
  };
}

interface ResalesDevelopment {
  id: string;
  name: string;
  developer_name?: string;
  status: string;
  price_min?: number;
  price_max?: number;
  beds_min?: number;
  beds_max?: number;
  // … rest of their schema
}
*/
