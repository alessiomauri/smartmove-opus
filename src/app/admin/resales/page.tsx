import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import SyncControls from './SyncControls';

/**
 * Resales sync admin dashboard.
 *
 * Three controls:
 *   - "Seed from samples" — dev-only seed that reads the saved sample
 *     JSONs and runs the orchestrator against them. Skips API entirely.
 *   - "Sync now" — live mode, walks SearchProperties via the proxy
 *     Worker. Will fail until p1/p2 secrets are in place on the Worker.
 *   - "Sync single reference" — one PropertyDetails call by Resales
 *     ref (e.g. R3479851). Same auth path; same caveat.
 *
 * Below the controls: the most recent 20 sync runs from
 * resales_sync_runs, plus quick stats (total Resales-sourced rows,
 * pending review count).
 */
export default async function ResalesAdminPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const [
    runs,
    propsAgg,
    devsAgg,
    pendingAgg,
  ] = await Promise.all([
    supabase
      .from('resales_sync_runs')
      .select('id, trigger, started_at, finished_at, status, pages_walked, upserted, pending, errors_count, error_summary, reference')
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
  ]);

  return (
    <main style={{ padding: '40px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Resales sync</h1>
        <p style={{ color: '#666', fontSize: 14 }}>
          Pulls properties + developments from Resales Online into Supabase.
          Live mode requires the Cloudflare Worker proxy to have valid
          credentials. Use "Seed from samples" during development.
        </p>
      </header>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Inventory</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <Stat label="Resales properties" value={propsAgg.count ?? 0} />
          <Stat label="Resales developments" value={devsAgg.count ?? 0} />
          <Stat label="Pending review" value={pendingAgg.count ?? 0} accent />
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Run a sync</h2>
        <SyncControls />
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Recent runs</h2>
        {!runs.data?.length ? (
          <p style={{ color: '#666', fontSize: 13 }}>
            No syncs yet. Click "Seed from samples" or "Sync now" above.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e5e5' }}>
                <th style={{ padding: '8px 12px' }}>Started</th>
                <th style={{ padding: '8px 12px' }}>Trigger</th>
                <th style={{ padding: '8px 12px' }}>Status</th>
                <th style={{ padding: '8px 12px' }}>Pages</th>
                <th style={{ padding: '8px 12px' }}>Upserted</th>
                <th style={{ padding: '8px 12px' }}>Pending</th>
                <th style={{ padding: '8px 12px' }}>Errors</th>
              </tr>
            </thead>
            <tbody>
              {runs.data.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                    {new Date(r.started_at).toLocaleString('en-GB')}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    {r.trigger}
                    {r.reference && <span style={{ color: '#888' }}> ({r.reference})</span>}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <StatusPill status={r.status} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>{r.pages_walked}</td>
                  <td style={{ padding: '8px 12px' }}>{r.upserted}</td>
                  <td style={{ padding: '8px 12px' }}>{r.pending}</td>
                  <td style={{ padding: '8px 12px' }}>
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
        )}
      </section>
    </main>
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
