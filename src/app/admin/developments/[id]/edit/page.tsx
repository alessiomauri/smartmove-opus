import { notFound } from 'next/navigation';
import AdminHeader from '@/components/admin/AdminHeader';
import { getDevelopmentById } from '@/lib/actions/developments';
import EditDevelopmentClient from './EditDevelopmentClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditDevelopmentPage({ params }: Props) {
  const { id } = await params;
  const development = await getDevelopmentById(id);
  if (!development) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <EditDevelopmentClient development={development} />
      </main>
    </div>
  );
}
