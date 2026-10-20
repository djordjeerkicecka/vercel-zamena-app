import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";
import { isValidSerbianBankAccount } from "@/lib/bankAccount";
import { MAX_IMAGES, MIN_IMAGES } from "@/lib/constants";
import { isDemoMode, getMockTicketNumber } from "@/lib/demo";
import type { SizeDirection, SubmitTicketPayload } from "@/lib/types";

const REASON_CODES = [
  "POGRESNA_VELICINA",
  "MODEL_NE_ODGOVARA",
  "NEUDOBNO",
  "OSTECENO",
  "POGRESAN_ARTIKAL",
  "DRUGO",
];

function computeSizeDirection(
  originalSize: number | null,
  exchangeSize: number | null
): SizeDirection | null {
  if (originalSize === null || exchangeSize === null) return null;
  if (exchangeSize < originalSize) return "MANJA";
  if (exchangeSize > originalSize) return "VECA";
  return "ISTA";
}

function validatePayload(payload: SubmitTicketPayload): string | null {
  if (payload.type !== "ZAMENA" && payload.type !== "REFUNDACIJA") {
    return "Nepoznat tip zahteva.";
  }
  if (!payload.orderId || !payload.orderNumber) return "Nedostaje porudžbina.";
  if (!payload.customerName?.trim()) return "Nedostaje ime i prezime.";
  if (!payload.email?.trim()) return "Nedostaje email adresa.";
  if (!normalizePhone(payload.phone || "")) return "Neispravan broj telefona.";

  if (!payload.items || payload.items.length === 0) {
    return "Izaberite bar jedan artikal.";
  }

  for (const item of payload.items) {
    if (payload.type === "REFUNDACIJA") {
      // Reason is required for refunds only.
      if (!item.reason || !REASON_CODES.includes(item.reason)) {
        return "Neispravan razlog povraćaja.";
      }
      if (item.reason === "DRUGO" && !item.reasonText?.trim()) {
        return "Unesite obrazloženje za razlog „Drugo“.";
      }
    }
    if (payload.type === "ZAMENA" && !item.exchangeVariantId) {
      return "Izaberite zamensku varijantu za svaki artikal.";
    }
  }

  if (payload.type === "ZAMENA" && !payload.shippingAddress) {
    return "Nedostaje adresa za slanje zamenskog artikla.";
  }

  if (payload.type === "REFUNDACIJA") {
    if (!payload.bankAccount || !isValidSerbianBankAccount(payload.bankAccount)) {
      return "Neispravan broj tekućeg računa.";
    }
    if (!payload.bankAccountOwner?.trim()) return "Nedostaje ime vlasnika računa.";
    if (!payload.goodsReceivedDate) return "Nedostaje datum prijema robe.";
    if (!payload.refundTermsConfirmed) {
      return "Potrebno je potvrditi uslove refundacije.";
    }
  }

  if (payload.imagePaths.length < MIN_IMAGES || payload.imagePaths.length > MAX_IMAGES) {
    return `Potrebno je priložiti od ${MIN_IMAGES} do ${MAX_IMAGES} slike.`;
  }

  return null;
}

export async function POST(request: NextRequest) {
  let payload: SubmitTicketPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtev." }, { status: 400 });
  }

  const validationError = validatePayload(payload);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // Demo mode: validate the payload but don't persist — just return a throwaway ticket number.
  if (isDemoMode()) {
    return NextResponse.json({ ticketNumber: getMockTicketNumber() }, { status: 201 });
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .insert({
      shopify_order_id: payload.orderId,
      order_number: payload.orderNumber,
      customer_name: payload.customerName.trim(),
      email: payload.email.trim(),
      phone: payload.phone.trim(),
      shipping_address1: payload.shippingAddress?.address1 ?? null,
      shipping_address2: payload.shippingAddress?.address2 ?? null,
      shipping_city: payload.shippingAddress?.city ?? null,
      shipping_zip: payload.shippingAddress?.zip ?? null,
      shipping_country: payload.shippingAddress?.country ?? null,
      type: payload.type,
      bank_account: payload.bankAccount,
      bank_account_owner: payload.bankAccountOwner,
      goods_received_date: payload.goodsReceivedDate,
      refund_terms_confirmed: payload.refundTermsConfirmed,
    })
    .select("id, ticket_number")
    .single();

  if (ticketError || !ticket) {
    console.error("Ticket insert failed", ticketError);
    return NextResponse.json(
      { error: "Greška prilikom kreiranja zahteva. Pokušajte ponovo." },
      { status: 500 }
    );
  }

  const isExchange = payload.type === "ZAMENA";

  const itemRows = payload.items.map((item) => {
    // size_direction is only meaningful for a same-model size swap. Skip it for refunds and
    // for exchanges to a different product (comparing sizes across models is not analytics-useful).
    const sameProductSwap = isExchange && item.exchangeProductId === item.productId;
    return {
      ticket_id: ticket.id,
      shopify_line_item_id: item.lineItemId,
      product_title: item.productTitle,
      variant_title: item.variantTitle,
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
      reason: isExchange ? null : item.reason,
      reason_text: !isExchange && item.reason === "DRUGO" ? item.reasonText : null,
      original_size: item.originalSize,
      exchange_product_id: isExchange ? item.exchangeProductId : null,
      exchange_variant_id: isExchange ? item.exchangeVariantId : null,
      exchange_variant_title: isExchange ? item.exchangeVariantTitle : null,
      exchange_sku: isExchange ? item.exchangeSku : null,
      exchange_size: isExchange ? item.exchangeSize : null,
      size_direction: sameProductSwap
        ? computeSizeDirection(item.originalSize, item.exchangeSize)
        : null,
    };
  });

  const { error: itemsError } = await supabase.from("ticket_items").insert(itemRows);

  if (itemsError) {
    console.error("Ticket items insert failed", itemsError);
    await supabase.from("tickets").delete().eq("id", ticket.id);
    return NextResponse.json(
      { error: "Greška prilikom čuvanja artikala. Pokušajte ponovo." },
      { status: 500 }
    );
  }

  if (payload.imagePaths.length > 0) {
    const imageRows = payload.imagePaths.map((path) => ({ ticket_id: ticket.id, storage_path: path }));
    const { error: imagesError } = await supabase.from("ticket_images").insert(imageRows);

    if (imagesError) {
      console.error("Ticket images insert failed", imagesError);
      // Non-fatal: the ticket itself was created successfully, just log for follow-up.
    }
  }

  return NextResponse.json({ ticketNumber: ticket.ticket_number }, { status: 201 });
}
