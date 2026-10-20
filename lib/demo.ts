// Demo mode — lets you click through the whole wizard UI without real Shopify/Supabase
// credentials. Enabled by DEMO_MODE=true in .env.local. NEVER enable this in production:
// order lookup returns fake data for any input and ticket submission is not persisted.

import type {
  OrderLookupResultDTO,
  ProductListItemDTO,
  ProductVariantsResultDTO,
  TicketStatus,
} from "./types";
import type { TicketDetailData } from "@/components/admin/TicketDetail";

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

const DEMO_SHOE_PRODUCT_ID = "gid://shopify/Product/DEMO-SHOE";
const DEMO_MASSAGER_PRODUCT_ID = "gid://shopify/Product/DEMO-MASSAGER";
const DEMO_SANDALE_PRODUCT_ID = "gid://shopify/Product/DEMO-SANDALE";
const DEMO_ULOSCI_PRODUCT_ID = "gid://shopify/Product/DEMO-ULOSCI";

const DEMO_PRODUCT_TITLES: Record<string, string> = {
  [DEMO_SHOE_PRODUCT_ID]: "Ortopedske patike Apex",
  [DEMO_MASSAGER_PRODUCT_ID]: "Masažer za stopala Relax",
  [DEMO_SANDALE_PRODUCT_ID]: "Ortopedske sandale Sole",
  [DEMO_ULOSCI_PRODUCT_ID]: "Ulošci za obuću Comfort",
};

/** Catalog of products offered in the "exchange for a different article" dropdown (demo). */
export function getMockProductList(): ProductListItemDTO[] {
  return Object.entries(DEMO_PRODUCT_TITLES).map(([productId, title]) => ({ productId, title }));
}

/** A fake order with two line items: one shoe (has sizes + colors) and one massager
 * (no sizes, single variant) — so both Step 4a UI branches are visible. */
export function getMockOrder(): OrderLookupResultDTO {
  return {
    orderId: "gid://shopify/Order/DEMO-1001",
    orderNumber: "1001",
    customerName: "Marko Marković",
    email: "marko.markovic@primer.rs",
    phone: "+381641234567",
    shippingAddress: {
      address1: "Bulevar oslobođenja 12",
      address2: "stan 4",
      city: "Novi Sad",
      zip: "21000",
      country: "Srbija",
    },
    lineItems: [
      {
        lineItemId: "gid://shopify/LineItem/DEMO-1",
        productId: DEMO_SHOE_PRODUCT_ID,
        variantId: "gid://shopify/ProductVariant/DEMO-SHOE-41-CRNA",
        title: "Ortopedske patike Apex",
        variantTitle: "Crna / 41",
        sku: "APEXBLACKP41",
        quantity: 1,
        price: "6990.00",
        imageUrl: null,
        originalSize: 41,
      },
      {
        lineItemId: "gid://shopify/LineItem/DEMO-2",
        productId: DEMO_MASSAGER_PRODUCT_ID,
        variantId: "gid://shopify/ProductVariant/DEMO-MASSAGER-1",
        title: "Masažer za stopala Relax",
        variantTitle: "Standardni",
        sku: "RELAXMSG",
        quantity: 1,
        price: "3490.00",
        imageUrl: null,
        originalSize: null,
      },
    ],
  };
}

