"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "./StatusBadge";
import type { TicketStatus } from "@/lib/types";

interface TicketRow {
  id: string;
  ticket_number: string;
  created_at: string;
  customer_name: string;
  order_number: string;
  type: "ZAMENA" | "REFUNDACIJA";
  status: TicketStatus;
  ticket_items: { price: number; quantity: number }[];
  ticket_shipments?: { kind: string; status: string }[];
}

function ticketAmount(items: { price: number; quantity: number }[]): number {
  return items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
}

// Compact courier state for the list: the most relevant active shipment per ticket.
function courierChip(shipments?: { kind: string; status: string }[]): { label: string; cls: string } | null {
  const active = (shipments ?? []).filter((s) => !["CANCELED", "REJECTED"].includes(s.status));
  if (active.length === 0) return null;
  const send = active.find((s) => s.kind === "ZAMENA");
  const pickup = active.find((s) => s.kind === "PREUZIMANJE");
  if (send) {
    const map: Record<string, [string, string]> = {
      PROCESSING: ["Zamena: u obradi", "bg-blue-100 text-blue-700"],
      SENT: ["Zamena: poslata", "bg-amber-100 text-amber-700"],
      DELIVERED: ["Zamena: isporučena", "bg-green-100 text-green-700"],
      RETURN: ["Zamena: vraćena", "bg-red-100 text-red-700"],
    };
    const m = map[send.status];
    if (m) return { label: m[0], cls: m[1] };
  }
  if (pickup) {
    const map: Record<string, [string, string]> = {
      PROCESSING: ["Preuzimanje: zakazano", "bg-blue-100 text-blue-700"],
      SENT: ["Kurir preuzeo", "bg-amber-100 text-amber-700"],
      DELIVERED: ["Stiglo u magacin", "bg-green-100 text-green-700"],
      RETURN: ["Preuzimanje: vraćeno", "bg-red-100 text-red-700"],
    };
    const m = map[pickup.status];
    if (m) return { label: m[0], cls: m[1] };
  }
  return null;
}

export function TicketListTable({ tickets }: { tickets: TicketRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allOnPage = tickets.length > 0 && tickets.every((t) => selected.has(t.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (tickets.every((t) => prev.has(t.id))) return new Set();
      return new Set(tickets.map((t) => t.id));
    });
  }

  async function handleBulkDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tickets/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Greška prilikom brisanja.");
        return;
      }
      setSelected(new Set());
      setConfirming(false);
      setConfirmText("");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
          <span className="text-sm font-medium text-red-800">Izabrano: {selected.size}</span>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary !py-2" onClick={() => setSelected(new Set())}>
              Poništi izbor
            </button>
            <button type="button" className="btn-danger !py-2" onClick={() => setConfirming(true)}>
              Obriši izabrane ({selected.size})
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-500"
                  checked={allOnPage}
                  onChange={toggleAll}
                  aria-label="Izaberi sve"
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Broj tiketa</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Datum</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Kupac</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Porudžbina</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Tip</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Kurir</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Iznos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tickets.map((ticket) => (
              <tr key={ticket.id} className={selected.has(ticket.id) ? "bg-red-50/40" : "hover:bg-gray-50"}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-500"
                    checked={selected.has(ticket.id)}
                    onChange={() => toggle(ticket.id)}
                    aria-label={`Izaberi ${ticket.ticket_number}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/tiketi/${ticket.id}`} className="font-semibold text-brand-700 hover:underline">
                    {ticket.ticket_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {new Date(ticket.created_at).toLocaleDateString("sr-RS")}
                </td>
                <td className="px-4 py-3 text-gray-800">{ticket.customer_name}</td>
                <td className="px-4 py-3 text-gray-600">#{ticket.order_number}</td>
                <td className="px-4 py-3 text-gray-600">
                  {ticket.type === "ZAMENA" ? "Zamena" : "Refundacija"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={ticket.status} />
                </td>
                <td className="px-4 py-3">
                  {(() => {
                    const chip = courierChip(ticket.ticket_shipments);
                    return chip ? (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${chip.cls}`}>
                        🚚 {chip.label}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-gray-600">{ticketAmount(ticket.ticket_items).toFixed(2)} RSD</td>
              </tr>
            ))}

            {tickets.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  Nema tiketa koji odgovaraju filterima.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !deleting && setConfirming(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-red-700">Obriši {selected.size} tiketa trajno</h3>
            <p className="mt-1.5 text-sm text-gray-600">
              Ova akcija je nepovratna (briše tikete, stavke i slike). Za potvrdu ukucajte{" "}
              <strong>OBRISI</strong>.
            </p>
            <input
              type="text"
              className="form-input mt-4"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="OBRISI"
              autoFocus
            />
            {error && <p className="form-error">{error}</p>}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setConfirming(false)}
                disabled={deleting}
              >
                Otkaži
              </button>
              <button
                type="button"
                className="btn-danger flex-1"
                disabled={confirmText.trim().toUpperCase() !== "OBRISI" || deleting}
                onClick={handleBulkDelete}
              >
                {deleting ? "Brisanje..." : "Obriši trajno"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
