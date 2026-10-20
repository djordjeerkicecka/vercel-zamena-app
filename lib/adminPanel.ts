import { createSupabaseServiceRoleClient } from "./supabase/server";

// Vlasnički delovi admina su ograničeni allowlistom mejlova u app_settings pod
// ključem 'admin_panel_emails' (zarezom razdvojeno). Support nalozi vide tikete.

export async function getPanelAllowlist(): Promise<string[]> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "admin_panel_emails")
      .maybeSingle();
    if (!data?.value) return [];
    return data.value
      .split(",")
      .map((e: string) => e.trim().toLowerCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function isPanelAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const allowlist = await getPanelAllowlist();
  return allowlist.includes(email.toLowerCase());
}
