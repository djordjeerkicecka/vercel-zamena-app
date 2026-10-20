"use client";

import { useState } from "react";

interface Props {
  ticketNumber: string;
  onConfirm: (typedTicketNumber: string) => Promise<void>;
  onCancel: () => void;
}

export function DeleteDialog({ ticketNumber, onConfirm, onCancel }: Props) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const matches = value.trim() === ticketNumber;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-red-700">Obriši tiket trajno</h3>
        <p className="mt-1.5 text-sm text-gray-600">
          Ova akcija je nepovratna. Da biste potvrdili, ukucajte broj tiketa <strong>{ticketNumber}</strong>.
        </p>

        <input
          type="text"
          className="form-input mt-4"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={ticketNumber}
        />

        <div className="mt-6 flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onCancel} disabled={submitting}>
            Otkaži
          </button>
          <button
            type="button"
            className="btn-danger flex-1"
            disabled={!matches || submitting}
            onClick={async () => {
              setSubmitting(true);
              await onConfirm(value.trim());
              setSubmitting(false);
            }}
          >
            {submitting ? "Brisanje..." : "Obriši trajno"}
          </button>
        </div>
      </div>
    </div>
  );
}
