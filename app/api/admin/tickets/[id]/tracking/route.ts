import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/supabase/requireUser";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (isDemoMode()) return NextResponse.json({ ok: true });

  const user = await getAuthenticatedAdmin();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const trackingNumber: string = (body?.trackingNumber ?? "").trim();

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("tickets")
    .update({ exchange_tracking_number: trackingNumber || null })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: "Greška prilikom čuvanja broja pošiljke." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
