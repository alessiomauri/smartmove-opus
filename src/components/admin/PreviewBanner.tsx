import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { PROPERTIES_PUBLIC } from '@/lib/feature-flags';

interface PreviewBannerProps {
  /** Which mode the admin is currently viewing */
  mode: 'listings' | 'info';
  /** URL to swap to the OTHER mode */
  swapUrl: string;
  /** Label for the swap button */
  swapLabel: string;
}

/**
 * Small sticky banner shown at the very top of public pages when an
 * authenticated admin is viewing them. Makes it crystal-clear which mode
 * the admin is previewing and provides a one-click swap to the other view.
 *
 * Only renders when PROPERTIES_PUBLIC is false — once the site goes fully
 * public, this banner disappears entirely (no need to preview anything).
 */
export default function PreviewBanner({ mode, swapUrl, swapLabel }: PreviewBannerProps) {
  if (PROPERTIES_PUBLIC) return null;

  const isListings = mode === 'listings';

  return (
    <div className="sticky top-0 z-[100] bg-[#0f6c74] text-white text-[12px]">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          {isListings ? <Eye className="w-3.5 h-3.5 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 shrink-0" />}
          <span className="font-semibold tracking-[0.05em] uppercase shrink-0">
            Admin Preview
          </span>
          <span className="text-white/80 truncate">
            {isListings
              ? '· Post-launch listings view (visitors see this when PROPERTIES_PUBLIC = true)'
              : '· Public info-mode view (what visitors see today)'}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={swapUrl}
            className="text-white/90 hover:text-white underline underline-offset-2"
          >
            {swapLabel}
          </Link>
          <Link
            href="/admin"
            className="text-white/70 hover:text-white"
          >
            Admin →
          </Link>
        </div>
      </div>
    </div>
  );
}