export function getMockVariants(productId: string): ProductVariantsResultDTO {
  if (productId === DEMO_MASSAGER_PRODUCT_ID) {
    // No size option, single variant -> "Zamena za isti artikal" branch.
    return {
      productId,
      hasSizeOption: false,
      hasColorOption: false,
      variants: [
        {
          variantId: "gid://shopify/ProductVariant/DEMO-MASSAGER-1",
          title: "Standardni",
          sku: "RELAXMSG",
          barcode: "8600000000017",
          size: null,
          color: null,
          available: true,
          inventoryQuantity: 15,
        },
      ],
    };
  }

  if (productId === DEMO_ULOSCI_PRODUCT_ID) {
    // No size option, multiple variants -> variant dropdown branch.
    return {
      productId,
      hasSizeOption: false,
      hasColorOption: false,
      variants: [
        {
          variantId: "gid://shopify/ProductVariant/DEMO-ULOSCI-GEL",
          title: "Gel",
          sku: "COMFGEL",
          barcode: "8600000000024",
          size: null,
          color: null,
          available: true,
          inventoryQuantity: 20,
        },
        {
          variantId: "gid://shopify/ProductVariant/DEMO-ULOSCI-MEMORY",
          title: "Memory pena",
          sku: "COMFMEMORY",
          barcode: "8600000000031",
          size: null,
          color: null,
          available: true,
          inventoryQuantity: 12,
        },
      ],
    };
  }

  if (productId === DEMO_SANDALE_PRODUCT_ID) {
    // Sandals: sizes 36-42, single color.
    const sizes = [36, 37, 38, 39, 40, 41, 42];
    const soldOut = new Set([37]);
    return {
      productId,
      hasSizeOption: true,
      hasColorOption: false,
      variants: sizes.map((size) => {
        const available = !soldOut.has(size);
        return {
          variantId: `gid://shopify/ProductVariant/DEMO-SANDALE-${size}`,
          title: `${size}`,
          sku: `SOLE${size}`,
          barcode: `8600000010${size}`,
          size,
          color: null,
          available,
          inventoryQuantity: available ? 6 : 0,
        };
      }),
    };
  }

  // Shoe (default): sizes 40-44 across two colors, a couple sold out to show the disabled state.
  const colors = ["Crna", "Bela"];
  const sizes = [40, 41, 42, 43, 44];
  const soldOut = new Set(["Crna-44", "Bela-40"]);

  const variants = colors.flatMap((color) =>
    sizes.map((size) => {
      const key = `${color}-${size}`;
      const available = !soldOut.has(key);
      return {
        variantId: `gid://shopify/ProductVariant/DEMO-SHOE-${size}-${color.toUpperCase()}`,
        title: `${color} / ${size}`,
        sku: `APEX${color === "Crna" ? "BLACK" : "WHITE"}P${size}`,
        barcode: `8600000020${size}`,
        size,
        color,
        available,
        inventoryQuantity: available ? 8 : 0,
      };
    })
  );

  return {
    productId,
    hasSizeOption: true,
    hasColorOption: true,
    variants,
  };
}

/** Generates a throwaway ticket number for demo submissions (not persisted). */
export function getMockTicketNumber(): string {
  const suffix = Math.floor(Math.random() * 90000 + 10000);
  return `ZR-${suffix}`;
}

// ---------------------------------------------------------------------------
// Admin dashboard demo data
// ---------------------------------------------------------------------------

// Placeholder image returned by the signed-url endpoint in demo mode (no real Storage).
export const DEMO_PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='400'%20height='400'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23e5e7eb'/%3E%3Ctext%20x='50%25'%20y='50%25'%20font-family='sans-serif'%20font-size='26'%20fill='%236b7280'%20text-anchor='middle'%20dominant-baseline='middle'%3EDemo%20slika%3C/text%3E%3C/svg%3E";

type DemoTicket = TicketDetailData & { shopify_order_id: string };

