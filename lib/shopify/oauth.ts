import { createHmac, timingSafeEqual } from "node:crypto";
import { webApiAdapterInitialized } from "@shopify/shopify-api/adapters/web-api";
import { ApiVersion, shopifyApi } from "@shopify/shopify-api";
import { getConfiguredShops, type ShopConfig } from "./shops";

export const OAUTH_CALLBACK_PATH = "/api/shopify/auth/callback";
export const OAUTH_BINDING_COOKIE = "zamena_shopify_connection";
export const SHOPIFY_SCOPES = ["read_orders", "read_products", "write_app_proxy"];

export function getShopifyAppUrl(): URL {
  const url = new URL(process.env.SHOPIFY_APP_URL || "");
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" ||
      url.search || url.hash) {
    throw new Error("SHOPIFY_APP_URL mora biti korenski HTTPS URL Vercel aplikacije.");
  }
  return url;
}

export function configuredOAuthShop(domain: string | null): ShopConfig {
  // Request parameters must be bare domains. Only explicitly configured shops can connect.
  const shop = getConfiguredShops().find((entry) => entry.domain === domain);
  if (!shop || shop.authMode !== "oauth" || !shop.clientId || !shop.clientSecret) {
    throw new Error("Prodavnica nije podešena za OAuth povezivanje.");
  }
  return shop;
}

export function shopifyOAuth(shop: ShopConfig) {
  if (!webApiAdapterInitialized || !shop.clientId || !shop.clientSecret) {
    throw new Error("Shopify OAuth nije konfigurisan.");
  }
  const appUrl = getShopifyAppUrl();
  return shopifyApi({
    apiKey: shop.clientId,
    apiSecretKey: shop.clientSecret,
    apiVersion: ApiVersion.October26,
    scopes: SHOPIFY_SCOPES,
    hostName: appUrl.host,
    hostScheme: "https",
    isEmbeddedApp: false,
    // Routes report safe error categories instead of logging SDK exceptions or callback URLs.
    logger: { log: () => {}, httpRequests: false },
  });
}

interface OAuthBinding {
  shop: string;
  clientId: string;
  adminId: string;
  state: string;
  expires: number;
}

export function createOAuthBinding(shop: ShopConfig, adminId: string, state: string): string {
  const data = Buffer.from(JSON.stringify({
    shop: shop.domain, clientId: shop.clientId!, adminId, state, expires: Date.now() + 60_000,
  } satisfies OAuthBinding)).toString("base64url");
  const signature = createHmac("sha256", shop.clientSecret!).update(`oauth-binding:${data}`).digest("base64url");
  return `${data}.${signature}`;
}

export function verifyOAuthBinding(
  value: string | undefined, shop: ShopConfig, adminId: string, state: string | null
): boolean {
  if (!value || !state || !shop.clientSecret) return false;
  try {
    const [data, signature, extra] = value.split(".");
    if (extra || !data || !signature) return false;
    const expected = createHmac("sha256", shop.clientSecret).update(`oauth-binding:${data}`).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const binding: OAuthBinding = JSON.parse(Buffer.from(data, "base64url").toString());
    return binding.shop === shop.domain && binding.clientId === shop.clientId &&
      binding.adminId === adminId && binding.state === state && binding.expires > Date.now();
  } catch { return false; }
}

export function hasUniqueOAuthParameters(params: URLSearchParams): boolean {
  return Array.from(params.keys()).every((key) => params.getAll(key).length === 1);
}

/** SDK failures may carry HTTP bodies. Never return/log those objects, messages, or tokens. */
export function oauthFailureCategory(error: unknown): string {
  const name = error instanceof Error ? error.constructor.name : "UnknownError";
  return ["InvalidOAuthError", "InvalidHmacError", "CookieNotFound", "BotActivityDetected", "HttpResponseError"]
    .includes(name) ? name : "ShopifyConnectionError";
}
