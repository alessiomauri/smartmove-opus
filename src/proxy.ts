import { createServerClient } from '@supabase/ssr';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

// Next 16 proxy convention (replaces the deprecated middleware.ts).
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin routes are locale-agnostic and gated by Supabase auth.
  if (pathname.startsWith('/admin')) {
    return adminAuth(request);
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

async function adminAuth(request: NextRequest) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === '/admin/login';

  if (!isLoginPage && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    return NextResponse.redirect(url);
  }

  if (isLoginPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // Skip Next internals, Vercel telemetry beacons, static assets, and
  // API routes. Everything else (admin OR public) flows through above.
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
};
