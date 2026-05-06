import Link from 'next/link';
import { Edit2, Eye, EyeOff, MapPin } from 'lucide-react';
import AdminHeader from '@/components/admin/AdminHeader';
import { getAllAreas } from '@/lib/actions/areas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Areas | Admin' };

export default async function AdminAreasPage() {
  const areas = await getAllAreas();

  // Group by region
  const byRegion: Record<string, typeof areas> = {};
  for (const a of areas) {
    if (!byRegion[a.region]) byRegion[a.region] = [];
    byRegion[a.region].push(a);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Areas</h1>
            <p className="text-sm text-gray-500 mt-1">
              {areas.length} area{areas.length !== 1 ? 's' : ''} · {areas.filter(a => !a.is_micro_location).length} main, {areas.filter(a => a.is_micro_location).length} micro
            </p>
          </div>
          <Link
            href="/admin/seed"
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Seed data
          </Link>
        </div>

        {areas.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-600 mb-4">No areas yet.</p>
            <Link href="/admin/seed" className="text-sm text-[#0f6c74] underline">
              Seed from static data →
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(byRegion).map(([region, regionAreas]) => (
              <div key={region} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{region}</h2>
                </div>
                <table className="w-full">
                  <tbody className="divide-y divide-gray-100">
                    {regionAreas.map(a => (
                      <tr key={a.slug} className="hover:bg-gray-50">
                        <td className="px-4 py-3 w-1/2">
                          <div className="flex items-center gap-2">
                            <MapPin className={`w-3.5 h-3.5 shrink-0 ${a.is_micro_location ? 'text-gray-400' : 'text-[#0f6c74]'}`} />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {a.name}
                                {a.is_micro_location && a.parent_area && (
                                  <span className="ml-2 text-xs text-gray-400 font-normal">
                                    → {a.parent_area}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 truncate">/{a.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-[240px]">
                          {a.price_range || <span className="text-gray-300">no price range</span>}
                        </td>
                        <td className="px-4 py-3">
                          {a.hero_image ? (
                            <span className="text-xs text-green-600">has image</span>
                          ) : (
                            <span className="text-xs text-amber-600">no image</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {a.published ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-50 rounded">
                              <Eye className="w-3 h-3" /> Live
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded">
                              <EyeOff className="w-3 h-3" /> Draft
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/admin/areas/${a.slug}/edit`}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
