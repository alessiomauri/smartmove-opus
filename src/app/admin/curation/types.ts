export type EntityType = 'property' | 'development';

export type EntitySummary = {
  id: string;
  name: string;
  slug: string;
  price: number | null;
  price_on_request?: boolean;
  hero_image: string;
  location: string | null;
  area: string | null;
  source_id: string | null;
  is_featured?: boolean;
  published?: boolean;
  status?: string | null;
};

export type FeaturedItem = EntitySummary & { featured_order: number };

export type CuratedItem = {
  itemId: string;
  entityId: string;
  rank: number;
  entityType: EntityType;
  summary: EntitySummary | null;
};

export type CuratedListData = {
  slug: string;
  title: string;
  entityType: EntityType;
  items: CuratedItem[];
};
