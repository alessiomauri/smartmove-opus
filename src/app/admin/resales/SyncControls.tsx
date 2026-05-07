'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function SyncControls() {
  const router = useRouter();
  const [busy, setBusy] = useState<'samples' | 'live' | 'ref' | null>(null);
  const [reference, setReference] = useState('');

  async function trigger(endpoint: string, label: string, body?: object) {
    const which =
      endpoint.includes('seed-samples') ? 'samples' :
      endpoint.includes('sync-reference') ? 'ref' : 'live';
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
      } else {
        toast.success(`${label} complete`, {
          description: json.report?.message || `Upserted ${json.report?.upserted ?? 0}`,
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

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => trigger('/api/admin/resales/seed-samples', 'Seed from samples')}
        style={btnSecondary}
      >
        {busy === 'samples' ? 'Seeding…' : 'Seed from samples (dev)'}
      </button>

      <button
        type="button"
        disabled={busy !== null}
        onClick={() => trigger('/api/admin/resales/sync', 'Sync')}
        style={btnPrimary}
      >
        {busy === 'live' ? 'Syncing…' : 'Sync now (live)'}
      </button>

      <span style={{ width: 16 }} />

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
          trigger('/api/admin/resales/sync-reference', 'Sync reference', { reference })
        }
        style={btnSecondary}
      >
        {busy === 'ref' ? 'Fetching…' : 'Sync reference'}
      </button>
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
