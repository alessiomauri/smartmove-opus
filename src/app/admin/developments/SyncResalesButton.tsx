'use client';

import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

// Placeholder until the full Resales sync admin UI lands at /admin/resales
// (Phase 4 — see SMARTMOVE_BRIEF §4.1 for the three-mode sync architecture:
// nightly cron + manual "sync now" + single-reference + approval workflow).
export default function SyncResalesButton() {
  const handleClick = () => {
    toast.message('Resales sync coming soon', {
      description:
        'The Resales sync dashboard at /admin/resales is being built. ' +
        'It will support nightly cron, manual sync, single-reference sync, ' +
        'and an approval workflow for MLS-sourced properties.',
      duration: 8000,
    });
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md"
      title="Resales sync (coming in Phase 4)"
    >
      <RefreshCw className="w-4 h-4" />
      Sync from Resales
    </button>
  );
}
