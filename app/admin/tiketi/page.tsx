import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FiltersBar } from "@/components/admin/FiltersBar";
import { TicketListTable } from "@/components/admin/TicketListTable";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/constants";
import { isDemoMode, getMockTicketList, getMockStatusCounts } from "@/lib/demo";
import type { TicketStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

interface TicketListRow {
  id: string;
  ticket_number: string;
  created_at: string;
  customer_name: string;
  order_number: string;
  type: "ZAMENA" | "REFUNDACIJA";
  status: TicketStatus;
  ticket_items: { price: number; quantity: number }[];
  ticket_shipments?: { kind: string; status: string }[];
}

export default async function TicketsListPage({
  searchParams,
}: {
  searchParams: { status?: string; type?: string; q?: string; sort?: string };
}) {
  // Status counts (across all statuses) + filtered list. In demo mode both come from mock data.
  const counts: Record<string, number> = {};
  for (const s of STATUS_ORDER) counts[s] = 0;

  let tickets: TicketListRow[] | null = null;
  let error = false;

  if (isDemoMode()) {
    Object.assign(counts, getMockStatusCounts());
    tickets = getMockTicketList(searchParams) as TicketListRow[];
  } else {
    const supabase = createSupabaseServerClient();

    const { data: allStatuses } = await supabase.from("tickets").select("status");
    (allStatuses ?? []).forEach((row) => {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    });

    let query = supabase
      .from("tickets")
      .select(
        "id, ticket_number, created_at, customer_name, order_number, type, status, ticket_items(price, quantity), ticket_shipments(kind, status)"
      );

    if (searchParams.status) {
      query = query.eq("status", searchParams.status);
    } else {
      query = query.neq("status", "arhivirano");
    }

    if (searchParams.type) {
      query = query.eq("type", searchParams.type);
    }

    if (searchParams.q) {
      const q = searchParams.q.replace(/[%_]/g, "");
      query = query.or(`order_number.ilike.%${q}%,customer_name.ilike.%${q}%,phone.ilike.%${q}%`);
    }

    query = query.order("created_at", { ascending: searchParams.sort === "asc" });

    const result = await query.returns<TicketListRow[]>();
    tickets = result.data;
    error = Boolean(result.error);
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-gray-900">Zahtevi za zamene i refundacije</h1>

      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_ORDER.map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm ring-1 ring-gray-200">
            {STATUS_LABELS[status]}
            <span className="rounded-full bg-gray-100 px-1.5 font-bold text-gray-800">{counts[status] ?? 0}</span>
          </span>
        ))}
      </div>

      <FiltersBar />

      {error && <p className="form-error">Greška prilikom učitavanja tiketa.</p>}

      <TicketListTable tickets={tickets ?? []} />
    </div>
  );
}
