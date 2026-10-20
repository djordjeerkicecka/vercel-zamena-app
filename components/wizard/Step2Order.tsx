"use client";

import { useState } from "react";
import type { OrderLookupResultDTO } from "@/lib/types";

interface Props {
  orderNumberInput: string;
  phoneInput: string;
  onOrderNumberChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onFound: (order: OrderLookupResultDTO) => void;
  onBack: () => void;
}

export function Step2Order({
  orderNumberInput,
  phoneInput,
  onOrderNumberChange,
  onPhoneChange,
  onFound,
  onBack,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!orderNumberInput.trim() || !phoneInput.trim()) {
      setError("Unesite broj porudžbine i broj telefona.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: orderNumberInput, phone: phoneInput }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Porudžbina nije pronađena, proverite podatke.");
        return;
      }

      onFound(data.order as OrderLookupResultDTO);
    } catch {
      setError("Došlo je do greške. Pokušajte ponovo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2 className="text-lg font-bold text-gray-900">Pronađite vašu porudžbinu</h2>
      <p className="mt-1 text-sm text-gray-600">
        Unesite broj porudžbine i broj telefona koji ste koristili prilikom poručivanja.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="form-label" htmlFor="orderNumber">
            Broj porudžbine
          </label>
          <input
            id="orderNumber"
            type="text"
            inputMode="numeric"
            placeholder="npr. 1234 ili #1234"
            className="form-input"
            value={orderNumberInput}
            onChange={(e) => onOrderNumberChange(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Broj porudžbine se nalazi u <strong>Viber poruci</strong> i u <strong>email
            potvrdi</strong> koje ste dobili nakon poručivanja.
          </p>
        </div>

        <div>
          <label className="form-label" htmlFor="phone">
            Broj telefona
          </label>
          <input
            id="phone"
            type="tel"
            placeholder="npr. 06X/XXX-XXXX"
            className="form-input"
            value={phoneInput}
            onChange={(e) => onPhoneChange(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Unesite isti broj telefona koji ste uneli prilikom poručivanja.
          </p>
        </div>

        {error && <p className="form-error">{error}</p>}
      </div>

      <div className="mt-8 flex gap-3">
        <button type="button" className="btn-secondary flex-1" onClick={onBack} disabled={loading}>
          Nazad
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={loading}>
          {loading ? "Pretraga..." : "Pronađi porudžbinu"}
        </button>
      </div>
    </form>
  );
}
