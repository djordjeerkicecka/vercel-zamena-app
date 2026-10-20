// Server-side only Shopify Admin GraphQL client. Never import this from a Client Component —
// the Shopify credentials must never reach the browser bundle.
//
// Since 1 Jan 2026 Shopify no longer issues permanent custom-app tokens (shpat_...). Apps
// created in the new Dev Dashboard obtain a short-lived (24h) access token via the OAuth
// "client credentials" grant, using the app's Client ID + Client Secret. We fetch that token
// on demand and cache it in module memory (per shop) until shortly before it expires.
//
// For backward compatibility, if a shop has a static admin token, it is used directly and no
// token exchange happens.

import { getConfiguredShops, getPrimaryShop, type ShopConfig } from "./shops";

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-10";

interface ShopifyGraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

// Cached client-credentials tokens, keyed by shop id (domain). Shared across requests handled by
// the same serverless instance; a cold start simply re-fetches.
const cachedTokens = new Map<string, { token: string; expiresAt: number }>();

async function fetchClientCredentialsToken(
  shop: ShopConfig
): Promise<{ token: string; expiresAt: number }> {
  if (!shop.clientId || !shop.clientSecret) {
    throw new Error(
      `Shopify shop "${shop.name}" nije konfigurisan: nedostaje CLIENT_ID / CLIENT_SECRET (ili ADMIN_TOKEN).`
    );
  }

  const res = await fetch(`https://${shop.domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: shop.clientId,
      client_secret: shop.clientSecret,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Shopify autentifikacija nije uspela (${shop.name}): ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error(`Shopify nije vratio access_token (${shop.name}).`);
  }

  // expires_in is seconds (~86399 = 24h). Refresh 5 minutes early to avoid edge-of-expiry failures.
  const expiresInMs = (json.expires_in ?? 86399) * 1000;
  return { token: json.access_token, expiresAt: Date.now() + expiresInMs - 5 * 60 * 1000 };
}

async function getAccessToken(shop: ShopConfig): Promise<string> {
  if (shop.adminToken) return shop.adminToken;

  const cached = cachedTokens.get(shop.id);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const fresh = await fetchClientCredentialsToken(shop);
  cachedTokens.set(shop.id, fresh);
  return fresh.token;
}

/** Runs a GraphQL query against a specific shop. */
export async function shopifyGraphQLForShop<T>(
  shop: ShopConfig,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const token = await getAccessToken(shop);

  const res = await fetch(`https://${shop.domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!res.ok) {
    // A stale cached token (e.g. revoked) surfaces as 401 — drop it so the next call re-fetches.
    if (res.status === 401) cachedTokens.delete(shop.id);
    throw new Error(`Shopify API greška (${shop.name}): ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as ShopifyGraphQLResponse<T>;

  if (json.errors && json.errors.length > 0) {
    throw new Error(`Shopify GraphQL greška (${shop.name}): ${json.errors.map((e) => e.message).join(", ")}`);
  }

  if (!json.data) {
    throw new Error(`Shopify GraphQL nije vratio podatke (${shop.name}).`);
  }

  return json.data;
}

/** Runs a GraphQL query against the primary shop (used by the existing order-lookup/product flows). */
export async function shopifyGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  return shopifyGraphQLForShop<T>(getPrimaryShop(), query, variables);
}

/** Extracts the numeric id from a Shopify GID, e.g. "gid://shopify/Order/123" -> "123". */
export function gidToNumericId(gid: string): string {
  const parts = gid.split("/");
  return parts[parts.length - 1];
}

export function shopifyAdminOrderUrl(orderGid: string): string {
  const shopName = getPrimaryShop().domain.replace(".myshopify.com", "");
  return `https://admin.shopify.com/store/${shopName}/orders/${gidToNumericId(orderGid)}`;
}

// Re-export so callers can enumerate shops without importing shops.ts directly.
export { getConfiguredShops };
