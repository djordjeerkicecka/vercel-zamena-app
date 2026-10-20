import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Server client bound to the current request's cookies — used in Server Components,
 * Route Handlers and Server Actions that need to act as the logged-in admin user
 * (respects RLS policies tied to auth.uid()).
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll can be called from a Server Component where cookies are read-only;
            // safe to ignore because the middleware refreshes the session on every request.
          }
        },
      },
    }
  );
}

/**
 * Service-role client — bypasses RLS entirely. Only ever use this inside server-side
 * API route handlers, never expose it to the browser. Used by the public form submission
 * endpoint (unauthenticated customers still need to be able to create a ticket) and by
 * admin routes that perform privileged operations (hard delete, storage cleanup).
 */
export function createSupabaseServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
