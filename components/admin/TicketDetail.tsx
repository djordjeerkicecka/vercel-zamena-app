"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { ImageGallery } from "./ImageGallery";
import { NotesPanel } from "./NotesPanel";
import { KurirCard } from "./KurirCard";
import { CopyForSheetsButton } from "./CopyForSheetsButton";
import { ArchiveDialog } from "./ArchiveDialog";
import { DeleteDialog } from "./DeleteDialog";
import { REASON_OPTIONS, STATUS_LABELS } from "@/lib/constants";
import type { ReasonCode, SizeDirection, TicketStatus } from "@/lib/types";

interface TicketItemRow {
  id: string;
  product_title: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  price: number;
  reason: ReasonCode | null;
  reason_text: string | null;
  original_size: number | null;
  exchange_product_id: string | null;
  exchange_variant_id: string | null;
  exchange_variant_title: string | null;
  exchange_sku: string | null;
  exchange_size: number | null;
  size_direction: SizeDirection | null;
}

interface TicketImageRow {
  id: string;
  storage_path: string;
}

interface TicketNoteRow {
  id: string;
  author_email: string;
  note: string;
  created_at: string;
}

export interface TicketDetailData {
  id: string;
  ticket_number: string;
  order_number: string;
  customer_name: string;
  email: string;
  phone: string;
  shipping_address1: string | null;
  shipping_address2: string | null;
  shipping_city: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
  type: "ZAMENA" | "REFUNDACIJA";
  status: TicketStatus;
  bank_account: string | null;
  bank_account_owner: string | null;
  goods_received_date: string | null;
  refund_terms_confirmed: boolean;
  images_deleted: boolean;
  exchange_tracking_number: string | null;
  created_at: string;
  ticket_items: TicketItemRow[];
  ticket_images: TicketImageRow[];
  ticket_notes: TicketNoteRow[];
}

function reasonLabel(code: ReasonCode) {
  return REASON_OPTIONS.find((r) => r.code === code)?.label ?? code;
}

const EDITABLE_STATUSES: TicketStatus[] = ["novo", "u_obradi", "odobreno", "odbijeno"];

interface TicketDetailProps {
  ticket: TicketDetailData;
  shopifyOrderUrl: string;
  // Ids of the neighbouring tickets in the list ordering (newest first), for quick navigation
  // without going back to the list. Null when at either end.
  prevTicketId: string | null;
  nextTicketId: string | null;
}

