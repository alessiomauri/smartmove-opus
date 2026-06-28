import AdminHeader from '@/components/admin/AdminHeader';
import { getListings, getListingsCounts } from '@/lib/actions/listings';
import PropertyAdminTable from '@/components/admin/PropertyAdminTable';
import type { InventoryParams } from '../inventory/types';

export const dynamic = 'force-dynamic';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params: InventoryParams = {
    page: one(sp.page),
    q: one(sp.q),
    status: one(sp.status),
    published: one(sp.published),
    featured: one(sp.featured),
    sort: one(sp.sort),
    dir: one(sp.dir),
  };
  const [inv, counts] = await Promise.all([getListings(params), getListingsCounts()]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PropertyAdminTable
          variant="listings"
          rows={inv.rows}
          total={inv.total}
          page={inv.page}
          pageSize={inv.pageSize}
          counts={counts}
          params={params}
        />
      </main>
    </div>
  );
}
