import { Property } from './property';

export type CollectionType = 'community' | 'personal';

export interface Collection {
  id: string;
  slug: string;
  title: string;
  message: string | null;
  type: CollectionType;
  cover_image: string | null;
  recipient_name: string | null;
  is_published: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionProperty {
  id: string;
  collection_id: string;
  property_id: string;
  sort_order: number;
  created_at: string;
}

// Collection with its properties loaded (for display)
export interface CollectionWithProperties extends Collection {
  properties: Property[];
}
