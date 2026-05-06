import { createClient } from '@supabase/supabase-js';

// Static client for build-time operations (generateStaticParams, sitemap, etc.)
// This client doesn't require cookies and can be used outside request context
export function createStaticSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
