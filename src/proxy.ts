import { createServerClient } from '@supabase/ssr';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

// Next 16 proxy convention (replaces the deprecated middleware.ts).
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin + agent routes are locale-agnostic and gated by Supabase auth + role.
  if (pathname.startsWith('/admin') || pathname.startsWith('/agent')) {
    return authGate(request);
  }

  // Short-link redirects (/s/{code}, /c/{code}) are locale-agnostic
  // route handlers — the i18n middleware must not rewrite them into
  // the locale tree.
  if (pathname.startsWith('/s/') || pathname.startsWith('/c/')) {
    return NextResponse.next();
  }

  // All other public routes go through the i18n middleware (locale detection,
  // localized pathname rewrites, hreflang headers).
  return intlMiddleware(request);
}

async function authGate(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isLoginPage = path === '/admin/login';
  const redirectTo = (p: string) => {
    const url = request.nextUrl.clone();
    url.pathname = p;
    url.search = '';
    return NextResponse.redirect(url);
  };

  // One cheap role lookup when authenticated (user_roles self-read RLS).
  let role: string | null = null;
  if (user) {
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    role = data?.role ?? null;
  }

  if (isLoginPage) {
    // Logged-in users leave login by role; anonymous or role-less users stay.
    if (user && role === 'admin') return redirectTo('/admin');
    if (user && role === 'agent') return redirectTo('/agent');
    return supabaseResponse;
  }

  if (!user) return redirectTo('/admin/login');

  // /admin/* is admin-only — agents are bounced to their own dashboard.
  if (path.startsWith('/admin') && role !== 'admin') {
    return redirectTo(role === 'agent' ? '/agent' : '/admin/login');
  }
  // /agent/* needs a role (agent, or admin viewing).
  if (path.startsWith('/agent') && role !== 'agent' && role !== 'admin') {
    return redirectTo('/admin/login');
  }

  return supabaseResponse;
}

export const config = {
  // Skip Next internals, Vercel telemetry beacons, static assets, and
  // API routes. Everything else (admin OR public) flows through above.
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
};
