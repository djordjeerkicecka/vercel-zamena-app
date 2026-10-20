import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { shopifyAdminOrderUrl } from "@/lib/shopify/client";
import { isDemoMode, getMockTicketDetail, getMockAdjacentTicketIds } from "@/lib/demo";
import { TicketDetail, type TicketDetailData } from "@/components/admin/TicketDetail";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  let ticket: (TicketDetailData & { shopify_order_id: string }) | null = null;
  let prevTicketId: string | null = null;
  let nextTicketId: string | null = null;

  if (isDemoMode()) {
    ticket = getMockTicketDetail(params.id);
    const adjacent = getMockAdjacentTicketIds(params.id);
    prevTicketId = adjacent.prevId;
    nextTicketId = adjacent.nextId;
  } else {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("tickets")
      .select("*, ticket_items(*), ticket_images(*), ticket_notes(*)")
      .eq("id", params.id)
      .order("created_at", { foreignTable: "ticket_notes", ascending: false })
      .order("created_at", { foreignTable: "ticket_items", ascending: true })
      .single<TicketDetailData & { shopify_order_id: string }>();
    ticket = data;

    // Neighbouring tickets in the same newest-first ordering as the list page, so support can
    // step through tickets without going back to the list. An id-only query stays cheap even
    // with a few thousand tickets; revisit with keyset pagination if volume grows well beyond that.
    if (ticket) {
      const { data: ids } = await supabase
        .from("tickets")
        .select("id")
        .order("created_at", { ascending: false });

      const ordered = ids ?? [];
      const idx = ordered.findIndex((row) => row.id === params.id);
      if (idx !== -1) {
        prevTicketId = idx > 0 ? ordered[idx - 1].id : null;
        nextTicketId = idx < ordered.length - 1 ? ordered[idx + 1].id : null;
      }
    }
  }

  if (!ticket) {
    notFound();
  }

  const shopifyOrderUrl = shopifyAdminOrderUrl(ticket.shopify_order_id);

  return (
    // key forces a full remount when navigating prev/next, so local state (status dropdown,
    // tracking input, dialogs) resets to the new ticket instead of carrying over.
    <TicketDetail
      key={ticket.id}
      ticket={ticket}
      shopifyOrderUrl={shopifyOrderUrl}
      prevTicketId={prevTicketId}
      nextTicketId={nextTicketId}
    />
  );
}
