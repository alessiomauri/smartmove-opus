'use client';

import { useState } from 'react';
import type { FeatureGroup } from '@/lib/resales-detail';

/**
 * Features & amenities — the design's category-grouped, 3-column chip
 * grid. First three groups show by default; "Show all N feature groups"
 * reveals the rest. Groups come pre-built from the feed's feature_labels.
 */
export default function ResalesFeatures({ groups }: { groups: FeatureGroup[] }) {
  const [open, setOpen] = useState(false);
  const VISIBLE = 3;
  if (groups.length === 0) return null;
  const shown = open ? groups : groups.slice(0, VISIBLE);

  return (
    <div className="rs-features rs-reveal">
      <h3>Features &amp; <em>amenities.</em></h3>
      <div className="rs-fgroups">
        {shown.map((g) => (
          <div className="rs-fgroup" key={g.label}>
            <div className="g-lbl">{g.label} <span className="n">{g.items.length}</span></div>
            <div className="rs-chips">
              {g.items.map((it) => (
                <span className="rs-chip" key={it}>{it}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {groups.length > VISIBLE && (
        <button className="rs-showall" type="button" onClick={() => setOpen((o) => !o)}>
          {open ? 'Show fewer' : `Show all ${groups.length} feature groups`}
        </button>
      )}
    </div>
  );
}
