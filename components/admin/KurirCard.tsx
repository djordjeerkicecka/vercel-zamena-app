"use client";

import { useCallback, useEffect, useState } from "react";

interface ShipmentRow {
  id: string;
  kind: "PREUZIMANJE" | "ZAMENA";
  sp_number: number | null;
  custom_number: string;
  status: string;
  tracking_code: string | null;
  notes: string;
}

interface Props {
  ticketId: string;
  ticketType: "ZAMENA" | "REFUNDACIJA";
  defaults: { name: string; street: string; city: string; zip: string; phone: string };
  returnSkus: string[];
  exchangeSkus: string[];
}

const PICKUP_LABELS: Record<string, string> = {
  PROCESSING: "Zakazano",
  SENT: "Kurir preuzeo",
  DELIVERED: "Stiglo u magacin",
  RETURN: "Vraćeno",
  CANCELED: "Otkazano",
  REJECTED: "Odbijeno",
};

const SEND_LABELS: Record<string, string> = {
  PROCESSING: "U obradi",
  SENT: "Poslato kupcu",
  DELIVERED: "Isporučeno kupcu",
  RETURN: "Kupac nije preuzeo",
  CANCELED: "Otkazano",
  REJECTED: "Odbijeno",
};

const STATUS_CLASSES: Record<string, string> = {
  PROCESSING: "bg-blue-100 text-blue-700",
  SENT: "bg-amber-100 text-amber-700",
  DELIVERED: "bg-green-100 text-green-700",
  RETURN: "bg-red-100 text-red-700",
  CANCELED: "bg-gray-100 text-gray-600",
  REJECTED: "bg-red-100 text-red-700",
};

