import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/supabase/requireUser";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { deleteTicketImages } from "@/lib/supabase/storage";
import { isDemoMode } from "@/lib/demo";

/**
 * Closes a ticket: "zavrseno" (Zahtev završen) or "odbijeno" (Odbij zahtev) both end with the
 * ticket archived, per the spec — a rejection note is logged so the outcome isn't lost once the
 * status collapses to 'arhivirano'. Optionally deletes the ticket's images from Storage to keep
 * the bucket from growing unbounded; the ticket row and its data are kept for analytics.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (isDemoMode()) return NextResponse.json({ ok: true });

  const user = await getAuthenticatedAdmin();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const outcome: "zavrseno" | "odbijeno" = body?.outcome;
  const deleteImages: boolean = Boolean(body?.deleteImages);

  if (outcome !== "zavrseno" && outcome !== "odbijeno") {
    return NextResponse.json({ error: "Neispravan zahtev." }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();

  const { error: updateError } = await supabase
    .from("tickets")
    .update({ status: "arhivirano" })
    .eq("id", params.id);

  if (updateError) {
    return NextResponse.json({ error: "Greška prilikom arhiviranja tiketa." }, { status: 500 });
  }

  await supabase.from("ticket_notes").insert({
    ticket_id: params.id,
    author_email: user.email,
    note: outcome === "zavrseno" ? "Zahtev završen i arhiviran." : "Zahtev odbijen i arhiviran.",
  });

  if (deleteImages) {
    const { data: images } = await supabase
      .from("ticket_images")
      .select("id, storage_path")
      .eq("ticket_id", params.id);

    if (images && images.length > 0) {
      await deleteTicketImages(images.map((i) => i.storage_path));
      await supabase.from("ticket_images").delete().eq("ticket_id", params.id);
      await supabase.from("tickets").update({ images_deleted: true }).eq("id", params.id);
    }
  }

  return NextResponse.json({ ok: true });
}
