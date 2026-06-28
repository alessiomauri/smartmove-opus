'use client';

import { useEffect, useState, useTransition } from 'react';
import { Search, Plus, Loader2, Mail, Send, FolderPlus } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatPrice } from '@/lib/utils';
import DragRankList, { type RankItem } from '@/components/admin/DragRankList';
import { searchPropertiesForCuration } from '@/lib/actions/curation';
import { buildEmailSelection } from '@/lib/actions/leads';
import { copySelectionToClipboard } from '@/components/admin/copy-email-selection';
import {
  getSelectionsForLead, createSelection, addSelectionItem,
  removeSelectionItem, reorderSelection, markSelectionSent,
} from '@/lib/actions/selections';
import type { SelectionRecord } from './selection-types';
import type { EntitySummary } from '@/app/admin/curation/types';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  approved: 'bg-blue-100 text-blue-700',
  sent: 'bg-emerald-100 text-emerald-700',
};

export default function SelectionEditor({ leadId }: { leadId: string }) {
  const [selections, setSelections] = useState<SelectionRecord[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<EntitySummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [copying, setCopying] = useState(false);

  async function reload() {
    const s = await getSelectionsForLead(leadId);
    setSelections(s);
    setActiveId((cur) => cur && s.some((x) => x.id === cur) ? cur : (s[0]?.id ?? null));
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const active = selections?.find((s) => s.id === activeId) ?? null;
  function run(fn: () => Promise<unknown>, ok?: string) {
    start(async () => {
      try { await fn(); await reload(); if (ok) toast.success(ok); }
      catch (e) { toast.error('Failed', { description: e instanceof Error ? e.message : String(e) }); }
    });
  }
  function newSelection() {
    start(async () => {
      try { const id = await createSelection(leadId); await reload(); setActiveId(id); toast.success('Draft selection created'); }
      catch (e) { toast.error('Failed', { description: e instanceof Error ? e.message : String(e) }); }
    });
  }
  async function search() {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try { setResults(await searchPropertiesForCuration(q.trim())); } finally { setSearching(false); }
  }
  async function copyCards() {
    if (!active?.items.length) { toast.error('Add properties first'); return; }
    setCopying(true);
    try {
      const ids = active.items.map((i) => i.propertyId);
      const n = await copySelectionToClipboard(() => buildEmailSelection({ ids, leadId }));
      toast.success(`${n} card${n === 1 ? '' : 's'} copied for email`, { description: 'Paste into your email client, then mark the selection sent.' });
    } catch (e) { toast.error('Copy failed', { description: e instanceof Error ? e.message : String(e) }); }
    finally { setCopying(false); }
  }

  const items: RankItem[] = (active?.items ?? []).map((i) => ({
    id: i.itemId, title: i.summary?.name ?? '(missing)',
    subtitle: `${i.summary?.area || i.summary?.location || ''}${i.summary?.source_id ? ` · ${i.summary.source_id}` : ''}`,
    price: i.summary?.price, price_on_request: i.summary?.price_on_request, image: i.summary?.hero_image,
  }));

  const teal = '#0f6c74';
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Email selections</span>
        <button onClick={newSelection} disabled={pending} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg text-white disabled:opacity-60" style={{ backgroundColor: teal }}>
          <FolderPlus className="w-3.5 h-3.5" />New selection
        </button>
      </div>

      {selections === null ? (
        <p className="text-xs text-gray-400 py-2 inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Loading…</p>
      ) : selections.length === 0 ? (
        <p className="text-xs text-gray-400 py-1">No selections yet — create a draft, add properties, copy the cards, then mark it sent.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            {selections.map((s) => (
              <button key={s.id} onClick={() => setActiveId(s.id)}
                className={cn('inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs border', activeId === s.id ? 'border-[#0f6c74] bg-[#0f6c74]/5' : 'border-gray-200 hover:bg-gray-50')}>
                {s.name} ({s.items.length})
                <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-semibold', STATUS_BADGE[s.status] ?? 'bg-gray-100 text-gray-600')}>{s.status}</span>
              </button>
            ))}
          </div>

          {active && (
            <div className="space-y-3">
              {/* search-add */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
                  placeholder="Add a property by reference, name or location…" className="w-full pl-8 pr-20 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-[#0f6c74] focus:ring-[#0f6c74]/20" />
                <button onClick={search} disabled={searching} className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-medium rounded-md text-white disabled:opacity-60" style={{ backgroundColor: teal }}>{searching ? '…' : 'Search'}</button>
              </div>
              {results.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {results.map((r) => (
                    <button key={r.id} onClick={() => { run(() => addSelectionItem(active.id, r.id)); setResults([]); setQ(''); }}
                      className="flex items-center gap-2 w-full p-2 hover:bg-gray-50 text-left text-sm">
                      <span className="flex-1 truncate">{r.name} <span className="text-gray-400">{r.area || r.location}{r.source_id ? ` · ${r.source_id}` : ''}</span></span>
                      <span className="text-xs text-gray-500">{formatPrice(r.price, r.price_on_request ?? false)}</span>
                      <Plus className="w-4 h-4 shrink-0" style={{ color: teal }} />
                    </button>
                  ))}
                </div>
              )}

              <DragRankList items={items} onReorder={(ids) => run(() => reorderSelection(ids))} onRemove={(itemId) => run(() => removeSelectionItem(itemId))} emptyText="No properties in this selection yet." />

              <div className="flex items-center gap-2 pt-1">
                <button onClick={copyCards} disabled={copying || !active.items.length} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-[#cbaa65] hover:bg-[#b3934f] text-white disabled:opacity-60">
                  <Mail className="w-4 h-4" />{copying ? 'Copying…' : 'Copy cards for email'}
                </button>
                {active.status !== 'sent' ? (
                  <button onClick={() => run(() => markSelectionSent(active.id), 'Marked sent')} disabled={pending || !active.items.length}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 disabled:opacity-60">
                    <Send className="w-4 h-4" />Mark sent
                  </button>
                ) : (
                  <span className="text-xs text-emerald-700">Sent{active.sentAt ? ` · ${active.sentAt.slice(0, 10)}` : ''}</span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
