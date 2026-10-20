import { NextRequest, NextResponse } from "next/server";
import { findOrderByNumberAndPhone } from "@/lib/shopify/orders";
import { checkRateLimit, sweepExpiredBuckets } from "@/lib/rateLimiter";
import { isDemoMode, getMockOrder } from "@/lib/demo";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const GENERIC_NOT_FOUND_MESSAGE = "Porudžbina nije pronađena, proverite podatke.";

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  sweepExpiredBuckets();

  const ip = getClientIp(request);
  const { allowed } = checkRateLimit(`order-lookup:${ip}`, MAX_ATTEMPTS, WINDOW_MS);

  if (!allowed) {
    return NextResponse.json(
      { error: "Previše pokušaja. Pokušajte ponovo za nekoliko minuta." },
      { status: 429 }
    );
  }

  let body: { orderNumber?: string; phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtev." }, { status: 400 });
  }

  const orderNumber = body.orderNumber?.trim();
  const phone = body.phone?.trim();

  if (!orderNumber || !phone) {
    return NextResponse.json(
      { error: "Unesite broj porudžbine i broj telefona." },
      { status: 400 }
    );
  }

  // Demo mode: return a fake order for any input so the wizard steps can be previewed.
  if (isDemoMode()) {
    return NextResponse.json({ order: getMockOrder() });
  }

  try {
    const order = await findOrderByNumberAndPhone(orderNumber, phone);

    if (!order) {
      return NextResponse.json({ error: GENERIC_NOT_FOUND_MESSAGE }, { status: 404 });
    }

    if (order.lineItems.length === 0) {
      return NextResponse.json(
        { error: "Porudžbina ne sadrži artikle koji se mogu vratiti." },
        { status: 404 }
      );
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Order lookup failed", error);
    return NextResponse.json(
      { error: "Došlo je do greške prilikom pretrage porudžbine. Pokušajte ponovo." },
      { status: 500 }
    );
  }
}
