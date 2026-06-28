'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search, Plus, Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import DragRankList, { type RankItem } from '@/components/admin/DragRankList';
import { setPropertyFeatured } from '@/lib/actions/inventory';
import {
  getPropertyByRef, setFeaturedOrder, searchPropertiesForCuration,
  searchDevelopmentsForCuration, addCuratedItem, removeCuratedItem, reorderCuratedList,
} from '@/lib/actions/curation';
import type { EntitySummary, FeaturedItem, CuratedListData } from './types';

const TEAL = '#0f6c74';

export default function CurationClient({
  featured, propsList, devsList, exploreVillas, exploreDevs,
}: {
  featured: FeaturedItem[];
  propsList: CuratedListData;
  devsList: CuratedListData;
  exploreVillas: CuratedListData;
  exploreDevs: CuratedListData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<unknown>, ok: string) {
    startTransition(async () => {
      try { await fn(); router.refresh(); toast.success(ok); }
      catch (e) { toast.error('Failed', { description: e instanceof Error ? e.message : String(e) }); }
    });
  }

  const featuredItems: RankItem[] = featured.map((f) => ({
    id: f.id, title: f.name,
    subtitle: `${f.area || f.location || ''}${f.source_id ? ` · ${f.source_id}` : ''}`,
    price: f.price, price_on_request: f.price_on_request, image: f.hero_image,
  }));

  const listItems = (l: CuratedListData): RankItem[] => l.items.map((it) => ({
    id: it.itemId,
    title: it.summary?.name ?? '(missing entity)',
    subtitle: `${it.summary?.area || it.summary?.location || ''}${it.summary?.source_id ? ` · ${it.summary.source_id}` : ''}`,
    price: it.summary?.price, price_on_request: it.summary?.price_on_request, image: it.summary?.hero_image,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Featured &amp; Top-20</h1>
          <p className="text-gray-500">Curated surfaces — the only listings that reach the homepage and Top-20 pages.</p>
        </div>
        {isPending && <span className="inline-flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" />Saving…</span>}
      </div>

      {/* ---- Featured "this week" (homepage order) ---- */}
      <Section title="Featured this week" subtitle="Drag to set the homepage order. The first card becomes the hero.">
        <FeaturedByRef onFeature={(id) => run(() => setPropertyFeatured(id, true), 'Featured & added')} />
        <div className="mt-4">
          <DragRankList
            items={featuredItems}
            onReorder={(ids) => run(() => setFeaturedOrder(ids), 'Order saved')}
            onRemove={(id) => run(() => setPropertyFeatured(id, false), 'Unfeatured')}
            emptyText="No featured listings yet — add one by reference above."
          />
        </div>
      </Section>

      {/* ---- Top-20 Investment Properties ---- */}
      <Section title={propsList.title} subtitle="Ordered, admin-managed list. Drag to rank.">
        <SearchAdd
          placeholder="Search a property by reference, name or location…"
          onSearch={searchPropertiesForCuration}
          onPick={(id) => run(() => addCuratedItem(propsList.slug, id), 'Added to list')}
        />
        <div className="mt-4">
          <DragRankList
            items={listItems(propsList)}
            onReorder={(ids) => run(() => reorderCuratedList(ids), 'Order saved')}
            onRemove={(itemId) => run(() => removeCuratedItem(itemId), 'Removed')}
            emptyText="No properties in this list yet."
          />
        </div>
      </Section>

      {/* ---- Top-20 Investment Developments ---- */}
      <Section title={devsList.title} subtitle="Ordered, admin-managed list. Drag to rank.">
        <SearchAdd
          placeholder="Search a development by reference or name…"
          onSearch={searchDevelopmentsForCuration}
          onPick={(id) => run(() => addCuratedItem(devsList.slug, id), 'Added to list')}
        />
        <div className="mt-4">
          <DragRankList
            items={listItems(devsList)}
            onReorder={(ids) => run(() => reorderCuratedList(ids), 'Order saved')}
            onRemove={(itemId) => run(() => removeCuratedItem(itemId), 'Removed')}
            emptyText="No developments in this list yet."
          />
        </div>
      </Section>

      {/* ---- Homepage Explore — Villas (the homepage villa card; rotates daily) ---- */}
      <Section title={exploreVillas.title} subtitle="The villa card in the homepage Explore section. Add one or more — with several, the homepage rotates daily (server day). Unpublished picks are skipped; with none, the card hides.">
        <SearchAdd
          placeholder="Search a property by reference, name or location…"
          onSearch={searchPropertiesForCuration}
          onPick={(id) => run(() => addCuratedItem(exploreVillas.slug, id), 'Added to homepage villa picks')}
        />
        <div className="mt-4">
          <DragRankList
            items={listItems(exploreVillas)}
            onReorder={(ids) => run(() => reorderCuratedList(ids), 'Order saved')}
            onRemove={(itemId) => run(() => removeCuratedItem(itemId), 'Removed')}
            emptyText="No villa picks yet — the homepage villa card stays hidden until you add one."
          />
        </div>
      </Section>

      {/* ---- Homepage Explore — Developments (the homepage development card) ---- */}
      <Section title={exploreDevs.title} subtitle="The development card in the homepage Explore section. Same rules — add one or more; rotates daily; skips unpublished; hides if none.">
        <SearchAdd
          placeholder="Search a development by reference or name…"
          onSearch={searchDevelopmentsForCuration}
          onPick={(id) => run(() => addCuratedItem(exploreDevs.slug, id), 'Added to homepage development picks')}
        />
        <div className="mt-4">
          <DragRankList
            items={listItems(exploreDevs)}
            onReorder={(ids) => run(() => reorderCuratedList(ids), 'Order saved')}
            onRemove={(itemId) => run(() => removeCuratedItem(itemId), 'Removed')}
            emptyText="No development picks yet — the homepage development card stays hidden until you add one."
          />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mb-4">{subtitle}</p>}
      {children}
    </section>
  );
}

function FeaturedByRef({ onFeature }: { onFeature: (id: string) => void }) {
  const [ref, setRef] = useState('');
  const [preview, setPreview] = useState<EntitySummary | null>(null);
  const [looking, setLooking] = useState(false);
  async function lookup() {
    if (!ref.trim()) return;
    setLooking(true); setPreview(null);
    try {
      const p = await getPropertyByRef(ref.trim());
      if (!p) toast.error('No property found for that reference');
      else setPreview(p);
    } finally { setLooking(false); }
  }
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Feature by Resales reference</p>
      <div className="flex gap-2">
        <input value={ref} onChange={(e) => setRef(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && lookup()}
          placeholder="e.g. R5400337" className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-[#0f6c74] focus:ring-[#0f6c74]/20" />
        <button onClick={lookup} disabled={looking} className="px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-60" style={{ backgroundColor: TEAL }}>
          {looking ? 'Looking…' : 'Look up'}
        </button>
      </div>
      {preview && (
        <div className="mt-3 flex items-center gap-3 bg-gray-50 rounded-lg p-3">
          <div className="relative w-16 h-12 rounded overflow-hidden bg-gray-100 shrink-0">
            {preview.hero_image && <Image src={preview.hero_image} alt="" fill className="object-cover" sizes="64px" unoptimized />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{preview.name}</p>
            <p className="text-xs text-gray-500 truncate">
              {preview.area || preview.location} · {preview.source_id} · {formatPrice(preview.price, preview.price_on_request ?? false)}
              {preview.is_featured && <span className="ml-2 text-amber-600">already featured</span>}
              {preview.published === false && <span className="ml-2 text-gray-400">(unpublished)</span>}
            </p>
          </div>
          <button onClick={() => { onFeature(preview.id); setPreview(null); setRef(''); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white">
            <Star className="w-4 h-4" /> Feature
          </button>
        </div>
      )}
    </div>
  );
}

function SearchAdd({ placeholder, onSearch, onPick }: {
  placeholder: string;
  onSearch: (q: string) => Promise<EntitySummary[]>;
  onPick: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<EntitySummary[]>([]);
  const [busy, setBusy] = useState(false);
  async function search() {
    if (!q.trim()) { setResults([]); return; }
    setBusy(true);
    try { setResults(await onSearch(q.trim())); } finally { setBusy(false); }
  }
  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder={placeholder} className="w-full pl-9 pr-24 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-[#0f6c74] focus:ring-[#0f6c74]/20" />
        <button onClick={search} disabled={busy} className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-medium rounded-md text-white disabled:opacity-60" style={{ backgroundColor: TEAL }}>
          {busy ? '…' : 'Search'}
        </button>
      </div>
      {results.length > 0 && (
        <div className="mt-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
          {results.map((r) => (
            <button key={r.id} onClick={() => { onPick(r.id); setResults([]); setQ(''); }}
              className="flex items-center gap-3 w-full p-2.5 hover:bg-gray-50 text-left">
              <div className="relative w-12 h-9 rounded overflow-hidden bg-gray-100 shrink-0">
                {r.hero_image && <Image src={r.hero_image} alt="" fill className="object-cover" sizes="48px" unoptimized />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                <p className="text-xs text-gray-500 truncate">{r.area || r.location}{r.source_id ? ` · ${r.source_id}` : ''}</p>
              </div>
              <span className="text-xs text-gray-500 hidden sm:block">{formatPrice(r.price, r.price_on_request ?? false)}</span>
              <Plus className="w-4 h-4 shrink-0" style={{ color: TEAL }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
