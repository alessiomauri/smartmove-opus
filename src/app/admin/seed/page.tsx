import AdminHeader from '@/components/admin/AdminHeader';
import SeedClient from './SeedClient';

export const metadata = {
  title: 'Seed Data | Admin',
};

export default function SeedPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-2xl mx-auto py-12 px-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Seed Data</h1>
        <p className="text-sm text-gray-600 mb-8">
          Populate the database from the static TypeScript files. This is idempotent. Running it
          multiple times will upsert records by <code className="bg-gray-100 px-1 rounded">slug</code>.
          Run this once after schema changes. Your manual edits to existing rows will be overwritten
          with the static content, so only run if you intend to reset.
        </p>
        <SeedClient />
      </div>
    </div>
  );
}
