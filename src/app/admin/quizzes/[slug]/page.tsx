import { notFound, redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import QuizEditor from './QuizEditor';
import type { QuizDefinition } from '@/lib/quiz';

export const dynamic = 'force-dynamic';

export default async function AdminQuizEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const { slug } = await params;
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('slug', slug).maybeSingle();
  if (!quiz) notFound();

  // Photo picker options: every published area's hero image, offered as
  // the stable `area:<slug>` token.
  const { data: areas } = await supabase
    .from('areas')
    .select('slug, name')
    .eq('published', true)
    .order('name');

  return (
    <QuizEditor
      initial={quiz as unknown as QuizDefinition}
      areaOptions={(areas ?? []).map((a) => ({ slug: a.slug, name: a.name }))}
    />
  );
}
