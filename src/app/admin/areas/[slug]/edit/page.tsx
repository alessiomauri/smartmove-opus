import { notFound } from 'next/navigation';
import AdminHeader from '@/components/admin/AdminHeader';
import AreaForm from '@/components/admin/AreaForm';
import { getAreaBySlug, getAllAreas } from '@/lib/actions/areas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit Area | Admin' };

export default async function EditAreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [area, allAreas] = await Promise.all([
    getAreaBySlug(slug),
    getAllAreas(),
  ]);

  if (!area) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Edit: {area.name}</h1>
        <AreaForm area={area} allAreas={allAreas} />
      </div>
    </div>
  );
}
