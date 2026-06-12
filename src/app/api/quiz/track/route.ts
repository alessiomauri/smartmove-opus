import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { isRateLimited } from '@/lib/lead-protection';

/** Quiz funnel beacons → quiz_events. No PII, no cookies. */

const EventSchema = z.object({
  quiz: z.string().min(1).max(60),
  event: z.enum(['start', 'answer', 'contact_view', 'complete']),
  step: z.number().int().min(0).max(50).optional(),
  question_id: z.string().max(60).optional(),
  answer_id: z.string().max(60).optional(),
  run_id: z.string().max(60).optional(),
});

export async function POST(req: NextRequest) {
  if (await isRateLimited(req, ':quiz-track')) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  await supabase.from('quiz_events').insert({
    quiz_slug: parsed.data.quiz,
    event: parsed.data.event,
    step: parsed.data.step ?? null,
    question_id: parsed.data.question_id ?? null,
    answer_id: parsed.data.answer_id ?? null,
    run_id: parsed.data.run_id ?? null,
  });
  return NextResponse.json({ ok: true });
}
