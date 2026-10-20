import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/supabase/requireUser";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { deleteTicketImages } from "@/lib/supabase/storage";
import { isDemoMode } from "@/lib/demo";

/**
 * Permanently deletes a ticket, its items, notes and images. Requires the caller to
 * re-type the exact ticket number as a confirmation guard against accidental clicks.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (isDemoMode()) return NextResponse.json({ ok: true });

  const user = await getAuthenticatedAdmin();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const confirmedTicketNumber: string | undefined = body?.ticketNumber?.trim();

  const supabase = createSupabaseServiceRoleClient();

  const { data: ticket, error: fetchError } = await supabase
    .from("tickets")
    .select("id, ticket_number")
    .eq("id", params.id)
    .single();

  if (fetchError || !ticket) {
    return NextResponse.json({ error: "Tiket nije pronađen." }, { status: 404 });
  }

  if (confirmedTicketNumber !== ticket.ticket_number) {
    return NextResponse.json(
      { error: "Uneti broj tiketa se ne poklapa. Brisanje otkazano." },
      { status: 400 }
    );
  }

  const { data: images } = await supabase
    .from("ticket_images")
    .select("storage_path")
    .eq("ticket_id", params.id);

  if (images && images.length > 0) {
    await deleteTicketImages(images.map((i) => i.storage_path));
  }

  // ticket_items, ticket_images and ticket_notes cascade-delete via FK ON DELETE CASCADE.
  const { error: deleteError } = await supabase.from("tickets").delete().eq("id", params.id);

  if (deleteError) {
    return NextResponse.json({ error: "Greška prilikom brisanja tiketa." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
