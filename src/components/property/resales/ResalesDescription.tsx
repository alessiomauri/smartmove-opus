'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Description block — the design's clamped body + "Read full description"
 * toggle. The button only appears when the copy actually overflows the
 * clamp (matches the design's requestAnimationFrame measure).
 */
export default function ResalesDescription({ heading, paras }: { heading: string; paras: string[] }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [clamped, setClamped] = useState(true);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    // Measured against the clamp's max-height (220px) + mask threshold.
    setOverflows(el.scrollHeight > 300);
  }, [paras]);

  // last word of the heading italicised, like the design's <em> tail
  const m = heading.match(/^(.*?)(\S+)$/);
  const head = m ? (
    <>{m[1]}<em>{m[2]}</em></>
  ) : (
    heading
  );

  return (
    <article className="rs-desc rs-reveal">
      <div className="rs-kicker">About this property</div>
      <h2>{head}</h2>
      <div ref={bodyRef} className={`body${clamped && overflows ? ' clamped' : ''}`}>
        {paras.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {overflows && (
        <button className="rs-readmore" type="button" onClick={() => setClamped((c) => !c)}>
          {clamped ? 'Read full description' : 'Show less'}
        </button>
      )}
    </article>
  );
}
