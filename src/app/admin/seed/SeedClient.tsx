'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2, Database } from 'lucide-react';
import { toast } from 'sonner';
import { seedBlogPostsFromStatic } from '@/lib/actions/blog';
import { seedAreasFromStatic } from '@/lib/actions/areas';

export default function SeedClient() {
  const [blogStatus, setBlogStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [areasStatus, setAreasStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [blogCount, setBlogCount] = useState(0);
  const [areasCount, setAreasCount] = useState(0);

  const runBlog = async () => {
    setBlogStatus('loading');
    try {
      const r = await seedBlogPostsFromStatic();
      setBlogCount(r.count);
      setBlogStatus('done');
      toast.success(`Seeded ${r.count} blog posts`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Seed failed');
      setBlogStatus('idle');
    }
  };

  const runAreas = async () => {
    setAreasStatus('loading');
    try {
      const r = await seedAreasFromStatic();
      setAreasCount(r.count);
      setAreasStatus('done');
      toast.success(`Seeded ${r.count} areas`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Seed failed');
      setAreasStatus('idle');
    }
  };

  const runAll = async () => {
    await runBlog();
    await runAreas();
  };

  return (
    <div className="space-y-4">
      <SeedCard
        title="Blog Posts"
        description="Seeds blog_posts table from src/lib/blog-data.ts"
        status={blogStatus}
        count={blogCount}
        onRun={runBlog}
      />
      <SeedCard
        title="Areas"
        description="Seeds areas table from src/lib/areas-data.ts"
        status={areasStatus}
        count={areasCount}
        onRun={runAreas}
      />

      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={runAll}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0f6c74] text-white text-sm font-medium rounded-lg hover:bg-[#0a4f55] transition-colors"
        >
          <Database className="w-4 h-4" />
          Seed Everything
        </button>
      </div>
    </div>
  );
}

function SeedCard({
  title, description, status, count, onRun,
}: {
  title: string;
  description: string;
  status: 'idle' | 'loading' | 'done';
  count: number;
  onRun: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
          {status === 'done' && (
            <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Seeded {count} records
            </p>
          )}
        </div>
        <button
          onClick={onRun}
          disabled={status === 'loading'}
          className="px-4 py-2 text-sm font-medium bg-[#0f6c74] text-white rounded-md hover:bg-[#0a4f55] disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Seeding...
            </>
          ) : (
            'Run Seed'
          )}
        </button>
      </div>
    </div>
  );
}
