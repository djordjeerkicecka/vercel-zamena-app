import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/supabase/requireUser";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { deleteTicketImages } from "@/lib/supabase/storage";
import { isDemoMode } from "@/lib/demo";

const MAX_BULK = 200;

/**
 * Permanently deletes several tickets at once (with their items, notes and images). Used for
 * clearing out test/spam entries. Guarded by a single typed confirmation on the client — here we
 * only require a valid admin session and a non-empty id list.
 */
export async function POST(request: NextRequest) {
  if (isDemoMode()) return NextResponse.json({ ok: true, deleted: 0 });

  const user = await getAuthenticatedAdmin();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const ids: unknown = body?.ids;

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((i) => typeof i === "string")) {
    return NextResponse.json({ error: "Nije izabran nijedan tiket." }, { status: 400 });
  }
  if (ids.length > MAX_BULK) {
    return NextResponse.json(
      { error: `Najviše ${MAX_BULK} tiketa odjednom.` },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceRoleClient();

  // Remove the storage objects for these tickets first (DB cascade handles the image rows).
  const { data: images } = await supabase
    .from("ticket_images")
    .select("storage_path")
    .in("ticket_id", ids as string[]);

  if (images && images.length > 0) {
    await deleteTicketImages(images.map((i) => i.storage_path));
  }

  const { error } = await supabase.from("tickets").delete().in("id", ids as string[]);
  if (error) {
    return NextResponse.json({ error: "Greška prilikom brisanja tiketa." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: ids.length });
}
