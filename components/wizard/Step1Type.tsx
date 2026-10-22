"use client";

import type { RequestType } from "@/lib/types";

interface Props {
  type: RequestType | null;
  onChange: (type: RequestType) => void;
  onNext: () => void;
}

export function Step1Type({ type, onChange, onNext }: Props) {
  return (
    <div className="card">
      <h1 className="text-lg font-bold text-gray-900">Izjava za zamenu/odustajanje od ugovora</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        Ovim putem izjavljujem da odustajem od Ugovora o kupovini zaključenog na daljinu (sajt:
        www.tenzia.co).
      </p>

      <div className="mt-6">
        <p className="form-label">Da li želite zamenu ili refundaciju novca?</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition ${
              type === "ZAMENA" ? "border-brand bg-brand-50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <input
              type="radio"
              name="request-type"
              className="h-4 w-4 accent-brand-500"
              checked={type === "ZAMENA"}
              onChange={() => onChange("ZAMENA")}
            />
            <span className="font-medium text-gray-800">Zamena artikla</span>
          </label>

          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition ${
              type === "REFUNDACIJA" ? "border-brand bg-brand-50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <input
              type="radio"
              name="request-type"
              className="h-4 w-4 accent-brand-500"
              checked={type === "REFUNDACIJA"}
              onChange={() => onChange("REFUNDACIJA")}
            />
            <span className="font-medium text-gray-800">Refundacija</span>
          </label>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Napomena: jedan zahtev može biti samo jednog tipa. Ako želite i zamenu i refundaciju za
          različite artikle, podnesite dva odvojena zahteva.
        </p>

        <a href="#" className="mt-3 inline-block text-sm text-brand-600 underline">
          Tražite formu za reklamacije? Nalazi se ovde
        </a>
      </div>

      <button type="button" className="btn-primary mt-8 w-full" disabled={!type} onClick={onNext}>
        Dalje
      </button>
    </div>
  );
}
