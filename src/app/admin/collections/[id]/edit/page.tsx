'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AdminHeader from '@/components/admin/AdminHeader';
import CollectionForm from '@/components/admin/CollectionForm';
import { useAdminCollection } from '@/hooks/useAdminCollection';

interface EditCollectionPageProps {
  params: Promise<{ id: string }>;
}

export default function EditCollectionPage({ params }: EditCollectionPageProps) {
  const { id } = use(params);
  const { collection, loading } = useAdminCollection(id);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-[#0f6c74] border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-500 mt-4">Loading collection...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Collection Not Found
            </h1>
            <p className="text-gray-500 mb-8">
              The collection you&apos;re trying to edit doesn&apos;t exist.
            </p>
            <Link
              href="/admin/collections"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#0f6c74] text-white rounded-lg font-medium hover:bg-[#0a4f55] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Collections
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return <CollectionForm collection={collection} isEditing />;
}
