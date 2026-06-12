'use client';

/**
 * Quiz funnel instrumentation. Two sinks, one call:
 *  - first-party: POST /api/quiz/track → quiz_events (no PII, no
 *    cookies; powers admin completion stats + per-question drop-off);
 *  - PostHog: forwarded to window.posthog when it's mounted (key
 *    configured) — same event names, so dashboards line up. Until the
 *    key exists this is a silent no-op, not a blocker.
 */

declare global {
  interface Window {
    posthog?: { capture: (event: string, props?: Record<string, unknown>) => void };
  }
}

const runId =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now());

export function trackQuiz(
  quizSlug: string,
  event: 'start' | 'answer' | 'contact_view' | 'complete',
  extra: { step?: number; questionId?: string; answerId?: string } = {}
): void {
  const payload = JSON.stringify({
    quiz: quizSlug,
    event,
    step: extra.step,
    question_id: extra.questionId,
    answer_id: extra.answerId,
    run_id: runId,
  });
  try {
    if (!navigator.sendBeacon?.('/api/quiz/track', new Blob([payload], { type: 'application/json' }))) {
      void fetch('/api/quiz/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      });
    }
  } catch {
    /* analytics must never break the quiz */
  }
  try {
    window.posthog?.capture(`quiz_${event}`, { quiz: quizSlug, ...extra });
  } catch {
    /* ditto */
  }
}
