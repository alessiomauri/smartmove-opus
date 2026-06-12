import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import DuplicateQuizButton from './DuplicateQuizButton';

/**
 * Quiz panel (Prompt 6): every quiz is a data row — list them with
 * status + funnel stats; editing happens per quiz. Adding a third quiz
 * = duplicate one as draft and reshape it. Zero code.
 */
export const dynamic = 'force-dynamic';

export default async function AdminQuizzesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('slug, title, status, questions, updated_at')
    .order('created_at', { ascending: true });

  const { data: events } = await supabase
    .from('quiz_events')
    .select('quiz_slug, event');

  const stats = new Map<string, { start: number; contact: number; complete: number }>();
  for (const e of events ?? []) {
    const s = stats.get(e.quiz_slug) ?? { start: 0, contact: 0, complete: 0 };
    if (e.event === 'start') s.start += 1;
    if (e.event === 'contact_view') s.contact += 1;
    if (e.event === 'complete') s.complete += 1;
    stats.set(e.quiz_slug, s);
  }

  const { data: quizLeads } = await supabase
    .from('leads')
    .select('source_detail')
    .in('source', ['quiz-area', 'quiz-dev']);
  const leadsByQuiz = new Map<string, number>();
  for (const l of quizLeads ?? []) {
    const slug = (l.source_detail ?? '').split(' ·')[0];
    if (slug) leadsByQuiz.set(slug, (leadsByQuiz.get(slug) ?? 0) + 1);
  }

  return (
    <main style={{ padding: '40px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, marginBottom: 6 }}>Quizzes</h1>
        <p style={{ color: '#666', fontSize: 14 }}>
          Quiz definitions are data — every question, photo and matching
          weight is editable here. Duplicate any quiz as a draft to build a
          new one; flip status to live and its homepage card appears.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(quizzes ?? []).map((q) => {
          const s = stats.get(q.slug) ?? { start: 0, contact: 0, complete: 0 };
          const leads = leadsByQuiz.get(q.slug) ?? 0;
          const completion = s.start > 0 ? `${Math.round((s.complete / s.start) * 100)}%` : '—';
          const questionCount = Array.isArray(q.questions) ? q.questions.length : 0;
          return (
            <div
              key={q.slug}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
                padding: '16px 20px',
                border: '1px solid #e5e5e5',
                borderRadius: 10,
                background: '#fff',
              }}
            >
              <div style={{ minWidth: 260, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <strong style={{ fontSize: 15.5 }}>{q.title}</strong>
                  <span
                    style={{
                      padding: '2px 10px',
                      borderRadius: 999,
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      background: q.status === 'live' ? '#dff0e1' : '#f0f0f0',
                      color: q.status === 'live' ? '#2f6f4f' : '#777',
                    }}
                  >
                    {q.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 3, fontFamily: 'monospace' }}>
                  /quiz/{q.slug} · {questionCount} questions
                </div>
              </div>

              <div style={{ display: 'flex', gap: 22, fontSize: 12.5, color: '#555' }}>
                <Stat label="Starts" value={s.start} />
                <Stat label="Reached gate" value={s.contact} />
                <Stat label="Completed" value={s.complete} />
                <Stat label="Completion" value={completion} />
                <Stat label="Leads" value={leads} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Link
                  href={`/admin/quizzes/${q.slug}`}
                  style={{ padding: '8px 16px', borderRadius: 999, background: '#cbaa65', color: '#fff', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}
                >
                  Edit
                </Link>
                <a
                  href={`/quiz/${q.slug}${q.status === 'draft' ? '?preview=1' : ''}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid #ddd', color: '#444', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}
                >
                  Preview
                </a>
                <DuplicateQuizButton slug={q.slug} />
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999' }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: '#222' }}>{value}</div>
    </div>
  );
}
