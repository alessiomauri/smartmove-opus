'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

const TARGET = new Date('2026-09-01T00:00:00+02:00').getTime();
const pad = (n: number) => (n < 10 ? '0' : '') + n;

/** Live countdown to the Dubai launch (1 September 2026). */
export function DubaiCountdown() {
  const [t, setT] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, TARGET - Date.now());
      setT({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="countdown" aria-label="Countdown to launch">
      <div className="cd-cell"><span className="cd-n">{pad(t.d)}</span><span className="cd-l">Days</span></div>
      <div className="cd-cell"><span className="cd-n">{pad(t.h)}</span><span className="cd-l">Hours</span></div>
      <div className="cd-cell"><span className="cd-n">{pad(t.m)}</span><span className="cd-l">Minutes</span></div>
      <div className="cd-cell"><span className="cd-n">{pad(t.s)}</span><span className="cd-l">Seconds</span></div>
    </div>
  );
}

/**
 * Dubai waitlist form → the existing hardened /api/leads (no new endpoint).
 * source 'newsletter', source_detail 'smartmove-dubai'. Mirrors LeadForm's
 * anti-spam: signed mount-time token (_ts) + honeypot ('company').
 */
export function DubaiWaitlist() {
  const tokenRef = useRef<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  useEffect(() => {
    fetch('/api/leads/token')
      .then((r) => r.json())
      .then((d) => { tokenRef.current = d.token ?? null; })
      .catch(() => {});
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === 'sending' || !email) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'newsletter',
          source_detail: 'smartmove-dubai',
          name: name || 'Dubai waitlist',
          email,
          _ts: tokenRef.current ?? undefined,
          company: honeypot,
        }),
      });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return <div className="wl-fine" style={{ fontSize: 14, color: 'var(--sm-gold-soft)' }}>You&apos;re on the list. We&apos;ll send one note when the doors open.</div>;
  }

  return (
    <form className="wl-form" onSubmit={onSubmit}>
      {/* honeypot — hidden from humans */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} aria-hidden="true" />
      <input type="text" placeholder="Full name" aria-label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
      <input type="email" placeholder="Email address" aria-label="Email address" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Request early access'}
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 5h12M9 1l4 4-4 4" /></svg>
      </button>
      {status === 'error' && <div className="wl-fine" style={{ color: '#e0a0a0' }}>Something went wrong — please try again.</div>}
    </form>
  );
}
