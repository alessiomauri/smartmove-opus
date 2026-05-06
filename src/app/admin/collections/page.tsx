'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Globe,
  User,
  BarChart3,
} from 'lucide-react';
import AdminHeader from '@/components/admin/AdminHeader';
import { useAdminCollections } from '@/hooks/useAdminCollections';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function AdminCollectionsPage() {
  const [search, setSearch] = useState('');
  const { collections, loading, deleteCollection, togglePublished } = useAdminCollections();

  const filtered = collections.filter((c) =>
    search === '' ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.recipient_name?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this collection?')) return;
    try {
      await deleteCollection(id);
      toast.success('Collection deleted');
    } catch {
      toast.error('Failed to delete collection');
    }
  };

  const handleTogglePublish = async (id: string, currentlyPublished: boolean) => {
    try {
      await togglePublished(id, !currentlyPublished);
      toast.success(!currentlyPublished ? 'Collection published' : 'Collection unpublished');
    } catch {
      toast.error('Failed to update collection');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Collections</h1>
            <p className="text-gray-500">Curated property selections to share with clients and community</p>
          </div>
          <Link
            href="/admin/collections/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f6c74] text-white rounded-lg font-medium hover:bg-[#0a4f55] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Collection
          </Link>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search collections..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-[#0f6c74] border-t-transparent rounded-full mx-auto" />
              <p className="text-gray-500 mt-2">Loading collections...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">
                {collections.length === 0
                  ? 'No collections yet. Create your first curated selection!'
                  : 'No collections match your search'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Collection
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Type
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Properties
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Views
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Published
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map((collection) => (
                    <tr key={collection.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{collection.title}</p>
                          {collection.type === 'personal' && collection.recipient_name && (
                            <p className="text-sm text-gray-500">For {collection.recipient_name}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">/collection/{collection.slug}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full',
                          collection.type === 'community'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-purple-50 text-purple-700'
                        )}>
                          {collection.type === 'community' ? (
                            <Globe className="w-3 h-3" />
                          ) : (
                            <User className="w-3 h-3" />
                          )}
                          {collection.type === 'community' ? 'Community' : 'Personal'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-gray-900">{collection.property_count}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span className="text-sm">{collection.view_count}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleTogglePublish(collection.id, collection.is_published)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-colors',
                            collection.is_published
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          )}
                        >
                          {collection.is_published ? (
                            <><Eye className="w-3.5 h-3.5" /> Published</>
                          ) : (
                            <><EyeOff className="w-3.5 h-3.5" /> Draft</>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {collection.is_published && (
                            <a
                              href={`/collection/${collection.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
                              title="View"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <Link
                            href={`/admin/collections/${collection.id}/edit`}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(collection.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-500 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-900">{collections.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Community</p>
            <p className="text-2xl font-bold text-gray-900">
              {collections.filter((c) => c.type === 'community').length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Personal</p>
            <p className="text-2xl font-bold text-gray-900">
              {collections.filter((c) => c.type === 'personal').length}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
