"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/constants";

export function FiltersBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParam("q", q || null);
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div>
        <label className="form-label">Status</label>
        <select
          className="form-input"
          value={searchParams.get("status") ?? ""}
          onChange={(e) => updateParam("status", e.target.value || null)}
        >
          <option value="">Sve (osim arhiviranih)</option>
          {STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="form-label">Tip</label>
        <select
          className="form-input"
          value={searchParams.get("type") ?? ""}
          onChange={(e) => updateParam("type", e.target.value || null)}
        >
          <option value="">Svi tipovi</option>
          <option value="ZAMENA">Zamena</option>
          <option value="REFUNDACIJA">Refundacija</option>
        </select>
      </div>

      <div>
        <label className="form-label">Sortiranje</label>
        <select
          className="form-input"
          value={searchParams.get("sort") ?? "desc"}
          onChange={(e) => updateParam("sort", e.target.value)}
        >
          <option value="desc">Najnovije prvo</option>
          <option value="asc">Najstarije prvo</option>
        </select>
      </div>

      <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px]">
        <label className="form-label">Pretraga</label>
        <div className="flex gap-2">
          <input
            type="text"
            className="form-input"
            placeholder="Broj porudžbine, ime, telefon..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit" className="btn-secondary shrink-0">
            Pretraži
          </button>
        </div>
      </form>
    </div>
  );
}
