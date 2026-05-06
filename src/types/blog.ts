export type BlogCategory =
  | 'buying-guide'
  | 'selling-guide'
  | 'area-guide'
  | 'market-report'
  | 'lifestyle'
  | 'investment';

export const BLOG_CATEGORIES: BlogCategory[] = [
  'buying-guide',
  'selling-guide',
  'area-guide',
  'market-report',
  'lifestyle',
  'investment',
];

export const BLOG_CATEGORY_LABELS: Record<BlogCategory, string> = {
  'buying-guide': 'Buying Guide',
  'selling-guide': 'Selling Guide',
  'area-guide': 'Area Guide',
  'market-report': 'Market Report',
  'lifestyle': 'Lifestyle',
  'investment': 'Investment',
};

/** Blog post row (DB representation - snake_case). */
export interface BlogPost {
  slug: string;
  title: string;
  meta_description: string;
  category: BlogCategory;
  excerpt: string;
  content: string;
  keywords: string[];
  published_at: string; // YYYY-MM-DD
  updated_at_date: string; // YYYY-MM-DD (editorial updated date)
  reading_time: string;
  featured: boolean;
  hero_image: string;
  hero_image_alt: string;
  published: boolean;
  created_at?: string;
  updated_at?: string;
}
