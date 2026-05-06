import { createServerSupabaseClient } from '@/lib/supabase-server';
import { PROPERTIES_PUBLIC } from '@/lib/feature-flags';

/**
 * Decide whether the current request should see the property listings,
 * favourites, and detail pages.
 *
 * Rules (in order):
 *   1. If `?info=1` query override is set → false (admins use this to preview
 *      the public info-mode view even while logged in)
 *   2. If PROPERTIES_PUBLIC = true → true (post-launch — everyone sees listings)
 *   3. If logged-in admin → true (live "preview mode")
 *   4. Otherwise → false (public visitor in pre-launch info-mode)
 *
 * @param searchParams Optional `?info=1` URL override (admin escape hatch)
 */
export async function shouldShowListings(searchParams?: {
  info?: string | string[];
}): Promise<boolean> {
  // Admin escape hatch: `?info=1` forces the info-mode view even for admins
  const infoParam = Array.isArray(searchParams?.info)
    ? searchParams?.info[0]
    : searchParams?.info;
  if (infoParam === '1') return false;

  if (PROPERTIES_PUBLIC) return true;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
}

/**
 * Whether the current request is from a logged-in admin. Used to decide
 * whether to show the admin preview banner on public-facing pages.
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
}
