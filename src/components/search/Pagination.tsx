import { Link } from '@/i18n/navigation';

/**
 * Numbered pagination (1 … 4 5 [6] 7 8 … 24) — plain server-rendered
 * links, so back/forward and refresh restore state for free. Shared by
 * the property and development search surfaces.
 */
export default function Pagination({
  page,
  pages,
  hrefFor,
}: {
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
}) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5 mt-10 flex-wrap">
      {pageWindow(page, pages).map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-2 text-ink/40 text-[13px]">…</span>
        ) : (
          <Link
            key={p}
            href={hrefFor(p as number) as never}
            aria-current={p === page ? 'page' : undefined}
            className={`min-w-[38px] h-[38px] inline-flex items-center justify-center rounded-full text-[13px] transition-colors ${
              p === page
                ? 'bg-gold text-white font-semibold'
                : 'bg-white border border-ink/10 text-ink/70 hover:border-gold hover:text-gold'
            }`}
          >
            {p}
          </Link>
        )
      )}
    </nav>
  );
}

function pageWindow(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= total - 2) [total - 1, total - 2, total - 3].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('…');
    out.push(sorted[i]);
  }
  return out;
}
