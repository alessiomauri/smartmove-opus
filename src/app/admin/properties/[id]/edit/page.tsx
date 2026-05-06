'use client';

import { use } from 'react';
import AdminHeader from '@/components/admin/AdminHeader';
import PropertyForm from '@/components/admin/PropertyForm';
import { useAdminProperty } from '@/hooks/useAdminProperty';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface EditPropertyPageProps {
  params: Promise<{ id: string }>;
}

export default function EditPropertyPage({ params }: EditPropertyPageProps) {
  const { id } = use(params);
  const { property, loading, updateProperty } = useAdminProperty(id);

  const handleSubmit = async (data: Parameters<typeof updateProperty>[0]) => {
    await updateProperty(data);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-[#0f6c74] border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-500 mt-4">Loading property...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Property Not Found
            </h1>
            <p className="text-gray-500 mb-8">
              The property you&apos;re trying to edit doesn&apos;t exist.
            </p>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#0f6c74] text-white rounded-lg font-medium hover:bg-[#0a4f55] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PropertyForm initialData={property} onSubmit={handleSubmit} isEditing />
      </main>
    </div>
  );
}
