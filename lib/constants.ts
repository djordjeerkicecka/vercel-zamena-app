import type { ReasonCode, RequestType, TicketStatus } from "./types";

export const REASON_OPTIONS: { code: ReasonCode; label: string }[] = [
  { code: "POGRESNA_VELICINA", label: "Pogrešna veličina" },
  { code: "MODEL_NE_ODGOVARA", label: "Model mi ne odgovara / ne dopada mi se" },
  { code: "NEUDOBNO", label: "Proizvod mi je neudoban" },
  { code: "OSTECENO", label: "Proizvod je oštećen" },
  { code: "POGRESAN_ARTIKAL", label: "Isporučen je pogrešan artikal" },
  { code: "DRUGO", label: "Drugo" },
];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  novo: "Novo",
  u_obradi: "U obradi",
  odobreno: "Odobreno",
  odbijeno: "Odbijeno",
  arhivirano: "Arhivirano",
};

export const STATUS_ORDER: TicketStatus[] = ["novo", "u_obradi", "odobreno", "odbijeno", "arhivirano"];

export const STATUS_BADGE_CLASSES: Record<TicketStatus, string> = {
  novo: "bg-blue-100 text-blue-700",
  u_obradi: "bg-amber-100 text-amber-700",
  odobreno: "bg-green-100 text-green-700",
  odbijeno: "bg-red-100 text-red-700",
  arhivirano: "bg-gray-100 text-gray-600",
};

// Wizard steps differ by request type: ZAMENA combines item selection + replacement choice
// into one step and skips the reason step, while REFUNDACIJA keeps a separate reason step and
// a bank-details step. Each entry has a stable `key` (used for rendering/navigation) and a
// Serbian `label` (shown in the progress bar).
export type WizardStepKey =
  | "type"
  | "order"
  | "items"
  | "itemsExchange"
  | "refund"
  | "contact"
  | "review";

export const WIZARD_STEPS: Record<RequestType, { key: WizardStepKey; label: string }[]> = {
  ZAMENA: [
    { key: "type", label: "Tip zahteva" },
    { key: "order", label: "Porudžbina" },
    { key: "itemsExchange", label: "Artikli i zamena" },
    { key: "contact", label: "Kontakt" },
    { key: "review", label: "Pregled" },
  ],
  REFUNDACIJA: [
    { key: "type", label: "Tip zahteva" },
    { key: "order", label: "Porudžbina" },
    { key: "items", label: "Artikli" },
    { key: "refund", label: "Refundacija" },
    { key: "contact", label: "Kontakt" },
    { key: "review", label: "Pregled" },
  ],
};

// Shown before a type is picked (step 1 is identical for both flows).
export const WIZARD_STEPS_DEFAULT = WIZARD_STEPS.ZAMENA;

// Logistics notes shown to the customer at the end of the exchange flow. Kept as a constant so
// the copy can be tweaked in one place. Applies to ZAMENA (courier pickup + return, customer
// bears shipping, price difference on delivery).
export const EXCHANGE_LOGISTICS_NOTES = [
  "Nakon što popunite formu i ukoliko zahtev ispunjava uslove, zakazujemo kurira da preuzme paket od vas.",
  "Kada artikal stigne u naš magacin, šaljemo vam zamenski artikal.",
  "Ako je zamenski artikal skuplji, razliku u ceni doplaćujete prilikom dostave (pouzećem).",
  "Troškove slanja u slučaju zamene snosi kupac — visinu troška određuje kurirska služba.",
  "Paket mora biti upakovan isto kao što je stigao do vas.",
];

// Photos: 1 receipt (fiskalni račun) + 1–3 product photos = 2..4 total.
export const MAX_IMAGES = 4;
export const MIN_IMAGES = 2;
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export const REFUND_WINDOW_DAYS = 14;

/**
 * Column layout for the "Kopiraj red za Sheets" clipboard export (see CopyForSheetsButton).
 * Columns D–G are blank (D/E/F are filled manually by support in Google Sheets:
 * "Prvi odgovor", "Zakazivanje preuzimanja", "Kupac obavešten o preuzimanju"; G is unused).
 * The tail differs by request type:
 *
 *   A            B      C              D  E  F  G   H                     I                  J
 *   REFUNDACIJA: ime    tip  br.porudžbine  -  -  -  -   tekući račun + ime    SKU vraćenog       —
 *   ZAMENA:      ime    tip  br.porudžbine  -  -  -  -   —                     SKU vraćenog       SKU zamenskog
 */
