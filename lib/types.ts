// Shared domain types used across the public form, admin dashboard, and API routes.

export type RequestType = "ZAMENA" | "REFUNDACIJA";

export type TicketStatus = "novo" | "u_obradi" | "odobreno" | "odbijeno" | "arhivirano";

// -- "Paketi" (order follow-ups) feature --

export type FollowupStatus = "novo" | "poruka_poslata" | "pozvan" | "reseno";
export type FollowupTab = "neposlati" | "vraceni";

export interface FollowupOrderDTO {
  // Stable follow-up key, unique across shops: `${shopId}::${orderNumericId}`.
  // Used as the order_followups primary key (two shops can share a numeric order id).
  key: string;
  orderId: string; // Shopify GID
  orderNumericId: string;
  orderNumber: string; // without leading #
  shopId: string;
  shopName: string;
  customerName: string;
  phone: string | null;
  address: { street: string; city: string; zip: string };
  totalAmount: string;
  currency: string;
  createdAt: string; // ISO
  daysOld: number;
  trackingNumber: string | null;
  adminUrl: string;
  // Merged follow-up state (defaults when there's no order_followups row yet).
  status: FollowupStatus;
  note: string;
  updatedBy: string | null;
  resolvedAt: string | null;
}

export type ReasonCode =
  | "POGRESNA_VELICINA"
  | "MODEL_NE_ODGOVARA"
  | "NEUDOBNO"
  | "OSTECENO"
  | "POGRESAN_ARTIKAL"
  | "DRUGO";

export type SizeDirection = "MANJA" | "VECA" | "ISTA";

export interface OrderLineItemDTO {
  lineItemId: string;
  productId: string;
  variantId: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  price: string;
  imageUrl: string | null;
  originalSize: number | null;
}

export interface OrderLookupResultDTO {
  orderId: string;
  orderNumber: string;
  customerName: string;
  email: string;
  phone: string;
  shippingAddress: {
    address1: string;
    address2: string | null;
    city: string;
    zip: string;
    country: string;
  } | null;
  lineItems: OrderLineItemDTO[];
}

export interface ProductVariantOptionDTO {
  variantId: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  size: number | null;
  color: string | null;
  available: boolean;
  inventoryQuantity: number;
}

export interface ProductVariantsResultDTO {
  productId: string;
  hasSizeOption: boolean;
  hasColorOption: boolean;
  variants: ProductVariantOptionDTO[];
}

// Lightweight product entry for the "exchange for a different article" dropdown.
export interface ProductListItemDTO {
  productId: string;
  title: string;
}

// -- Form submission payload (client -> POST /api/tickets) --

export interface SubmitTicketItemPayload {
  lineItemId: string;
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  price: string;
  // Reason is only collected for REFUNDACIJA; null for ZAMENA items.
  reason: ReasonCode | null;
  reasonText: string | null;
  originalSize: number | null;
  // Exchange-only fields. exchangeProductId is the chosen replacement product (same as
  // productId for a same-model swap, or a different product id when swapping for another article).
  exchangeProductId: string | null;
  exchangeVariantId: string | null;
  exchangeVariantTitle: string | null;
  exchangeSku: string | null;
  exchangeSize: number | null;
}

export interface SubmitTicketPayload {
  type: RequestType;
  orderId: string;
  orderNumber: string;
  customerName: string;
  email: string;
  phone: string;
  shippingAddress: {
    address1: string;
    address2: string | null;
    city: string;
    zip: string;
    country: string;
  } | null;
  items: SubmitTicketItemPayload[];
  bankAccount: string | null;
  bankAccountOwner: string | null;
  goodsReceivedDate: string | null;
  refundTermsConfirmed: boolean;
  imagePaths: string[];
}
