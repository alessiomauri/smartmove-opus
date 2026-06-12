'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  scoreAnswers,
  resolveAreaMatches,
  resolveDevelopmentMatches,
  resolvePhoto,
  listingsForArea,
  type QuizDefinition,
  type AreaPoolItem,
  type ListingPoolItem,
  type DevPoolItem,
} from '@/lib/quiz';
import { trackQuiz } from '@/lib/quiz-track';

/**
 * The one quiz renderer (Prompt 6). Consumes ANY definition row:
 * intro → one question per screen (photo-card taps / sliders, zero
 * typing) → contact gate styled as the FINAL STEP with the matches
 * blurred behind it → instant results.
 *
 * Conversion mechanics (decided):
 *  - matches are computed CLIENT-SIDE before the gate, so the teaser
 *    is real and results render the instant the lead submits;
 *  - the lead posts in the BACKGROUND to the hardened /api/leads
 *    (signed token + honeypot + rate limit) — no spinner between
 *    submit and payoff;
 *  - phone is REQUIRED (call-first sales flow) — framing does the
 *    persuasion, never field removal;
 *  - result cards only surface CURATED content (the pools the server
 *    passed are pre-filtered; resolvers enforce it again).
 */

interface Props {
  quiz: QuizDefinition;
  areas: AreaPoolItem[];
  listings: ListingPoolItem[];
  devs: DevPoolItem[];
}

type Stage = 'intro' | 'questions' | 'contact' | 'results';

