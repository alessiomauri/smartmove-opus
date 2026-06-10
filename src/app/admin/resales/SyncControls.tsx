'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type Busy = 'samples' | 'live' | 'ref' | 'import' | 'reconcile' | null;

export default function SyncControls({
  fullImportStatus = 'idle',
}: {
  /** sync_state.resales_full_import.status — drives the import button label. */
  fullImportStatus?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [reference, setReference] = useState('');

  async function trigger(endpoint: string, label: string, body?: object, which: Busy = 'live') {
    setBusy(which);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(`${label} failed`, {
          description: json.error || json.report?.message || 'Unknown error',
          duration: 8000,
        });
      } else if (json.started) {
        // Full import: immediate-ack — it drains + self-chains in the
        // background. Progress shows in the "Sync state" card.
        toast.success(`${label} started`, {
          description: 'Running in the background — it continues across page boundaries on its own. Watch the Sync state card.',
          duration: 7000,
        });
        router.refresh();
      } else if (json.skipped) {
        toast.info(`${label} skipped`, { description: json.skipped, duration: 6000 });
      } else {
        toast.success(`${label} ${json.done === false ? 'chunk done — continuing in background' : 'complete'}`, {
          description: json.report?.message || json.summary
            ? json.report?.message ?? `Removed ${json.summary?.removed ?? 0}, ingested ${json.summary?.ingested ?? 0}`
            : undefined,
          duration: 6000,
        });
        router.refresh();
      }
    } catch (e) {
      toast.error(`${label} failed`, {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(null);
    }
  }

  const importRunning = fullImportStatus === 'running';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => trigger('/api/admin/resales/sync', 'Sync', undefined, 'live')}
          style={btnPrimary}
        >
          {busy === 'live' ? 'Syncing…' : 'Sync now (incremental)'}
        </button>

        <button
          type="button"
          disabled={busy !== null}
          onClick={() => trigger('/api/admin/resales/seed-samples', 'Seed from samples', undefined, 'samples')}
          style={btnSecondary}
        >
          {busy === 'samples' ? 'Seeding…' : 'Seed from samples (dev)'}
        </button>

        <span style={{ width: 8 }} />

        <input
          type="text"
          placeholder="Reference (e.g. R3479851)"
          value={reference}
          onChange={(e) => setReference(e.target.value.trim())}
          style={inputStyle}
        />
        <button
          type="button"
          disabled={busy !== null || !reference}
          onClick={() =>
            trigger('/api/admin/resales/sync-reference', 'Sync reference', { reference }, 'ref')
          }
          style={btnSecondary}
        >
          {busy === 'ref' ? 'Fetching…' : 'Sync reference'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            if (
              !importRunning &&
              !window.confirm(
                'Start a FULL import? It walks the entire Resales feed in paced chunks (self-continuing in the background) and can take a while. Existing rows are hash-skipped.'
              )
            ) {
              return;
            }
            trigger(
              '/api/admin/resales/sync',
              importRunning ? 'Resume full import' : 'Full import',
              { mode: 'full-import', restart: !importRunning },
              'import'
            );
          }}
          style={importRunning ? btnPrimary : btnSecondary}
        >
          {busy === 'import'
            ? 'Importing…'
            : importRunning
              ? 'Resume full import'
              : 'Start full import'}
        </button>

        <button
          type="button"
          disabled={busy !== null}
          onClick={() => trigger('/api/admin/resales/reconcile', 'Reconciliation', { restart: true }, 'reconcile')}
          style={btnSecondary}
        >
          {busy === 'reconcile' ? 'Reconciling…' : 'Run reconciliation'}
        </button>

        <span style={{ fontSize: 12, color: '#888' }}>
          Full import + reconciliation run in self-continuing chunks — leave the page, they keep going.
        </span>
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 18px',
  border: 0,
  borderRadius: 6,
  background: '#cbaa65',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '10px 18px',
  border: '1px solid #d4d4d4',
  borderRadius: 6,
  background: '#fff',
  color: '#1c1a17',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  padding: '10px 14px',
  border: '1px solid #d4d4d4',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'monospace',
  width: 220,
};
