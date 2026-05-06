'use client';

import AdminHeader from '@/components/admin/AdminHeader';
import PropertyForm from '@/components/admin/PropertyForm';
import { Property } from '@/types/property';
import { createProperty } from '@/lib/actions/properties';

export default function NewPropertyPage() {
  const handleSubmit = async (data: Partial<Property>) => {
    await createProperty(data);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PropertyForm onSubmit={handleSubmit} />
      </main>
    </div>
  );
}
