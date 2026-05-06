'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Save, Trash2, Eye, EyeOff } from 'lucide-react';
import {
  Development,
  DevelopmentInput,
  DevelopmentStatus,
  DEVELOPMENT_STATUS_LABELS,
  DEVELOPMENT_AMENITIES_DEFAULTS,
  DEVELOPMENT_UNIT_TYPES,
} from '@/types/development';
import { AREAS } from '@/types/property';
import HeroImagePicker from './HeroImagePicker';
import ImageUploader from './ImageUploader';

interface DevelopmentFormProps {
  initial?: Development;
  onSubmit: (input: DevelopmentInput) => Promise<{ id: string; slug: string }>;
  onDelete?: () => Promise<void>;
}

type Tab = 'basic' | 'units' | 'media' | 'location' | 'amenities' | 'seo';

const TABS: { key: Tab; label: string }[] = [
  { key: 'basic', label: 'Basic' },
  { key: 'units', label: 'Units & Pricing' },
  { key: 'media', label: 'Media' },
  { key: 'location', label: 'Location' },
  { key: 'amenities', label: 'Amenities' },
  { key: 'seo', label: 'SEO' },
];

const DEFAULTS: DevelopmentInput = {
  slug: '',
  name: '',
  developer: null,
  status: 'off_plan',
  source: 'manual',
  source_id: null,
  title: '',
  meta_description: '',
  subtitle: '',
  short_description: '',
  description: '',
  price_from: null,
  price_to: null,
  price_on_request: false,
  bedrooms_from: null,
  bedrooms_to: null,
  bathrooms_from: null,
  bathrooms_to: null,
  size_from: null,
  size_to: null,
  terrace_size_from: null,
  terrace_size_to: null,
  total_units: null,
  units_available: null,
  unit_types: [],
  completion_date: null,
  delivery_phases: null,
  location: null,
  area: null,
  micro_location: null,
  latitude: null,
  longitude: null,
  location_description: null,
  hero_image: '',
  hero_image_alt: '',
  gallery_images: [],
  masterplan_images: [],
  floor_plan_images: [],
  brochure_pdf: null,
  amenities: [],
  keywords: [],
  is_featured: false,
  featured_order: 0,
  published: false,
};

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 80);
}

