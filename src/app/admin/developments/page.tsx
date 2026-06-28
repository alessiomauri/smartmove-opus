import Link from 'next/link';
import { Plus, Edit2, Eye, EyeOff, Star, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import AdminHeader from '@/components/admin/AdminHeader';
import { getDevelopmentsPage } from '@/lib/actions/developments';
import { DEVELOPMENT_STATUS_LABELS, DEVELOPMENT_STATUS_COLORS } from '@/types/development';
import SyncResalesButton from './SyncResalesButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Developments | Admin' };

function formatPrice(n: number | null) {
  if (n === null) return '-';
  return `€${n.toLocaleString('en-GB')}`;
}
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminDevelopmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = one(sp.q) ?? '';
  const { rows, total, page, pageSize } = await getDevelopmentsPage({ page: one(sp.page), q });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const qs = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString()}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">New Developments</h1>
            <p className="text-sm text-gray-500 mt-1">
              {total.toLocaleString()} development{total !== 1 ? 's' : ''} ·{' '}
              <span className="text-amber-700">Hidden from public site</span> until launch
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SyncResalesButton />
            <Link href="/admin/developments/new" className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f6c74] text-white text-sm font-medium rounded-md hover:bg-[#0a4f55]">
              <Plus className="w-4 h-4" /> New Development
            </Link>
          </div>
        </div>

        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900 flex items-start gap-3">
          <EyeOff className="w-4 h-4 mt-0.5 shrink-0" />
          <div><strong>Pre-launch:</strong> /new-developments routes are built but excluded from robots/sitemap until the feature flag launches. Server-paginated (50/page).</div>
        </div>

        {/* Search (server-rendered GET) */}
        <form method="get" className="mb-4 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input name="q" defaultValue={q} placeholder="Search name, area, or reference…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-[#0f6c74] focus:ring-[#0f6c74]/20" />
        </form>

        {rows.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-600">No developments match.</div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Name', 'Developer', 'Status', 'Price from', 'Source', 'Visible'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {d.is_featured && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                        <div className="min-w-0"><div className="text-sm font-medium text-gray-900 truncate">{d.name}</div><div className="text-xs text-gray-500 truncate">/{d.slug}</div></div>
                      </div>
                    </td>
                    {/* Developer credit is admin-internal only (never public). */}
                    <td className="px-4 py-3 text-sm text-gray-600">{d.developer ?? '-'}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${DEVELOPMENT_STATUS_COLORS[d.status]}`}>{DEVELOPMENT_STATUS_LABELS[d.status]}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.price_on_request ? 'On request' : formatPrice(d.price_from)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">{d.source === 'manual' ? 'Manual' : 'Resales'}</td>
                    <td className="px-4 py-3">{d.published
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-50 rounded"><Eye className="w-3 h-3" /> Published</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded"><EyeOff className="w-3 h-3" /> Draft</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/developments/${d.id}/edit`} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded"><Edit2 className="w-3 h-3" /> Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>{total === 0 ? 'No results' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total.toLocaleString()}`}</span>
          <div className="flex items-center gap-2">
            {page > 1
              ? <Link href={qs(page - 1)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg bg-white hover:bg-gray-50"><ChevronLeft className="w-4 h-4" />Prev</Link>
              : <span className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg bg-white opacity-40"><ChevronLeft className="w-4 h-4" />Prev</span>}
            <span className="px-2">Page {page} / {pageCount}</span>
            {page < pageCount
              ? <Link href={qs(page + 1)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg bg-white hover:bg-gray-50">Next<ChevronRight className="w-4 h-4" /></Link>
              : <span className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg bg-white opacity-40">Next<ChevronRight className="w-4 h-4" /></span>}
          </div>
        </div>
      </div>
    </div>
  );
}