const MOCK_TICKETS: DemoTicket[] = [
  {
    id: "demo-1",
    ticket_number: "ZR-00001",
    order_number: "1001",
    shopify_order_id: "gid://shopify/Order/DEMO-1001",
    customer_name: "Marko Marković",
    email: "marko.markovic@primer.rs",
    phone: "+381641234567",
    shipping_address1: "Bulevar oslobođenja 12",
    shipping_address2: "stan 4",
    shipping_city: "Novi Sad",
    shipping_zip: "21000",
    shipping_country: "Srbija",
    type: "ZAMENA",
    status: "novo",
    bank_account: null,
    bank_account_owner: null,
    goods_received_date: null,
    refund_terms_confirmed: false,
    images_deleted: false,
    exchange_tracking_number: null,
    created_at: "2026-07-02T09:12:00Z",
    ticket_items: [
      {
        id: "demo-1-i1",
        product_title: "Ortopedske patike Apex",
        variant_title: "Crna / 41",
        sku: "APEXBLACKP41",
        quantity: 1,
        price: 6990,
        reason: null,
        reason_text: null,
        original_size: 41,
        exchange_product_id: "gid://shopify/Product/DEMO-SHOE",
        exchange_variant_id: "gid://shopify/ProductVariant/DEMO-SHOE-42-CRNA",
        exchange_variant_title: "Crna / 42",
        exchange_sku: "APEXBLACKP42",
        exchange_size: 42,
        size_direction: "VECA",
      },
    ],
    ticket_images: [
      { id: "demo-1-img1", storage_path: "demo/zr-00001/1.jpg" },
      { id: "demo-1-img2", storage_path: "demo/zr-00001/2.jpg" },
    ],
    ticket_notes: [
      {
        id: "demo-1-n1",
        author_email: "podrska@primer.rs",
        note: "Kupac javio da su patike premale, traži veći broj.",
        created_at: "2026-07-02T10:00:00Z",
      },
    ],
  },
  {
    id: "demo-2",
    ticket_number: "ZR-00002",
    order_number: "1002",
    shopify_order_id: "gid://shopify/Order/DEMO-1002",
    customer_name: "Jelena Jovanović",
    email: "jelena.jovanovic@primer.rs",
    phone: "+381601112233",
    shipping_address1: null,
    shipping_address2: null,
    shipping_city: null,
    shipping_zip: null,
    shipping_country: null,
    type: "REFUNDACIJA",
    status: "u_obradi",
    bank_account: "160-0000000001234-55",
    bank_account_owner: "Jelena Jovanović",
    goods_received_date: "2026-06-28",
    refund_terms_confirmed: true,
    images_deleted: false,
    exchange_tracking_number: null,
    created_at: "2026-07-01T14:30:00Z",
    ticket_items: [
      {
        id: "demo-2-i1",
        product_title: "Masažer za stopala Relax",
        variant_title: "Standardni",
        sku: "RELAXMSG",
        quantity: 1,
        price: 3490,
        reason: "NEUDOBNO",
        reason_text: null,
        original_size: null,
        exchange_product_id: null,
        exchange_variant_id: null,
        exchange_variant_title: null,
        exchange_sku: null,
        exchange_size: null,
        size_direction: null,
      },
    ],
    ticket_images: [{ id: "demo-2-img1", storage_path: "demo/zr-00002/1.jpg" }],
    ticket_notes: [],
  },
  {
    id: "demo-3",
    ticket_number: "ZR-00003",
    order_number: "1003",
    shopify_order_id: "gid://shopify/Order/DEMO-1003",
    customer_name: "Petar Petrović",
    email: "petar.petrovic@primer.rs",
    phone: "+381631234000",
    shipping_address1: "Kralja Petra 5",
    shipping_address2: null,
    shipping_city: "Beograd",
    shipping_zip: "11000",
    shipping_country: "Srbija",
    type: "ZAMENA",
    status: "odobreno",
    bank_account: null,
    bank_account_owner: null,
    goods_received_date: null,
    refund_terms_confirmed: false,
    images_deleted: false,
    exchange_tracking_number: "SP123456789RS",
    created_at: "2026-06-30T08:05:00Z",
    ticket_items: [
      {
        id: "demo-3-i1",
        product_title: "Ortopedske patike Apex",
        variant_title: "Bela / 43",
        sku: "APEXWHITEP43",
        quantity: 1,
        price: 6990,
        reason: null,
        reason_text: null,
        original_size: 43,
        exchange_product_id: "gid://shopify/Product/DEMO-SANDALE",
        exchange_variant_id: "gid://shopify/ProductVariant/DEMO-SANDALE-42",
        exchange_variant_title: "Ortopedske sandale Sole — 42",
        exchange_sku: "SOLE42",
        exchange_size: 42,
        size_direction: null,
      },
    ],
    ticket_images: [{ id: "demo-3-img1", storage_path: "demo/zr-00003/1.jpg" }],
    ticket_notes: [
      {
        id: "demo-3-n1",
        author_email: "podrska@primer.rs",
        note: "Odobreno. Zakazan kurir za preuzimanje.",
        created_at: "2026-06-30T12:00:00Z",
      },
    ],
  },
  {
    id: "demo-4",
    ticket_number: "ZR-00004",
    order_number: "1004",
    shopify_order_id: "gid://shopify/Order/DEMO-1004",
    customer_name: "Ana Anić",
    email: "ana.anic@primer.rs",
    phone: "+381642223344",
    shipping_address1: null,
    shipping_address2: null,
    shipping_city: null,
    shipping_zip: null,
    shipping_country: null,
    type: "REFUNDACIJA",
    status: "odbijeno",
    bank_account: "265-1234567890123-45",
    bank_account_owner: "Ana Anić",
    goods_received_date: "2026-06-10",
    refund_terms_confirmed: true,
    images_deleted: false,
    exchange_tracking_number: null,
    created_at: "2026-06-29T16:45:00Z",
    ticket_items: [
      {
        id: "demo-4-i1",
        product_title: "Ortopedske sandale Sole",
        variant_title: "38",
        sku: "SOLE38",
        quantity: 1,
        price: 4990,
        reason: "OSTECENO",
        reason_text: null,
        original_size: 38,
        exchange_product_id: null,
        exchange_variant_id: null,
        exchange_variant_title: null,
        exchange_sku: null,
        exchange_size: null,
        size_direction: null,
      },
    ],
    ticket_images: [],
    ticket_notes: [
      {
        id: "demo-4-n1",
        author_email: "podrska@primer.rs",
        note: "Zahtev odbijen — rok od 14 dana je istekao.",
        created_at: "2026-06-29T17:30:00Z",
      },
    ],
  },
  {
    id: "demo-5",
    ticket_number: "ZR-00005",
    order_number: "1005",
    shopify_order_id: "gid://shopify/Order/DEMO-1005",
    customer_name: "Nikola Nikolić",
    email: "nikola.nikolic@primer.rs",
    phone: "+381605556677",
    shipping_address1: "Cara Dušana 88",
    shipping_address2: null,
    shipping_city: "Niš",
    shipping_zip: "18000",
    shipping_country: "Srbija",
    type: "ZAMENA",
    status: "arhivirano",
    bank_account: null,
    bank_account_owner: null,
    goods_received_date: null,
    refund_terms_confirmed: false,
    images_deleted: true,
    exchange_tracking_number: "SP987654321RS",
    created_at: "2026-06-20T11:20:00Z",
    ticket_items: [
      {
        id: "demo-5-i1",
        product_title: "Ulošci za obuću Comfort",
        variant_title: "Gel",
        sku: "COMFGEL",
        quantity: 1,
        price: 1990,
        reason: null,
        reason_text: null,
        original_size: null,
        exchange_product_id: "gid://shopify/Product/DEMO-ULOSCI",
        exchange_variant_id: "gid://shopify/ProductVariant/DEMO-ULOSCI-MEMORY",
        exchange_variant_title: "Memory pena",
        exchange_sku: "COMFMEMORY",
        exchange_size: null,
        size_direction: null,
      },
    ],
    ticket_images: [],
    ticket_notes: [
      {
        id: "demo-5-n1",
        author_email: "podrska@primer.rs",
        note: "Zahtev završen i arhiviran.",
        created_at: "2026-06-24T09:00:00Z",
      },
    ],
  },
];

