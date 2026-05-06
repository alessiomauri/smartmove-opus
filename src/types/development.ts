export type DevelopmentStatus =
  | 'off_plan'
  | 'under_construction'
  | 'key_ready'
  | 'completed'
  | 'sold_out';

export type DevelopmentSource = 'manual' | 'resales_online';

export const DEVELOPMENT_STATUS_LABELS: Record<DevelopmentStatus, string> = {
  off_plan: 'Off-plan',
  under_construction: 'Under construction',
  key_ready: 'Key-ready',
  completed: 'Completed',
  sold_out: 'Sold out',
};

export const DEVELOPMENT_STATUS_COLORS: Record<DevelopmentStatus, string> = {
  off_plan: 'bg-blue-100 text-blue-800',
  under_construction: 'bg-amber-100 text-amber-800',
  key_ready: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-stone-100 text-stone-800',
  sold_out: 'bg-rose-100 text-rose-800',
};

export const DEVELOPMENT_SOURCE_LABELS: Record<DevelopmentSource, string> = {
  manual: 'Manual',
  resales_online: 'Resales Online',
};

/** Common amenities seeded into the admin form's quick-pick. */
export const DEVELOPMENT_AMENITIES_DEFAULTS: string[] = [
  'Communal pool',
  'Private gardens',
  'Spa',
  'Gym',
  'Padel courts',
  'Tennis courts',
  'Concierge',
  '24h security',
  'Gated community',
  'Underground parking',
  'Storage rooms',
  'Co-working space',
  'Children\'s playground',
  'Yoga / wellness studio',
  'Restaurant',
  'Beach club access',
  'Golf course access',
];

export const DEVELOPMENT_UNIT_TYPES: string[] = [
  'apartment',
  'penthouse',
  'townhouse',
  'villa',
  'duplex',
  'studio',
];

export interface Development {
  id: string;
  slug: string;

  // Core
  name: string;
  developer: string | null;
  status: DevelopmentStatus;
  source: DevelopmentSource;
  source_id: string | null;
  last_synced_at: string | null;

  // Marketing copy
  title: string;
  meta_description: string;
  subtitle: string;
  short_description: string;
  description: string;

  // Pricing (range)
  price_from: number | null;
  price_to: number | null;
  price_on_request: boolean;

  // Unit composition (ranges)
  bedrooms_from: number | null;
  bedrooms_to: number | null;
  bathrooms_from: number | null;
  bathrooms_to: number | null;
  size_from: number | null;
  size_to: number | null;
  terrace_size_from: number | null;
  terrace_size_to: number | null;
  total_units: number | null;
  units_available: number | null;
  unit_types: string[];

  // Timing
  completion_date: string | null;   // ISO date string
  delivery_phases: string | null;

  // Location
  location: string | null;
  area: string | null;
  micro_location: string | null;
  latitude: number | null;
  longitude: number | null;
  location_description: string | null;

  // Media
  hero_image: string;
  hero_image_blur: string | null;
  hero_image_alt: string;
  gallery_images: string[];
  masterplan_images: string[];
  floor_plan_images: string[];
  brochure_pdf: string | null;

  // Amenities
  amenities: string[];

  // SEO
  keywords: string[];

  // Publishing / featured
  is_featured: boolean;
  featured_order: number;
  published: boolean;

  created_at: string;
  updated_at: string;
}

/** What the admin form returns on save (omits server-managed fields). */
export type DevelopmentInput = Omit<
  Development,
  'id' | 'created_at' | 'updated_at' | 'hero_image_blur' | 'last_synced_at'
> & {
  id?: string;
};
