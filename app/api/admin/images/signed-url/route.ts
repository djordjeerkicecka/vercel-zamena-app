import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/supabase/requireUser";
import { createSignedImageUrl } from "@/lib/supabase/storage";
import { isDemoMode, DEMO_PLACEHOLDER_IMAGE } from "@/lib/demo";

export async function GET(request: NextRequest) {
  // Demo mode: no real Storage — hand back a placeholder image.
  if (isDemoMode()) return NextResponse.json({ url: DEMO_PLACEHOLDER_IMAGE });

  const user = await getAuthenticatedAdmin();
  if (!user) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const path = request.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "Nedostaje putanja slike." }, { status: 400 });

  try {
    const url = await createSignedImageUrl(path);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Signed URL generation failed", error);
    return NextResponse.json({ error: "Greška prilikom generisanja linka za sliku." }, { status: 500 });
  }
}
