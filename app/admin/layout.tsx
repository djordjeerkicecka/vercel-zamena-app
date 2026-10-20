import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { isDemoMode } from "@/lib/demo";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // In demo mode there is no Supabase session — show a placeholder admin identity.
  let user: { email?: string } | null = isDemoMode() ? { email: "demo@example.com" } : null;

  if (!isDemoMode()) {
    const supabase = createSupabaseServerClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  }

  return (
    <div className="admin-dark min-h-screen bg-gray-50">
      {user && (
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-6">
              <Link href="/admin/tiketi" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
                  O
                </div>
                <span className="font-bold text-brand-700">Podrška — zamene i tiketi</span>
              </Link>
              <nav className="flex items-center gap-4 text-sm font-medium">
                <Link href="/admin/tiketi" className="text-gray-600 hover:text-brand-700">
                  Tiketi
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden text-sm text-gray-500 sm:inline">{user.email}</span>
              <LogoutButton />
            </div>
          </div>
        </header>
      )}
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
