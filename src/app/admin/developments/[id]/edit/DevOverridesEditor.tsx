'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { setDevOverride, clearDevOverride } from '@/lib/actions/dev-overrides';

const TEXT_FIELDS: { key: string; label: string; area?: boolean }[] = [
  { key: 'name', label: 'Name (H1)' },
  { key: 'subtitle', label: 'Subtitle' },
  { key: 'title', label: 'SEO title' },
  { key: 'meta_description', label: 'Meta description', area: true },
  { key: 'short_description', label: 'Short description', area: true },
  { key: 'description', label: 'Description', area: true },
];

export default function DevOverridesEditor({ development }: { development: Record<string, unknown> }) {
  const router = useRouter();
  const id = development.id as string;
  const slug = development.slug as string;
  const overrides = (development.overrides as Record<string, unknown> | null) ?? {};
  const gallery = (development.gallery_images as string[] | null) ?? [];
  const feedHero = (development.hero_image as string | null) ?? null;
  const heroOptions = [...new Set([feedHero, ...gallery].filter(Boolean))] as string[];
  const heroOverride = (overrides.hero_image as string | null) ?? '';

  const [pending, start] = useTransition();
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, (overrides[f.key] as string | undefined) ?? '']))
  );

  function save(field: string, value: unknown) {
    start(async () => {
      try { await setDevOverride(id, field, value); toast.success('Override saved'); router.refresh(); }
      catch (e) { toast.error('Failed', { description: e instanceof Error ? e.message : String(e) }); }
    });
  }
  function clear(field: string) {
    start(async () => {
      try { await clearDevOverride(id, field); setVals((v) => ({ ...v, [field]: '' })); toast.success('Override cleared — back to feed'); router.refresh(); }
      catch (e) { toast.error('Failed', { description: e instanceof Error ? e.message : String(e) }); }
    });
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-[#0f6c74] focus:ring-[#0f6c74]/20';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit development — overrides</h1>
          <p className="text-gray-500 text-sm">Synced (MLS) development. Edits are admin overrides the sync never clobbers — clear a field to fall back to the feed value.</p>
        </div>
        <Link href={`/new-developments/${slug}`} target="_blank" className="inline-flex items-center gap-1.5 text-sm text-[#0f6c74] hover:underline"><ExternalLink className="w-4 h-4" />View public page</Link>
      </div>

      {TEXT_FIELDS.map((f) => {
        const feedVal = (development[f.key] as string | null) ?? '';
        const active = Object.prototype.hasOwnProperty.call(overrides, f.key) && overrides[f.key] !== '' && overrides[f.key] != null;
        return (
          <section key={f.key} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-gray-700">{f.label}</label>
              {active
                ? <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Override active</span>
                : <span className="text-[11px] text-gray-400">Showing feed value</span>}
            </div>
            <p className="text-xs text-gray-400 mb-2 truncate"><span className="uppercase tracking-wider">Feed:</span> {feedVal || '—'}</p>
            {f.area
              ? <textarea rows={3} className={inputCls} value={vals[f.key]} placeholder="(leave empty to use the feed value)" onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} />
              : <input className={inputCls} value={vals[f.key]} placeholder="(leave empty to use the feed value)" onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} />}
            <div className="flex gap-2 mt-2">
              <button disabled={pending} onClick={() => save(f.key, vals[f.key])} className="px-3 py-1.5 text-sm font-medium rounded-lg text-white disabled:opacity-60" style={{ backgroundColor: '#0f6c74' }}>Save override</button>
              {active && <button disabled={pending} onClick={() => clear(f.key)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"><RotateCcw className="w-3.5 h-3.5" />Clear</button>}
            </div>
          </section>
        );
      })}

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-semibold text-gray-700">Hero image</label>
          {heroOverride ? <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Override active</span> : <span className="text-[11px] text-gray-400">Showing feed value</span>}
        </div>
        {heroOptions.length === 0 ? (
          <p className="text-sm text-gray-400">No images on this development.</p>
        ) : (
          <select className={inputCls} value={heroOverride} disabled={pending}
            onChange={(e) => (e.target.value ? save('hero_image', e.target.value) : clear('hero_image'))}>
            <option value="">Feed default{feedHero ? ` (…${feedHero.slice(-24)})` : ''}</option>
            {heroOptions.map((url, i) => <option key={url} value={url}>Image {i + 1} — …{url.slice(-28)}</option>)}
          </select>
        )}
      </section>

      <p className="text-xs text-gray-400">
        Gallery order/hide and the new dev-detail fields (payment structure, “The residences”) are storage-ready in the overrides
        JSONB; their editors arrive with the design-port phase. {pending && <span className="inline-flex items-center gap-1 ml-1"><Loader2 className="w-3 h-3 animate-spin" />saving…</span>}
      </p>
    </div>
  );
}
