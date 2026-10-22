import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { isDemoMode } from "@/lib/demo";
import { isPanelAdmin } from "@/lib/adminPanel";
import { TenziaMark } from "@/components/Logo";

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

  const canManageShopify = !isDemoMode() && !!user && await isPanelAdmin(user.email);

  return (
    <div className="min-h-screen bg-white">
      {user && (
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-4 px-4 py-5">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link href="/admin/tiketi" aria-label="TENZIA — Podrška za zamene i refundacije" className="flex items-center text-black">
                <TenziaMark className="h-auto w-[150px] shrink-0" />
              </Link>
              <nav aria-label="Navigacija podrške" className="flex items-center gap-4 text-sm font-medium">
                <Link href="/admin/tiketi" className="text-gray-600 hover:text-brand-700">
                  Tiketi
                </Link>
                {canManageShopify && <Link href="/admin/shopify" className="text-gray-600 hover:text-brand-700">Shopify veza</Link>}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden text-sm text-gray-500 sm:inline">{user.email}</span>
              <LogoutButton />
            </div>
          </div>
        </header>
      )}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">{children}</div>
    </div>
  );
}
