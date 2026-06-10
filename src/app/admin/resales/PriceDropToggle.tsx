'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { setShowPriceDropBadges } from '@/lib/actions/settings';

/**
 * Site-wide kill switch for "Price Reduced" badges. Default OFF. The
 * per-listing opt-out lives in each property's edit form; both gates
 * must pass before the public payload ever carries `price_drop: true`.
 */
export default function PriceDropToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useState(enabled);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !optimistic;
    setOptimistic(next);
    startTransition(async () => {
      try {
        await setShowPriceDropBadges(next);
        toast.success(`Price-drop badges ${next ? 'enabled' : 'disabled'} site-wide`);
        router.refresh();
      } catch (e) {
        setOptimistic(!next);
        toast.error('Failed to update setting', {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, border: '1px solid #e5e5e5', borderRadius: 8, background: '#fff', maxWidth: 640 }}>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={optimistic}
        style={{
          width: 46,
          height: 26,
          borderRadius: 999,
          border: 0,
          cursor: 'pointer',
          position: 'relative',
          background: optimistic ? '#cbaa65' : '#d4d4d4',
          transition: 'background 150ms ease',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: optimistic ? 23 : 3,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 150ms ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          }}
        />
      </button>
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
          {optimistic ? 'Badges enabled site-wide' : 'Badges disabled site-wide (default)'}
        </p>
        <p style={{ fontSize: 12.5, color: '#666', margin: '4px 0 0' }}>
          Gates the computed <code>price_drop</code> flag everywhere — cards,
          detail pages, and any future alert emails. Listings with
          &ldquo;hide price-drop badge&rdquo; set in their edit form stay
          hidden even when this is on.
        </p>
      </div>
    </div>
  );
}
