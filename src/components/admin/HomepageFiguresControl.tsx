'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { setHomepageStats } from '@/lib/actions/home-stats';
import type { HomepageStats } from '@/lib/home-stats';

const FIELDS: { key: keyof HomepageStats; label: string; placeholder: string; hint: string }[] = [
  { key: 'soldVolume', label: 'Sold volume', placeholder: 'e.g. €820M+', hint: 'Sell badge — "… placed across the coast"' },
  { key: 'rating', label: 'Average rating', placeholder: 'e.g. 4.9', hint: 'Shown as "x / 5" with stars' },
  { key: 'reviewsCount', label: 'Reviews count', placeholder: 'e.g. 210+', hint: '"… verified buyer reviews"' },
  { key: 'quizStarts', label: 'Quiz starts (this year)', placeholder: 'e.g. 2,000+', hint: '"… buyers started here this year"' },
  { key: 'foundedYear', label: 'Founded year', placeholder: 'e.g. 2009', hint: 'Drives "Est. 2009" + "N years" (auto)' },
];

const input = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-[#0f6c74] focus:ring-[#0f6c74]/20';

export default function HomepageFiguresControl({ current }: { current: HomepageStats }) {
  const router = useRouter();
  const [v, setV] = useState<HomepageStats>({
    soldVolume: current.soldVolume ?? '', rating: current.rating ?? '', reviewsCount: current.reviewsCount ?? '',
    quizStarts: current.quizStarts ?? '', foundedYear: current.foundedYear ?? '',
  });
  const [pending, start] = useTransition();
  const set = (k: keyof HomepageStats, val: string) => setV((p) => ({ ...p, [k]: val }));

  function save() {
    start(async () => {
      try { await setHomepageStats(v); toast.success('Homepage figures saved'); router.refresh(); }
      catch (e) { toast.error('Failed', { description: e instanceof Error ? e.message : String(e) }); }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Leave a field <strong>blank</strong> to hide that figure on the homepage — nothing fake is shown. One source of truth per number.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">{f.label}</span>
            <input className={input} value={v[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
            <span className="block text-[11px] text-gray-400 mt-1">{f.hint}</span>
          </label>
        ))}
      </div>
      <button onClick={save} disabled={pending} className="px-3 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-60" style={{ backgroundColor: '#0f6c74' }}>
        {pending ? 'Saving…' : 'Save homepage figures'}
      </button>
    </div>
  );
}
