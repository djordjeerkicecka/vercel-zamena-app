// Browser-side image compression, run before uploading each photo.
//
// Cuts a typical 4–8MB phone photo to well under 1MB by downscaling to at most 2000px on the
// long edge and re-encoding as JPEG at ~72% quality. That keeps enough resolution to read a
// receipt QR code / see the product, while drastically reducing storage and upload time.
// It also normalizes formats — e.g. an iPhone HEIC photo comes out as a standard JPEG.
//
// If the browser can't decode the file for any reason, the original file is returned unchanged
// so uploading never breaks.

const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 0.72;

export async function compressImage(file: File): Promise<File> {
  try {
    if (!file.type.startsWith("image/")) return file;

    // `imageOrientation: "from-image"` applies the EXIF rotation so portrait phone photos
    // don't come out sideways.
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    } as ImageBitmapOptions);

    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob) return file;

    // For an already-tiny JPEG, keep whichever is smaller.
    if (blob.size >= file.size && file.type === "image/jpeg") return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "slika";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
