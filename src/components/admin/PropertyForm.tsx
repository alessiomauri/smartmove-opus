'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Eye, ArrowLeft, Plus, Search, Globe, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  Property,
  PropertyStatus,
  PropertyType,
  STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  AREAS,
  FEATURE_OPTIONS,
} from '@/types/property';
import { Area } from '@/types/area';
import { slugify, cn } from '@/lib/utils';
import { getFeatureOptions, addFeatureOption, FeatureOption } from '@/lib/actions/features';
import { getAllAreas } from '@/lib/actions/areas';
import ImageUploader from './ImageUploader';
import SocialContentGenerator from './SocialContentGenerator';

interface PropertyFormProps {
  initialData?: Partial<Property>;
  onSubmit: (data: Partial<Property>) => Promise<void>;
  isEditing?: boolean;
}

export default function PropertyForm({
  initialData,
  onSubmit,
  isEditing = false,
}: PropertyFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'features' | 'media' | 'location' | 'social'>('basic');
  const [dbFeatures, setDbFeatures] = useState<FeatureOption[]>([]);
  const [allAreas, setAllAreas] = useState<Area[]>([]);
  const [featureSearch, setFeatureSearch] = useState('');
  const [newFeatureName, setNewFeatureName] = useState('');
  const [isAddingFeature, setIsAddingFeature] = useState(false);
  const [showScraper, setShowScraper] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [imageImportProgress, setImageImportProgress] = useState<{ done: number; total: number } | null>(null);

  // Load feature options + areas from database on mount
  useEffect(() => {
    getFeatureOptions().then((features) => {
      if (features.length > 0) {
        setDbFeatures(features);
      }
    });
    getAllAreas().then(setAllAreas);
  }, []);

  // Form state
  const [formData, setFormData] = useState<Partial<Property>>({
    name: '',
    slug: '',
    status: 'available',
    price: null,
    price_on_request: false,
    location: '',
    area: '',
    description: '',
    bedrooms: null,
    bathrooms: null,
    interior_size: null,
    terrace_size: null,
    plot_size: null,
    orientation: '',
    has_pool: false,
    parking_spaces: null,
    features: [],
    hero_image: '',
    gallery_images: [],
    floor_plan_images: [],
    latitude: null,
    longitude: null,
    location_description: '',
    property_type: 'villa',
    micro_location: null,
    published: false,
    hide_price_drop: false,
    ...initialData,
  });

  const updateField = <K extends keyof Property>(
    field: K,
    value: Property[K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      // Auto-generate slug from name
      ...(field === 'name' && !isEditing
        ? { slug: slugify(value as string) }
        : {}),
    }));
  };

  // Micro-location options: direct children of the selected main area
  const selectedAreaObj = allAreas.find(a => a.name === formData.area && a.pin_category === 'main');
  const microLocationOptions = selectedAreaObj
    ? allAreas
        .filter(a => a.parent_area === selectedAreaObj.slug && a.pin_category !== 'airport')
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const toggleFeature = (feature: string) => {
    const current = formData.features || [];
    const updated = current.includes(feature)
      ? current.filter((f) => f !== feature)
      : [...current, feature];
    updateField('features', updated);
  };

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return;
    setIsScraping(true);

    try {
      const response = await fetch('/api/admin/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl.trim() }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to scrape');
      }

      const data = await response.json();

      // Pre-fill form with scraped data (only fill empty fields)
      setFormData((prev) => ({
        ...prev,
        name: prev.name || data.name || '',
        slug: prev.slug || slugify(data.name || ''),
        description: prev.description || data.description || '',
        price: prev.price || data.price,
        price_on_request: data.price_on_request && !prev.price,
        bedrooms: prev.bedrooms || data.bedrooms,
        bathrooms: prev.bathrooms || data.bathrooms,
        interior_size: prev.interior_size || data.interior_size,
        plot_size: prev.plot_size || data.plot_size,
        terrace_size: prev.terrace_size || data.terrace_size,
        location: prev.location || data.location || '',
        features: prev.features?.length ? prev.features : data.features || [],
      }));

      setShowScraper(false);
      setScrapeUrl('');

      // Import images + floor plans in the background
      const imageUrls: string[] = data.images || [];
      const floorPlanUrls: string[] = data.floor_plan_images || [];
      const totalImages = imageUrls.length + floorPlanUrls.length;

      if (totalImages > 0) {
        toast.success('Property data imported', {
          description: `Now downloading ${totalImages} image${totalImages > 1 ? 's' : ''}${floorPlanUrls.length > 0 ? ` (including ${floorPlanUrls.length} floor plan${floorPlanUrls.length > 1 ? 's' : ''})` : ''}...`,
        });
        setImageImportProgress({ done: 0, total: totalImages });

        try {
          const batchSize = 10;

          // Import gallery images
          const galleryUploaded: string[] = [];
          for (let i = 0; i < imageUrls.length; i += batchSize) {
            const batch = imageUrls.slice(i, i + batchSize);
            const res = await fetch('/api/admin/import-images', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ urls: batch }),
            });
            if (res.ok) {
              const result = await res.json();
              galleryUploaded.push(...result.uploaded);
            }
            setImageImportProgress({ done: Math.min(i + batchSize, imageUrls.length), total: totalImages });
          }

          // Import floor plan images
          const floorPlanUploaded: string[] = [];
          if (floorPlanUrls.length > 0) {
            const res = await fetch('/api/admin/import-images', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ urls: floorPlanUrls }),
            });
            if (res.ok) {
              const result = await res.json();
              floorPlanUploaded.push(...result.uploaded);
            }
            setImageImportProgress({ done: totalImages, total: totalImages });
          }

          const totalUploaded = galleryUploaded.length + floorPlanUploaded.length;
          if (totalUploaded > 0) {
            setFormData((prev) => ({
              ...prev,
              gallery_images: [...(prev.gallery_images || []), ...galleryUploaded],
              floor_plan_images: [...(prev.floor_plan_images || []), ...floorPlanUploaded],
              hero_image: prev.hero_image || galleryUploaded[0] || '',
            }));
            const parts = [];
            if (galleryUploaded.length > 0) parts.push(`${galleryUploaded.length} gallery`);
            if (floorPlanUploaded.length > 0) parts.push(`${floorPlanUploaded.length} floor plan`);
            toast.success(`${parts.join(' + ')} images imported`);
          } else {
            toast.error('No images could be imported');
          }
        } catch {
          toast.error('Image import failed');
        } finally {
          setImageImportProgress(null);
        }
      } else {
        toast.success('Property data imported');
      }
    } catch (error) {
      console.error('Scrape failed:', error);
      toast.error('Scrape failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsScraping(false);
    }
  };

  const handleAddCustomFeature = async () => {
    const name = newFeatureName.trim();
    if (!name) return;

    setIsAddingFeature(true);
    try {
      const result = await addFeatureOption(name);
      if (result) {
        setDbFeatures((prev) => [...prev, result]);
      }
      // Also select it immediately
      toggleFeature(name);
      setNewFeatureName('');
    } catch (error) {
      console.error('Failed to add feature:', error);
    } finally {
      setIsAddingFeature(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(formData);
      router.push('/admin');
    } catch (error) {
      console.error('Error saving property:', error);
      toast.error('Failed to save property. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'features', label: 'Features' },
    { id: 'media', label: 'Media' },
    { id: 'location', label: 'Location' },
    ...(isEditing ? [{ id: 'social' as const, label: 'Share & Social' }] : []),
  ] as const;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Property' : 'Add New Property'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {!isEditing && (
            <button
              type="button"
              onClick={() => setShowScraper(!showScraper)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Globe className="w-4 h-4" />
              Import from URL
            </button>
          )}
          <Link
            href={formData.slug ? `/property/${formData.slug}` : '#'}
            target="_blank"
            className={cn(
              'flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium transition-colors',
              formData.slug
                ? 'text-gray-700 hover:bg-gray-50'
                : 'text-gray-400 cursor-not-allowed'
            )}
          >
            <Eye className="w-4 h-4" />
            Preview
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-[#0f6c74] text-white rounded-lg text-sm font-medium hover:bg-[#0a4f55] transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : 'Save Property'}
          </button>
        </div>
      </div>

      {/* Scraper Panel */}
      {showScraper && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-800 mb-2">
            Import property data from a listing URL
          </p>
          <p className="text-xs text-amber-600 mb-3">
            Paste a property listing URL. We&apos;ll extract all details, features, and images automatically.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              placeholder="https://www.idealista.com/inmueble/..."
              className="flex-1 px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74] text-sm bg-white"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleScrape();
                }
              }}
            />
            <button
              type="button"
              onClick={handleScrape}
              disabled={isScraping || !scrapeUrl.trim()}
              className="px-4 py-2 bg-[#0f6c74] text-white text-sm font-medium rounded-lg hover:bg-[#0a4f55] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isScraping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4" />
                  Import
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Image Import Progress */}
      {imageImportProgress && (
        <div className="bg-[#0f6c74]/5 border border-[#0f6c74]/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-[#0f6c74] animate-spin flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[#0f6c74]">
                Importing images... {imageImportProgress.done}/{imageImportProgress.total}
              </p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-[#0f6c74] h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${(imageImportProgress.done / imageImportProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-[#0f6c74] text-[#0f6c74]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Property Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74]"
                  placeholder="e.g., Villa Amara"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL Slug *
                </label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => updateField('slug', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74]"
                  placeholder="villa-amara"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status *
                </label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) =>
                    updateField('status', e.target.value as PropertyStatus)
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74] bg-white"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Property Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Property Type *
                </label>
                <select
                  required
                  value={formData.property_type}
                  onChange={(e) =>
                    updateField('property_type', e.target.value as PropertyType)
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74] bg-white"
                >
                  {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Area */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Area *
                </label>
                <select
                  required
                  value={formData.area}
                  onChange={(e) => updateField('area', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74] bg-white"
                >
                  <option value="">Select area</option>
                  {AREAS.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location Label
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74]"
                  placeholder="e.g., Nueva Andalucia"
                />
              </div>

              {/* Specific area (micro-location) — internal categorisation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Specific Area <span className="text-gray-400 font-normal">(internal)</span>
                </label>
                <select
                  value={formData.micro_location ?? ''}
                  onChange={(e) => updateField('micro_location', e.target.value || null)}
                  disabled={!formData.area}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74] bg-white disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">none</option>
                  {microLocationOptions.map(a => (
                    <option key={a.slug} value={a.slug}>{a.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Links this property to a specific area page. Select the main Area first.
                </p>
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price (EUR)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    value={formData.price || ''}
                    onChange={(e) =>
                      updateField(
                        'price',
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    disabled={formData.price_on_request}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74] disabled:bg-gray-100"
                    placeholder="4500000"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.price_on_request}
                      onChange={(e) =>
                        updateField('price_on_request', e.target.checked)
                      }
                      className="w-4 h-4 text-[#0f6c74] rounded focus:ring-[#0f6c74]"
                    />
                    Price on Request
                  </label>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={8}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74]"
                placeholder="Describe the property..."
              />
              <p className="text-xs text-gray-400 mt-1">
                Use blank lines to separate paragraphs
              </p>
            </div>

            {/* Published Toggle */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.published}
                  onChange={(e) => updateField('published', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#0f6c74]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0f6c74]"></div>
              </label>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {formData.published ? 'Published' : 'Draft'}
                </p>
                <p className="text-xs text-gray-500">
                  {formData.published
                    ? 'This property is visible on the website'
                    : 'This property is hidden from the website'}
                </p>
              </div>
            </div>

            {/* Price-drop badge opt-out — admin-owned: the Resales sync
                never writes this flag, so it survives nightly upserts. */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hide_price_drop ?? false}
                  onChange={(e) => updateField('hide_price_drop', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#0f6c74]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0f6c74]"></div>
              </label>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {formData.hide_price_drop ? 'Price-drop badge hidden' : 'Price-drop badge allowed'}
                </p>
                <p className="text-xs text-gray-500">
                  When hidden, this listing never shows &ldquo;Reduced&rdquo; badges or
                  appears in price-drop alerts — even while the site-wide toggle is on.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Features Tab */}
        {activeTab === 'features' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Bedrooms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bedrooms
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.bedrooms || ''}
                  onChange={(e) =>
                    updateField(
                      'bedrooms',
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74]"
                />
              </div>

              {/* Bathrooms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bathrooms
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.bathrooms || ''}
                  onChange={(e) =>
                    updateField(
                      'bathrooms',
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74]"
                />
              </div>

              {/* Interior Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Interior (m²)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.interior_size || ''}
                  onChange={(e) =>
                    updateField(
                      'interior_size',
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74]"
                />
              </div>

              {/* Terrace Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Terrace (m²)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.terrace_size || ''}
                  onChange={(e) =>
                    updateField(
                      'terrace_size',
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74]"
                />
              </div>

              {/* Plot Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plot (m²)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.plot_size || ''}
                  onChange={(e) =>
                    updateField(
                      'plot_size',
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74]"
                />
              </div>

              {/* Parking */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Parking Spaces
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.parking_spaces || ''}
                  onChange={(e) =>
                    updateField(
                      'parking_spaces',
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74]"
                />
              </div>

              {/* Orientation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Orientation
                </label>
                <select
                  value={formData.orientation || ''}
                  onChange={(e) => updateField('orientation', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74] bg-white"
                >
                  <option value="">Select</option>
                  <option value="North">North</option>
                  <option value="South">South</option>
                  <option value="East">East</option>
                  <option value="West">West</option>
                  <option value="North-East">North-East</option>
                  <option value="North-West">North-West</option>
                  <option value="South-East">South-East</option>
                  <option value="South-West">South-West</option>
                </select>
              </div>

              {/* Pool */}
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.has_pool}
                    onChange={(e) => updateField('has_pool', e.target.checked)}
                    className="w-4 h-4 text-[#0f6c74] rounded focus:ring-[#0f6c74]"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Has Pool
                  </span>
                </label>
              </div>
            </div>

            {/* Amenities */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Amenities ({formData.features?.length || 0} selected)
                </label>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={featureSearch}
                  onChange={(e) => setFeatureSearch(e.target.value)}
                  placeholder="Search amenities..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74] text-sm"
                />
              </div>

              {/* Selected features */}
              {formData.features && formData.features.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4 p-3 bg-[#0f6c74]/5 rounded-lg">
                  {formData.features.map((feature) => (
                    <button
                      key={feature}
                      type="button"
                      onClick={() => toggleFeature(feature)}
                      className="px-3 py-1.5 rounded-full text-sm font-medium bg-[#0f6c74] text-white hover:bg-[#0a4f55] transition-colors flex items-center gap-1"
                    >
                      {feature}
                      <span className="text-white/70 ml-0.5">&times;</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Feature options by category */}
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {(() => {
                  // Use database features if available, otherwise fall back to hardcoded
                  const allFeatures = dbFeatures.length > 0
                    ? dbFeatures
                    : FEATURE_OPTIONS.map((f) => ({ id: f, name: f, category: 'General', created_at: '' }));

                  const filtered = featureSearch
                    ? allFeatures.filter((f) =>
                        f.name.toLowerCase().includes(featureSearch.toLowerCase())
                      )
                    : allFeatures;

                  // Group by category
                  const grouped = filtered.reduce((acc, f) => {
                    const cat = f.category || 'Other';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(f);
                    return acc;
                  }, {} as Record<string, typeof allFeatures>);

                  if (Object.keys(grouped).length === 0) {
                    return (
                      <p className="text-sm text-gray-400 text-center py-4">
                        No matching amenities found
                      </p>
                    );
                  }

                  return Object.entries(grouped).map(([category, features]) => (
                    <div key={category}>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        {category}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {features.map((feature) => (
                          <button
                            key={feature.id}
                            type="button"
                            onClick={() => toggleFeature(feature.name)}
                            className={cn(
                              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                              formData.features?.includes(feature.name)
                                ? 'bg-[#0f6c74] text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            )}
                          >
                            {feature.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* Add custom feature */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Add Custom Amenity
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFeatureName}
                    onChange={(e) => setNewFeatureName(e.target.value)}
                    placeholder="e.g., Helipad"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74] text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newFeatureName.trim()) {
                          handleAddCustomFeature();
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={!newFeatureName.trim() || isAddingFeature}
                    onClick={handleAddCustomFeature}
                    className="px-4 py-2 bg-[#0f6c74] text-white text-sm font-medium rounded-lg hover:bg-[#0a4f55] transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Media Tab */}
        {activeTab === 'media' && (
          <div className="space-y-8">
            {/* Hero Image Preview */}
            {formData.hero_image && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hero Image
                </label>
                <div className="relative aspect-video max-w-lg rounded-lg overflow-hidden border-2 border-[#0f6c74]">
                  <img
                    src={formData.hero_image}
                    alt="Hero preview"
                    className="object-cover w-full h-full"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-[#0f6c74] text-white text-[10px] font-semibold rounded tracking-wide uppercase">
                    Hero Image
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Click the star icon on any gallery image to change the hero.
                </p>
              </div>
            )}

            {/* Gallery Images */}
            <ImageUploader
              images={formData.gallery_images || []}
              onChange={(images) => {
                updateField('gallery_images', images);
                // Auto-set first image as hero if none is set
                if (!formData.hero_image && images.length > 0) {
                  updateField('hero_image', images[0]);
                }
              }}
              maxImages={30}
              label="Property Images"
              heroImage={formData.hero_image}
              onHeroSelect={(url) => updateField('hero_image', url)}
            />

            {/* Floor Plans */}
            <ImageUploader
              images={formData.floor_plan_images || []}
              onChange={(images) => updateField('floor_plan_images', images)}
              maxImages={5}
              label="Floor Plans"
              aspectRatio="aspect-[3/2]"
            />
          </div>
        )}

        {/* Location Tab */}
        {activeTab === 'location' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Latitude */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.latitude || ''}
                  onChange={(e) =>
                    updateField(
                      'latitude',
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74]"
                  placeholder="36.5095"
                />
              </div>

              {/* Longitude */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.longitude || ''}
                  onChange={(e) =>
                    updateField(
                      'longitude',
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74]"
                  placeholder="-4.9549"
                />
              </div>
            </div>

            {/* Location Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location Description
              </label>
              <textarea
                value={formData.location_description || ''}
                onChange={(e) =>
                  updateField('location_description', e.target.value)
                }
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/20 focus:border-[#0f6c74]"
                placeholder="Describe the location, nearby amenities, transport links..."
              />
            </div>

            {/* Map Preview */}
            {formData.latitude && formData.longitude && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Map Preview
                </label>
                <div className="relative w-full h-[300px] rounded-lg overflow-hidden border border-gray-200">
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${formData.longitude - 0.01},${formData.latitude - 0.01},${formData.longitude + 0.01},${formData.latitude + 0.01}&layer=mapnik&marker=${formData.latitude},${formData.longitude}`}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    title="Location preview"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Social & Sharing Tab */}
        {activeTab === 'social' && isEditing && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Share2 className="w-5 h-5 text-[#0f6c74]" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Share & Social Content</h3>
                <p className="text-sm text-gray-500">Ready-to-share content for WhatsApp and Instagram. Copy and paste directly.</p>
              </div>
            </div>
            <SocialContentGenerator property={formData as Property} />
          </div>
        )}
      </div>
    </form>
  );
}
