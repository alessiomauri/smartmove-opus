'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { setDefaultSort } from '@/lib/actions/team';

const LABELS: Record<string, string> = {
  newest: 'Newest first',
  price_desc: 'Price: high → low',
  price_asc: 'Price: low → high',
  name: 'Name A–Z',
};

export default function DefaultSortControl({ current }: { current: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function change(v: string) {
    start(async () => {
      try { await setDefaultSort(v); toast.success('Public default sort updated'); router.refresh(); }
      catch (e) { toast.error('Failed', { description: e instanceof Error ? e.message : String(e) }); }
    });
  }
  return (
    <select value={current} disabled={pending} onChange={(e) => change(e.target.value)}
      className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:border-[#0f6c74] focus:ring-[#0f6c74]/20">
      {Object.entries(LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
