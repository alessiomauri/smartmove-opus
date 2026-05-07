export type PropertyStatus = 'available' | 'sold' | 'reserved' | 'under_offer' | 'coming_soon';
export type PropertyType =
  | 'villa'
  | 'apartment'
  | 'townhouse'
  | 'penthouse'
  | 'plot_with_project';

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  villa: 'Villa',
  apartment: 'Apartment',
  townhouse: 'Townhouse',
  penthouse: 'Penthouse',
  plot_with_project: 'Plot with Project',
};

export type PropertySource = 'manual' | 'resales_online' | 'scraper';

export interface Property {
  id: string;
  name: string;
  slug: string;
  status: PropertyStatus;
  price: number | null;
  price_on_request: boolean;
  location: string;
  area: string;
  description: string;

  // Features
  bedrooms: number | null;
  bathrooms: number | null;
  interior_size: number | null;
  terrace_size: number | null;
  plot_size: number | null;
  orientation: string | null;
  has_pool: boolean;
  parking_spaces: number | null;

  // Additional features
  features: string[];

  // Images
  hero_image: string;
  hero_image_blur?: string | null;
  gallery_images: string[];
  floor_plan_images: string[];

  // Location
  latitude: number | null;
  longitude: number | null;
  location_description: string | null;

  // Featured
  is_featured: boolean;
  featured_order: number;

  // Categorisation
  property_type: PropertyType;
  micro_location: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
  published: boolean;
}

export interface PropertyFilters {
  status?: PropertyStatus | 'all';
  propertyType?: PropertyType;
  area?: string;
  /** Also match properties whose area name is one of these (for child main areas). */
  childAreaNames?: string[];
  /** Match properties whose micro_location is one of these slugs. */
  microLocationSlugs?: string[];
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  features?: string[];
  search?: string;
}

export type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'name';

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  available: 'Available',
  sold: 'Sold',
  reserved: 'Reserved',
  under_offer: 'Under Offer',
  coming_soon: 'Coming Soon',
};

export const STATUS_COLORS: Record<PropertyStatus, string> = {
  available: 'bg-emerald-500',
  sold: 'bg-gray-500',
  reserved: 'bg-amber-500',
  under_offer: 'bg-blue-500',
  coming_soon: 'bg-purple-500',
};

/** Main locations — used as the primary "Area" dropdown in the property form. */
export const AREAS = [
  'Marbella',
  'Marbella East',
  'Nueva Andalucia',
  'Benahavis',
  'Estepona',
  'Casares',
  'Manilva',
  'Sotogrande',
  'Mijas',
  'Fuengirola',
  'Torremolinos',
  'Malaga',
];

export const FEATURE_OPTIONS = [
  'Sea View',
  'Mountain View',
  'Golf View',
  'Private Pool',
  'Communal Pool',
  'Gym',
  'Spa',
  'Tennis Court',
  'Cinema Room',
  'Wine Cellar',
  'Guest House',
  'Staff Quarters',
  'Lift',
  'Smart Home',
  'Underfloor Heating',
  'Air Conditioning',
  'Garden',
  'Jacuzzi',
];
