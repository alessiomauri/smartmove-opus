import type { PropertyStatus, PropertyType } from '@/types/property';

/** The lean column set /admin/inventory ships to the client (one page only). */
export type InventoryRow = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  area: string | null;
  price: number | null;
  price_on_request: boolean;
  status: PropertyStatus;
  property_type: PropertyType;
  bedrooms: number | null;
  source: string | null;
  source_id: string | null;
  is_featured: boolean;
  featured_order: number;
  published: boolean;
  pending_review: boolean;
  rejected: boolean;
  hide_price_drop: boolean;
  hero_image: string;
  created_at: string;
};

export type InventoryParams = {
  page?: string;
  q?: string;
  status?: string;     // PropertyStatus | 'all'
  published?: string;  // 'all' | 'published' | 'draft'
  review?: string;     // 'all' | 'pending' | 'rejected'
  featured?: string;   // 'all' | 'featured' | 'not'
  sort?: string;       // 'created_at' | 'price' | 'name'
  dir?: string;        // 'asc' | 'desc'
};

export type InventoryCounts = {
  total: number;
  pendingReview: number;
  published: number;
  sold: number;
};

export type BulkAction =
  | 'approve' | 'reject' | 'publish' | 'hide' | 'feature' | 'unfeature';

export const PAGE_SIZE = 50;
