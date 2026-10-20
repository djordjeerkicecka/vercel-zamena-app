"use client";

import { REASON_OPTIONS, EXCHANGE_LOGISTICS_NOTES } from "@/lib/constants";
import type { WizardItemState, ShippingAddressState } from "./types";
import type { RequestType } from "@/lib/types";

interface Props {
  type: RequestType;
  orderNumber: string;
  items: WizardItemState[];
  customerName: string;
  email: string;
  contactPhone: string;
  shippingAddress: ShippingAddressState;
  bankAccount: string;
  bankAccountOwner: string;
  goodsReceivedDate: string;
  imagePaths: string[];
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
  onBack: () => void;
}

function reasonLabel(code: string) {
  return REASON_OPTIONS.find((r) => r.code === code)?.label ?? code;
}

export function Step6Review({
  type,
  orderNumber,
  items,
  customerName,
  email,
  contactPhone,
  shippingAddress,
  bankAccount,
  bankAccountOwner,
  goodsReceivedDate,
  imagePaths,
  submitting,
  submitError,
  onSubmit,
  onBack,
}: Props) {
  const checkedItems = items.filter((i) => i.checked);

  return (
    <div className="card">
      <h2 className="text-lg font-bold text-gray-900">Pregled zahteva</h2>

      <div className="mt-4 space-y-4 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-400">Tip zahteva</p>
          <p className="font-medium text-gray-800">
            {type === "ZAMENA" ? "Zamena artikla" : "Refundacija"} — porudžbina #{orderNumber}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-400">Artikli</p>
          <ul className="mt-1 space-y-2">
            {checkedItems.map((item) => (
              <li key={item.lineItemId} className="rounded-lg border border-gray-100 p-2.5">
                <p className="font-medium text-gray-800">{item.title}</p>
                <p className="text-xs text-gray-500">{item.variantTitle}</p>
                {type === "REFUNDACIJA" && item.reason && (
                  <p className="text-xs text-gray-600">
                    Razlog: {reasonLabel(item.reason)}
                    {item.reason === "DRUGO" && item.reasonText ? ` — ${item.reasonText}` : ""}
                  </p>
                )}
                {type === "ZAMENA" && item.exchangeVariantTitle && (
                  <p className="text-xs text-brand-700">Zamena za: {item.exchangeVariantTitle}</p>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-400">Kontakt</p>
          <p className="text-gray-700">{customerName}</p>
          <p className="text-gray-700">{email}</p>
          <p className="text-gray-700">{contactPhone}</p>
        </div>

        {type === "ZAMENA" && (
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400">
              Adresa za slanje zamenskog artikla
            </p>
            <p className="text-gray-700">
              {shippingAddress.address1}
              {shippingAddress.address2 ? `, ${shippingAddress.address2}` : ""}, {shippingAddress.zip}{" "}
              {shippingAddress.city}
            </p>
          </div>
        )}

        {type === "REFUNDACIJA" && (
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400">Refundacija</p>
            <p className="text-gray-700">
              {bankAccount} — {bankAccountOwner}
            </p>
            <p className="text-gray-700">Datum prijema robe: {goodsReceivedDate}</p>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase text-gray-400">Slike</p>
          <p className="text-gray-700">{imagePaths.length} priloženo</p>
        </div>
      </div>

      {type === "ZAMENA" && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Kako teče proces zamene:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {EXCHANGE_LOGISTICS_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {submitError && <p className="form-error mt-4">{submitError}</p>}

      <div className="mt-8 flex gap-3">
        <button type="button" className="btn-secondary flex-1" onClick={onBack} disabled={submitting}>
          Nazad
        </button>
        <button type="button" className="btn-primary flex-1" onClick={onSubmit} disabled={submitting}>
          {submitting ? "Slanje..." : "Pošalji zahtev"}
        </button>
      </div>
    </div>
  );
}
