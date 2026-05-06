import Link from 'next/link';
import { Plus, Edit2, Eye, EyeOff, Star, RefreshCw } from 'lucide-react';
import AdminHeader from '@/components/admin/AdminHeader';
import { getAllDevelopments } from '@/lib/actions/developments';
import { DEVELOPMENT_STATUS_LABELS, DEVELOPMENT_STATUS_COLORS } from '@/types/development';
import SyncResalesButton from './SyncResalesButton';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Developments | Admin' };

function formatPrice(n: number | null) {
  if (n === null) return '-';
  return `€${n.toLocaleString('en-GB')}`;
}

export default async function AdminDevelopmentsPage() {
  const items = await getAllDevelopments();

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">New Developments</h1>
            <p className="text-sm text-gray-500 mt-1">
              {items.length} development{items.length !== 1 ? 's' : ''} ·{' '}
              <span className="text-amber-700">Hidden from public site</span> until launch
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SyncResalesButton />
            <Link
              href="/admin/developments/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f6c74] text-white text-sm font-medium rounded-md hover:bg-[#0a4f55]"
            >
              <Plus className="w-4 h-4" /> New Development
            </Link>
          </div>
        </div>

        {/* Banner: pre-launch state */}
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900 flex items-start gap-3">
          <EyeOff className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <strong>Pre-launch:</strong> public routes for /new-developments are built but
            disallowed in robots.txt and excluded from the sitemap. No nav links point to them.
            Flip the feature flag in <code className="text-xs bg-amber-100 px-1 rounded">src/app/new-developments/page.tsx</code> to launch.
          </div>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-600 mb-4">No developments yet.</p>
            <Link
              href="/admin/developments/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f6c74] text-white text-sm font-medium rounded-md hover:bg-[#0a4f55]"
            >
              <Plus className="w-4 h-4" /> Create the first development
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Developer</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Price from</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Source</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Visible</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {d.is_featured && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{d.name}</div>
                          <div className="text-xs text-gray-500 truncate">/{d.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.developer ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${DEVELOPMENT_STATUS_COLORS[d.status]}`}>
                        {DEVELOPMENT_STATUS_LABELS[d.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {d.price_on_request ? 'On request' : formatPrice(d.price_from)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">
                      {d.source === 'manual' ? 'Manual' : 'Resales'}
                    </td>
                    <td className="px-4 py-3">
                      {d.published ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-50 rounded">
                          <Eye className="w-3 h-3" /> Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded">
                          <EyeOff className="w-3 h-3" /> Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/developments/${d.id}/edit`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
