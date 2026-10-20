"use client";

import { useState } from "react";
import type { RequestType } from "@/lib/types";
import type { ShippingAddressState } from "./types";
import { MAX_IMAGE_SIZE_BYTES } from "@/lib/constants";
import { compressImage } from "@/lib/imageCompress";

interface ImageEntry {
  path: string;
  previewUrl: string;
  fileName: string;
}

// Photos are split into two required sections: the fiscal receipt (comes in the bag with the
// product) and the product itself with its label visibly still attached.
type ImageSection = "racun" | "proizvod";
const SECTION_MAX: Record<ImageSection, number> = { racun: 1, proizvod: 3 };

interface Props {
  type: RequestType;
  customerName: string;
  email: string;
  contactPhone: string;
  shippingAddress: ShippingAddressState;
  draftId: string;
  imagePaths: string[];
  consentGiven: boolean;
  onCustomerNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onContactPhoneChange: (v: string) => void;
  onShippingAddressChange: (v: ShippingAddressState) => void;
  onImagePathsChange: (v: string[]) => void;
  onConsentChange: (v: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step5Contact({
  type,
  customerName,
  email,
  contactPhone,
  shippingAddress,
  draftId,
  imagePaths,
  consentGiven,
  onCustomerNameChange,
  onEmailChange,
  onContactPhoneChange,
  onShippingAddressChange,
  onImagePathsChange,
  onConsentChange,
  onNext,
  onBack,
}: Props) {
  const [sectionImages, setSectionImages] = useState<Record<ImageSection, ImageEntry[]>>({
    racun: [],
    proizvod: [],
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parent payload keeps a single flat list (receipt first) — the server only checks counts.
  function syncPaths(next: Record<ImageSection, ImageEntry[]>) {
    onImagePathsChange([...next.racun, ...next.proizvod].map((i) => i.path));
  }

  async function handleFiles(section: ImageSection, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    const files = Array.from(fileList);
    if (sectionImages[section].length + files.length > SECTION_MAX[section]) {
      setError(
        section === "racun"
          ? "Dovoljna je jedna fotografija računa."
          : `Možete otpremiti najviše ${SECTION_MAX.proizvod} fotografije proizvoda.`
      );
      return;
    }

    setUploading(true);
    try {
      for (const original of files) {
        if (!original.type.startsWith("image/")) {
          setError("Dozvoljene su samo slike.");
          continue;
        }

        // Compress/resize in the browser before uploading (also converts HEIC -> JPEG).
        const file = await compressImage(original);

        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          setError("Slika je prevelika. Maksimalna veličina je 10MB.");
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("draftId", draftId);

        const res = await fetch("/api/images/upload", { method: "POST", body: formData });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Greška prilikom otpremanja slike.");
          continue;
        }

        const entry: ImageEntry = {
          path: data.path,
          previewUrl: URL.createObjectURL(file),
          fileName: file.name,
        };
        setSectionImages((prev) => {
          const next = { ...prev, [section]: [...prev[section], entry] };
          syncPaths(next);
          return next;
        });
      }
    } finally {
      setUploading(false);
    }
  }

  async function removeImage(section: ImageSection, path: string) {
    setSectionImages((prev) => {
      const next = { ...prev, [section]: prev[section].filter((i) => i.path !== path) };
      syncPaths(next);
      return next;
    });
    try {
      await fetch(`/api/images/upload?path=${encodeURIComponent(path)}`, { method: "DELETE" });
    } catch {
      // Non-fatal — orphaned storage object cleaned up manually if needed.
    }
  }

  function handleNext() {
    if (!customerName.trim() || !email.trim() || !contactPhone.trim()) {
      setError("Popunite sva obavezna polja.");
      return;
    }
    if (type === "ZAMENA") {
      if (!shippingAddress.address1.trim() || !shippingAddress.city.trim() || !shippingAddress.zip.trim()) {
        setError("Popunite adresu za slanje zamenskog artikla.");
        return;
      }
    }
    if (sectionImages.racun.length < 1) {
      setError("Priložite fotografiju fiskalnog računa.");
      return;
    }
    if (sectionImages.proizvod.length < 1) {
      setError("Priložite bar jednu fotografiju proizvoda sa vidljivom etiketom.");
      return;
    }
    if (!consentGiven) {
      setError("Potrebno je da se saglasite sa uslovima korišćenja.");
      return;
    }
    setError(null);
    onNext();
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold text-gray-900">Kontakt podaci i slike</h2>

      <div className="mt-5 space-y-4">
        <div>
          <label className="form-label" htmlFor="customerName">
            Ime i prezime
          </label>
          <input
            id="customerName"
            type="text"
            className="form-input"
            value={customerName}
            onChange={(e) => onCustomerNameChange(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="form-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="contactPhone">
              Telefon
            </label>
            <input
              id="contactPhone"
              type="tel"
              className="form-input"
              value={contactPhone}
              onChange={(e) => onContactPhoneChange(e.target.value)}
            />
          </div>
        </div>

        {type === "ZAMENA" && (
          <div className="space-y-4 rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-800">Adresa za slanje zamenskog artikla</p>
            <div>
              <label className="form-label">Adresa</label>
              <input
                type="text"
                className="form-input"
                value={shippingAddress.address1}
                onChange={(e) => onShippingAddressChange({ ...shippingAddress, address1: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Dodatne informacije (opciono)</label>
              <input
                type="text"
                className="form-input"
                value={shippingAddress.address2}
                onChange={(e) => onShippingAddressChange({ ...shippingAddress, address2: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Grad</label>
                <input
                  type="text"
                  className="form-input"
                  value={shippingAddress.city}
                  onChange={(e) => onShippingAddressChange({ ...shippingAddress, city: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Poštanski broj</label>
                <input
                  type="text"
                  className="form-input"
                  value={shippingAddress.zip}
                  onChange={(e) => onShippingAddressChange({ ...shippingAddress, zip: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Photo requirements — the owner's exact instructions, shown for both request types. */}
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
          <p className="font-semibold">Molimo Vas da uz formular priložite:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>fotografiju fiskalnog računa koji se nalazi u kesi zajedno sa proizvodom;</li>
            <li>fotografiju proizvoda na kojoj se jasno vidi da etiketa nije skinuta.</li>
          </ul>
        </div>

        <UploadSection
          title="Fotografija fiskalnog računa"
          hint="Fiskalni račun se nalazi u kesi zajedno sa proizvodom — slikajte ga tako da bude jasno vidljiv i čitljiv."
          images={sectionImages.racun}
          max={SECTION_MAX.racun}
          uploading={uploading}
          onFiles={(files) => handleFiles("racun", files)}
          onRemove={(path) => removeImage("racun", path)}
        />

        <UploadSection
          title="Fotografije proizvoda"
          hint="Na fotografiji se mora jasno videti da etiketa NIJE skinuta sa proizvoda."
          images={sectionImages.proizvod}
          max={SECTION_MAX.proizvod}
          uploading={uploading}
          onFiles={(files) => handleFiles("proizvod", files)}
          onRemove={(path) => removeImage("proizvod", path)}
        />

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-brand-500"
            checked={consentGiven}
            onChange={(e) => onConsentChange(e.target.checked)}
          />
          <span className="text-sm text-gray-700">
            Saglasan/na sam sa{" "}
            <a href="#" className="text-brand-600 underline">
              uslovima korišćenja
            </a>{" "}
            i{" "}
            <a href="#" className="text-brand-600 underline">
              politikom privatnosti
            </a>
            .
          </span>
        </label>

        {error && <p className="form-error">{error}</p>}
      </div>

      <div className="mt-8 flex gap-3">
        <button type="button" className="btn-secondary flex-1" onClick={onBack}>
          Nazad
        </button>
        <button type="button" className="btn-primary flex-1" onClick={handleNext} disabled={uploading}>
          Dalje
        </button>
      </div>
    </div>
  );
}

interface UploadSectionProps {
  title: string;
  hint: string;
  images: ImageEntry[];
  max: number;
  uploading: boolean;
  onFiles: (files: FileList | null) => void;
  onRemove: (path: string) => void;
}

// One photo-upload block: "Slikaj" opens the phone camera directly (capture attribute),
// "Iz galerije" opens the file picker; on desktop both fall back to the file picker.
function UploadSection({ title, hint, images, max, uploading, onFiles, onRemove }: UploadSectionProps) {
  const full = images.length >= max;

  return (
    <div>
      <label className="form-label">
        {title} <span className="text-red-500">*</span>{" "}
        <span className="font-normal text-gray-400">
          ({max === 1 ? "1 slika" : `1–${max} slike`}, max 10MB)
        </span>
      </label>
      <p className="mb-2 text-xs text-gray-500">{hint}</p>

      <div className="flex flex-wrap gap-2">
        <label
          className={`btn-secondary cursor-pointer ${uploading || full ? "pointer-events-none opacity-50" : ""}`}
        >
          📷 Slikaj
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={uploading || full}
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <label
          className={`btn-secondary cursor-pointer ${uploading || full ? "pointer-events-none opacity-50" : ""}`}
        >
          🖼️ Iz galerije
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={max > 1}
            className="hidden"
            disabled={uploading || full}
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {uploading && <p className="mt-1.5 text-xs text-gray-500">Otpremanje slika...</p>}

      {images.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3">
          {images.map((img) => (
            <div key={img.path} className="relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.previewUrl} alt={img.fileName} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(img.path)}
                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                aria-label="Ukloni sliku"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