export default function QuizRunner({ quiz, areas, listings, devs }: Props) {
  const locale = useLocale();
  const [stage, setStage] = useState<Stage>('intro');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Contact fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [error, setError] = useState('');

  const total = quiz.questions.length;
  const question = quiz.questions[step];

  // Matches — computed live as answers accumulate (powers the teaser).
  const matches = useMemo(() => {
    const totals = scoreAnswers(quiz.questions, answers);
    return quiz.result.kind === 'area'
      ? resolveAreaMatches(totals, areas, quiz.result.count)
      : resolveDevelopmentMatches(totals, devs, quiz.result.count);
  }, [answers, quiz, areas, devs]);

  // Submit token for the gate — minted at mount like every lead form.
  useEffect(() => {
    fetch('/api/leads/token')
      .then((r) => r.json())
      .then((j) => { tokenRef.current = j.token ?? null; })
      .catch(() => {});
  }, []);

  function start() {
    trackQuiz(quiz.slug, 'start');
    setStage('questions');
  }

  function answer(optionId: string) {
    const opt = question.options.find((o) => o.id === optionId);
    setAnswers((prev) => ({ ...prev, [question.id]: optionId }));
    trackQuiz(quiz.slug, 'answer', { step: step + 1, questionId: question.id, answerId: optionId });
    const line = opt?.feedback ?? null;
    setFeedback(line);
    // Brief beat for the reactive line, then advance.
    window.setTimeout(() => {
      setFeedback(null);
      if (step + 1 < total) {
        setStep(step + 1);
      } else {
        trackQuiz(quiz.slug, 'contact_view');
        setStage('contact');
      }
    }, line ? 1100 : 350);
  }

  function back() {
    if (stage === 'contact') {
      setStage('questions');
      return;
    }
    if (step > 0) setStep(step - 1);
    else setStage('intro');
  }

  function formatAnswers(): string {
    const lines = quiz.questions.map((q) => {
      const opt = q.options.find((o) => o.id === answers[q.id]);
      return `${q.text} → ${opt?.record ?? opt?.label ?? '—'}`;
    });
    const matchLine =
      'Matches: ' +
      matches
        .map((m) => ('slug' in m ? m.slug : ''))
        .filter(Boolean)
        .join(', ');
    return [...lines, '', matchLine].join('\n');
  }

  function coreAnswer(field: 'budget' | 'timeline' | 'purpose' | 'party'): string | undefined {
    const q = quiz.questions.find((qq) => qq.core === field);
    if (!q) return undefined;
    const opt = q.options.find((o) => o.id === answers[q.id]);
    return opt?.record ?? opt?.label;
  }

  function showMatches(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const digits = phone.replace(/[^\d]/g, '');
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Your name and a valid email, please.');
      return;
    }
    if (digits.length < 7) {
      setError('A reachable phone number is what makes the walkthrough work.');
      return;
    }

    // Results FIRST — the payoff is instant. The lead posts in the
    // background; the hardened endpoint owes us nothing visual.
    trackQuiz(quiz.slug, 'complete');
    setStage('results');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });

    void fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: quiz.result.kind === 'area' ? 'quiz-area' : 'quiz-dev',
        source_detail: `${quiz.slug} · ${matches.map((m) => ('slug' in m ? m.slug : '')).join(', ')}`.slice(0, 120),
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        message: formatAnswers(),
        budget_tier: coreAnswer('budget'),
        purchase_timeline: coreAnswer('timeline'),
        contact_method: 'phone',
        language: locale,
        _ts: tokenRef.current ?? undefined,
        company: honeypot,
      }),
    }).catch(() => {
      /* lead capture is fire-and-forget here; the visitor already has
         their results — the advisor flow recovers via analytics if a
         post ever drops. */
    });
  }

  // ───────────────────────── INTRO ─────────────────────────
  if (stage === 'intro') {
    return (
      <Shell>
        <p className="text-[10px] font-semibold tracking-[0.24em] uppercase text-gold mb-5">
          {quiz.intro.eyebrow ?? 'Quiz'}
        </p>
        <h1 className="font-display text-[38px] md:text-[56px] leading-[1.02] tracking-tight text-ink mb-5">
          {quiz.intro.heading}
        </h1>
        {quiz.intro.sub && (
          <p className="text-[16px] text-ink/65 leading-relaxed max-w-lg mx-auto mb-8">{quiz.intro.sub}</p>
        )}
        <button type="button" onClick={start} className="px-8 py-4 text-[13px] font-semibold tracking-[0.1em] uppercase bg-gold text-white rounded-full hover:bg-gold-deep transition-colors">
          {quiz.intro.cta ?? 'Start'}
        </button>
        {quiz.intro.estimate && (
          <p className="text-[12px] text-ink/40 mt-4">{quiz.intro.estimate}</p>
        )}
      </Shell>
    );
  }

  // ─────────────────────── QUESTIONS ───────────────────────
  if (stage === 'questions') {
    const picked = answers[question.id];
    return (
      <Shell>
        <Progress current={step + 1} total={total + 1} label={`${step + 1} / ${total}`} onBack={back} />
        <h2 className="font-display text-[28px] md:text-[40px] leading-[1.05] tracking-tight text-ink mb-2">
          {question.text}
        </h2>
        {question.sub && <p className="text-[14px] text-ink/55 mb-6">{question.sub}</p>}

        {question.kind === 'slider' ? (
          <div className="max-w-md mx-auto mt-8">
            {question.options.map((o, i) => (
              <button
                key={o.id}
                type="button"
                onClick={() => answer(o.id)}
                className={`w-full text-left px-5 py-4 mb-2.5 rounded-2xl border transition-all ${
                  picked === o.id
                    ? 'border-gold bg-gold/[0.07]'
                    : 'border-ink/10 bg-white hover:border-gold/60'
                }`}
              >
                <span className="flex items-center gap-4">
                  <span className="shrink-0 w-8 h-[3px] rounded-full bg-gold/20 relative overflow-hidden">
                    <span className="absolute inset-y-0 left-0 bg-gold rounded-full" style={{ width: `${((i + 1) / question.options.length) * 100}%` }} />
                  </span>
                  <span>
                    <span className="block text-[15px] font-medium text-ink">{o.label}</span>
                    {o.sublabel && <span className="block text-[12px] text-ink/50">{o.sublabel}</span>}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className={`grid gap-3.5 mt-8 ${question.kind === 'photo' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'} max-w-2xl mx-auto`}>
            {question.options.map((o) => {
              const photo = question.kind === 'photo' ? resolvePhoto(o.photo, areas) : null;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => answer(o.id)}
                  className={`group text-left rounded-2xl overflow-hidden border transition-all ${
                    picked === o.id ? 'border-gold ring-2 ring-gold/30' : 'border-ink/10 hover:border-gold/60'
                  } bg-white`}
                >
                  {photo && (
                    <span className="block relative aspect-[16/10] overflow-hidden">
                      <Image src={photo} alt="" fill className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" sizes="(max-width: 640px) 100vw, 320px" />
                    </span>
                  )}
                  <span className="block px-4 py-3.5">
                    <span className="block text-[14.5px] font-medium text-ink leading-snug">{o.label}</span>
                    {o.sublabel && <span className="block text-[12px] text-ink/50 mt-0.5">{o.sublabel}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Reactive feedback beat */}
        <div aria-live="polite" className="h-7 mt-6">
          {feedback && (
            <p className="text-[14px] text-gold font-medium animate-[fadeIn_.3s_ease]">{feedback}</p>
          )}
        </div>
      </Shell>
    );
  }

  // ──────────────────── CONTACT (final step) ────────────────────
  if (stage === 'contact') {
    return (
      <Shell wide>
        <Progress current={total + 1} total={total + 1} label="Your matches are ready" onBack={back} />
        <h2 className="font-display text-[30px] md:text-[42px] leading-[1.05] tracking-tight text-ink mb-2">
          Done — your three matches are in.
        </h2>
        <p className="text-[14.5px] text-ink/60 mb-8 max-w-md mx-auto">
          Tell us where to send the guides and your matches appear right here.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start text-left max-w-4xl mx-auto">
          {/* The teaser — real computed matches, blurred + masked */}
          <div className="order-2 lg:order-1 space-y-3 select-none" aria-hidden="true">
            {matches.map((m, i) => {
              const img = 'hero_image' in m ? m.hero_image : null;
              const label = 'name' in m ? m.name : '';
              return (
                <div key={i} className="relative rounded-2xl overflow-hidden border border-ink/10 bg-white">
                  <div className="relative h-[110px]">
                    {img && (
                      <Image src={img} alt="" fill className="object-cover blur-[6px] scale-105 brightness-[0.85]" sizes="480px" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-paper/70 via-transparent to-transparent" />
                    <div className="absolute left-4 bottom-3">
                      <span className="text-[10px] tracking-[0.2em] uppercase text-white/90 drop-shadow">Match {i + 1}</span>
                      <p className="font-display text-[20px] text-white drop-shadow-sm">
                        {label.slice(0, 2)}
                        <span className="tracking-[0.18em]">•••••</span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* The gate — styled as the last quiz step, not a form wall */}
          <form onSubmit={showMatches} className="order-1 lg:order-2 bg-white border border-ink/[0.08] rounded-2xl p-6 md:p-8 shadow-[0_8px_40px_-12px_rgba(28,26,23,0.1)]">
            <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
              <label>
                Company (leave blank)
                <input type="text" name="company" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
              </label>
            </div>
            <input
              type="text" required placeholder="Your name" aria-label="Your name" value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 mb-2.5 text-[14px] bg-white border border-ink/15 rounded-full focus:outline-none focus:border-gold transition-colors placeholder:text-ink/35"
            />
            <input
              type="email" required placeholder="your@email.com" aria-label="Email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 mb-2.5 text-[14px] bg-white border border-ink/15 rounded-full focus:outline-none focus:border-gold transition-colors placeholder:text-ink/35"
            />
            <input
              type="tel" required placeholder="Phone — incl. country code" aria-label="Phone" value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 mb-1.5 text-[14px] bg-white border border-ink/15 rounded-full focus:outline-none focus:border-gold transition-colors placeholder:text-ink/35"
            />
            <p className="text-[11.5px] text-ink/45 mb-4 px-1">
              So your area specialist can walk you through your matches — and WhatsApp you the guides.
            </p>
            {error && <p className="text-[12.5px] text-red-700 mb-3" role="alert">{error}</p>}
            <button type="submit" className="w-full px-6 py-4 text-[13px] font-semibold tracking-[0.1em] uppercase bg-gold text-white rounded-full hover:bg-gold-deep transition-colors">
              Show my matches →
            </button>
            <p className="text-[11px] text-ink/40 mt-2.5 text-center">
              Instant — your matches appear on the next screen.
            </p>
          </form>
        </div>
      </Shell>
    );
  }

  // ───────────────────────── RESULTS ─────────────────────────
  const bookingHref =
    process.env.NEXT_PUBLIC_BOOKING_URL ||
    process.env.NEXT_PUBLIC_WHATSAPP_URL ||
    null;

  return (
    <Shell wide>
      <p className="text-[10px] font-semibold tracking-[0.24em] uppercase text-gold mb-4">
        {quiz.title}
      </p>
      <h2 className="font-display text-[34px] md:text-[48px] leading-[1.03] tracking-tight text-ink mb-3">
        {quiz.result.headline}
      </h2>
      {quiz.result.sub && <p className="text-[15px] text-ink/60 max-w-lg mx-auto mb-3">{quiz.result.sub}</p>}
      {quiz.result.guideNote && (
        <p className="inline-block text-[12.5px] text-gold bg-gold/[0.08] border border-gold/25 rounded-full px-4 py-1.5 mb-10">
          {quiz.result.guideNote}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
        {matches.map((m, i) => {
          if (quiz.result.kind === 'area') {
            const area = m as AreaPoolItem;
            const picks = listingsForArea(area, listings);
            return (
              <div key={area.slug} className="bg-white border border-ink/[0.08] rounded-2xl overflow-hidden flex flex-col">
                <Link href={{ pathname: '/areas/[slug]', params: { slug: area.slug } }} className="block relative aspect-[16/10] group overflow-hidden">
                  {area.hero_image && (
                    <Image src={area.hero_image} alt={area.name} fill className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" sizes="(max-width: 768px) 100vw, 400px" />
                  )}
                  <span className="absolute top-3 left-3 text-[10px] font-semibold tracking-[0.16em] uppercase bg-white/90 text-ink rounded-full px-3 py-1">
                    Match {i + 1}
                  </span>
                </Link>
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <div>
                    <h3 className="font-display text-[22px] text-ink leading-tight">{area.name}</h3>
                    {area.subheading && <p className="text-[12.5px] text-ink/55 mt-1 leading-snug">{area.subheading}</p>}
                  </div>
                  {picks.length > 0 && (
                    <ul className="border-t border-ink/[0.07] pt-3 space-y-2">
                      {picks.map((p) => (
                        <li key={p.slug}>
                          <Link href={{ pathname: '/property/[slug]', params: { slug: p.slug } }} className="group flex items-center gap-3">
                            {p.hero_image && (
                              <span className="relative w-14 h-10 rounded-md overflow-hidden shrink-0">
                                <Image src={p.hero_image} alt="" fill className="object-cover" sizes="56px" />
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block text-[12.5px] text-ink truncate group-hover:text-gold transition-colors">{p.name}</span>
                              <span className="block text-[11.5px] text-ink/50">
                                {p.price_on_request || !p.price ? 'Price on request' : `€${p.price.toLocaleString('en-US')}`}
                                {p.bedrooms != null ? ` · ${p.bedrooms} beds` : ''}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={{ pathname: '/areas/[slug]', params: { slug: area.slug } }}
                    className="mt-auto text-[11.5px] font-semibold tracking-[0.1em] uppercase text-gold hover:text-gold-deep transition-colors"
                  >
                    Read the {area.name} guide →
                  </Link>
                </div>
              </div>
            );
          }
          const dev = m as DevPoolItem;
          return (
            <div key={dev.id} className="bg-white border border-ink/[0.08] rounded-2xl overflow-hidden flex flex-col">
              <div className="relative aspect-[16/10]">
                {dev.hero_image && <Image src={dev.hero_image} alt={dev.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 400px" />}
                <span className="absolute top-3 left-3 text-[10px] font-semibold tracking-[0.16em] uppercase bg-white/90 text-ink rounded-full px-3 py-1">
                  Match {i + 1}
                </span>
              </div>
              <div className="p-5 flex flex-col gap-2 flex-1">
                <h3 className="font-display text-[22px] text-ink leading-tight">{dev.name}</h3>
                <p className="text-[12.5px] text-ink/55">
                  {[dev.area ?? dev.location, dev.price_from ? `from €${dev.price_from.toLocaleString('en-US')}` : null].filter(Boolean).join(' · ')}
                </p>
                <Link
                  href={{ pathname: '/new-developments/[slug]', params: { slug: dev.slug } }}
                  className="mt-auto text-[11.5px] font-semibold tracking-[0.1em] uppercase text-gold hover:text-gold-deep transition-colors"
                >
                  See the project →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Orientation-call CTA — swappable: Cal.com when wired, else WhatsApp/contact */}
      <div className="mt-12 bg-white border border-ink/[0.08] rounded-2xl px-8 py-9 max-w-xl mx-auto">
        <h3 className="font-display text-[24px] text-ink mb-1.5">{quiz.result.cta?.label ?? 'Book a 30-min orientation call'}</h3>
        {quiz.result.cta?.sub && <p className="text-[13.5px] text-ink/55 mb-5">{quiz.result.cta.sub}</p>}
        {bookingHref ? (
          <a href={bookingHref} target="_blank" rel="noopener noreferrer" className="inline-block px-7 py-3.5 text-[12.5px] font-semibold tracking-[0.1em] uppercase bg-gold text-white rounded-full hover:bg-gold-deep transition-colors">
            Pick a time
          </a>
        ) : (
          <Link href="/contact" className="inline-block px-7 py-3.5 text-[12.5px] font-semibold tracking-[0.1em] uppercase bg-gold text-white rounded-full hover:bg-gold-deep transition-colors">
            Arrange the call
          </Link>
        )}
      </div>
    </Shell>
  );
}

/* ───────── shared bits ───────── */

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto px-6 py-14 md:py-20 text-center ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>
      {children}
    </div>
  );
}

function Progress({ current, total, label, onBack }: { current: number; total: number; label: string; onBack: () => void }) {
  return (
    <div className="mb-9">
      <div className="flex items-center justify-between mb-2.5">
        <button type="button" onClick={onBack} className="text-[12px] text-ink/45 hover:text-gold transition-colors">
          ← Back
        </button>
        <span className="text-[11px] tracking-[0.14em] uppercase text-ink/50">{label}</span>
      </div>
      <div className="h-[3px] bg-ink/[0.08] rounded-full overflow-hidden">
        <div
          className="h-full bg-gold rounded-full transition-all duration-500 ease-out"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
}
