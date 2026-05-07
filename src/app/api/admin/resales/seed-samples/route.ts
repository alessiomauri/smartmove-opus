import { NextResponse } from 'next/server';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { runResalesSync, type ResalesPage } from '@/lib/integrations/resales-sync';
import type { ResalesPropertyRaw } from '@/lib/integrations/resales-mapping';

/**
 * Samples-mode seed: reads the saved Resales sample JSONs from
 * ~/Desktop/smartmove-web-briefs/resales-samples/ and runs the
 * normal sync orchestrator against them.
 *
 * Use case: development — populate the DB with a few real-shape
 * properties before the live API credentials are issued, so the
 * homepage / detail pages render against real data shapes.
 *
 * Admin-only. The samples directory must exist on the running
 * machine — works for local dev, intentionally fails on Vercel
 * (the samples aren't deployed). That's by design: this is a
 * dev seeding aid, not a production primitive.
 */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const samplesDir =
    process.env.RESALES_SAMPLES_DIR ||
    path.resolve(process.cwd(), '..', 'smartmove-web-briefs', 'resales-samples');

  let files: string[];
  try {
    files = (await readdir(samplesDir)).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: `Samples directory not accessible at ${samplesDir}. ` +
               `Set RESALES_SAMPLES_DIR or run from local dev.`,
      },
      { status: 400 }
    );
  }

  // Load every sample, flatten into a single in-memory list. The
  // orchestrator's fetcher then yields one "page" containing all of them.
  const allProperties: ResalesPropertyRaw[] = [];
  for (const file of files) {
    const raw = await readFile(path.join(samplesDir, file), 'utf8');
    const env = JSON.parse(raw) as Record<string, unknown>;
    const arr = unwrapProperties(env);
    allProperties.push(...arr);
  }

  let yielded = false;
  const fetchPage = async (): Promise<ResalesPage> => {
    if (yielded) {
      return { properties: [], totalCount: allProperties.length, queryId: null, done: true };
    }
    yielded = true;
    return {
      properties: allProperties,
      totalCount: allProperties.length,
      queryId: null,
      done: true,
    };
  };

  const report = await runResalesSync({
    supabase,
    trigger: 'samples',
    fetchPage,
    triggeredBy: user.id,
  });

  return NextResponse.json({
    ok: report.status !== 'failed',
    samples: files.length,
    sourcedRecords: allProperties.length,
    report,
  });
}

/** Mirror of the test runner's unwrap — handles all observed sample shapes. */
function unwrapProperties(env: Record<string, unknown>): ResalesPropertyRaw[] {
  let arr: unknown[] = [];
  if (env.Property) {
    arr = Array.isArray(env.Property) ? env.Property : [env.Property];
  } else if (env._partial_property_object && typeof env._partial_property_object === 'object') {
    arr = [{ Reference: 'PARTIAL-FRAGMENT', ...(env._partial_property_object as object) }];
  } else if (
    env._partial_property_object_when_sold &&
    typeof env._partial_property_object_when_sold === 'object'
  ) {
    const wrapped = env._partial_property_object_when_sold as { Property?: unknown };
    if (wrapped.Property) arr = [wrapped.Property];
  }
  return arr.filter(
    (p) => p != null && typeof p === 'object' && typeof (p as { Reference?: unknown }).Reference === 'string'
  ) as ResalesPropertyRaw[];
}
