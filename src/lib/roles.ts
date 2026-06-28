import { createServerSupabaseClient } from '@/lib/supabase-server';

export type Role = 'admin' | 'agent' | null;
export type CurrentRole = { userId: string | null; role: Role; agentId: string | null };

/**
 * Resolve the current user's role + linked agent id (from user_roles).
 * Used by server components/actions. The proxy does its own equivalent
 * lookup with its request-scoped client.
 */
export async function getCurrentRole(): Promise<CurrentRole> {
  const sb = await createServerSupabaseClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { userId: null, role: null, agentId: null };
  const { data } = await sb.from('user_roles').select('role, agent_id').eq('user_id', user.id).maybeSingle();
  return { userId: user.id, role: (data?.role ?? null) as Role, agentId: (data?.agent_id ?? null) as string | null };
}