export function TicketDetail({ ticket, shopifyOrderUrl, prevTicketId, nextTicketId }: TicketDetailProps) {
  const router = useRouter();
  const [status, setStatus] = useState(ticket.status);
  const [tracking, setTracking] = useState(ticket.exchange_tracking_number ?? "");
  const [savingTracking, setSavingTracking] = useState(false);
  const [archiveOutcome, setArchiveOutcome] = useState<"zavrseno" | "odbijeno" | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleStatusChange(newStatus: TicketStatus) {
    setStatus(newStatus);
    setActionError(null);
    const res = await fetch(`/api/admin/tickets/${ticket.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      setStatus(ticket.status);
      setActionError("Greška prilikom izmene statusa.");
    } else {
      router.refresh();
    }
  }

  async function handleSaveTracking() {
    setSavingTracking(true);
    setActionError(null);
    const res = await fetch(`/api/admin/tickets/${ticket.id}/tracking`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingNumber: tracking }),
    });
    setSavingTracking(false);
    if (!res.ok) setActionError("Greška prilikom čuvanja broja pošiljke.");
    else router.refresh();
  }

  async function handleArchiveConfirm(deleteImages: boolean) {
    if (!archiveOutcome) return;
    const res = await fetch(`/api/admin/tickets/${ticket.id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: archiveOutcome, deleteImages }),
    });
    const data = await res.json();
    if (!res.ok) {
      setActionError(data.error || "Greška prilikom arhiviranja.");
    } else {
      // Update local state immediately so the badge and action buttons reflect the archive
      // without waiting for the server re-render (and so it's visible in demo mode too).
      setStatus("arhivirano");
      setArchiveOutcome(null);
      router.refresh();
    }
  }

  async function handleDeleteConfirm(typedTicketNumber: string) {
    const res = await fetch(`/api/admin/tickets/${ticket.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketNumber: typedTicketNumber }),
    });
    const data = await res.json();
    if (!res.ok) {
      setActionError(data.error || "Greška prilikom brisanja tiketa.");
      setShowDeleteDialog(false);
    } else {
      router.push("/admin/tiketi");
    }
  }

  const returnSkus = ticket.ticket_items.map((i) => i.sku).filter((s): s is string => Boolean(s));
  const exchangeSkus = ticket.ticket_items
    .map((i) => i.exchange_sku)
    .filter((s): s is string => Boolean(s));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{ticket.ticket_number}</h1>
          <p className="text-sm text-gray-500">
            {new Date(ticket.created_at).toLocaleString("sr-RS")} · Porudžbina{" "}
            <a href={shopifyOrderUrl} target="_blank" rel="noreferrer" className="text-brand-600 underline">
              #{ticket.order_number}
            </a>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <div className="flex gap-2">
            {prevTicketId ? (
              <Link href={`/admin/tiketi/${prevTicketId}`} className="btn-secondary !px-3 !py-2">
                ← Prethodni
              </Link>
            ) : (
              <span className="btn-secondary cursor-not-allowed !px-3 !py-2 opacity-40">← Prethodni</span>
            )}
            {nextTicketId ? (
              <Link href={`/admin/tiketi/${nextTicketId}`} className="btn-secondary !px-3 !py-2">
                Sledeći tiket →
              </Link>
            ) : (
              <span className="btn-secondary cursor-not-allowed !px-3 !py-2 opacity-40">Sledeći tiket →</span>
            )}
          </div>
        </div>
      </div>

      {actionError && <p className="form-error mb-4">{actionError}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card">
            <h2 className="text-sm font-bold uppercase text-gray-500">Kupac</h2>
            <div className="mt-2 space-y-1 text-sm">
              <p className="font-medium text-gray-800">{ticket.customer_name}</p>
              <p className="text-gray-600">{ticket.email}</p>
              <p className="text-gray-600">{ticket.phone}</p>
            </div>

            {ticket.type === "ZAMENA" && (
              <div className="mt-3 border-t border-gray-100 pt-3 text-sm">
                <p className="font-semibold text-gray-700">Adresa za slanje zamene</p>
                <p className="text-gray-600">
                  {ticket.shipping_address1}
                  {ticket.shipping_address2 ? `, ${ticket.shipping_address2}` : ""}, {ticket.shipping_zip}{" "}
                  {ticket.shipping_city}
                </p>
              </div>
            )}

            {ticket.type === "REFUNDACIJA" && (
              <div className="mt-3 border-t border-gray-100 pt-3 text-sm">
                <p className="font-semibold text-gray-700">Tekući račun</p>
                <p className="text-gray-600">
                  {ticket.bank_account} — {ticket.bank_account_owner}
                </p>
                <p className="mt-1 text-gray-600">Datum prijema robe: {ticket.goods_received_date}</p>
                <p className="text-gray-600">
                  Potvrđeni uslovi: {ticket.refund_terms_confirmed ? "Da" : "Ne"}
                </p>
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="text-sm font-bold uppercase text-gray-500">Artikli</h2>
            <div className="mt-2 space-y-3">
              {ticket.ticket_items.map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-100 p-3 text-sm">
                  <p className="font-medium text-gray-800">
                    {item.product_title} {item.variant_title ? `— ${item.variant_title}` : ""}
                  </p>
                  <p className="text-xs text-gray-500">
                    SKU: {item.sku ?? "—"} · Količina: {item.quantity} · {item.price} RSD
                  </p>
                  {item.reason && (
                    <p className="mt-1 text-gray-600">
                      Razlog: {reasonLabel(item.reason)}
                      {item.reason === "DRUGO" && item.reason_text ? ` — ${item.reason_text}` : ""}
                    </p>
                  )}
                  {ticket.type === "ZAMENA" && item.exchange_variant_title && (
                    <p className="mt-1 text-brand-700">
                      Zamena za: {item.exchange_variant_title}
                      {item.exchange_sku && ` · SKU: ${item.exchange_sku}`}
                      {item.size_direction &&
                        ` (${item.original_size ?? "—"} → ${item.exchange_size ?? "—"}, ${item.size_direction})`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-sm font-bold uppercase text-gray-500">Slike</h2>
            <div className="mt-2">
              <ImageGallery images={ticket.ticket_images} imagesDeleted={ticket.images_deleted} />
            </div>
          </div>

          <div className="card">
            <h2 className="text-sm font-bold uppercase text-gray-500">Interne beleške</h2>
            <div className="mt-2">
              <NotesPanel ticketId={ticket.id} initialNotes={ticket.ticket_notes} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm font-bold uppercase text-gray-500">Status</h2>
            <select
              className="form-input mt-2"
              value={status}
              disabled={status === "arhivirano"}
              onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
            >
              {EDITABLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
              {status === "arhivirano" && <option value="arhivirano">{STATUS_LABELS.arhivirano}</option>}
            </select>

            {ticket.type === "ZAMENA" && (
              <div className="mt-4">
                <label className="form-label">Broj pošiljke za zamenu</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="form-input"
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-secondary shrink-0"
                    onClick={handleSaveTracking}
                    disabled={savingTracking}
                  >
                    Sačuvaj
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4">
              <CopyForSheetsButton
                customerName={ticket.customer_name}
                type={ticket.type}
                orderNumber={ticket.order_number}
                returnSkus={returnSkus}
                exchangeSkus={exchangeSkus}
                bankAccount={ticket.bank_account}
                bankAccountOwner={ticket.bank_account_owner}
              />
            </div>
          </div>

          <KurirCard
            ticketId={ticket.id}
            ticketType={ticket.type}
            defaults={{
              name: ticket.customer_name,
              street: [ticket.shipping_address1, ticket.shipping_address2].filter(Boolean).join(", "),
              city: ticket.shipping_city ?? "",
              zip: ticket.shipping_zip ?? "",
              phone: ticket.phone,
            }}
            returnSkus={returnSkus}
            exchangeSkus={exchangeSkus}
          />

          {status !== "arhivirano" && (
            <div className="card">
              <h2 className="text-sm font-bold uppercase text-gray-500">Zatvaranje tiketa</h2>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setArchiveOutcome("zavrseno")}
                >
                  ✓ Zahtev završen
                </button>
                <button type="button" className="btn-danger" onClick={() => setArchiveOutcome("odbijeno")}>
                  ✗ Odbij zahtev
                </button>
              </div>
            </div>
          )}

          <div className="card">
            <h2 className="text-sm font-bold uppercase text-gray-500">Opasna zona</h2>
            <button
              type="button"
              className="btn-danger mt-3 w-full"
              onClick={() => setShowDeleteDialog(true)}
            >
              Obriši tiket trajno
            </button>
          </div>

          <Link href="/admin/tiketi" className="block text-center text-sm text-gray-500 hover:underline">
            ← Nazad na listu tiketa
          </Link>
        </div>
      </div>

      {archiveOutcome && (
        <ArchiveDialog
          outcome={archiveOutcome}
          onConfirm={handleArchiveConfirm}
          onCancel={() => setArchiveOutcome(null)}
        />
      )}

      {showDeleteDialog && (
        <DeleteDialog
          ticketNumber={ticket.ticket_number}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}
    </div>
  );
}