export default function DevelopmentForm({ initial, onSubmit, onDelete }: DevelopmentFormProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('basic');
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<DevelopmentInput>(() => {
    if (!initial) return DEFAULTS;
    const { id: _id, created_at: _c, updated_at: _u, hero_image_blur: _b, last_synced_at: _s, ...rest } =
      initial;
    return { ...DEFAULTS, ...rest };
  });

  const set = <K extends keyof DevelopmentInput>(key: K, value: DevelopmentInput[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const handleSubmit = async (publish?: boolean) => {
    if (!data.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!data.slug.trim()) {
      toast.error('Slug is required');
      return;
    }
    setSaving(true);
    try {
      const payload = publish === undefined ? data : { ...data, published: publish };
      const result = await onSubmit(payload);
      toast.success(publish === false ? 'Saved as draft' : publish === true ? 'Published' : 'Saved');
      if (!initial) {
        router.push(`/admin/developments/${result.id}/edit`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm('Delete this development? This cannot be undone.')) return;
    try {
      await onDelete();
      toast.success('Development deleted');
      router.push('/admin/developments');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900">
            {initial ? data.name || 'Edit Development' : 'New Development'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {data.published ? (
              <span className="inline-flex items-center gap-1 text-green-700">
                <Eye className="w-3.5 h-3.5" /> Published
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-gray-500">
                <EyeOff className="w-3.5 h-3.5" /> Draft (not visible on site)
              </span>
            )}
            {data.source !== 'manual' && (
              <span className="ml-3 text-xs uppercase tracking-wider px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                Source: {data.source}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onDelete && (
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
          <button
            onClick={() => handleSubmit(false)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-[#0f6c74] text-white hover:bg-[#0a4f55] rounded-md disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {data.published ? 'Save & Update' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-[#0f6c74] text-[#0f6c74]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {tab === 'basic' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name *">
              <input
                type="text"
                value={data.name}
                onChange={(e) => {
                  set('name', e.target.value);
                  if (!initial && !data.slug) set('slug', slugify(e.target.value));
                }}
                className={inputCls}
              />
            </Field>
            <Field label="Slug *">
              <input
                type="text"
                value={data.slug}
                onChange={(e) => set('slug', slugify(e.target.value))}
                className={inputCls}
              />
            </Field>
            <Field label="Developer">
              <input
                type="text"
                value={data.developer ?? ''}
                onChange={(e) => set('developer', e.target.value || null)}
                placeholder="e.g. Sierra Blanca Estates"
                className={inputCls}
              />
            </Field>
            <Field label="Status *">
              <select
                value={data.status}
                onChange={(e) => set('status', e.target.value as DevelopmentStatus)}
                className={inputCls}
              >
                {(Object.keys(DEVELOPMENT_STATUS_LABELS) as DevelopmentStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {DEVELOPMENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Subtitle" className="md:col-span-2">
              <input
                type="text"
                value={data.subtitle}
                onChange={(e) => set('subtitle', e.target.value)}
                placeholder="One-line tagline shown on the public page"
                className={inputCls}
              />
            </Field>
            <Field label="Short description (cards)" className="md:col-span-2">
              <textarea
                value={data.short_description}
                onChange={(e) => set('short_description', e.target.value)}
                rows={2}
                placeholder="1–2 sentences shown on listing cards"
                className={inputCls}
              />
            </Field>
            <Field label="Full description" className="md:col-span-2">
              <textarea
                value={data.description}
                onChange={(e) => set('description', e.target.value)}
                rows={8}
                placeholder="Long-form description shown on the detail page"
                className={inputCls}
              />
            </Field>
            <Field label="Featured">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={data.is_featured}
                  onChange={(e) => set('is_featured', e.target.checked)}
                />
                <span className="text-sm text-gray-700">Pin to top of listings</span>
              </label>
            </Field>
            <Field label="Featured order">
              <input
                type="number"
                value={data.featured_order ?? 0}
                onChange={(e) => set('featured_order', Number(e.target.value) || 0)}
                className={inputCls}
              />
            </Field>
          </div>
        )}

        {tab === 'units' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Price from (€)">
              <input
                type="number"
                value={data.price_from ?? ''}
                onChange={(e) => set('price_from', e.target.value ? Number(e.target.value) : null)}
                className={inputCls}
              />
            </Field>
            <Field label="Price to (€)">
              <input
                type="number"
                value={data.price_to ?? ''}
                onChange={(e) => set('price_to', e.target.value ? Number(e.target.value) : null)}
                className={inputCls}
              />
            </Field>
            <Field label="Price on request" className="md:col-span-2">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={data.price_on_request}
                  onChange={(e) => set('price_on_request', e.target.checked)}
                />
                <span className="text-sm text-gray-700">Hide prices, show "Price on request"</span>
              </label>
            </Field>

            <Field label="Bedrooms from">
              <input
                type="number"
                value={data.bedrooms_from ?? ''}
                onChange={(e) => set('bedrooms_from', e.target.value ? Number(e.target.value) : null)}
                className={inputCls}
              />
            </Field>
            <Field label="Bedrooms to">
              <input
                type="number"
                value={data.bedrooms_to ?? ''}
                onChange={(e) => set('bedrooms_to', e.target.value ? Number(e.target.value) : null)}
                className={inputCls}
              />
            </Field>
            <Field label="Bathrooms from">
              <input
                type="number"
                value={data.bathrooms_from ?? ''}
                onChange={(e) => set('bathrooms_from', e.target.value ? Number(e.target.value) : null)}
                className={inputCls}
              />
            </Field>
            <Field label="Bathrooms to">
              <input
                type="number"
                value={data.bathrooms_to ?? ''}
                onChange={(e) => set('bathrooms_to', e.target.value ? Number(e.target.value) : null)}
                className={inputCls}
              />
            </Field>
            <Field label="Interior size from (m²)">
              <input
                type="number"
                value={data.size_from ?? ''}
                onChange={(e) => set('size_from', e.target.value ? Number(e.target.value) : null)}
                className={inputCls}
              />
            </Field>
            <Field label="Interior size to (m²)">
              <input
                type="number"
                value={data.size_to ?? ''}
                onChange={(e) => set('size_to', e.target.value ? Number(e.target.value) : null)}
                className={inputCls}
              />
            </Field>
            <Field label="Terrace from (m²)">
              <input
                type="number"
                value={data.terrace_size_from ?? ''}
                onChange={(e) => set('terrace_size_from', e.target.value ? Number(e.target.value) : null)}
                className={inputCls}
              />
            </Field>
            <Field label="Terrace to (m²)">
              <input
                type="number"
                value={data.terrace_size_to ?? ''}
                onChange={(e) => set('terrace_size_to', e.target.value ? Number(e.target.value) : null)}
                className={inputCls}
              />
            </Field>
            <Field label="Total units">
              <input
                type="number"
                value={data.total_units ?? ''}
                onChange={(e) => set('total_units', e.target.value ? Number(e.target.value) : null)}
                className={inputCls}
              />
            </Field>
            <Field label="Units available">
              <input
                type="number"
                value={data.units_available ?? ''}
                onChange={(e) => set('units_available', e.target.value ? Number(e.target.value) : null)}
                className={inputCls}
              />
            </Field>

            <Field label="Unit types" className="md:col-span-2">
              <div className="flex flex-wrap gap-2">
                {DEVELOPMENT_UNIT_TYPES.map((u) => {
                  const active = data.unit_types.includes(u);
                  return (
                    <button
                      key={u}
                      type="button"
                      onClick={() =>
                        set(
                          'unit_types',
                          active ? data.unit_types.filter((x) => x !== u) : [...data.unit_types, u]
                        )
                      }
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border ${
                        active
                          ? 'bg-[#0f6c74] text-white border-[#0f6c74]'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {u}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Completion date">
              <input
                type="date"
                value={data.completion_date ?? ''}
                onChange={(e) => set('completion_date', e.target.value || null)}
                className={inputCls}
              />
            </Field>
            <Field label="Delivery phases (free text)">
              <input
                type="text"
                value={data.delivery_phases ?? ''}
                onChange={(e) => set('delivery_phases', e.target.value || null)}
                placeholder="e.g. Phase 1: Q4 2026; Phase 2: Q2 2027"
                className={inputCls}
              />
            </Field>
          </div>
        )}

        {tab === 'media' && (
          <div className="space-y-8">
            <HeroImagePicker
              value={data.hero_image}
              onChange={(url) => set('hero_image', url)}
              bucket="development-images"
              label="Hero image"
              helperText="The main image shown at the top of the development page"
            />
            <Field label="Hero image alt text">
              <input
                type="text"
                value={data.hero_image_alt}
                onChange={(e) => set('hero_image_alt', e.target.value)}
                placeholder="e.g. Aerial render of Palo Alto Marbella"
                className={inputCls}
              />
            </Field>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Gallery (renders + photos)</h3>
              <ImageUploader
                images={data.gallery_images}
                onChange={(imgs) => set('gallery_images', imgs)}
                aspectRatio="aspect-[4/3]"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Masterplan / site plans</h3>
              <ImageUploader
                images={data.masterplan_images}
                onChange={(imgs) => set('masterplan_images', imgs)}
                aspectRatio="aspect-[4/3]"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Floor plans</h3>
              <ImageUploader
                images={data.floor_plan_images}
                onChange={(imgs) => set('floor_plan_images', imgs)}
                aspectRatio="aspect-square"
              />
            </div>

            <Field label="Brochure PDF URL">
              <input
                type="url"
                value={data.brochure_pdf ?? ''}
                onChange={(e) => set('brochure_pdf', e.target.value || null)}
                placeholder="https://...brochure.pdf  upload manually to Supabase storage and paste the public URL"
                className={inputCls}
              />
            </Field>
          </div>
        )}

        {tab === 'location' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Display location label">
              <input
                type="text"
                value={data.location ?? ''}
                onChange={(e) => set('location', e.target.value || null)}
                placeholder="e.g. Hills above Marbella, Palo Alto"
                className={inputCls}
              />
            </Field>
            <Field label="Main area">
              <select
                value={data.area ?? ''}
                onChange={(e) => set('area', e.target.value || null)}
                className={inputCls}
              >
                <option value="">Select an area</option>
                {AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Micro-location (area slug)">
              <input
                type="text"
                value={data.micro_location ?? ''}
                onChange={(e) => set('micro_location', e.target.value || null)}
                placeholder="e.g. palo-alto, golden-mile"
                className={inputCls}
              />
            </Field>
            <Field label=" ">{/* spacer */}<></></Field>
            <Field label="Latitude">
              <input
                type="number"
                step="any"
                value={data.latitude ?? ''}
                onChange={(e) => set('latitude', e.target.value ? Number(e.target.value) : null)}
                className={inputCls}
              />
            </Field>
            <Field label="Longitude">
              <input
                type="number"
                step="any"
                value={data.longitude ?? ''}
                onChange={(e) => set('longitude', e.target.value ? Number(e.target.value) : null)}
                className={inputCls}
              />
            </Field>
            <Field label="Location description" className="md:col-span-2">
              <textarea
                value={data.location_description ?? ''}
                onChange={(e) => set('location_description', e.target.value || null)}
                rows={3}
                placeholder="Map blurb / neighbourhood notes"
                className={inputCls}
              />
            </Field>
          </div>
        )}

        {tab === 'amenities' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Click to toggle. You can also type custom amenities and press Enter.
            </p>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set([...DEVELOPMENT_AMENITIES_DEFAULTS, ...data.amenities])).map(
                (a) => {
                  const active = data.amenities.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() =>
                        set(
                          'amenities',
                          active ? data.amenities.filter((x) => x !== a) : [...data.amenities, a]
                        )
                      }
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border ${
                        active
                          ? 'bg-[#0f6c74] text-white border-[#0f6c74]'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {a}
                    </button>
                  );
                }
              )}
            </div>
            <CustomTagInput
              placeholder="Add custom amenity, press Enter"
              onAdd={(value) =>
                !data.amenities.includes(value) && set('amenities', [...data.amenities, value])
              }
            />
          </div>
        )}

        {tab === 'seo' && (
          <div className="grid grid-cols-1 gap-4">
            <Field label="SEO title">
              <input
                type="text"
                value={data.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Falls back to the development name if empty"
                className={inputCls}
              />
            </Field>
            <Field label="Meta description">
              <textarea
                value={data.meta_description}
                onChange={(e) => set('meta_description', e.target.value)}
                rows={3}
                placeholder="160 chars max, used in <meta name='description'>"
                className={inputCls}
              />
            </Field>
            <Field label="Keywords (comma-separated)">
              <input
                type="text"
                value={data.keywords.join(', ')}
                onChange={(e) =>
                  set(
                    'keywords',
                    e.target.value
                      .split(',')
                      .map((k) => k.trim())
                      .filter(Boolean)
                  )
                }
                className={inputCls}
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74] focus:border-transparent';

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

function CustomTagInput({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (value: string) => void;
}) {
  const [v, setV] = useState('');
  return (
    <input
      type="text"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && v.trim()) {
          e.preventDefault();
          onAdd(v.trim());
          setV('');
        }
      }}
      placeholder={placeholder}
      className={inputCls + ' max-w-md'}
    />
  );
}
