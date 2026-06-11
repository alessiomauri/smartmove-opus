'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ArrowUpDown,
  Star,
  Settings2,
  Mail,
} from 'lucide-react';
import AdminHeader from '@/components/admin/AdminHeader';
import { useAdminProperties } from '@/hooks/useAdminProperties';
import { STATUS_LABELS, STATUS_COLORS, PropertyStatus, SortOption } from '@/types/property';
import { formatPrice, cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase';
import { toast } from 'sonner';
import { buildEmailSelection } from '@/lib/actions/leads';
import { copySelectionToClipboard } from '@/components/admin/copy-email-selection';

type AdminSort = 'newest' | 'oldest' | 'price_desc' | 'price_asc' | 'name' | 'location';

const ADMIN_SORT_LABELS: Record<AdminSort, string> = {
  newest: 'Newest First',
  oldest: 'Oldest First',
  price_desc: 'Price: High to Low',
  price_asc: 'Price: Low to High',
  name: 'Name: A-Z',
  location: 'Location: A-Z',
};

const DEFAULT_SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest First',
  price_desc: 'Price: High to Low',
  price_asc: 'Price: Low to High',
  name: 'Name: A-Z',
};

export default function AdminDashboard() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PropertyStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<AdminSort>('newest');
  const [defaultSort, setDefaultSort] = useState<SortOption>('newest');
  const [showSortSettings, setShowSortSettings] = useState(false);
  // Multi-select for the copy-card-to-email workflow (selection emails).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copying, setCopying] = useState(false);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copySelectedForEmail() {
    if (selected.size === 0) return;
    setCopying(true);
    try {
      const ids = [...selected];
      const count = await copySelectionToClipboard(() => buildEmailSelection({ ids }));
      toast.success(`${count} card${count === 1 ? '' : 's'} copied for email`, {
        description: 'Paste into your email client — cards stack vertically, links carry tracking.',
        duration: 7000,
      });
      setSelected(new Set());
    } catch (e) {
      toast.error('Copy failed', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setCopying(false);
    }
  }

  // Fetch all properties (including unpublished) for admin
  const { properties, loading, deleteProperty, togglePublished, refetch } = useAdminProperties();

  // Load current default sort setting
  useEffect(() => {
    async function loadSettings() {
      const supabase = createClient();
      const { data } = await supabase
        .from('site_settings')
        .select('default_sort')
        .eq('id', 1)
        .single();
      if (data?.default_sort) setDefaultSort(data.default_sort as SortOption);
    }
    loadSettings();
  }, []);

  const handleDefaultSortChange = async (newSort: SortOption) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('site_settings')
      .update({ default_sort: newSort })
      .eq('id', 1);

    if (error) {
      toast.error('Failed to update default sort');
      return;
    }

    setDefaultSort(newSort);
    toast.success(`Public site will now sort by "${DEFAULT_SORT_LABELS[newSort]}"`);
    setShowSortSettings(false);
  };

  const handleToggleFeatured = async (id: string, currentlyFeatured: boolean) => {
    const supabase = createClient();

    // If featuring, set featured_order to 0 (top); admin can reorder later
    const { error } = await supabase
      .from('properties')
      .update({
        is_featured: !currentlyFeatured,
        featured_order: !currentlyFeatured ? 0 : 0,
      })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update featured status');
      return;
    }

    toast.success(!currentlyFeatured ? 'Property featured. It will appear first on the site' : 'Property unfeatured');
    refetch();
  };

  // Filter and sort properties
  const filteredProperties = properties
    .filter((property) => {
      const matchesSearch =
        property.name.toLowerCase().includes(search.toLowerCase()) ||
        (property.location?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchesStatus =
        statusFilter === 'all' || property.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price_desc':
          if (a.price === null) return 1;
          if (b.price === null) return -1;
          return b.price - a.price;
        case 'price_asc':
          if (a.price === null) return 1;
          if (b.price === null) return -1;
          return a.price - b.price;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'location':
          return (a.location || '').localeCompare(b.location || '');
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this property? This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      await deleteProperty(id);
    } catch (err) {
      alert('Failed to delete property. Please try again.');
      console.error('Delete error:', err);
    }
  };

  const handleTogglePublish = async (id: string, currentlyPublished: boolean) => {
    try {
      await togglePublished(id, !currentlyPublished);
    } catch (err) {
      alert('Failed to update property. Please try again.');
      console.error('Toggle publish error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
            <p className="text-gray-500">
              Manage your property listings
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowSortSettings(!showSortSettings)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm text-gray-700"
              >
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline">Display</span>
              </button>

              {/* Default sort dropdown */}
              {showSortSettings && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSortSettings(false)} />
                  <div className="absolute right-0 top-full mt-2 bg-white shadow-lg rounded-xl border border-gray-200 p-4 z-50 w-[260px]">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Public Site Default Sort
                    </p>
                    <div className="space-y-1">
                      {(Object.entries(DEFAULT_SORT_LABELS) as [SortOption, string][]).map(([value, label]) => (
                        <button
                          key={value}
                          onClick={() => handleDefaultSortChange(value)}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                            defaultSort === value
                              ? 'bg-[#0f6c74]/10 text-[#0f6c74] font-medium'
                              : 'text-gray-600 hover:bg-gray-50'
                          )}
                        >
                          {label}
                          {defaultSort === value && ' (current)'}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        Featured properties always appear first, regardless of sort order.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <Link
              href="/admin/properties/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f6c74] text-white rounded-lg font-medium hover:bg-[#0a4f55] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Property
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search properties..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74]"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as PropertyStatus | 'all')
              }
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74] bg-white"
            >
              <option value="all">All Status</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as AdminSort)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74] bg-white"
            >
              {Object.entries(ADMIN_SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Properties Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-[#0f6c74] border-t-transparent rounded-full mx-auto" />
              <p className="text-gray-500 mt-2">Loading properties...</p>
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No properties found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all for email copy"
                        checked={filteredProperties.length > 0 && selected.size === filteredProperties.length}
                        onChange={(e) =>
                          setSelected(e.target.checked ? new Set(filteredProperties.map((p) => p.id)) : new Set())
                        }
                        className="accent-[#cbaa65] w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th
                      className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3 cursor-pointer hover:text-gray-700 transition-colors select-none"
                      onClick={() => setSortBy(sortBy === 'name' ? 'newest' : 'name')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Property
                        {(sortBy === 'name' || sortBy === 'newest' || sortBy === 'oldest') && (
                          <ArrowUpDown className="w-3 h-3 text-[#0f6c74]" />
                        )}
                      </span>
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Status
                    </th>
                    <th
                      className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3 cursor-pointer hover:text-gray-700 transition-colors select-none"
                      onClick={() => setSortBy(sortBy === 'price_desc' ? 'price_asc' : 'price_desc')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Price
                        {(sortBy === 'price_desc' || sortBy === 'price_asc') && (
                          <ArrowUpDown className="w-3 h-3 text-[#0f6c74]" />
                        )}
                      </span>
                    </th>
                    <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                      Featured
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
                  {filteredProperties.map((property) => (
                    <tr key={property.id} className={cn('hover:bg-gray-50', selected.has(property.id) && 'bg-amber-50/60')}>
                      <td className="px-4 py-4 w-10">
                        <input
                          type="checkbox"
                          aria-label={`Select ${property.name} for email copy`}
                          checked={selected.has(property.id)}
                          onChange={() => toggleSelected(property.id)}
                          className="accent-[#cbaa65] w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-4">
                          <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-gray-100">
                            <Image
                              src={property.hero_image}
                              alt={property.name}
                              fill
                              className="object-cover"
                              sizes="64px"
                            />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {property.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {property.location}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'px-2.5 py-0.5 text-xs font-medium text-white rounded-full',
                            STATUS_COLORS[property.status]
                          )}
                        >
                          {STATUS_LABELS[property.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-gray-900">
                          {formatPrice(property.price, property.price_on_request)}
                        </p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleFeatured(property.id, property.is_featured)}
                          className={cn(
                            'p-1.5 rounded-lg transition-all',
                            property.is_featured
                              ? 'text-amber-500 hover:bg-amber-50'
                              : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50/50'
                          )}
                          title={property.is_featured ? 'Remove from featured' : 'Feature this property'}
                        >
                          <Star className={cn('w-4 h-4', property.is_featured && 'fill-amber-500')} />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() =>
                            handleTogglePublish(property.id, property.published)
                          }
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-colors',
                            property.published
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          )}
                        >
                          {property.published ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              Published
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              Draft
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/property/${property.slug}`}
                            target="_blank"
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
                            title="View Property"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/admin/properties/${property.id}/edit`}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(property.id)}
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

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mt-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-900">
              {properties.length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Featured
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {properties.filter((p) => p.is_featured).length}
            </p>
          </div>
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <div
              key={status}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <p className="text-sm text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-gray-900">
                {properties.filter((p) => p.status === status).length}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* Floating copy bar — appears while a selection is active */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-gray-900 text-white rounded-full pl-5 pr-2 py-2 shadow-2xl">
          <span className="text-sm">
            {selected.size} propert{selected.size === 1 ? 'y' : 'ies'} selected
          </span>
          <button
            onClick={copySelectedForEmail}
            disabled={copying}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#cbaa65] hover:bg-[#b3934f] rounded-full text-sm font-semibold transition-colors disabled:opacity-60"
          >
            <Mail className="w-4 h-4" />
            {copying ? 'Copying…' : 'Copy for email'}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="px-3 py-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
