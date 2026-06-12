'use client';

import { useState } from 'react';
import { toast } from 'sonner';

/**
 * Share control for facet landing pages — a facet IS a search, and its
 * pretty URL is the cleanest share, so this copies the page URL itself
 * (no short link needed). Same never-silent contract as the search
 * share: success toast, or a visible manual-copy input when the
 * clipboard refuses.
 */
export default function CopyUrlButton({ label = 'Share this page' }: { label?: string }) {
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  async function copy() {
    const url = window.location.origin + window.location.pathname;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied ✓', { description: url, duration: 6000 });
      setManualUrl(null);
    } catch {
      setManualUrl(url);
      toast.info('Copy the link below', { description: 'Your browser blocked automatic copying.' });
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={copy}
        className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gold hover:text-gold-deep transition-colors"
      >
        {label}
      </button>
      {manualUrl && (
        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gold/30 rounded-xl">
          <input
            readOnly
            value={manualUrl}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Share link"
            className="w-64 text-[12px] font-mono text-ink bg-transparent focus:outline-none"
          />
          <button type="button" onClick={() => setManualUrl(null)} className="text-[11px] text-ink/45 hover:text-gold">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
