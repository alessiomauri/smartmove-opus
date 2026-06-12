'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { duplicateQuiz } from '@/lib/actions/quizzes';

export default function DuplicateQuizButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const copy = await duplicateQuiz(slug);
            toast.success(`Duplicated as draft: ${copy}`);
            router.push(`/admin/quizzes/${copy}`);
          } catch (e) {
            toast.error('Duplicate failed', { description: e instanceof Error ? e.message : String(e) });
          }
        })
      }
      style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid #ddd', background: '#fff', color: '#444', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
    >
      {pending ? 'Copying…' : 'Duplicate'}
    </button>
  );
}
