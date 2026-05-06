# Auth

Admin-only authentication. The public site has no user accounts.

---

## Provider

**Supabase Auth**, email + password. JWT cookies refreshed by middleware on every admin request.

---

## Admin User Creation

There is **no signup flow exposed**. Admin users are created manually via the Supabase dashboard:

1. Supabase → Authentication → Users → Add user
2. Provide email + password
3. Save

This is intentional: only one or two admin accounts exist; you never want anyone signing up to the admin panel.

To revoke access: delete the user in the Supabase dashboard.

---

## Login Flow

`src/app/admin/login/page.tsx`:

- `'use client'` page with email + password form
- On submit calls `signIn` server action from `src/lib/actions/auth.ts`:
  ```ts
  export async function signIn(email: string, password: string) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }
  ```
- On success: `router.push('/admin')` + `router.refresh()` (force middleware re-run with new cookies)
- On error: shows toast

---

## Middleware (`src/middleware.ts`)

Runs on every request matching the matcher:

```ts
export const config = {
  matcher: ['/admin/:path*'],
};
```

The matcher is tight — middleware only runs on admin routes, not public pages (zero overhead on public traffic).

Inside:
1. Create a Supabase server client bound to the request/response cookies
2. Call `supabase.auth.getUser()` — this **refreshes the JWT** if it's near expiry, writing new cookies to the response
3. Check `request.nextUrl.pathname`:
   - On `/admin/login` + already authed → redirect to `/admin`
   - On any other admin route + not authed → redirect to `/admin/login`
4. Return the (potentially modified) response

This pattern is the recommended Supabase Auth + Next.js App Router setup.

---

## Sign Out

`signOut` server action in `src/lib/actions/auth.ts`:

```ts
export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
```

Triggered by a "Sign out" link in the admin header.

---

## RLS Implications

Supabase RLS is the second line of defence. Even if middleware were misconfigured, RLS would prevent unauthorised data mutations:

- `properties`, `areas`, `blog_posts`, `collections`, `feature_options`, `site_settings` — anon can SELECT (with `published = true` for properties), but only authenticated users can INSERT/UPDATE/DELETE
- Storage buckets — same pattern: public read, authenticated write

So an attacker who somehow bypassed middleware would still hit RLS on every write.

---

## Server Actions Auth Check

Every mutation server action verifies the user is authenticated as a defence-in-depth measure:

```ts
export async function updateProperty(id: string, data: Partial<Property>) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to update a property');
  // … proceed with update
}
```

Pattern repeated in: properties, areas, blog, collections, features actions.

---

## Recreating Auth

1. Enable Email auth in Supabase project (Authentication > Providers)
2. Disable signups (Authentication > Users > Disable new sign-ups) — admin-only
3. Create your admin user manually
4. Copy `src/lib/supabase-server.ts`, `src/lib/supabase.ts`
5. Copy `src/middleware.ts` (admin gate)
6. Copy `src/lib/actions/auth.ts` (signIn / signOut)
7. Copy `src/app/admin/login/page.tsx`
8. Add the auth-check pattern to every mutation server action
