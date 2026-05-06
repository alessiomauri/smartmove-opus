'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BlogPost, BLOG_CATEGORIES, BLOG_CATEGORY_LABELS } from '@/types/blog';
import HeroImagePicker from './HeroImagePicker';
import { createBlogPost, updateBlogPost, deleteBlogPost } from '@/lib/actions/blog';

interface Props {
  post?: BlogPost;
  mode: 'create' | 'edit';
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const emptyPost: BlogPost = {
  slug: '',
  title: '',
  meta_description: '',
  category: 'buying-guide',
  excerpt: '',
  content: '',
  keywords: [],
  published_at: today(),
  updated_at_date: today(),
  reading_time: '5 min read',
  featured: false,
  hero_image: '',
  hero_image_alt: '',
  published: true,
};

export default function BlogPostForm({ post, mode }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<BlogPost>(post ?? emptyPost);
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');
  const [keywordsInput, setKeywordsInput] = useState((post?.keywords ?? []).join(', '));
  const [isPending, startTransition] = useTransition();

  const update = <K extends keyof BlogPost>(key: K, value: BlogPost[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleTitleChange = (title: string) => {
    update('title', title);
    if (!slugTouched && mode === 'create') {
      update('slug', slugify(title));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.slug || !form.content) {
      toast.error('Title, slug, and content are required.');
      return;
    }

    const payload: BlogPost = {
      ...form,
      keywords: keywordsInput.split(',').map(s => s.trim()).filter(Boolean),
      updated_at_date: today(),
    };

    startTransition(async () => {
      try {
        if (mode === 'create') {
          await createBlogPost(payload);
          toast.success('Blog post created');
          router.push('/admin/blog');
        } else {
          await updateBlogPost(post!.slug, payload);
          toast.success('Blog post updated');
          router.push('/admin/blog');
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Save failed');
      }
    });
  };

  const handleDelete = () => {
    if (!post) return;
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteBlogPost(post.slug);
        toast.success('Blog post deleted');
        router.push('/admin/blog');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Delete failed');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/blog" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Back to posts
        </Link>
        <div className="flex items-center gap-2">
          {mode === 'edit' && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md"
            >
              Delete
            </button>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f6c74] text-white text-sm font-medium rounded-md hover:bg-[#0a4f55] disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {mode === 'create' ? 'Create Post' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Title & Slug */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30 focus:border-[#0f6c74]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => { setSlugTouched(true); update('slug', e.target.value); }}
            disabled={mode === 'edit'}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30 focus:border-[#0f6c74] disabled:bg-gray-50 disabled:text-gray-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            {mode === 'edit'
              ? 'Slug is fixed once created (URL stability).'
              : 'URL path: /blog/' + (form.slug || 'your-slug')}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => update('category', e.target.value as BlogPost['category'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
            >
              {BLOG_CATEGORIES.map(c => (
                <option key={c} value={c}>{BLOG_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reading Time</label>
            <input
              type="text"
              value={form.reading_time}
              onChange={(e) => update('reading_time', e.target.value)}
              placeholder="e.g. 8 min read"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
            />
          </div>
        </div>
      </div>

      {/* Hero Image */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <HeroImagePicker
          value={form.hero_image}
          onChange={(url) => update('hero_image', url)}
          bucket="blog-images"
          label="Hero Image"
          helperText="This image appears on the article hero and in social previews (OG image)."
        />
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Hero Image Alt Text</label>
          <input
            type="text"
            value={form.hero_image_alt}
            onChange={(e) => update('hero_image_alt', e.target.value)}
            placeholder="Descriptive alt text for SEO/accessibility"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
          />
        </div>
      </div>

      {/* Meta & Excerpt */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description (SEO)</label>
          <textarea
            value={form.meta_description}
            onChange={(e) => update('meta_description', e.target.value)}
            rows={2}
            maxLength={180}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
          />
          <p className="text-xs text-gray-500 mt-1">{form.meta_description.length}/180. Ideal 150-160 chars.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
          <textarea
            value={form.excerpt}
            onChange={(e) => update('excerpt', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
          />
          <p className="text-xs text-gray-500 mt-1">Shown on blog listing cards.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
          <input
            type="text"
            value={keywordsInput}
            onChange={(e) => setKeywordsInput(e.target.value)}
            placeholder="marbella property, costa del sol, buying guide"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
          />
          <p className="text-xs text-gray-500 mt-1">Comma-separated.</p>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Content (Markdown) *</label>
        <textarea
          value={form.content}
          onChange={(e) => update('content', e.target.value)}
          rows={24}
          className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
          placeholder={`Start with a paragraph...

## A Section Heading

Another paragraph here.`}
        />
        <p className="text-xs text-gray-500 mt-1">
          Use <code className="bg-gray-100 px-1 rounded">## Heading</code> for section headings. Separate paragraphs with blank lines.
        </p>
      </div>

      {/* Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Published Date</label>
            <input
              type="date"
              value={form.published_at}
              onChange={(e) => update('published_at', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated Date</label>
            <input
              type="date"
              value={form.updated_at_date}
              onChange={(e) => update('updated_at_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6c74]/30"
            />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => update('featured', e.target.checked)}
              className="w-4 h-4 text-[#0f6c74] rounded"
            />
            <span className="text-sm text-gray-700">Featured (shows on blog index)</span>
          </label>
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
    </form>
  );
}