export interface DemoTicketListRow {
  id: string;
  ticket_number: string;
  created_at: string;
  customer_name: string;
  order_number: string;
  type: "ZAMENA" | "REFUNDACIJA";
  status: TicketStatus;
  ticket_items: { price: number; quantity: number }[];
}

/** Applies the same filter/sort logic as the real ticket list query, over the mock tickets. */
export function getMockTicketList(params: {
  status?: string;
  type?: string;
  q?: string;
  sort?: string;
}): DemoTicketListRow[] {
  let rows = MOCK_TICKETS.slice();

  if (params.status) {
    rows = rows.filter((t) => t.status === params.status);
  } else {
    rows = rows.filter((t) => t.status !== "arhivirano");
  }

  if (params.type) {
    rows = rows.filter((t) => t.type === params.type);
  }

  if (params.q) {
    const q = params.q.toLowerCase();
    rows = rows.filter(
      (t) =>
        t.order_number.toLowerCase().includes(q) ||
        t.customer_name.toLowerCase().includes(q) ||
        t.phone.toLowerCase().includes(q)
    );
  }

  rows.sort((a, b) =>
    params.sort === "asc"
      ? a.created_at.localeCompare(b.created_at)
      : b.created_at.localeCompare(a.created_at)
  );

  return rows.map((t) => ({
    id: t.id,
    ticket_number: t.ticket_number,
    created_at: t.created_at,
    customer_name: t.customer_name,
    order_number: t.order_number,
    type: t.type,
    status: t.status,
    ticket_items: t.ticket_items.map((i) => ({ price: i.price, quantity: i.quantity })),
  }));
}

export function getMockStatusCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of MOCK_TICKETS) {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  }
  return counts;
}

