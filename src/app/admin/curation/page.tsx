import AdminHeader from '@/components/admin/AdminHeader';
import { getFeaturedProperties, getCuratedList } from '@/lib/actions/curation';
import CurationClient from './CurationClient';

export const dynamic = 'force-dynamic';

export default async function CurationPage() {
  const [featured, propsList, devsList] = await Promise.all([
    getFeaturedProperties(),
    getCuratedList('top-20-investment-properties'),
    getCuratedList('top-20-investment-developments'),
  ]);
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CurationClient featured={featured} propsList={propsList} devsList={devsList} />
      </main>
    </div>
  );
}
