import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/supabase/requireUser";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createPickup, cancelOrders, getOrder, splitStreet } from "@/lib/slanjepaketa";
import { isDemoMode } from "@/lib/demo";

export const dynamic = "force-dynamic";

interface ShipmentRow {
  id: string;
  ticket_id: string;
  kind: "PREUZIMANJE" | "ZAMENA";
  sp_order_id: string;
  sp_number: number | null;
  custom_number: string;
  status: string;
  tracking_code: string | null;
  notes: string;
}

const ACTIVE = ["PROCESSING", "SENT"];

/** GET — returns this ticket's SP shipments, refreshing live statuses for active ones. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (isDemoMode()) return NextResponse.json({ shipments: [] });
  const user = await getAuthenticatedAdmin();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const supabase = createSupabaseServiceRoleClient();
  const { data } = await supabase
    .from("ticket_shipments")
    .select("*")
    .eq("ticket_id", params.id)
    .order("created_at", { ascending: true })
    .returns<ShipmentRow[]>();

  const rows = data ?? [];
  for (const row of rows) {
    if (!ACTIVE.includes(row.status)) continue;
    try {
      const order = await getOrder(row.sp_order_id);
      const status = order.courier_details.status;
      const tracking = order.courier_details.code ?? order.courier_details.codes?.[0] ?? null;
      if (status !== row.status || (tracking && tracking !== row.tracking_code)) {
        row.status = status;
        if (tracking) row.tracking_code = tracking;
        await supabase
          .from("ticket_shipments")
          .update({ status, tracking_code: row.tracking_code })
          .eq("id", row.id);
      }
    } catch {
      // SP hiccup — keep the stored status; webhook or next refresh will catch up.
    }
  }

  return NextResponse.json({ shipments: rows });
}

/** POST — schedules a courier pickup from the customer for this ticket's returned items. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (isDemoMode()) return NextResponse.json({ ok: true });
  const user = await getAuthenticatedAdmin();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  const supabase = createSupabaseServiceRoleClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*, ticket_items(sku, quantity, product_title)")
    .eq("id", params.id)
    .single();

  if (!ticket) return NextResponse.json({ error: "Tiket nije pronađen." }, { status: 404 });

  // One active pickup per ticket.
  const { data: existing } = await supabase
    .from("ticket_shipments")
    .select("id, status")
    .eq("ticket_id", params.id)
    .eq("kind", "PREUZIMANJE")
    .not("status", "in", "(CANCELED,REJECTED)");
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "Preuzimanje za ovaj tiket već postoji." }, { status: 400 });
  }

  // Address: ticket values, overridable from the confirm dialog (refund tickets have no address).
  const street = (body.street ?? ticket.shipping_address1 ?? "").trim();
  const city = (body.city ?? ticket.shipping_city ?? "").trim();
  const zip = (body.zip ?? ticket.shipping_zip ?? "").trim();
  const phone = (body.phone ?? ticket.phone ?? "").trim();
  const name = (body.name ?? ticket.customer_name ?? "").trim();
  if (!street || !city || !zip || !phone || !name) {
    return NextResponse.json(
      { error: "Nedostaju podaci za preuzimanje (ime, adresa, grad, poštanski broj, telefon)." },
      { status: 400 }
    );
  }

  const items = (ticket.ticket_items as { sku: string | null; quantity: number; product_title: string }[])
    .filter((i) => i.sku)
    .map((i) => ({ code: i.sku as string, quantity: i.quantity }));
  if (items.length === 0) {
    return NextResponse.json(
      { error: "Stavke tiketa nemaju SKU šifre — preuzimanje se ne može kreirati." },
      { status: 400 }
    );
  }

  const customNumber = `${ticket.ticket_number}-P`;
  try {
    const { address, address_number } = splitStreet(street);
    const order = await createPickup({
      customNumber,
      products: items,
      customer: {
        name,
        country: "Srbija",
        city,
        address,
        address_number,
        postal_code: zip,
        phone,
      },
    });

    const { data: row, error } = await supabase
      .from("ticket_shipments")
      .insert({
        ticket_id: params.id,
        kind: "PREUZIMANJE",
        sp_order_id: order._id,
        sp_number: order.number ?? null,
        custom_number: customNumber,
        status: order.courier_details.status,
      })
      .select()
      .single();
    if (error) throw error;

    await supabase.from("ticket_notes").insert({
      ticket_id: params.id,
      author_email: user.email,
      note: `Zakazano preuzimanje kod SlanjePaketa (nalog #${order.number ?? order._id}).`,
    });

    return NextResponse.json({ shipment: row }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

/** DELETE — cancels a pickup that is still PROCESSING. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (isDemoMode()) return NextResponse.json({ ok: true });
  const user = await getAuthenticatedAdmin();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const shipmentId = request.nextUrl.searchParams.get("shipmentId");
  if (!shipmentId) return NextResponse.json({ error: "Nedostaje shipmentId." }, { status: 400 });

  const supabase = createSupabaseServiceRoleClient();
  const { data: row } = await supabase
    .from("ticket_shipments")
    .select("*")
    .eq("id", shipmentId)
    .eq("ticket_id", params.id)
    .single<ShipmentRow>();
  if (!row) return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });
  if (row.status !== "PROCESSING") {
    return NextResponse.json(
      { error: "Otkazivanje je moguće samo dok je nalog u obradi (PROCESSING)." },
      { status: 400 }
    );
  }

  try {
    await cancelOrders([row.sp_order_id]);
    await supabase.from("ticket_shipments").update({ status: "CANCELED" }).eq("id", row.id);
    await supabase.from("ticket_notes").insert({
      ticket_id: params.id,
      author_email: user.email,
      note: `Otkazan SlanjePaketa nalog #${row.sp_number ?? row.sp_order_id} (${row.kind.toLowerCase()}).`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
