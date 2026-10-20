"use client";

import { useState } from "react";
import type { ProductVariantOptionDTO } from "@/lib/types";

interface Props {
  variants: ProductVariantOptionDTO[];
  hasColorOption: boolean;
  onSelect: (variant: ProductVariantOptionDTO) => void;
  onClose: () => void;
}

export function SizePickerModal({ variants, hasColorOption, onSelect, onClose }: Props) {
  const colors = hasColorOption
    ? Array.from(new Set(variants.map((v) => v.color).filter((c): c is string => Boolean(c))))
    : [];
  const [selectedColor, setSelectedColor] = useState<string | null>(colors[0] ?? null);

  const visibleVariants = selectedColor ? variants.filter((v) => v.color === selectedColor) : variants;

  const sizes = Array.from(
    new Map(visibleVariants.filter((v) => v.size !== null).map((v) => [v.size, v] as const)).values()
  ).sort((a, b) => (a.size ?? 0) - (b.size ?? 0));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Izaberite veličinu</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Zatvori"
          >
            ✕
          </button>
        </div>

        {colors.length > 1 && (
          <div className="mb-4">
            <p className="form-label">Boja</p>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    selectedColor === color
                      ? "border-brand bg-brand-50 text-brand-700"
                      : "border-gray-300 text-gray-600"
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="form-label">Veličina</p>
        {sizes.length === 0 ? (
          <p className="text-sm text-gray-500">Nema dostupnih veličina za izabranu boju.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {sizes.map((v) => (
              <button
                key={v.variantId}
                type="button"
                disabled={!v.available}
                onClick={() => onSelect(v)}
                className={`rounded-xl border py-3 text-sm font-medium transition ${
                  v.available
                    ? "border-gray-300 text-gray-800 hover:border-brand hover:bg-brand-50"
                    : "cursor-not-allowed border-gray-100 text-gray-300 line-through"
                }`}
              >
                {v.size}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
