'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Save, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Area, AREA_REGIONS, PIN_CATEGORIES, PIN_CATEGORY_LABELS } from '@/types/area';
import HeroImagePicker from './HeroImagePicker';
import { updateArea } from '@/lib/actions/areas';

const CoordinatePicker = dynamic(() => import('./CoordinatePicker'), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] bg-gray-100 rounded-lg flex items-center justify-center text-sm text-gray-400">
      Loading map…
    </div>
  ),
});

interface Props {
  area: Area;
  allAreas: Area[];
}

function csv(arr: string[]) { return arr.join(', '); }
function parseCsv(s: string): string[] {
  return s.split(',').map(x => x.trim()).filter(Boolean);
}

export default function AreaForm({ area, allAreas }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Area>(area);
  const [propertyTypesInput, setPropertyTypesInput] = useState(csv(area.property_types));
  const [highlightsInput, setHighlightsInput] = useState(csv(area.highlights));
  const [keywordsInput, setKeywordsInput] = useState(csv(area.keywords));
  const [nearbyAreasInput, setNearbyAreasInput] = useState(csv(area.nearby_areas));
  const [isPending, startTransition] = useTransition();

  const update = <K extends keyof Area>(key: K, value: Area[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Area = {
      ...form,
      property_types: parseCsv(propertyTypesInput),
      highlights: parseCsv(highlightsInput),
      keywords: parseCsv(keywordsInput),
      nearby_areas: parseCsv(nearbyAreasInput),
    };
    startTransition(async () => {
      try {
        await updateArea(area.slug, payload);
        toast.success('Area updated');
        router.push('/admin/areas');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Save failed');
      }
    });
  };

  // Non-micro areas as parent options
  const parentOptions = allAreas.filter(a => !a.is_micro_location && a.slug !== area.slug);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/areas" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Back to areas
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f6c74] text-white text-sm font-medium rounded-md hover:bg-[#0a4f55] disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Basic */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug (fixed)</label>
            <input
              type="text"
              value={form.slug}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
            <select
              value={form.region}
              onChange={(e) => update('region', e.target.value as Area['region'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
            >
              {AREA_REGIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price Range</label>
            <input
              type="text"
              value={form.price_range}
              onChange={(e) => update('price_range', e.target.value)}
              placeholder="From €500,000 to €10,000,000+"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer mb-1">
              <input
                type="checkbox"
                checked={form.is_micro_location}
                onChange={(e) => update('is_micro_location', e.target.checked)}
                className="w-4 h-4 text-[#0f6c74] rounded"
              />
              Micro-location (part of another area)
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Area</label>
            <select
              value={form.parent_area ?? ''}
              onChange={(e) => update('parent_area', e.target.value || null)}
              disabled={!form.is_micro_location}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30 disabled:bg-gray-50"
            >
              <option value="">none</option>
              {parentOptions.map(p => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pin Category</label>
            <select
              value={form.pin_category}
              onChange={(e) => update('pin_category', e.target.value as Area['pin_category'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
            >
              {PIN_CATEGORIES.map(c => (
                <option key={c} value={c}>{PIN_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Controls pin color on the /areas map.</p>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <HeroImagePicker
          value={form.hero_image}
          onChange={(url) => update('hero_image', url)}
          bucket="area-images"
          label="Hero Image"
          helperText="Featured at the top of the area page."
        />
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Hero Image Alt Text</label>
          <input
            type="text"
            value={form.hero_image_alt}
            onChange={(e) => update('hero_image_alt', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
          />
        </div>
      </div>

      {/* Copy */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Page Title (SEO)</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
          <textarea
            value={form.meta_description}
            onChange={(e) => update('meta_description', e.target.value)}
            rows={2}
            maxLength={180}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
          />
          <p className="text-xs text-gray-500 mt-1">{form.meta_description.length}/180</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hero Heading</label>
          <input
            type="text"
            value={form.heading}
            onChange={(e) => update('heading', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subheading</label>
          <input
            type="text"
            value={form.subheading}
            onChange={(e) => update('subheading', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description (body copy)</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
          />
          <p className="text-xs text-gray-500 mt-1">Separate paragraphs with blank lines.</p>
        </div>
      </div>

      {/* Lists */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Property Types</label>
          <input
            type="text"
            value={propertyTypesInput}
            onChange={(e) => setPropertyTypesInput(e.target.value)}
            placeholder="Luxury Villas, Apartments, Penthouses"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
          />
          <p className="text-xs text-gray-500 mt-1">Comma-separated.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Highlights</label>
          <input
            type="text"
            value={highlightsInput}
            onChange={(e) => setHighlightsInput(e.target.value)}
            placeholder="Beachfront, Gated Community, Sea Views"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
          />
          <p className="text-xs text-gray-500 mt-1">Comma-separated. Shown as chips.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Keywords (SEO)</label>
          <input
            type="text"
            value={keywordsInput}
            onChange={(e) => setKeywordsInput(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
          />
          <p className="text-xs text-gray-500 mt-1">Comma-separated.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nearby Areas</label>
          <input
            type="text"
            value={nearbyAreasInput}
            onChange={(e) => setNearbyAreasInput(e.target.value)}
            placeholder="marbella, nueva-andalucia"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
          />
          <p className="text-xs text-gray-500 mt-1">Comma-separated slugs. Used for internal linking.</p>
        </div>
      </div>

      {/* Coords & settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <p className="text-sm font-medium text-gray-700">Pin Position</p>
        <CoordinatePicker
          lat={form.coordinates_lat}
          lng={form.coordinates_lng}
          onChange={(lat, lng) => {
            update('coordinates_lat', lat);
            update('coordinates_lng', lng);
          }}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
            <input
              type="number"
              step="0.0001"
              value={form.coordinates_lat}
              onChange={(e) => update('coordinates_lat', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
            <input
              type="number"
              step="0.0001"
              value={form.coordinates_lng}
              onChange={(e) => update('coordinates_lng', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
            <input
              type="number"
              value={form.display_order}
              onChange={(e) => update('display_order', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
            />
            <p className="text-xs text-gray-500 mt-1">Lower = appears first.</p>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => update('published', e.target.checked)}
                className="w-4 h-4 text-[#0f6c74] rounded"
              />
              <span className="text-sm text-gray-700">Published (visible to public)</span>
            </label>
          </div>
        </div>
      </div>
    </form>
  );
}
