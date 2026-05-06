'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { BlogPost } from '@/types/blog';
import { BLOG_POSTS as STATIC_BLOG_POSTS } from '@/lib/blog-data';
import { revalidatePath } from 'next/cache';

// Fetch all blog posts (admin - includes unpublished)
export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('published_at', { ascending: false });

  if (error) {
    console.error('Error fetching blog posts:', error);
    throw new Error('Failed to fetch blog posts');
  }
  return (data || []) as BlogPost[];
}

// Fetch published posts (public). Featured posts are pinned to the top of
// the list, so anything that consumes this (homepage Latest Insight, /blog
// index, related-posts widgets) gets featured-first ordering automatically.
export async function getPublishedBlogPosts(): Promise<BlogPost[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('published', true)
    .order('featured', { ascending: false })
    .order('published_at', { ascending: false });

  if (error) {
    console.error('Error fetching blog posts:', error);
    return [];
  }
  return (data || []) as BlogPost[];
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching blog post:', error);
    return null;
  }
  return data as BlogPost;
}

export async function createBlogPost(post: Partial<BlogPost>) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { created_at, updated_at, ...dataToInsert } = post as BlogPost;

  const { data, error } = await supabase
    .from('blog_posts')
    .insert(dataToInsert)
    .select()
    .single();

  if (error) {
    console.error('Error creating blog post:', error);
    throw new Error(`Failed to create blog post: ${error.message}`);
  }

  revalidatePath('/admin/blog');
  revalidatePath('/blog');
  revalidatePath(`/blog/${data.slug}`);

  return data as BlogPost;
}

export async function updateBlogPost(slug: string, post: Partial<BlogPost>) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { created_at, updated_at, ...dataToUpdate } = post as BlogPost;

  const { data, error } = await supabase
    .from('blog_posts')
    .update(dataToUpdate)
    .eq('slug', slug)
    .select()
    .single();

  if (error) {
    console.error('Error updating blog post:', error);
    throw new Error(`Failed to update blog post: ${error.message}`);
  }

  revalidatePath('/admin/blog');
  revalidatePath('/blog');
  revalidatePath(`/blog/${slug}`);
  if (data.slug !== slug) revalidatePath(`/blog/${data.slug}`);

  return data as BlogPost;
}

export async function deleteBlogPost(slug: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('blog_posts')
    .delete()
    .eq('slug', slug);

  if (error) {
    console.error('Error deleting blog post:', error);
    throw new Error(`Failed to delete blog post: ${error.message}`);
  }

  revalidatePath('/admin/blog');
  revalidatePath('/blog');
  return { success: true };
}

export async function toggleBlogPublished(slug: string, published: boolean) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('blog_posts')
    .update({ published })
    .eq('slug', slug);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/blog');
  revalidatePath('/blog');
  return { success: true };
}

/**
 * One-time seed from the static TS data. Idempotent via upsert on slug.
 */
export async function seedBlogPostsFromStatic() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const rows = STATIC_BLOG_POSTS.map(p => ({
    slug: p.slug,
    title: p.title,
    meta_description: p.metaDescription,
    category: p.category,
    excerpt: p.excerpt,
    content: p.content,
    keywords: p.keywords,
    published_at: p.publishedAt,
    updated_at_date: p.updatedAt,
    reading_time: p.readingTime,
    featured: !!p.featured,
    hero_image: p.heroImage,
    hero_image_alt: p.heroImageAlt,
    published: true,
  }));

  const { error } = await supabase
    .from('blog_posts')
    .upsert(rows, { onConflict: 'slug' });

  if (error) {
    console.error('Seed error:', error);
    throw new Error(`Seed failed: ${error.message}`);
  }

  revalidatePath('/admin/blog');
  revalidatePath('/blog');
  return { count: rows.length };
}
