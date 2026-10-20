import { createSupabaseServerClient } from "./server";

/** Returns the currently logged-in Supabase Auth user, or null. Used by /api/admin/* route handlers,
 * since the root middleware only guards page navigations under /admin, not API routes. */
export async function getAuthenticatedAdmin() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
