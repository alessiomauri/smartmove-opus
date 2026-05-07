import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

/**
 * Quick link from the developments admin list to the dedicated Resales
 * sync dashboard. The dashboard owns the three sync modes (samples,
 * live, single-reference) and the run history.
 */
export default function SyncResalesButton() {
  return (
    <Link
      href="/admin/resales"
      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md"
      title="Open the Resales sync dashboard"
    >
      <RefreshCw className="w-4 h-4" />
      Resales sync
    </Link>
  );
}
