"use client";

import { useEffect, useState } from "react";

interface TicketImageRow {
  id: string;
  storage_path: string;
}

export function ImageGallery({ images, imagesDeleted }: { images: TicketImageRow[]; imagesDeleted: boolean }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    images.forEach((img) => {
      fetch(`/api/admin/images/signed-url?path=${encodeURIComponent(img.storage_path)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.url) setUrls((prev) => ({ ...prev, [img.id]: data.url }));
        })
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.map((i) => i.id).join(",")]);

  if (imagesDeleted) {
    return <p className="text-sm text-gray-400">Slike su obrisane iz skladišta.</p>;
  }

  if (images.length === 0) {
    return <p className="text-sm text-gray-400">Nema priloženih slika.</p>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {images.map((img) => (
          <button
            key={img.id}
            type="button"
            className="h-24 w-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
            onClick={() => urls[img.id] && setLightbox(urls[img.id])}
          >
            {urls[img.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[img.id]} alt="Slika artikla" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                Učitavanje...
              </span>
            )}
          </button>
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Uvećana slika" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </>
  );
}
