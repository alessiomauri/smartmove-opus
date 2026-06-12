'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { saveQuiz } from '@/lib/actions/quizzes';
import type { QuizDefinition, QuizQuestion, QuizOption, CoreField } from '@/lib/quiz';

/**
 * Pragmatic structured editor over a quiz definition — plain forms in
 * the admin idiom, not a page builder. Everything the engine reads is
 * editable: intro/title/status, questions (add / remove / reorder),
 * option text + photos (area-token picker or URL) + per-answer
 * matching weights, result copy. Save = whole-definition write.
 */

const CORE_FIELDS: Array<CoreField | ''> = ['', 'budget', 'timeline', 'purpose', 'party', 'area_pref'];

export default function QuizEditor({
  initial,
  areaOptions,
}: {
  initial: QuizDefinition;
  areaOptions: Array<{ slug: string; name: string }>;
}) {
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizDefinition>(initial);
  const [openQ, setOpenQ] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function patch(p: Partial<QuizDefinition>) {
    setQuiz((q) => ({ ...q, ...p }));
  }
  function patchQuestion(idx: number, p: Partial<QuizQuestion>) {
    setQuiz((q) => {
      const questions = [...q.questions];
      questions[idx] = { ...questions[idx], ...p };
      return { ...q, questions };
    });
  }
  function patchOption(qi: number, oi: number, p: Partial<QuizOption>) {
    setQuiz((q) => {
      const questions = [...q.questions];
      const options = [...questions[qi].options];
      options[oi] = { ...options[oi], ...p };
      questions[qi] = { ...questions[qi], options };
      return { ...q, questions };
    });
  }
  function move(idx: number, dir: -1 | 1) {
    setQuiz((q) => {
      const questions = [...q.questions];
      const j = idx + dir;
      if (j < 0 || j >= questions.length) return q;
      [questions[idx], questions[j]] = [questions[j], questions[idx]];
      return { ...q, questions };
    });
  }
  function addQuestion() {
    const id = `q-${Date.now().toString(36)}`;
    setQuiz((q) => ({
      ...q,
      questions: [
        ...q.questions,
        {
          id,
          kind: 'cards',
          text: 'New question',
          options: [
            { id: 'a', label: 'Option A', weights: {} },
            { id: 'b', label: 'Option B', weights: {} },
          ],
        },
      ],
    }));
    setOpenQ(id);
  }
  function removeQuestion(idx: number) {
    if (!window.confirm('Remove this question?')) return;
    setQuiz((q) => ({ ...q, questions: q.questions.filter((_, i) => i !== idx) }));
  }
  function addOption(qi: number) {
    patchQuestion(qi, {
      options: [
        ...quiz.questions[qi].options,
        { id: `opt-${Date.now().toString(36)}`, label: 'New option', weights: {} },
      ],
    });
  }
  function removeOption(qi: number, oi: number) {
    const options = quiz.questions[qi].options.filter((_, i) => i !== oi);
    patchQuestion(qi, { options });
  }

  function save() {
    startTransition(async () => {
      try {
        await saveQuiz(quiz);
        toast.success('Quiz saved', {
          description: quiz.status === 'live' ? 'Live immediately — caches refreshed.' : 'Saved as draft.',
        });
        router.refresh();
      } catch (e) {
        toast.error('Save failed', { description: e instanceof Error ? e.message : String(e) });
      }
    });
  }

  return (
    <main style={{ padding: '40px 32px', maxWidth: 980, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, marginBottom: 4 }}>Edit quiz</h1>
          <p style={{ color: '#888', fontSize: 12.5, fontFamily: 'monospace' }}>/quiz/{quiz.slug}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a
            href={`/quiz/${quiz.slug}${quiz.status === 'draft' ? '?preview=1' : ''}`}
            target="_blank"
            rel="noreferrer"
            style={{ ...btnGhost }}
          >
            Preview
          </a>
          <select
            value={quiz.status}
            onChange={(e) => patch({ status: e.target.value as QuizDefinition['status'] })}
            style={{ ...inputStyle, width: 110 }}
          >
            <option value="draft">draft</option>
            <option value="live">live</option>
          </select>
          <button type="button" onClick={save} disabled={pending} style={btnPrimary}>
            {pending ? 'Saving…' : 'Save quiz'}
          </button>
        </div>
      </header>

      {/* Title + intro */}
      <Section title="Title & intro">
        <Field label="Title">
          <input style={inputStyle} value={quiz.title} onChange={(e) => patch({ title: e.target.value })} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Eyebrow">
            <input style={inputStyle} value={quiz.intro.eyebrow ?? ''} onChange={(e) => patch({ intro: { ...quiz.intro, eyebrow: e.target.value } })} />
          </Field>
          <Field label="Start button">
            <input style={inputStyle} value={quiz.intro.cta ?? ''} onChange={(e) => patch({ intro: { ...quiz.intro, cta: e.target.value } })} />
          </Field>
        </div>
        <Field label="Intro heading">
          <input style={inputStyle} value={quiz.intro.heading ?? ''} onChange={(e) => patch({ intro: { ...quiz.intro, heading: e.target.value } })} />
        </Field>
        <Field label="Intro sub-copy">
          <textarea style={{ ...inputStyle, borderRadius: 10, minHeight: 60 }} value={quiz.intro.sub ?? ''} onChange={(e) => patch({ intro: { ...quiz.intro, sub: e.target.value } })} />
        </Field>
        <Field label="Estimate line (e.g. '7 questions · under 90 seconds')">
          <input style={inputStyle} value={quiz.intro.estimate ?? ''} onChange={(e) => patch({ intro: { ...quiz.intro, estimate: e.target.value } })} />
        </Field>
      </Section>

      {/* Questions */}
      <Section
        title={`Questions (${quiz.questions.length})`}
        action={<button type="button" onClick={addQuestion} style={btnGhost}>+ Add question</button>}
      >
        {quiz.questions.map((q, qi) => {
          const open = openQ === q.id;
          return (
            <div key={q.id} style={{ border: '1px solid #e5e5e5', borderRadius: 10, marginBottom: 10, background: '#fff' }}>
              <div
                onClick={() => setOpenQ(open ? null : q.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}
              >
                <span style={{ color: '#999', fontSize: 12, width: 22 }}>{qi + 1}.</span>
                <strong style={{ fontSize: 14, flex: 1 }}>{q.text}</strong>
                <span style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {q.kind}{q.core ? ` · core:${q.core}` : ''}
                </span>
                <span onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 4 }}>
                  <MiniBtn onClick={() => move(qi, -1)} disabled={qi === 0}>↑</MiniBtn>
                  <MiniBtn onClick={() => move(qi, 1)} disabled={qi === quiz.questions.length - 1}>↓</MiniBtn>
                  <MiniBtn onClick={() => removeQuestion(qi)} danger>✕</MiniBtn>
                </span>
              </div>

              {open && (
                <div style={{ borderTop: '1px solid #f0f0f0', padding: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                    <Field label="Question text">
                      <input style={inputStyle} value={q.text} onChange={(e) => patchQuestion(qi, { text: e.target.value })} />
                    </Field>
                    <Field label="Kind">
                      <select style={inputStyle} value={q.kind} onChange={(e) => patchQuestion(qi, { kind: e.target.value as QuizQuestion['kind'] })}>
                        <option value="photo">photo cards</option>
                        <option value="cards">cards</option>
                        <option value="slider">slider</option>
                      </select>
                    </Field>
                    <Field label="Core field (lead column)">
                      <select style={inputStyle} value={q.core ?? ''} onChange={(e) => patchQuestion(qi, { core: (e.target.value || null) as QuizQuestion['core'] })}>
                        {CORE_FIELDS.map((c) => (
                          <option key={c} value={c}>{c || '—'}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Sub-copy (optional)">
                    <input style={inputStyle} value={q.sub ?? ''} onChange={(e) => patchQuestion(qi, { sub: e.target.value })} />
                  </Field>

                  <div style={{ marginTop: 8 }}>
                    {q.options.map((o, oi) => (
                      <div key={o.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 8, background: '#fafafa' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                          <Field label={`Option ${oi + 1} — label`}>
                            <input style={inputStyle} value={o.label} onChange={(e) => patchOption(qi, oi, { label: e.target.value })} />
                          </Field>
                          <Field label="Sub-label">
                            <input style={inputStyle} value={o.sublabel ?? ''} onChange={(e) => patchOption(qi, oi, { sublabel: e.target.value })} />
                          </Field>
                          <Field label="Recorded as (lead answer)">
                            <input style={inputStyle} value={o.record ?? ''} onChange={(e) => patchOption(qi, oi, { record: e.target.value })} />
                          </Field>
                          <MiniBtn onClick={() => removeOption(qi, oi)} danger>✕</MiniBtn>
                        </div>
                        {q.kind === 'photo' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                            <Field label="Photo (URL or area token)">
                              <input style={inputStyle} value={o.photo ?? ''} onChange={(e) => patchOption(qi, oi, { photo: e.target.value })} placeholder="area:marbella or https://…" />
                            </Field>
                            <Field label="…or pick an area photo">
                              <select
                                style={inputStyle}
                                value={o.photo?.startsWith('area:') ? o.photo : ''}
                                onChange={(e) => e.target.value && patchOption(qi, oi, { photo: e.target.value })}
                              >
                                <option value="">—</option>
                                {areaOptions.map((a) => (
                                  <option key={a.slug} value={`area:${a.slug}`}>{a.name}</option>
                                ))}
                              </select>
                            </Field>
                          </div>
                        )}
                        <Field label="Reactive feedback line (optional)">
                          <input style={inputStyle} value={o.feedback ?? ''} onChange={(e) => patchOption(qi, oi, { feedback: e.target.value })} />
                        </Field>
                        <WeightsEditor
                          weights={o.weights ?? {}}
                          onChange={(weights) => patchOption(qi, oi, { weights })}
                        />
                      </div>
                    ))}
                    <button type="button" onClick={() => addOption(qi)} style={btnGhost}>+ Add option</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Section>

      {/* Result copy */}
      <Section title="Results screen">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 10 }}>
          <Field label="Headline">
            <input style={inputStyle} value={quiz.result.headline ?? ''} onChange={(e) => patch({ result: { ...quiz.result, headline: e.target.value } })} />
          </Field>
          <Field label="Matches">
            <input
              style={inputStyle}
              type="number" min={1} max={6}
              value={quiz.result.count ?? 3}
              onChange={(e) => patch({ result: { ...quiz.result, count: Number(e.target.value) || 3 } })}
            />
          </Field>
        </div>
        <Field label="Sub-copy">
          <input style={inputStyle} value={quiz.result.sub ?? ''} onChange={(e) => patch({ result: { ...quiz.result, sub: e.target.value } })} />
        </Field>
        <Field label="Guide-delivery note">
          <input style={inputStyle} value={quiz.result.guideNote ?? ''} onChange={(e) => patch({ result: { ...quiz.result, guideNote: e.target.value } })} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Call CTA label">
            <input style={inputStyle} value={quiz.result.cta?.label ?? ''} onChange={(e) => patch({ result: { ...quiz.result, cta: { ...(quiz.result.cta ?? { label: '' }), label: e.target.value } } })} />
          </Field>
          <Field label="Call CTA sub">
            <input style={inputStyle} value={quiz.result.cta?.sub ?? ''} onChange={(e) => patch({ result: { ...quiz.result, cta: { ...(quiz.result.cta ?? { label: '' }), sub: e.target.value } } })} />
          </Field>
        </div>
        <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
          Result kind is <code>{quiz.result.kind}</code> — area quizzes weight area slugs;
          development quizzes weight <code>crit:*</code> tokens (docs/QUIZZES.md).
        </p>
      </Section>
    </main>
  );
}

/* ───────── weights ───────── */

function WeightsEditor({
  weights,
  onChange,
}: {
  weights: Record<string, number>;
  onChange: (w: Record<string, number>) => void;
}) {
  const entries = Object.entries(weights);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#999', marginBottom: 5 }}>
        Matching weights (target → score)
      </div>
      {entries.map(([target, score], i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
          <input
            style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 12.5 }}
            value={target}
            placeholder="area-slug or crit:dim:value"
            onChange={(e) => {
              const next = entries.slice();
              next[i] = [e.target.value, score];
              onChange(Object.fromEntries(next));
            }}
          />
          <input
            style={{ ...inputStyle, width: 70 }}
            type="number"
            value={score}
            onChange={(e) => {
              const next = entries.slice();
              next[i] = [target, Number(e.target.value) || 0];
              onChange(Object.fromEntries(next));
            }}
          />
          <MiniBtn
            onClick={() => onChange(Object.fromEntries(entries.filter((_, j) => j !== i)))}
            danger
          >
            ✕
          </MiniBtn>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange({ ...weights, '': 1 })}
        style={{ ...btnGhost, fontSize: 11 }}
      >
        + weight
      </button>
    </div>
  );
}

/* ───────── chrome ───────── */

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 17 }}>{title}</h2>
        {action}
      </div>
      <div style={{ background: '#fcfcfb', border: '1px solid #eee', borderRadius: 12, padding: 16 }}>{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span style={{ display: 'block', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#999', marginBottom: 4 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function MiniBtn({ children, onClick, disabled, danger }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid #ddd',
        background: '#fff',
        color: danger ? '#a33b2a' : '#555',
        fontSize: 12,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #ddd',
  borderRadius: 8,
  fontSize: 13.5,
  background: '#fff',
};

const btnPrimary: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 999,
  border: 0,
  background: '#cbaa65',
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

const btnGhost: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 999,
  border: '1px solid #ddd',
  background: '#fff',
  color: '#444',
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  textDecoration: 'none',
};
