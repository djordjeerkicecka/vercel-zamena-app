import { NextRequest, NextResponse } from "next/server";
import { connectionAdministrator, connectionResult, privateResponse } from "@/lib/shopify/oauth-admin";
import { configuredOAuthShop, hasUniqueOAuthParameters, oauthFailureCategory,
  OAUTH_BINDING_COOKIE, shopifyOAuth, verifyOAuthBinding } from "@/lib/shopify/oauth";
import { createOAuthConnectionStore } from "@/lib/shopify/oauth-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await connectionAdministrator();
  if (!admin) return privateResponse(NextResponse.json({ error: "Ponovo se prijavite i pokrenite povezivanje iz admin panela." }, { status: 403 }));
  try {
    const params = request.nextUrl.searchParams;
    if (!hasUniqueOAuthParameters(params)) throw new Error("Ambiguous callback");
    const shop = configuredOAuthShop(params.get("shop"));
    if (!verifyOAuthBinding(request.cookies.get(OAUTH_BINDING_COOKIE)?.value, shop, admin.id, params.get("state"))) {
      throw new Error("Invalid connection binding");
    }
    // Shopify's official SDK verifies the signed state cookie, callback HMAC and timestamp
    // before exchanging the one-use code. Customer requests never pass through this route.
    const { session, headers } = await shopifyOAuth(shop).auth.callback<Headers>({ rawRequest: request, expiring: true });
    await createOAuthConnectionStore().save(shop, session);
    return connectionResult("connected", headers);
  } catch (error) {
    console.error("Shopify OAuth callback failed", oauthFailureCategory(error));
    return connectionResult("failed");
  }
}
