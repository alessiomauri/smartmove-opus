import { Link } from '@/i18n/navigation';
import { getCachedLiveQuizzes } from '@/lib/cache';

/**
 * Homepage entry cards for the lead-gen quizzes — engine-driven: one
 * card per LIVE quiz row, so flipping a quiz live/draft in
 * /admin/quizzes adds/removes its card with zero code. Renders nothing
 * while no quiz is live.
 */
export default async function QuizEntryCards() {
  const quizzes = await getCachedLiveQuizzes();
  if (quizzes.length === 0) return null;

  return (
    <section className="sm-section">
      <header className="sm-section__head">
        <h2 className="sm-section__title">
          <span className="sm-section__num">ii.&nbsp;</span>
          Not sure <em>where to start?</em>
        </h2>
        <span className="sm-section__num">90 seconds, no typing</span>
      </header>

      <div className={`grid grid-cols-1 ${quizzes.length > 1 ? 'md:grid-cols-2' : ''} gap-5`}>
        {quizzes.map((q) => {
          const intro = q.intro as { sub?: string; estimate?: string; eyebrow?: string };
          return (
            <Link
              key={q.slug}
              href={{ pathname: '/quiz/[slug]', params: { slug: q.slug } }}
              className="group relative bg-white border border-ink/[0.08] rounded-2xl p-8 md:p-10 overflow-hidden transition-all hover:border-gold/50 hover:shadow-[0_12px_44px_-14px_rgba(203,170,101,0.35)]"
            >
              <div className="absolute -top-16 -right-16 w-44 h-44 bg-gold/[0.06] rounded-full blur-2xl pointer-events-none transition-transform duration-500 group-hover:scale-125" />
              <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-gold mb-3">
                {intro.eyebrow ?? 'Quiz'}
              </p>
              <h3 className="font-display text-[26px] md:text-[32px] leading-[1.08] tracking-tight text-ink mb-3 max-w-sm">
                {q.title}
              </h3>
              {intro.sub && (
                <p className="text-[14px] text-ink/60 leading-relaxed max-w-md mb-6">{intro.sub}</p>
              )}
              <span className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-[0.1em] uppercase text-gold">
                {intro.estimate ?? 'Start'}
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
