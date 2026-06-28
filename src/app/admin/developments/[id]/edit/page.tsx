import { notFound } from 'next/navigation';
import AdminHeader from '@/components/admin/AdminHeader';
import { getDevelopmentById } from '@/lib/actions/developments';
import EditDevelopmentClient from './EditDevelopmentClient';
import DevOverridesEditor from './DevOverridesEditor';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditDevelopmentPage({ params }: Props) {
  const { id } = await params;
  const development = await getDevelopmentById(id);
  if (!development) notFound();

  // Synced (MLS) developments are edited as OVERRIDES the sync never
  // clobbers; manual stock stays fully editable on its own columns.
  const isSynced = (development as { source?: string }).source === 'resales_online';

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isSynced
          ? <DevOverridesEditor development={development as unknown as Record<string, unknown>} />
          : <EditDevelopmentClient development={development} />}
      </main>
    </div>
  );
}
