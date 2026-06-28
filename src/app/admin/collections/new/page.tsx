import AdminHeader from '@/components/admin/AdminHeader';
import CollectionForm from '@/components/admin/CollectionForm';

export default function NewCollectionPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CollectionForm />
      </main>
    </div>
  );
}
