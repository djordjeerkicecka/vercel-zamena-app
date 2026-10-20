import { NextRequest, NextResponse } from "next/server";
import { uploadTicketImage, deleteTicketImages } from "@/lib/supabase/storage";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from "@/lib/constants";
import { isDemoMode } from "@/lib/demo";

// Images are uploaded during Step 5 of the wizard, before the ticket exists — the client
// generates a random draftId up front and reuses it for every image in that submission.
export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtev." }, { status: 400 });
  }

  const file = formData.get("file");
  const draftId = formData.get("draftId");

  if (!(file instanceof File) || typeof draftId !== "string" || !draftId) {
    return NextResponse.json({ error: "Nedostaje fajl ili draftId." }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Dozvoljeni formati slika su JPG, PNG i WEBP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Slika je prevelika. Maksimalna veličina je 10MB." },
      { status: 400 }
    );
  }

  // draftId is client-generated but only ever used to namespace a storage folder path —
  // sanitize to prevent path traversal.
  const safeDraftId = draftId.replace(/[^a-zA-Z0-9-]/g, "");
  if (!safeDraftId) {
    return NextResponse.json({ error: "Neispravan draftId." }, { status: 400 });
  }

  // Demo mode: skip Storage entirely and return a fake path. The client renders the preview
  // from a local object URL, so the image still shows in the wizard.
  if (isDemoMode()) {
    return NextResponse.json({ path: `demo/${safeDraftId}/${file.name}` });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = await uploadTicketImage(safeDraftId, file.name, bytes, file.type);
    return NextResponse.json({ path });
  } catch (error) {
    console.error("Image upload failed", error);
    return NextResponse.json({ error: "Greška prilikom otpremanja slike." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "Nedostaje putanja slike." }, { status: 400 });
  }

  // Demo mode: nothing was uploaded to Storage, so just acknowledge.
  if (isDemoMode()) {
    return NextResponse.json({ ok: true });
  }

  try {
    await deleteTicketImages([path]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Image delete failed", error);
    return NextResponse.json({ error: "Greška prilikom brisanja slike." }, { status: 500 });
  }
}
