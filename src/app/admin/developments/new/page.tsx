'use client';

import AdminHeader from '@/components/admin/AdminHeader';
import DevelopmentForm from '@/components/admin/DevelopmentForm';
import { createDevelopment } from '@/lib/actions/developments';
import { DevelopmentInput } from '@/types/development';

export default function NewDevelopmentPage() {
  const handleSubmit = async (input: DevelopmentInput) => {
    const created = await createDevelopment(input);
    return { id: created.id, slug: created.slug };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DevelopmentForm onSubmit={handleSubmit} />
      </main>
    </div>
  );
}
