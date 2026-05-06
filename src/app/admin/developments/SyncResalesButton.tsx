'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { syncDevelopmentsFromResales } from '@/lib/integrations/resales';

export default function SyncResalesButton() {
  const [running, setRunning] = useState(false);

  const handleSync = async () => {
    setRunning(true);
    try {
      const result = await syncDevelopmentsFromResales();
      toast.success(result.message);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sync failed';
      // The stub throws a long instructional message — show a digestible toast
      toast.message('Resales Online not configured', { description: msg, duration: 10000 });
    } finally {
      setRunning(false);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={running}
      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md disabled:opacity-50"
      title="Pull new developments from Resales Online (currently stubbed, needs API credentials)"
    >
      <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
      Sync from Resales
    </button>
  );
}
