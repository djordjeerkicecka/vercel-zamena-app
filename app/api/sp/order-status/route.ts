import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// SlanjePaketa status webhook. SP sends:
//   PUT { id: '<klijent broj porudžbine>', status: '<status>', notes: '<string>' }
// where `id` is OUR custom_number (e.g. ZR-00012-P). The URL carries a secret `key` query param
// (we choose the URL in SP settings) so random callers can't spoof statuses.

const STATUS_MAP: Record<string, string> = {
  "wc-dover-send": "SENT",
  "wc-dover-deliver": "DELIVERED",
  "wc-dover-return": "RETURN",
  "wc-dover-cancel": "CANCELED",
  // Accept raw API enums too, in case SP sends them directly.
  PROCESSING: "PROCESSING",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  RETURN: "RETURN",
  CANCELED: "CANCELED",
  REJECTED: "REJECTED",
};

async function handle(request: NextRequest) {
  if (request.nextUrl.searchParams.get("key") !== process.env.SP_WEBHOOK_KEY) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const customNumber: string | undefined = body?.id?.toString().trim();
  const rawStatus: string | undefined = body?.status?.toString().trim();
  const notes: string = body?.notes?.toString() ?? "";

  if (!customNumber || !rawStatus) {
    return NextResponse.json({ error: "missing id/status" }, { status: 400 });
  }

  const status = STATUS_MAP[rawStatus];
  if (!status) return NextResponse.json({ ok: true, ignored: "unknown status" });

  const supabase = createSupabaseServiceRoleClient();
  const { data: row } = await supabase
    .from("ticket_shipments")
    .select("id, ticket_id, kind, status")
    .eq("custom_number", customNumber)
    .maybeSingle();

  // Not one of ours (e.g. a regular store order) — acknowledge so SP doesn't retry.
  if (!row) return NextResponse.json({ ok: true, ignored: "no matching shipment" });

  if (row.status !== status) {
    await supabase
      .from("ticket_shipments")
      .update({ status, notes: notes || undefined })
      .eq("id", row.id);

    const label =
      row.kind === "PREUZIMANJE"
        ? { SENT: "Kurir preuzeo paket od kupca.", DELIVERED: "Paket kupca stigao u magacin.", RETURN: "Preuzimanje vraćeno.", CANCELED: "Preuzimanje otkazano." }[status]
        : { SENT: "Zamena poslata kupcu.", DELIVERED: "Zamena isporučena kupcu.", RETURN: "Zamena vraćena (kupac nije preuzeo).", CANCELED: "Slanje zamene otkazano." }[status];

    if (label) {
      await supabase.from("ticket_notes").insert({
        ticket_id: row.ticket_id,
        author_email: "slanjepaketa@webhook",
        note: `${label}${notes ? ` (${notes})` : ""}`,
      });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function PUT(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
