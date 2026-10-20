import type { OrderLookupResultDTO, ReasonCode, RequestType } from "@/lib/types";

export interface WizardItemState {
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
  checked: boolean;
  // Reason is only used for REFUNDACIJA; stays null for ZAMENA items.
  reason: ReasonCode | null;
  reasonText: string;
  // Exchange target — only populated when the overall request type is ZAMENA.
  // "isti" = swap for another variant of the same product; "drugi" = swap for a different product.
  exchangeMode: "isti" | "drugi";
  exchangeProductId: string | null;
  exchangeProductTitle: string | null;
  exchangeVariantId: string | null;
  exchangeVariantTitle: string | null;
  exchangeSku: string | null;
  exchangeSize: number | null;
}

export interface ShippingAddressState {
  address1: string;
  address2: string;
  city: string;
  zip: string;
  country: string;
}

export interface WizardState {
  stepIndex: number;
  type: RequestType | null;
  orderNumberInput: string;
  phoneInput: string;
  order: OrderLookupResultDTO | null;
  items: WizardItemState[];

  // Refund-only fields
  bankAccount: string;
  bankAccountOwner: string;
  goodsReceivedDate: string;
  refundTermsConfirmed: boolean;

  // Contact
  customerName: string;
  email: string;
  contactPhone: string;
  shippingAddress: ShippingAddressState;

  // Images
  draftId: string;
  imagePaths: string[];
  consentGiven: boolean;
}

export const EMPTY_ADDRESS: ShippingAddressState = {
  address1: "",
  address2: "",
  city: "",
  zip: "",
  country: "Srbija",
};

export function createInitialWizardState(): WizardState {
  return {
    stepIndex: 0,
    type: null,
    orderNumberInput: "",
    phoneInput: "",
    order: null,
    items: [],
    bankAccount: "",
    bankAccountOwner: "",
    goodsReceivedDate: "",
    refundTermsConfirmed: false,
    customerName: "",
    email: "",
    contactPhone: "",
    shippingAddress: EMPTY_ADDRESS,
    draftId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    imagePaths: [],
    consentGiven: false,
  };
}
