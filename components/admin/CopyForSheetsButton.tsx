"use client";

import { useState } from "react";
import type { RequestType } from "@/lib/types";

interface Props {
  customerName: string;
  type: RequestType;
  orderNumber: string;
  returnSkus: string[];
  exchangeSkus: string[];
  bankAccount: string | null;
  bankAccountOwner: string | null;
}

/**
 * Builds the TAB-separated row for pasting into Google Sheets — one click copies the whole
 * row so a paste fills each cell into its own column. Columns 4-6 are intentionally blank,
 * filled in manually by support inside the sheet ("Prvi odgovor", "Zakazivanje preuzimanja",
 * "Kupac obavešten o preuzimanju"). See lib/constants.ts for the column order definition.
 */
export function CopyForSheetsButton({
  customerName,
  type,
  orderNumber,
  returnSkus,
  exchangeSkus,
  bankAccount,
  bankAccountOwner,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  function buildRow(): string {
    const typeUpper = type === "ZAMENA" ? "ZAMENA" : "REFUNDACIJA";
    // Bank account in its formatted (dashed) form, then owner name —
    // e.g. "160-0000000001234-55 Petar Petrović".
    const bankAccountCell =
      type === "REFUNDACIJA" && bankAccount && bankAccountOwner
        ? `${bankAccount} ${bankAccountOwner}`
        : "";

    // Columns A–G are shared. D, E, F are the internal columns support fills in the sheet;
    // G is intentionally blank (the request no longer duplicates the type here).
    //   A = ime i prezime, B = tip, C = broj porudžbine, D/E/F/G = prazno.
    const prefix = [
      customerName,
      typeUpper,
      orderNumber.replace(/^#/, ""),
      "", // D — Prvi odgovor
      "", // E — Zakazivanje preuzimanja
      "", // F — Kupac obavešten o preuzimanju
      "", // G — prazno
    ];

    // Type-specific tail:
    //   REFUNDACIJA: H = tekući račun + ime, I = SKU vraćenog artikla.
    //   ZAMENA:      H = prazno, I = SKU vraćenog artikla, J = SKU zamenskog artikla.
    const tail =
      type === "REFUNDACIJA"
        ? [bankAccountCell, returnSkus.join(", ")]
        : ["", returnSkus.join(", "), exchangeSkus.join(", ")];

    return [...prefix, ...tail].join("\t");
  }

  async function handleCopy() {
    const row = buildRow();
    setError(false);

    try {
      await navigator.clipboard.writeText(row);
    } catch {
      // Fallback for older browsers / non-secure contexts.
      try {
        const textarea = document.createElement("textarea");
        textarea.value = row;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch {
        setError(true);
        return;
      }
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <button type="button" className="btn-secondary w-full" onClick={handleCopy}>
        {copied ? "Kopirano ✓" : "Kopiraj red za Sheets"}
      </button>
      {error && <p className="form-error">Kopiranje nije uspelo. Pokušajte ponovo.</p>}
    </div>
  );
}
