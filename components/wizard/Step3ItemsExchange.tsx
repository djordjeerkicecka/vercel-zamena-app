"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type {
  ProductListItemDTO,
  ProductVariantOptionDTO,
  ProductVariantsResultDTO,
} from "@/lib/types";
import type { WizardItemState } from "./types";
import { SizePickerModal } from "./SizePickerModal";
import { EXCHANGE_LOGISTICS_NOTES } from "@/lib/constants";

interface Props {
  items: WizardItemState[];
  onChange: (items: WizardItemState[]) => void;
  onNext: () => void;
  onBack: () => void;
  onSwitchToRefund: () => void;
}

type VariantsEntry =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: ProductVariantsResultDTO };

/**
 * Combined step for ZAMENA: pick which ordered items to return AND choose the replacement inline.
 * No reason is collected here (the customer is simply swapping). For each checked item the
 * replacement defaults to the same article (variant/size picker); optionally they can switch to
 * a different article, chosen from a catalog dropdown, and then pick its variant/size.
 */
export function Step3ItemsExchange({ items, onChange, onNext, onBack, onSwitchToRefund }: Props) {
  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, VariantsEntry>>({});
  const [productList, setProductList] = useState<ProductListItemDTO[]>([]);
  const [modalForLineItem, setModalForLineItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The product whose variants each checked item currently needs loaded.
  const neededProductIds = items
    .filter((i) => i.checked)
    .map((i) => (i.exchangeMode === "drugi" ? i.exchangeProductId : i.productId))
    .filter((id): id is string => Boolean(id));
  const neededKey = Array.from(new Set(neededProductIds)).join(",");

  // Load the catalog once (for the "different article" dropdown).
  useEffect(() => {
    fetch("/api/products/list")
      .then((res) => res.json())
      .then((data) => setProductList(data.products ?? []))
      .catch(() => setProductList([]));
  }, []);

  // Lazily load variants for whichever products the checked items point at.
  useEffect(() => {
    const productIds = neededKey ? neededKey.split(",") : [];
    productIds.forEach((productId) => {
      setVariantsByProduct((prev) => {
        if (prev[productId]) return prev;
        return { ...prev, [productId]: { status: "loading" } };
      });

      fetch(`/api/products/variants?productId=${encodeURIComponent(productId)}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setVariantsByProduct((prev) => ({ ...prev, [productId]: { status: "ready", data } }));
        })
        .catch(() => {
          setVariantsByProduct((prev) => ({ ...prev, [productId]: { status: "error" } }));
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neededKey]);

  // Auto-select the sole variant for products with no size option and only one option in stock.
  useEffect(() => {
    let changed = false;
    const next = items.map((item) => {
      if (!item.checked || item.exchangeVariantId) return item;
      const effectiveProductId = item.exchangeMode === "drugi" ? item.exchangeProductId : item.productId;
      if (!effectiveProductId) return item;
      const entry = variantsByProduct[effectiveProductId];
      if (!entry || entry.status !== "ready") return item;
      if (!entry.data.hasSizeOption && entry.data.variants.length === 1) {
        const v = entry.data.variants[0];
        if (v.available) {
          changed = true;
          return applyVariant(item, v);
        }
      }
      return item;
    });
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantsByProduct]);

  function productTitleFor(item: WizardItemState, productId: string): string {
    if (productId === item.productId) return item.title;
    return productList.find((p) => p.productId === productId)?.title ?? "Artikal";
  }

  function applyVariant(item: WizardItemState, variant: ProductVariantOptionDTO): WizardItemState {
    const effectiveProductId = item.exchangeMode === "drugi" ? item.exchangeProductId! : item.productId;
    const isDifferentProduct = effectiveProductId !== item.productId;
    const productTitle = productTitleFor(item, effectiveProductId);
    const variantTitle = isDifferentProduct ? `${productTitle} — ${variant.title}` : variant.title;
    return {
      ...item,
      exchangeProductId: effectiveProductId,
      exchangeProductTitle: productTitle,
      exchangeVariantId: variant.variantId,
      exchangeVariantTitle: variantTitle,
      exchangeSku: variant.sku,
      exchangeSize: variant.size,
    };
  }

  function updateItem(lineItemId: string, patch: Partial<WizardItemState>) {
    onChange(items.map((it) => (it.lineItemId === lineItemId ? { ...it, ...patch } : it)));
  }

  function toggleChecked(lineItemId: string, checked: boolean) {
    updateItem(lineItemId, {
      checked,
      // Reset exchange choice when unchecking.
      ...(checked
        ? {}
        : {
            exchangeMode: "isti",
            exchangeProductId: null,
            exchangeProductTitle: null,
            exchangeVariantId: null,
            exchangeVariantTitle: null,
            exchangeSku: null,
            exchangeSize: null,
          }),
    });
  }

  function setMode(item: WizardItemState, mode: "isti" | "drugi") {
    updateItem(item.lineItemId, {
      exchangeMode: mode,
      exchangeProductId: mode === "isti" ? item.productId : null,
      exchangeProductTitle: null,
      exchangeVariantId: null,
      exchangeVariantTitle: null,
      exchangeSku: null,
      exchangeSize: null,
    });
  }

  function setOtherProduct(item: WizardItemState, productId: string) {
    updateItem(item.lineItemId, {
      exchangeProductId: productId || null,
      exchangeProductTitle: null,
      exchangeVariantId: null,
      exchangeVariantTitle: null,
      exchangeSku: null,
      exchangeSize: null,
    });
  }

  function selectVariant(item: WizardItemState, variant: ProductVariantOptionDTO) {
    onChange(items.map((it) => (it.lineItemId === item.lineItemId ? applyVariant(it, variant) : it)));
  }

  const checkedItems = items.filter((i) => i.checked);

  function handleNext() {
    if (checkedItems.length === 0) {
      setError("Izaberite bar jedan artikal koji menjate.");
      return;
    }
    for (const item of checkedItems) {
      if (item.exchangeMode === "drugi" && !item.exchangeProductId) {
        setError("Izaberite zamenski artikal iz liste.");
        return;
      }
      if (!item.exchangeVariantId) {
        setError("Izaberite zamensku varijantu/veličinu za svaki artikal.");
        return;
      }
    }
    setError(null);
    onNext();
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold text-gray-900">Artikli i zamena</h2>
      <p className="mt-1 text-sm text-gray-600">
        Označite koje artikle menjate i za svaki izaberite zamenski artikal.
      </p>

      <div className="mt-5 space-y-4">
        {items.map((item) => {
          const effectiveProductId =
            item.exchangeMode === "drugi" ? item.exchangeProductId : item.productId;
          const entry = effectiveProductId ? variantsByProduct[effectiveProductId] : undefined;
          const sameProductUnavailable =
            item.exchangeMode === "isti" &&
            entry?.status === "ready" &&
            entry.data.variants.every((v) => !v.available);

          return (
            <div
              key={item.lineItemId}
              className={`rounded-xl border p-3 transition ${
                item.checked ? "border-brand bg-brand-50/40" : "border-gray-200"
              }`}
            >
              <div className="flex gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-brand-500"
                  checked={item.checked}
                  onChange={(e) => toggleChecked(item.lineItemId, e.target.checked)}
                />

                {item.imageUrl ? (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    <Image src={item.imageUrl} alt={item.title} fill sizes="64px" className="object-cover" />
                  </div>
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-lg bg-gray-100" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{item.title}</p>
                  {item.variantTitle && <p className="text-xs text-gray-500">{item.variantTitle}</p>}
                  <p className="text-xs text-gray-500">
                    Količina: {item.quantity} · {item.price} RSD
                  </p>
                </div>
              </div>

              {item.checked && (
                <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                  <p className="text-sm font-medium text-gray-700">Zamenski artikal</p>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label
                      className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm ${
                        item.exchangeMode === "isti"
                          ? "border-brand bg-brand-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`mode-${item.lineItemId}`}
                        className="h-4 w-4 accent-brand-500"
                        checked={item.exchangeMode === "isti"}
                        onChange={() => setMode(item, "isti")}
                      />
                      <span>Isti artikal</span>
                    </label>
                    <label
                      className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm ${
                        item.exchangeMode === "drugi"
                          ? "border-brand bg-brand-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`mode-${item.lineItemId}`}
                        className="h-4 w-4 accent-brand-500"
                        checked={item.exchangeMode === "drugi"}
                        onChange={() => setMode(item, "drugi")}
                      />
                      <span>Drugi artikal</span>
                    </label>
                  </div>

                  {item.exchangeMode === "drugi" && (
                    <div>
                      <label className="form-label">Izaberite artikal za zamenu</label>
                      <select
                        className="form-input"
                        value={item.exchangeProductId ?? ""}
                        onChange={(e) => setOtherProduct(item, e.target.value)}
                      >
                        <option value="" disabled>
                          Izaberite artikal
                        </option>
                        {productList.map((p) => (
                          <option key={p.productId} value={p.productId}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Variant / size picker for the effective exchange product */}
                  {effectiveProductId &&
                    (!entry || entry.status === "loading" ? (
                      <p className="text-sm text-gray-500">Učitavanje dostupnih varijanti...</p>
                    ) : entry.status === "error" ? (
                      <p className="text-sm text-red-600">Greška prilikom učitavanja varijanti.</p>
                    ) : entry.data.variants.every((v) => !v.available) ? (
                      <div className="text-sm text-amber-700">
                        <p>Nema dostupnih varijanti za izabrani artikal.</p>
                        {sameProductUnavailable && (
                          <button type="button" className="btn-secondary mt-2" onClick={onSwitchToRefund}>
                            Nastavi kao refundacija
                          </button>
                        )}
                      </div>
                    ) : entry.data.hasSizeOption ? (
                      <div>
                        {item.exchangeVariantId ? (
                          <p className="text-sm text-brand-700">Izabrano: {item.exchangeVariantTitle}</p>
                        ) : (
                          <p className="text-sm text-gray-500">Veličina nije izabrana</p>
                        )}
                        <button
                          type="button"
                          className="btn-secondary mt-2"
                          onClick={() => setModalForLineItem(item.lineItemId)}
                        >
                          {item.exchangeVariantId ? "Promeni veličinu" : "Izaberi veličinu"}
                        </button>
                      </div>
                    ) : entry.data.variants.length > 1 ? (
                      <div>
                        <label className="form-label">Varijanta</label>
                        <select
                          className="form-input"
                          value={item.exchangeVariantId ?? ""}
                          onChange={(e) => {
                            const v = entry.data.variants.find((x) => x.variantId === e.target.value);
                            if (v) selectVariant(item, v);
                          }}
                        >
                          <option value="" disabled>
                            Izaberite varijantu
                          </option>
                          {entry.data.variants
                            .filter((v) => v.available)
                            .map((v) => (
                              <option key={v.variantId} value={v.variantId}>
                                {v.title}
                              </option>
                            ))}
                        </select>
                      </div>
                    ) : (
                      <p className="text-sm text-green-700">✓ Zamena za isti artikal</p>
                    ))}

                  {entry?.status === "ready" &&
                    entry.data.hasSizeOption &&
                    modalForLineItem === item.lineItemId && (
                      <SizePickerModal
                        variants={entry.data.variants}
                        hasColorOption={entry.data.hasColorOption}
                        onSelect={(v) => {
                          selectVariant(item, v);
                          setModalForLineItem(null);
                        }}
                        onClose={() => setModalForLineItem(null)}
                      />
                    )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Price difference note — no price math in code, just inform the customer. */}
      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-semibold">Napomena o ceni i slanju:</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {EXCHANGE_LOGISTICS_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="mt-8 flex gap-3">
        <button type="button" className="btn-secondary flex-1" onClick={onBack}>
          Nazad
        </button>
        <button type="button" className="btn-primary flex-1" onClick={handleNext}>
          Dalje
        </button>
      </div>
    </div>
  );
}
