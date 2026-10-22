import { NextRequest, NextResponse } from "next/server";
import { connectionAdministrator, privateResponse } from "@/lib/shopify/oauth-admin";
import { configuredOAuthShop, createOAuthBinding, getShopifyAppUrl, oauthFailureCategory,
  OAUTH_BINDING_COOKIE, OAUTH_CALLBACK_PATH, shopifyOAuth } from "@/lib/shopify/oauth";
import { tokenEncryptionKey } from "@/lib/shopify/oauth-crypto";
import { createOAuthConnectionStore } from "@/lib/shopify/oauth-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const admin = await connectionAdministrator();
  if (!admin) return privateResponse(NextResponse.json({ error: "Nemate dozvolu za povezivanje prodavnice." }, { status: 403 }));
  try {
    const origin = getShopifyAppUrl().origin;
    if (request.headers.get("origin") !== origin || new URL(request.url).origin !== origin) {
      return privateResponse(NextResponse.json({ error: "Neispravan izvor zahteva." }, { status: 403 }));
    }
    const form = await request.formData();
    const domain = form.getAll("shop");
    const shop = configuredOAuthShop(domain.length === 1 && typeof domain[0] === "string" ? domain[0] : null);
    tokenEncryptionKey();
    // Verify storage before sending the merchant to approve permissions.
    await createOAuthConnectionStore().load(shop);
    const redirect = await shopifyOAuth(shop).auth.begin({
      shop: shop.domain, callbackPath: OAUTH_CALLBACK_PATH, isOnline: false, rawRequest: request,
    }) as Response;
    if (redirect.status !== 302) throw new Error("OAuth redirect unavailable");
    const state = new URL(redirect.headers.get("Location")!).searchParams.get("state");
    if (!state) throw new Error("OAuth state unavailable");
    const response = new NextResponse(null, { status: 302, headers: redirect.headers });
    // Preserve SDK cookie bytes: NextResponse.cookies.set would re-encode the SDK's
    // base64 signature cookies, which Shopify's adapter deliberately reads verbatim.
    response.headers.append("Set-Cookie", `${OAUTH_BINDING_COOKIE}=${createOAuthBinding(shop, admin.id, state)}; Path=${OAUTH_CALLBACK_PATH}; Max-Age=60; HttpOnly; Secure; SameSite=Lax`);
    return privateResponse(response);
  } catch (error) {
    console.error("Shopify connection start failed", oauthFailureCategory(error));
    return privateResponse(NextResponse.json({ error: "Povezivanje nije pokrenuto. Proverite OAuth konfiguraciju i migraciju baze." }, { status: 400 }));
  }
}
