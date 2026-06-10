import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import SyncControls from './SyncControls';
import PriceDropToggle from './PriceDropToggle';

/**
 * Resales sync admin dashboard.
 *
 * Controls: seed-from-samples (dev), incremental sync, single-reference
 * sync, chunked full import (start/resume), weekly reconciliation.
 *
 * Below: sync health (watermark, full-import progress, last reconcile),
 * the price-drop badge site toggle, and the most recent 20 runs with the
 * delta metrics (seen / skipped / updated / inserted / price & status
 * changes / API calls / duration).
 */
/** Stale-running TTL: a crashed run must not look alive forever. */
async function failStaleRuns(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  await supabase
    .from('resales_sync_runs')
    .update({
      status: 'failed',
      error_summary: 'Stale: still running past 20min TTL',
      finished_at: new Date().toISOString(),
    })
    .eq('status', 'running')
    .lt('started_at', new Date(Date.now() - 20 * 60 * 1000).toISOString());
}

export default async function ResalesAdminPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  await failStaleRuns(supabase);

  const [runs, propsAgg, devsAgg, pendingAgg, syncState, settings] = await Promise.all([
    supabase
      .from('resales_sync_runs')
      .select(
        'id, trigger, started_at, finished_at, status, pages_walked, rows_seen, rows_skipped_unchanged, rows_updated, rows_inserted, price_changes, status_changes, soft_deleted, api_calls, duration_ms, errors_count, error_summary, reference, watermark_after'
      )
      .order('started_at', { ascending: false })
      .limit(20),
    supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'resales_online'),
    supabase
      .from('developments')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'resales_online'),
    supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('pending_review', true),
    supabase.from('sync_state').select('key, value, updated_at'),
    supabase.from('site_settings').select('show_price_drop_badges').eq('id', 1).single(),
  ]);

  const stateByKey = new Map((syncState.data ?? []).map((r) => [r.key, r.value as Record<string, unknown>]));
  const watermark = stateByKey.get('resales_watermark') as { watermark?: string } | undefined;
  const fullImport = stateByKey.get('resales_full_import') as
    | { status?: string; pages_done?: number; rows_seen?: number; total_count?: number | null; error?: string | null }
    | undefined;
  const reconcile = stateByKey.get('resales_reconcile') as
    | { status?: string; last_completed_at?: string | null; refs?: string[]; total_count?: number | null }
    | undefined;

  const latestRun = runs.data?.[0];
  const latestCron = runs.data?.find((r) => r.trigger === 'cron');

  return (
    <main style={{ padding: '40px 32px', maxWidth: 1280, margin: '0 auto' }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Resales sync</h1>
        <p style={{ color: '#666', fontSize: 14 }}>
          Watermark-driven delta sync: unchanged rows are hash-skipped, admin
          flags survive upserts, price/status changes land in history tables.
          See docs/SYNC.md for the runbook.
        </p>
      </header>

      {/* ── Health banners ── */}
      {latestRun?.status === 'failed' && (
        <Banner tone="error">
          Latest run ({latestRun.trigger}, {new Date(latestRun.started_at).toLocaleString('en-GB')})
          FAILED: {latestRun.error_summary ?? 'no error summary'}
        </Banner>
      )}
      {fullImport?.status === 'running' && fullImport?.error && (
        <Banner tone="error">
          Full import hit an error and is paused at page cursor — it resumes on
          the next nightly cron or a manual &ldquo;Resume full import&rdquo;. Error: {fullImport.error}
        </Banner>
      )}
      {latestCron && latestCron.status === 'success' && (latestCron.rows_seen ?? 0) === 0 && (
        <Banner tone="warn">
          Last cron run saw 0 rows. Fine if nothing changed upstream — but if
          this persists for days, check the Worker credentials / filter id.
        </Banner>
      )}

      {/* ── Sync state ── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Sync state</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <StatText
            label="Watermark (max LastUpdated)"
            value={watermark?.watermark ?? 'not set — runs unbounded until first success'}
          />
          <StatText
            label="Full import"
            value={
              fullImport?.status === 'running'
                ? `running — ${fullImport.pages_done ?? 0} pages, ${fullImport.rows_seen ?? 0} rows${fullImport.total_count ? ` of ~${fullImport.total_count}` : ''}`
                : fullImport?.status ?? 'never run'
            }
          />
          <StatText
            label="Last reconciliation"
            value={
              reconcile?.status === 'walking'
                ? `walking — ${reconcile.refs?.length ?? 0} refs collected${reconcile.total_count ? ` of ~${reconcile.total_count}` : ''}`
                : reconcile?.last_completed_at
                  ? new Date(reconcile.last_completed_at).toLocaleString('en-GB')
                  : 'never run'
            }
          />
        </div>
      </section>

      {/* ── Inventory ── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Inventory</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <Stat label="Resales properties" value={propsAgg.count ?? 0} />
          <Stat label="Resales developments" value={devsAgg.count ?? 0} />
          <Stat label="Pending review" value={pendingAgg.count ?? 0} accent />
        </div>
      </section>

      {/* ── Controls ── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Run a sync</h2>
        <SyncControls fullImportStatus={fullImport?.status ?? 'idle'} />
      </section>

      {/* ── Price-drop badges ── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Price-drop badges</h2>
        <PriceDropToggle enabled={settings.data?.show_price_drop_badges ?? false} />
      </section>

      {/* ── Runs ── */}
      <section>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Recent runs</h2>
        {!runs.data?.length ? (
          <p style={{ color: '#666', fontSize: 13 }}>
            No syncs yet. Click &ldquo;Sync now&rdquo; above.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e5e5' }}>
                  <Th>Started</Th>
                  <Th>Trigger</Th>
                  <Th>Status</Th>
                  <Th>Pages</Th>
                  <Th>Seen</Th>
                  <Th>Skipped</Th>
                  <Th>Updated</Th>
                  <Th>Inserted</Th>
                  <Th>Price Δ</Th>
                  <Th>Status Δ</Th>
                  <Th>Removed</Th>
                  <Th>API</Th>
                  <Th>Time</Th>
                  <Th>Errors</Th>
                </tr>
              </thead>
              <tbody>
                {runs.data.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {new Date(r.started_at).toLocaleString('en-GB')}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {r.trigger}
                      {r.reference && <span style={{ color: '#888' }}> ({r.reference})</span>}
                    </td>
                    <td style={{ padding: '8px 10px' }}><StatusPill status={r.status} /></td>
                    <td style={{ padding: '8px 10px' }}>{r.pages_walked}</td>
                    <td style={{ padding: '8px 10px' }}>{r.rows_seen ?? '—'}</td>
                    <td style={{ padding: '8px 10px', color: '#2f6f4f' }}>{r.rows_skipped_unchanged ?? '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{r.rows_updated ?? '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{r.rows_inserted ?? '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{r.price_changes || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{r.status_changes || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{r.soft_deleted || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{r.api_calls ?? '—'}</td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      {r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {r.errors_count ? (
                        <span title={r.error_summary ?? ''} style={{ color: '#a33b2a' }}>
                          {r.errors_count}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{children}</th>;
}

function Banner({ tone, children }: { tone: 'error' | 'warn'; children: React.ReactNode }) {
  const palette = tone === 'error'
    ? { bg: '#fbe2dd', border: '#e8b3a8', fg: '#a33b2a' }
    : { bg: '#fff4d6', border: '#e8d49a', fg: '#8a6210' };
  return (
    <div
      style={{
        padding: '12px 16px',
        marginBottom: 16,
        borderRadius: 8,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.fg,
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      style={{
        padding: 20,
        border: '1px solid #e5e5e5',
        borderRadius: 8,
        background: accent ? '#f3e8cc' : '#fff',
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#666' }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 600, marginTop: 8 }}>{value}</div>
    </div>
  );
}

function StatText({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 20, border: '1px solid #e5e5e5', borderRadius: 8, background: '#fff' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#666' }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8, fontFamily: 'monospace' }}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    success: { bg: '#dff0e1', fg: '#2f6f4f' },
    partial: { bg: '#fff4d6', fg: '#8a6210' },
    failed:  { bg: '#fbe2dd', fg: '#a33b2a' },
    running: { bg: '#e7eef5', fg: '#3e6499' },
  };
  const c = colors[status] ?? colors.running;
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      {status}
    </span>
  );
}
