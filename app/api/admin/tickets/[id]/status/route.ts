import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/supabase/requireUser";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";

const EDITABLE_STATUSES = ["novo", "u_obradi", "odobreno", "odbijeno"];

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  // Demo mode: acknowledge without persisting (mock data is read-only).
  if (isDemoMode()) return NextResponse.json({ ok: true });

  const user = await getAuthenticatedAdmin();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const status = body?.status;

  if (!EDITABLE_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "Neispravan status. Za arhiviranje koristite akcije zatvaranja tiketa." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("tickets").update({ status }).eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: "Greška prilikom izmene statusa." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
