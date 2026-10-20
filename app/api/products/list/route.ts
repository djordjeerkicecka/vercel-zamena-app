import { NextResponse } from "next/server";
import { listExchangeProducts } from "@/lib/shopify/products";
import { isDemoMode, getMockProductList } from "@/lib/demo";

// This GET route has no params, so Next.js would otherwise try to statically prerender it at
// build time — which fails because it fetches a live Shopify token (no-store). Force dynamic so
// it always runs per-request.
export const dynamic = "force-dynamic";

// Returns the catalog of products the customer can pick as an alternative exchange article.
export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({ products: getMockProductList() });
  }

  try {
    const products = await listExchangeProducts();
    return NextResponse.json({ products });
  } catch (error) {
    console.error("Product list lookup failed", error);
    return NextResponse.json(
      { error: "Greška prilikom učitavanja liste artikala." },
      { status: 500 }
    );
  }
}