export function getMockTicketDetail(id: string): DemoTicket | null {
  return MOCK_TICKETS.find((t) => t.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// "Paketi" demo data
// ---------------------------------------------------------------------------

export function getMockPaketiData() {
  const day = 86_400_000;
  const mk = (
    n: number,
    daysOld: number,
    name: string,
    phone: string,
    amount: string,
    tracking: string | null,
    tab: "neposlati" | "vraceni"
  ) => ({
    key: `demo-shop::${n}`,
    orderId: `gid://shopify/Order/DEMO-${n}`,
    orderNumericId: String(n),
    orderNumber: String(n),
    shopId: "demo-shop",
    shopName: "Ortomed",
    customerName: name,
    phone,
    address: { street: "Bulevar oslobođenja 12", city: "Novi Sad", zip: "21000" },
    totalAmount: amount,
    currency: "RSD",
    createdAt: new Date(Date.now() - daysOld * day).toISOString(),
    daysOld,
    trackingNumber: tracking,
    adminUrl: "#",
    status: "novo" as const,
    note: "",
    updatedBy: null,
    resolvedAt: null,
    _tab: tab,
  });

  const neposlati = [
    mk(4821, 7, "Marko Petrović", "+381641234567", "4590", null, "neposlati"),
    mk(4809, 12, "Jelena Ilić", "0601112233", "6990", null, "neposlati"),
    mk(4790, 15, "Petar Simić", "+381631119988", "3490", null, "neposlati"),
  ];
  const vraceni = [
    mk(4750, 20, "Ana Kovačević", "0642223344", "5980", "RS123456789", "vraceni"),
    mk(4711, 33, "Nikola Jovanović", "+381605556677", "7490", "RS987654321", "vraceni"),
  ];

  return { neposlati, vraceni };
}

/** Demo data for the owner Admin panel — Prometika tab. */
export function getMockPrometika() {
  return {
    days: 60,
    soldUnits: 412,
    refunded: { units: 11, orders: 9 },
    zamene: {
      count: 29,
      directions: { MANJA: 3, VECA: 19, ISTA: 3, DRUGI_ARTIKAL: 4, OSTALO: 0 },
      transitions: [
        { t: "41 → 42", c: 12 },
        { t: "40 → 41", c: 5 },
        { t: "38 → 39", c: 2 },
      ],
      crossSwaps: [
        { t: "Apex Balance", c: 3 },
        { t: "Ortomed TerraFlex", c: 1 },
      ],
    },
    reasons: [
      { t: "Pogrešna veličina", c: 5 },
      { t: "Neudoban proizvod", c: 2 },
      { t: "Oštećeno", c: 1 },
    ],
    refundTicketCount: 8,
    oldestTicketAt: "2026-05-02T10:00:00Z",
    flags: [
      "76% zamena traži VEĆI broj → kalup mali, razmotri korekciju tabele veličina",
    ],
  };
}

/** Demo data for the owner Admin panel — Lager i finansije tab. */
export function getMockPanelLager() {
  const mkP = (id: string, title: string, qty: number, pv: number, sv: number, s14: number, mc = false) => ({
    productId: `gid://shopify/Product/${id}`,
    title,
    totalQty: qty,
    purchaseValue: pv,
    sellingValue: sv,
    missingCost: mc,
    missingPrice: false,
    salesLast14: s14,
    salesPerWeek: Math.round(s14 / 2),
    weeksOfStock: s14 > 0 ? qty / (s14 / 2) : null,
  });
  const products = [
    mkP("D1", "ORTOMED patike sa visokim đonom", 826, 2790000, 6900000, 192),
    mkP("D2", "Slipon Ortomed Patike", 310, 1060000, 2600000, 94),
    mkP("D3", "Ortomed TerraFlex", 77, 580000, 1400000, 78),
    mkP("D4", "Masažer za stopala Relax", 60, 390000, 1000000, 22, true),
  ];
  return {
    fromCache: false,
    report: {
      products,
      totals: {
        totalQty: products.reduce((s, p) => s + p.totalQty, 0),
        purchaseValue: products.reduce((s, p) => s + p.purchaseValue, 0),
        sellingValue: products.reduce((s, p) => s + p.sellingValue, 0),
        productsMissingCost: ["Masažer za stopala Relax"],
        productsMissingPrice: [],
      },
      salesTruncated: false,
      generatedAt: new Date().toISOString(),
    },
    shipments: [
      {
        id: "demo-sh-1",
        supplier: "Factory A (CN)",
        product_title: "ORTOMED patike sa visokim đonom — Crna",
        quantity: 500,
        unit_cost: 2680,
        eta: "2026-07-28",
        status: "u_transportu",
        cbm: 6.2,
        transport_cost: 310000,
        note: "",
      },
      {
        id: "demo-sh-2",
        supplier: "Factory A (CN)",
        product_title: "Ortomed TerraFlex",
        quantity: 300,
        unit_cost: 2700,
        eta: "2026-08-15",
        status: "poruceno",
        cbm: null,
        transport_cost: null,
        note: "",
      },
    ],
    arrived: [],
  };
}

/** Neighbouring ticket ids in newest-first ordering, for the prev/next navigation. */
export function getMockAdjacentTicketIds(id: string): {
  prevId: string | null;
  nextId: string | null;
} {
  const ordered = MOCK_TICKETS.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  const idx = ordered.findIndex((t) => t.id === id);
  if (idx === -1) return { prevId: null, nextId: null };
  return {
    prevId: idx > 0 ? ordered[idx - 1].id : null,
    nextId: idx < ordered.length - 1 ? ordered[idx + 1].id : null,
  };
}
