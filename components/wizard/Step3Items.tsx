"use client";

import { useState } from "react";
import Image from "next/image";
import { REASON_OPTIONS } from "@/lib/constants";
import type { WizardItemState } from "./types";

interface Props {
  items: WizardItemState[];
  onChange: (items: WizardItemState[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step3Items({ items, onChange, onNext, onBack }: Props) {
  const [error, setError] = useState<string | null>(null);

  function updateItem(index: number, patch: Partial<WizardItemState>) {
    const next = items.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function handleNext() {
    const checked = items.filter((i) => i.checked);
    if (checked.length === 0) {
      setError("Izaberite bar jedan artikal koji vraćate.");
      return;
    }
    for (const item of checked) {
      if (!item.reason) {
        setError("Izaberite razlog za svaki izabrani artikal.");
        return;
      }
      if (item.reason === "DRUGO" && !item.reasonText.trim()) {
        setError('Unesite obrazloženje za razlog "Drugo".');
        return;
      }
    }
    setError(null);
    onNext();
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold text-gray-900">Izaberite artikle</h2>
      <p className="mt-1 text-sm text-gray-600">
        Označite koje artikle sa porudžbine vraćate i navedite razlog za svaki.
      </p>

      <div className="mt-5 space-y-4">
        {items.map((item, index) => (
          <div
            key={item.lineItemId}
            className={`rounded-xl border p-3 transition ${
              item.checked ? "border-brand bg-brand-50/40" : "border-gray-200"
            }`}
          >
            <div className="flex gap-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-brand-500"
                  checked={item.checked}
                  onChange={(e) => updateItem(index, { checked: e.target.checked })}
                />
              </label>

              {item.imageUrl ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  <Image src={item.imageUrl} alt={item.title} fill sizes="64px" className="object-cover" />
                </div>
              ) : (
                <div className="h-16 w-16 shrink-0 rounded-lg bg-gray-100" />
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{item.title}</p>
                {item.variantTitle && <p className="text-xs text-gray-500">{item.variantTitle}</p>}
                <p className="text-xs text-gray-500">
                  Količina: {item.quantity} · {item.price} RSD
                </p>
              </div>
            </div>

            {item.checked && (
              <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                <div>
                  <label className="form-label">Razlog</label>
                  <select
                    className="form-input"
                    value={item.reason ?? ""}
                    onChange={(e) => updateItem(index, { reason: e.target.value as WizardItemState["reason"] })}
                  >
                    <option value="" disabled>
                      Izaberite razlog
                    </option>
                    {REASON_OPTIONS.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {item.reason === "DRUGO" && (
                  <div>
                    <label className="form-label">Obrazloženje</label>
                    <textarea
                      className="form-input"
                      rows={2}
                      value={item.reasonText}
                      onChange={(e) => updateItem(index, { reasonText: e.target.value })}
                      placeholder="Opišite razlog vraćanja"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="mt-8 flex gap-3">
        <button type="button" className="btn-secondary flex-1" onClick={onBack}>
          Nazad
        </button>
        <button type="button" className="btn-primary flex-1" onClick={handleNext}>
          Dalje
        </button>
      </div>
    </div>
  );
}
