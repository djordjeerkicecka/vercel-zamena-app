import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// SlanjePaketa tracking-code webhook: `id` = our custom_number, plus a tracking code.
// Payload field name may be `code` or `codes` — accept both.

async function handle(request: NextRequest) {
  if (request.nextUrl.searchParams.get("key") !== process.env.SP_WEBHOOK_KEY) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const customNumber: string | undefined = body?.id?.toString().trim();
  const code: string | undefined =
    body?.code?.toString().trim() ||
    (Array.isArray(body?.codes) ? body.codes[0]?.toString().trim() : undefined);

  if (!customNumber || !code) {
    return NextResponse.json({ error: "missing id/code" }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: row } = await supabase
    .from("ticket_shipments")
    .select("id, ticket_id, kind")
    .eq("custom_number", customNumber)
    .maybeSingle();

  if (!row) return NextResponse.json({ ok: true, ignored: "no matching shipment" });

  await supabase.from("ticket_shipments").update({ tracking_code: code }).eq("id", row.id);

  // For exchange sends, mirror the tracking number into the ticket's existing field too.
  if (row.kind === "ZAMENA") {
    await supabase.from("tickets").update({ exchange_tracking_number: code }).eq("id", row.ticket_id);
  }

  return NextResponse.json({ ok: true });
}

export async function PUT(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
