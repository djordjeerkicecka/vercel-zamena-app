import { NextRequest, NextResponse } from "next/server";
import { getProductVariantsWithInventory } from "@/lib/shopify/products";
import { isDemoMode, getMockVariants } from "@/lib/demo";

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("productId");

  if (!productId) {
    return NextResponse.json({ error: "Nedostaje productId." }, { status: 400 });
  }

  if (isDemoMode()) {
    return NextResponse.json(getMockVariants(productId));
  }

  try {
    const result = await getProductVariantsWithInventory(productId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Product variants lookup failed", error);
    return NextResponse.json(
      { error: "Greška prilikom učitavanja varijanti proizvoda." },
      { status: 500 }
    );
  }
}
