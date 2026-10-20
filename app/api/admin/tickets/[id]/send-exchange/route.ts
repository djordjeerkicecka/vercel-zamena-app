import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/supabase/requireUser";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createSend, splitStreet } from "@/lib/slanjepaketa";
import { isDemoMode } from "@/lib/demo";

export const dynamic = "force-dynamic";

/**
 * POST — sends the replacement parcel (SP warehouse → customer) for an exchange ticket.
 * Expected once the pickup has reached the warehouse (DELIVERED); `force: true` skips that check.
 * Body: { otkupnina?: number (RSD, total), force?: boolean, name/street/city/zip/phone overrides }.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (isDemoMode()) return NextResponse.json({ ok: true });
  const user = await getAuthenticatedAdmin();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  const supabase = createSupabaseServiceRoleClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*, ticket_items(exchange_sku, quantity)")
    .eq("id", params.id)
    .single();

  if (!ticket) return NextResponse.json({ error: "Tiket nije pronađen." }, { status: 404 });
  if (ticket.type !== "ZAMENA") {
    return NextResponse.json({ error: "Slanje zamene važi samo za tikete tipa ZAMENA." }, { status: 400 });
  }

  // Guard: don't send twice.
  const { data: existingSend } = await supabase
    .from("ticket_shipments")
    .select("id")
    .eq("ticket_id", params.id)
    .eq("kind", "ZAMENA")
    .not("status", "in", "(CANCELED,REJECTED)");
  if (existingSend && existingSend.length > 0) {
    return NextResponse.json({ error: "Zamena je već poslata za ovaj tiket." }, { status: 400 });
  }

  // Guard: pickup should have arrived at the warehouse first (unless forced).
  if (!body.force) {
    const { data: pickup } = await supabase
      .from("ticket_shipments")
      .select("status")
      .eq("ticket_id", params.id)
      .eq("kind", "PREUZIMANJE")
      .not("status", "in", "(CANCELED,REJECTED)")
      .maybeSingle();
    if (!pickup || pickup.status !== "DELIVERED") {
      return NextResponse.json(
        { error: "Paket kupca još nije stigao u magacin. Sačekajte status „Stiglo u magacin“ ili pošaljite uz potvrdu (force)." },
        { status: 409 }
      );
    }
  }

  const items = (ticket.ticket_items as { exchange_sku: string | null; quantity: number }[])
    .filter((i) => i.exchange_sku)
    .map((i) => ({ code: i.exchange_sku as string, quantity: i.quantity }));
  if (items.length === 0) {
    return NextResponse.json(
      { error: "Tiket nema SKU šifre zamenskih artikala." },
      { status: 400 }
    );
  }

  const street = (body.street ?? ticket.shipping_address1 ?? "").trim();
  const city = (body.city ?? ticket.shipping_city ?? "").trim();
  const zip = (body.zip ?? ticket.shipping_zip ?? "").trim();
  const phone = (body.phone ?? ticket.phone ?? "").trim();
  const name = (body.name ?? ticket.customer_name ?? "").trim();
  if (!street || !city || !zip || !phone || !name) {
    return NextResponse.json({ error: "Nedostaju podaci primaoca." }, { status: 400 });
  }

  const otkupnina = Math.max(0, Math.round(parseFloat(body.otkupnina ?? "0") || 0));
  const customNumber = `${ticket.ticket_number}-Z`;

  try {
    const { address, address_number } = splitStreet(street);
    const order = await createSend({
      customNumber,
      // Surcharge for a more expensive replacement goes as COD on the first line; other lines 0.
      products: items.map((it, idx) => ({ ...it, selling_price: idx === 0 ? otkupnina : 0 })),
      customer: {
        name,
        country: "Srbija",
        city,
        address,
        address_number,
        postal_code: zip,
        phone,
        email: ticket.email ?? undefined,
        note: `Zamena po tiketu ${ticket.ticket_number}`,
      },
    });

    const { data: row, error } = await supabase
      .from("ticket_shipments")
      .insert({
        ticket_id: params.id,
        kind: "ZAMENA",
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
      note: `Poslata zamena kroz SlanjePaketa (nalog #${order.number ?? order._id}${otkupnina > 0 ? `, doplata ${otkupnina} RSD` : ""}).`,
    });

    return NextResponse.json({ shipment: row }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
