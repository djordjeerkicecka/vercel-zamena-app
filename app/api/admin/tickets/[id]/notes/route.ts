import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/supabase/requireUser";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => null);
  const note: string | undefined = body?.note?.trim();

  if (!note) {
    return NextResponse.json({ error: "Beleška ne sme biti prazna." }, { status: 400 });
  }

  // Demo mode: return the note back (client appends it locally) without persisting.
  if (isDemoMode()) {
    return NextResponse.json(
      {
        note: {
          id: `demo-note-${Date.now()}`,
          author_email: "demo@primer.rs",
          note,
          created_at: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  }

  const user = await getAuthenticatedAdmin();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("ticket_notes")
    .insert({ ticket_id: params.id, author_email: user.email, note })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Greška prilikom čuvanja beleške." }, { status: 500 });
  }

  return NextResponse.json({ note: data }, { status: 201 });
}
