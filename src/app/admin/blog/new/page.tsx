import AdminHeader from '@/components/admin/AdminHeader';
import BlogPostForm from '@/components/admin/BlogPostForm';

export const metadata = { title: 'New Blog Post | Admin' };

export default function NewBlogPostPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">New Blog Post</h1>
        <BlogPostForm mode="create" />
      </div>
    </div>
  );
}
