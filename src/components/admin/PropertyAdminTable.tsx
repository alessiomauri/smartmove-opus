'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search, Star, Eye, EyeOff, Check, X, Edit2, ExternalLink, Trash2, Mail,
  ChevronLeft, ChevronRight, ArrowUpDown, TrendingDown, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatPrice } from '@/lib/utils';
import { STATUS_LABELS, STATUS_COLORS, PROPERTY_TYPE_LABELS } from '@/types/property';
import {
  approveProperty, rejectProperty, setPropertyPublished,
  setPropertyFeatured, setPropertyHidePriceDrop, bulkInventoryAction,
} from '@/lib/actions/inventory';
import { deleteProperty } from '@/lib/actions/properties';
import { buildEmailSelection } from '@/lib/actions/leads';
import { copySelectionToClipboard } from '@/components/admin/copy-email-selection';
import type { InventoryRow, InventoryParams, BulkAction } from '@/app/admin/inventory/types';

type Variant = 'inventory' | 'listings';
type Counts = { total: number; published: number; sold: number; pendingReview?: number; featured?: number };

type Props = {
  variant: Variant;
  rows: InventoryRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: Counts;
  params: InventoryParams;
};

const TEAL = '#0f6c74';

export default function PropertyAdminTable({ variant, rows, total, page, pageSize, counts, params }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const isInventory = variant === 'inventory';
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(params.q ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copying, setCopying] = useState(false);

  // Copy-for-email — reuses the Prompt 2 machinery (buildEmailSelection +
  // copySelectionToClipboard); no email rendering re-implemented here.
  async function copyForEmail(ids: string[]) {
    if (!ids.length) return;
    setCopying(true);
    try {
      const n = await copySelectionToClipboard(() => buildEmailSelection({ ids }));
      toast.success(`${n} card${n === 1 ? '' : 's'} copied for email`, { description: 'Paste into your email client — links carry tracking.' });
      setSelected(new Set());
    } catch (e) { toast.error('Copy failed', { description: e instanceof Error ? e.message : String(e) }); }
    finally { setCopying(false); }
  }

  function setParams(patch: Partial<InventoryParams>, resetPage = true) {
    const merged: InventoryParams = { ...params, ...patch };
    if (resetPage && !('page' in patch)) merged.page = undefined;
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (!v || v === 'all') continue;
      if (k === 'page' && v === '1') continue;
      sp.set(k, String(v));
    }
    const qs = sp.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  useEffect(() => {
    if (q === (params.q ?? '')) return;
    const t = setTimeout(() => setParams({ q: q || undefined }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function act(fn: () => Promise<unknown>, ok: string) {
    startTransition(async () => {
      try { await fn(); router.refresh(); toast.success(ok); }
      catch (e) { toast.error('Action failed', { description: e instanceof Error ? e.message : String(e) }); }
    });
  }
  function bulk(action: BulkAction, label: string) {
    const ids = [...selected];
    if (!ids.length) return;
    if (action === 'reject' && !confirm(`Reject ${ids.length} listing(s)? They will be unpublished and skipped by future syncs.`)) return;
    startTransition(async () => {
      try {
        const r = await bulkInventoryAction(ids, action);
        setSelected(new Set());
        router.refresh();
        toast.success(`${label} ${r.count} listing${r.count === 1 ? '' : 's'}`);
      } catch (e) { toast.error('Bulk action failed', { description: e instanceof Error ? e.message : String(e) }); }
    });
  }

  const sort = params.sort ?? 'created_at';
  const dir = params.dir ?? 'desc';
  function toggleSort(col: 'name' | 'price' | 'created_at') {
    if (sort === col) setParams({ sort: col, dir: dir === 'asc' ? 'desc' : 'asc' });
    else setParams({ sort: col, dir: col === 'name' ? 'asc' : 'desc' });
  }
  const sortIcon = (col: string) => sort === col && <ArrowUpDown className="w-3 h-3" style={{ color: TEAL }} />;

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const fromRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRow = Math.min(page * pageSize, total);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  function toggleAll() {
    setSelected((prev) => {
      if (allSelected) { const n = new Set(prev); rows.forEach((r) => n.delete(r.id)); return n; }
      const n = new Set(prev); rows.forEach((r) => n.add(r.id)); return n;
    });
  }
  function toggleOne(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const selectClass = 'px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:border-[#0f6c74] focus:ring-[#0f6c74]/20';

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isInventory ? 'Resales Inventory' : 'Own Listings'}</h1>
          <p className="text-gray-500">
            {isInventory ? 'Synced MLS listings — review, publish, feature. Server-paginated.' : 'Manually-entered agency stock — fully editable. Server-paginated.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isPending && <span className="inline-flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" />Updating…</span>}
          {!isInventory && (
            <Link href="/admin/properties/new" className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium" style={{ backgroundColor: TEAL }}>Add Listing</Link>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={counts.total} />
        {isInventory ? (
          <button
            onClick={() => setParams({ review: params.review === 'pending' ? undefined : 'pending' })}
            className={cn('text-left bg-white rounded-xl border p-4 transition-colors', params.review === 'pending' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-gray-200 hover:border-amber-300')}>
            <p className="text-sm text-gray-500 flex items-center gap-1.5">
              Pending review
              {(counts.pendingReview ?? 0) > 0 && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[11px] font-bold text-white bg-amber-500 rounded-full">{counts.pendingReview}</span>
              )}
            </p>
            <p className="text-2xl font-bold text-gray-900">{(counts.pendingReview ?? 0).toLocaleString()}</p>
          </button>
        ) : (
          <StatCard label="Featured" value={counts.featured ?? 0} />
        )}
        <StatCard label="Published" value={counts.published} />
        <StatCard label="Sold" value={counts.sold} />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Search reference, name, or location…" value={q} onChange={(e) => setQ(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-[#0f6c74] focus:ring-[#0f6c74]/20" />
          </div>
          <select value={params.status ?? 'all'} onChange={(e) => setParams({ status: e.target.value })} className={selectClass}>
            <option value="all">All status</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={params.published ?? 'all'} onChange={(e) => setParams({ published: e.target.value })} className={selectClass}>
            <option value="all">All visibility</option>
            <option value="published">Published</option>
            <option value="draft">Hidden / draft</option>
          </select>
          {isInventory && (
            <select value={params.review ?? 'all'} onChange={(e) => setParams({ review: e.target.value })} className={selectClass}>
              <option value="all">All review states</option>
              <option value="pending">Pending review</option>
              <option value="rejected">Rejected</option>
            </select>
          )}
          <select value={params.featured ?? 'all'} onChange={(e) => setParams({ featured: e.target.value })} className={selectClass}>
            <option value="all">Featured: any</option>
            <option value="featured">Featured only</option>
            <option value="not">Not featured</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className={cn('bg-white rounded-xl border border-gray-200 overflow-hidden transition-opacity', isPending && 'opacity-60')}>
        {rows.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No listings match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" aria-label="Select page" checked={allSelected} onChange={toggleAll} className="accent-[#cbaa65] w-4 h-4 cursor-pointer" />
                  </th>
                  <Th onClick={() => toggleSort('name')}>Property {sortIcon('name')}</Th>
                  <Th>Type</Th>
                  <Th onClick={() => toggleSort('price')}>Price {sortIcon('price')}</Th>
                  <Th>Status</Th>
                  {isInventory && <Th>Review</Th>}
                  <Th center>Featured</Th>
                  <Th>Visibility</Th>
                  <Th onClick={() => toggleSort('created_at')}>Added {sortIcon('created_at')}</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((r) => (
                  <tr key={r.id} className={cn('hover:bg-gray-50', selected.has(r.id) && 'bg-amber-50/60')}>
                    <td className="px-4 py-3 w-10">
                      <input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} className="accent-[#cbaa65] w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-14 h-11 rounded-md overflow-hidden bg-gray-100 shrink-0">
                          {r.hero_image && <Image src={r.hero_image} alt="" fill className="object-cover" sizes="56px" unoptimized />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate max-w-[220px]">{r.name}</p>
                          <p className="text-xs text-gray-500 truncate max-w-[220px]">{r.location || r.area || '—'}{r.source_id ? ` · ${r.source_id}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{PROPERTY_TYPE_LABELS[r.property_type] ?? r.property_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatPrice(r.price, r.price_on_request)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn('px-2.5 py-0.5 text-xs font-medium text-white rounded-full', STATUS_COLORS[r.status])}>{STATUS_LABELS[r.status]}</span>
                    </td>
                    {isInventory && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.rejected ? <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">Rejected</span>
                          : r.pending_review ? <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Pending</span>
                          : <span className="text-xs text-gray-400">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => act(() => setPropertyFeatured(r.id, !r.is_featured), r.is_featured ? 'Unfeatured' : 'Featured — now on the homepage')}
                        className={cn('p-1.5 rounded-lg transition-all', r.is_featured ? 'text-amber-500 hover:bg-amber-50' : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50/50')}
                        title={r.is_featured ? 'Remove from featured' : 'Feature on curated surfaces'}>
                        <Star className={cn('w-4 h-4', r.is_featured && 'fill-amber-500')} />
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button onClick={() => act(() => setPropertyPublished(r.id, !r.published), r.published ? 'Hidden' : 'Published')}
                        className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-colors',
                          r.published ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                        {r.published ? <><Eye className="w-3.5 h-3.5" />Published</> : <><EyeOff className="w-3.5 h-3.5" />Hidden</>}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{r.created_at?.slice(0, 10)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isInventory && r.pending_review && !r.rejected && (
                          <button onClick={() => act(() => approveProperty(r.id), 'Approved & published')} title="Approve & publish" className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50"><Check className="w-4 h-4" /></button>
                        )}
                        {isInventory && !r.rejected && (
                          <button onClick={() => { if (confirm('Reject this listing? It will be unpublished and skipped by future syncs.')) act(() => rejectProperty(r.id), 'Rejected'); }} title="Reject" className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><X className="w-4 h-4" /></button>
                        )}
                        {isInventory && (
                          <button onClick={() => act(() => setPropertyHidePriceDrop(r.id, !r.hide_price_drop), r.hide_price_drop ? 'Price-drop badge re-enabled' : 'Price-drop badge hidden')} title={r.hide_price_drop ? 'Price-drop badge hidden — click to show' : 'Hide price-drop badge'} className={cn('p-2 rounded-lg hover:bg-gray-100', r.hide_price_drop ? 'text-gray-300' : 'text-gray-500')}><TrendingDown className="w-4 h-4" /></button>
                        )}
                        <Link href={`/admin/properties/${r.id}/edit`} title="Edit" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><Edit2 className="w-4 h-4" /></Link>
                        <Link href={`/property/${r.slug}`} target="_blank" title="View" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><ExternalLink className="w-4 h-4" /></Link>
                        <button onClick={() => copyForEmail([r.id])} disabled={copying} title="Copy card for email" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"><Mail className="w-4 h-4" /></button>
                        {!isInventory && (
                          <button onClick={() => { if (confirm(`Delete "${r.name}"? This cannot be undone.`)) act(() => deleteProperty(r.id), 'Deleted'); }} title="Delete" className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
        <span>{total === 0 ? 'No results' : `${fromRow.toLocaleString()}–${toRow.toLocaleString()} of ${total.toLocaleString()}`}</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) }, false)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg bg-white disabled:opacity-40 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" />Prev</button>
          <span className="px-2">Page {page} / {pageCount}</span>
          <button disabled={page >= pageCount} onClick={() => setParams({ page: String(page + 1) }, false)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg bg-white disabled:opacity-40 hover:bg-gray-50">Next<ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gray-900 text-white rounded-full pl-5 pr-2 py-2 shadow-2xl">
          <span className="text-sm whitespace-nowrap">{selected.size} selected</span>
          {isInventory && <BulkBtn onClick={() => bulk('approve', 'Approved')}>Approve</BulkBtn>}
          <BulkBtn onClick={() => bulk('publish', 'Published')}>Publish</BulkBtn>
          <BulkBtn onClick={() => bulk('hide', 'Hid')}>Hide</BulkBtn>
          <BulkBtn onClick={() => bulk('feature', 'Featured')}>Feature</BulkBtn>
          <BulkBtn onClick={() => bulk('unfeature', 'Unfeatured')}>Unfeature</BulkBtn>
          {isInventory && <BulkBtn danger onClick={() => bulk('reject', 'Rejected')}>Reject</BulkBtn>}
          <button onClick={() => copyForEmail([...selected])} disabled={copying} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold bg-[#cbaa65] hover:bg-[#b3934f] text-white disabled:opacity-60">
            <Mail className="w-4 h-4" />{copying ? 'Copying…' : 'Copy for email'}
          </button>
          <button onClick={() => setSelected(new Set())} className="px-3 py-2 text-sm text-white/70 hover:text-white">Clear</button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
    </div>
  );
}

function Th({ children, onClick, center, right }: { children: ReactNode; onClick?: () => void; center?: boolean; right?: boolean }) {
  return (
    <th onClick={onClick}
      className={cn('text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 select-none',
        center ? 'text-center' : right ? 'text-right' : 'text-left', onClick && 'cursor-pointer hover:text-gray-700')}>
      <span className={cn('inline-flex items-center gap-1', center && 'justify-center', right && 'justify-end')}>{children}</span>
    </th>
  );
}

function BulkBtn({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn('px-3 py-2 rounded-full text-sm font-medium transition-colors', danger ? 'bg-red-500/90 hover:bg-red-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white')}>{children}</button>
  );
}
