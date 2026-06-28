import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client (RLS bypass). SERVER-ONLY — never import into a
 * client component. Used for privileged admin operations that the
 * authenticated-user client can't do under RLS, e.g. creating agent
 * auth accounts (auth.admin.*) in the Team screen.
 */
export function getServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
