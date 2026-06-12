'use server';

import { updateTag } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { QUIZZES_TAG } from '@/lib/cache';
import type { QuizDefinition } from '@/lib/quiz';

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return supabase;
}

/** Whole-definition save from the admin editor (RLS: authenticated). */
export async function saveQuiz(quiz: QuizDefinition): Promise<void> {
  const supabase = await requireAdmin();

  if (!/^[a-z0-9-]{3,60}$/.test(quiz.slug)) throw new Error('Invalid slug');
  if (!quiz.title?.trim()) throw new Error('Title required');
  if (!['live', 'draft'].includes(quiz.status)) throw new Error('Invalid status');
  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    throw new Error('At least one question required');
  }
  for (const q of quiz.questions) {
    if (!q.id || !q.text?.trim()) throw new Error('Every question needs an id and text');
    if (!Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`Question "${q.id}" needs at least two options`);
    }
  }

  const { error } = await supabase
    .from('quizzes')
    .update({
      title: quiz.title.trim(),
      status: quiz.status,
      intro: quiz.intro ?? {},
      questions: quiz.questions,
      result: quiz.result ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq('slug', quiz.slug);
  if (error) throw new Error(error.message);
  updateTag(QUIZZES_TAG);
}

/** Duplicate an entire quiz as a draft — iterate without touching live. */
export async function duplicateQuiz(slug: string): Promise<string> {
  const supabase = await requireAdmin();
  const { data: src, error } = await supabase.from('quizzes').select('*').eq('slug', slug).single();
  if (error || !src) throw new Error('Quiz not found');

  let copySlug = `${slug}-copy`;
  for (let i = 2; i < 20; i++) {
    const { data: clash } = await supabase.from('quizzes').select('slug').eq('slug', copySlug).maybeSingle();
    if (!clash) break;
    copySlug = `${slug}-copy-${i}`;
  }

  const { error: insErr } = await supabase.from('quizzes').insert({
    slug: copySlug,
    title: `${src.title} (copy)`,
    status: 'draft',
    intro: src.intro,
    questions: src.questions,
    result: src.result,
  });
  if (insErr) throw new Error(insErr.message);
  updateTag(QUIZZES_TAG);
  return copySlug;
}