export function KurirCard({ ticketId, ticketType, defaults, returnSkus, exchangeSkus }: Props) {
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Dialog state (shared fields for pickup & send)
  const [dialog, setDialog] = useState<null | "pickup" | "send">(null);
  const [fName, setFName] = useState(defaults.name);
  const [fStreet, setFStreet] = useState(defaults.street);
  const [fCity, setFCity] = useState(defaults.city);
  const [fZip, setFZip] = useState(defaults.zip);
  const [fPhone, setFPhone] = useState(defaults.phone);
  const [fOtkupnina, setFOtkupnina] = useState("0");
  const [fForce, setFForce] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}/pickup`);
      const data = await res.json();
      if (res.ok) setShipments(data.shipments ?? []);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  const pickup = shipments.find((s) => s.kind === "PREUZIMANJE" && !["CANCELED", "REJECTED"].includes(s.status));
  const send = shipments.find((s) => s.kind === "ZAMENA" && !["CANCELED", "REJECTED"].includes(s.status));

  function openDialog(kind: "pickup" | "send") {
    setFName(defaults.name);
    setFStreet(defaults.street);
    setFCity(defaults.city);
    setFZip(defaults.zip);
    setFPhone(defaults.phone);
    setFOtkupnina("0");
    setFForce(false);
    setError(null);
    setDialog(kind);
  }

  async function submitDialog() {
    setBusy(true);
    setError(null);
    try {
      const common = { name: fName, street: fStreet, city: fCity, zip: fZip, phone: fPhone };
      const url =
        dialog === "pickup"
          ? `/api/admin/tickets/${ticketId}/pickup`
          : `/api/admin/tickets/${ticketId}/send-exchange`;
      const body =
        dialog === "pickup" ? common : { ...common, otkupnina: fOtkupnina, force: fForce };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Greška.");
        return;
      }
      setDialog(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function cancelShipment(row: ShipmentRow) {
    const what = row.kind === "PREUZIMANJE" ? "zakazano preuzimanje" : "slanje zamene";
    if (!window.confirm(`Otkazati ${what} kod SlanjePaketa?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}/pickup?shipmentId=${row.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Greška.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  function renderRow(row: ShipmentRow) {
    const labels = row.kind === "PREUZIMANJE" ? PICKUP_LABELS : SEND_LABELS;
    return (
      <div key={row.id} className="rounded-lg border border-gray-100 p-2.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-gray-700">
            {row.kind === "PREUZIMANJE" ? "Preuzimanje od kupca" : "Slanje zamene"}
          </span>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[row.status] ?? "bg-gray-100 text-gray-600"}`}>
            {labels[row.status] ?? row.status}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Nalog: {row.sp_number ? `#${row.sp_number}` : row.custom_number}
          {row.tracking_code && <> · Tracking: <span className="font-mono">{row.tracking_code}</span></>}
        </p>
        {row.notes && <p className="mt-0.5 text-xs text-gray-400">{row.notes}</p>}
        {row.status === "PROCESSING" && (
          <button type="button" className="mt-2 text-xs text-red-500 hover:underline" onClick={() => cancelShipment(row)} disabled={busy}>
            Otkaži {row.kind === "PREUZIMANJE" ? "preuzimanje" : "slanje zamene"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase text-gray-500">Kurir — SlanjePaketa</h2>
        <button type="button" className="text-xs text-gray-400 hover:text-gray-600" onClick={load} disabled={loading}>
          {loading ? "..." : "Osveži"}
        </button>
      </div>

      <div className="mt-2 space-y-2">
        {shipments.filter((s) => !["CANCELED", "REJECTED"].includes(s.status)).map(renderRow)}

        {!pickup && (
          <button type="button" className="btn-primary w-full" onClick={() => openDialog("pickup")} disabled={busy}>
            🚚 Zakaži preuzimanje od kupca
          </button>
        )}

        {ticketType === "ZAMENA" && !send && pickup && (
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => openDialog("send")}
            disabled={busy}
            title={pickup.status !== "DELIVERED" ? "Paket još nije stigao u magacin — moguće poslati uz potvrdu" : ""}
          >
            📦 Pošalji zamenu {pickup.status !== "DELIVERED" && "⚠"}
          </button>
        )}

        {shipments.some((s) => ["CANCELED", "REJECTED"].includes(s.status)) && (
          <p className="text-xs text-gray-400">
            {shipments.filter((s) => ["CANCELED", "REJECTED"].includes(s.status)).length} otkazan(ih) nalog(a)
          </p>
        )}
      </div>

      {error && !dialog && <p className="form-error">{error}</p>}

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setDialog(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900">
              {dialog === "pickup" ? "🚚 Zakaži preuzimanje od kupca" : "📦 Pošalji zamenu kupcu"}
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              {dialog === "pickup"
                ? `Kurir preuzima: ${returnSkus.join(", ") || "artikli bez SKU"} — nalog se odmah kreira kod SlanjePaketa.`
                : `Šalje se: ${exchangeSkus.join(", ") || "artikli bez SKU"} iz magacina SlanjePaketa.`}
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="form-label">Ime i prezime</label>
                <input type="text" className="form-input" value={fName} onChange={(e) => setFName(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Ulica i broj</label>
                <input type="text" className="form-input" value={fStreet} onChange={(e) => setFStreet(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Grad</label>
                  <input type="text" className="form-input" value={fCity} onChange={(e) => setFCity(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Poštanski broj</label>
                  <input type="text" className="form-input" value={fZip} onChange={(e) => setFZip(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="form-label">Telefon</label>
                <input type="text" className="form-input" value={fPhone} onChange={(e) => setFPhone(e.target.value)} />
              </div>

              {dialog === "send" && (
                <>
                  <div>
                    <label className="form-label">Doplata / otkupnina (RSD — 0 ako nema)</label>
                    <input type="number" className="form-input" value={fOtkupnina} onChange={(e) => setFOtkupnina(e.target.value)} />
                    <p className="mt-1 text-xs text-gray-500">Za skuplji zamenski artikal upiši razliku u ceni — naplaćuje se pouzećem.</p>
                  </div>
                  {pickup && pickup.status !== "DELIVERED" && (
                    <label className="flex cursor-pointer items-start gap-2">
                      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-500" checked={fForce} onChange={(e) => setFForce(e.target.checked)} />
                      <span className="text-xs text-amber-700">
                        Paket kupca još NIJE stigao u magacin — svejedno pošalji zamenu.
                      </span>
                    </label>
                  )}
                </>
              )}

              {error && <p className="form-error">{error}</p>}
            </div>

            <div className="mt-5 flex gap-3">
              <button type="button" className="btn-secondary flex-1" onClick={() => setDialog(null)} disabled={busy}>
                Otkaži
              </button>
              <button type="button" className="btn-primary flex-1" onClick={submitDialog} disabled={busy}>
                {busy ? "Kreiranje..." : dialog === "pickup" ? "Potvrdi preuzimanje" : "Potvrdi slanje"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
