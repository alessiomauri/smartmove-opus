export type SelectionItem = {
  itemId: string;
  propertyId: string;
  sortOrder: number;
  summary: {
    id: string; name: string; slug: string; hero_image: string;
    price: number | null; price_on_request: boolean;
    location: string | null; area: string | null; source_id: string | null;
  } | null;
};

export type SelectionRecord = {
  id: string;
  name: string;
  status: string; // 'draft' | 'approved' | 'sent'
  sentAt: string | null;
  sendCount: number;
  items: SelectionItem[];
};
