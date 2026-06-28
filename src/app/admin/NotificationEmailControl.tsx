'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { setNotificationEmail } from '@/lib/actions/team';

export default function NotificationEmailControl({ current }: { current: string | null }) {
  const router = useRouter();
  const [val, setVal] = useState(current ?? '');
  const [pending, start] = useTransition();
  function save() {
    start(async () => {
      try { await setNotificationEmail(val); toast.success('Notification address saved'); router.refresh(); }
      catch (e) { toast.error('Failed', { description: e instanceof Error ? e.message : String(e) }); }
    });
  }
  return (
    <div className="flex gap-2">
      <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="admin@email.com"
        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-[#0f6c74] focus:ring-[#0f6c74]/20" />
      <button onClick={save} disabled={pending}
        className="px-3 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-60" style={{ backgroundColor: '#0f6c74' }}>Save</button>
    </div>
  );
}
