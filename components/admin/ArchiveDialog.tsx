"use client";

import { useState } from "react";

interface Props {
  outcome: "zavrseno" | "odbijeno";
  onConfirm: (deleteImages: boolean) => Promise<void>;
  onCancel: () => void;
}

export function ArchiveDialog({ outcome, onConfirm, onCancel }: Props) {
  const [deleteImages, setDeleteImages] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const title = outcome === "zavrseno" ? "Zahtev završen" : "Odbij zahtev";
  const description =
    outcome === "zavrseno"
      ? "Tiket će biti arhiviran i uklonjen sa podrazumevane liste."
      : "Zahtev će biti odbijen i arhiviran.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <p className="mt-1.5 text-sm text-gray-600">{description}</p>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-brand-500"
            checked={deleteImages}
            onChange={(e) => setDeleteImages(e.target.checked)}
          />
          <span className="text-sm text-gray-700">
            Obriši slike (uklanja fajlove iz skladišta; podaci tiketa ostaju radi analitike)
          </span>
        </label>

        <div className="mt-6 flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onCancel} disabled={submitting}>
            Otkaži
          </button>
          <button
            type="button"
            className={outcome === "odbijeno" ? "btn-danger flex-1" : "btn-primary flex-1"}
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              await onConfirm(deleteImages);
              setSubmitting(false);
            }}
          >
            {submitting ? "Obrada..." : "Potvrdi"}
          </button>
        </div>
      </div>
    </div>
  );
}
