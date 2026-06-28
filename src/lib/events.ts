import { createServerSupabaseClient } from '@/lib/supabase-server';

export type EventInput = {
  entityType: string;
  entityId?: string | null;
  action: string;
  meta?: Record<string, unknown>;
};

/**
 * Append a row to the append-only `events` log (attribution + the future
 * selection-engine trigger layer). BEST-EFFORT: never throws — an audit
 * failure must not break the admin action that triggered it.
 * Called from server actions, so it runs in a request context with the
 * acting user's session cookies.
 */
export async function logEvent(input: EventInput): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('events').insert({
      actor_user_id: user?.id ?? null,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      action: input.action,
      meta: input.meta ?? {},
    });
  } catch (e) {
    console.error('logEvent failed:', e);
  }
}
