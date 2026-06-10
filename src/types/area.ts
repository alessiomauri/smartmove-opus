export type AreaRegion =
  | 'Marbella'
  | 'Estepona'
  | 'Benahavis'
  | 'Mijas'
  | 'Fuengirola'
  | 'Benalmadena'
  | 'Torremolinos'
  | 'Malaga'
  | 'Casares'
  | 'Manilva'
  | 'San Roque';

export const AREA_REGIONS: AreaRegion[] = [
  'Marbella',
  'Estepona',
  'Benahavis',
  'Mijas',
  'Fuengirola',
  'Benalmadena',
  'Torremolinos',
  'Malaga',
  'Casares',
  'Manilva',
  'San Roque',
];

/**
 * Visual classification for map pins. Independent of `is_micro_location`
 * (which expresses the hierarchy). Use this to style the map / decide what
 * appears in the grid view.
 *
 * - main:    prominent town/area (filled teal pin)
 * - micro:   neighbourhood/urbanisation (small outlined pin)
 * - resort:  specific resort or hotel complex with notable property (gold pin)
 * - airport: transit reference point (slate pin, hidden from grid)
 */
export type PinCategory = 'main' | 'micro' | 'resort' | 'airport';

export const PIN_CATEGORIES: PinCategory[] = ['main', 'micro', 'resort', 'airport'];

export const PIN_CATEGORY_LABELS: Record<PinCategory, string> = {
  main: 'Location',
  micro: 'Area',
  resort: 'Resort',
  airport: 'Airport',
};

/** Area row (DB representation - snake_case). */
export interface Area {
  slug: string;
  name: string;
  region: AreaRegion;
  title: string;
  meta_description: string;
  heading: string;
  subheading: string;
  description: string;
  property_types: string[];
  highlights: string[];
  coordinates_lat: number;
  coordinates_lng: number;
  price_range: string;
  nearby_areas: string[];
  keywords: string[];
  is_micro_location: boolean;
  parent_area: string | null;
  hero_image: string;
  hero_image_alt: string;
  hero_image_blur?: string | null;
  display_order: number;
  published: boolean;
  pin_category: PinCategory;
  created_at?: string;
  updated_at?: string;
}
