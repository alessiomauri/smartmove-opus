import { notFound } from 'next/navigation';
import AdminHeader from '@/components/admin/AdminHeader';
import BlogPostForm from '@/components/admin/BlogPostForm';
import { getBlogPostBySlug } from '@/lib/actions/blog';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit Blog Post | Admin' };

export default async function EditBlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Edit: {post.title}</h1>
        <BlogPostForm mode="edit" post={post} />
      </div>
    </div>
  );
}
