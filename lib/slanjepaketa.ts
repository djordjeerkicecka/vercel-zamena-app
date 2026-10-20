// Server-side client for the SlanjePaketa fulfilment API (courier pickups + shipments).
// Docs: https://www.slanjepaketa.rs/api — auth via `Authorization: Private <token>`.
// Never import from client components; the token must stay server-side.

export interface SpOrderProduct {
  code: string; // SKU — must exist in the SP catalog
  quantity: number;
  selling_price: number; // COD for the WHOLE line in RSD; MUST be 0 for pickups
}

export interface SpCustomer {
  name: string;
  country: string; // "Srbija"
  city: string;
  address: string;
  address_number: string;
  postal_code: string;
  phone: string;
  email?: string;
  note?: string;
}

export interface SpOrder {
  _id: string;
  package_type: "SEND_PACKAGE" | "PICK_UP_PACKAGE";
  number: number;
  custom_number?: string;
  products: SpOrderProduct[];
  customer: Partial<SpCustomer>;
  // Otkupnina koju kurir naplaćuje — support je menja kad ispravlja porudžbinu,
  // pa je ovo izvor istine o stvarno naplaćenom iznosu.
  product_order_selling_price?: number | string;
  courier_details: {
    status: "PROCESSING" | "SENT" | "DELIVERED" | "RETURN" | "CANCELED" | "REJECTED";
    type?: string;
    code?: string | null;
    codes?: string[];
  };
  created_at: string;
}

function spConfig() {
  const base = process.env.SLANJEPAKETA_BASE_URL;
  const token = process.env.SLANJEPAKETA_TOKEN;
  if (!base || !token) {
    throw new Error("SlanjePaketa nije konfigurisan (nedostaju env promenljive).");
  }
  return { base, token };
}

async function spFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { base, token } = spConfig();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Private ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON error body
  }

  if (!res.ok) {
    // SP returns HTTP 400 with a `titles` array, or a generic `{code, message}` object
    // (observed for e.g. an unknown/inactive SKU).
    const err = json as { titles?: string[]; message?: string } | null;
    const msg = err?.titles?.length
      ? err.titles.join("; ")
      : err?.message
        ? `${err.message} (najčešći uzrok: SKU ne postoji ili nije aktivan u SP katalogu)`
        : `${res.status} ${res.statusText}`;
    throw new Error(`SlanjePaketa greška: ${msg}`);
  }
  return json as T;
}

// D Express is the account default; overridable via env if they ever switch.
function defaultCourier(): string {
  return process.env.SLANJEPAKETA_COURIER || "DEXPRESS";
}

/** Splits a street line like "Bulevar oslobođenja 12" into address + number (SP wants them apart). */
export function splitStreet(street: string): { address: string; address_number: string } {
  const m = street.trim().match(/^(.*?)[\s,]+(\d+[a-zA-Z]?(?:\/\d+)?)$/);
  if (m) return { address: m[1], address_number: m[2] };
  return { address: street.trim(), address_number: "bb" };
}

/** Creates a pickup order (courier collects the parcel from the customer → SP warehouse). */
export async function createPickup(params: {
  customNumber: string;
  products: { code: string; quantity: number }[];
  customer: SpCustomer;
}): Promise<SpOrder> {
  return spFetch<SpOrder>("/product-orders", {
    method: "POST",
    body: JSON.stringify({
      package_type: "PICK_UP_PACKAGE",
      custom_number: params.customNumber,
      products: params.products.map((p) => ({ ...p, selling_price: 0 })),
      customer: params.customer,
      courier_details: { type: defaultCourier(), pay: "SENDER" } // poštarinu plaća kupac (on je pošiljalac povrata); support menja u SP po potrebi,
    }),
  });
}

/** Creates a send order (SP warehouse → customer), with optional COD per line. */
export async function createSend(params: {
  customNumber: string;
  products: SpOrderProduct[];
  customer: SpCustomer;
}): Promise<SpOrder> {
  return spFetch<SpOrder>("/product-orders", {
    method: "POST",
    body: JSON.stringify({
      package_type: "SEND_PACKAGE",
      custom_number: params.customNumber,
      products: params.products,
      customer: params.customer,
      courier_details: { type: defaultCourier(), pay: "RECIPIENT" } // poštarinu plaća kupac (primalac zamene); support menja u SP po potrebi,
    }),
  });
}

/** Cancels orders that are still PROCESSING. */
export async function cancelOrders(ids: string[]): Promise<SpOrder[]> {
  return spFetch<SpOrder[]>("/product-orders/cancel", {
    method: "PUT",
    body: JSON.stringify({ ids }),
  });
}

export async function getOrder(id: string): Promise<SpOrder> {
  return spFetch<SpOrder>(`/product-orders/${id}`);
}

/**
 * Lists SP orders, newest first, paginated with limit (max 1000) + offset. The API
 * wraps the list either as a bare array or as { data: [...] } depending on version —
 * both shapes are handled. Used by the profit tracker's shipment-status sweep.
 */
export async function listOrders(params: {
  limit?: number;
  offset?: number;
}): Promise<SpOrder[]> {
  const limit = Math.min(params.limit ?? 200, 1000);
  const offset = params.offset ?? 0;
  const res = await spFetch<SpOrder[] | { data?: SpOrder[] }>(
    `/product-orders?limit=${limit}&offset=${offset}`
  );
  if (Array.isArray(res)) return res;
  return res?.data ?? [];
}
