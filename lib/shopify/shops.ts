// Multi-shop configuration. The app can talk to more than one Shopify store; each shop's
// credentials come from env. The primary shop uses the original variable names (so the existing
// order-lookup/products flows keep working); a second shop uses the *_2 suffix.
//
// To add the second shop, set in the environment:
//   SHOPIFY_STORE_DOMAIN_2, SHOPIFY_CLIENT_ID_2, SHOPIFY_CLIENT_SECRET_2, SHOPIFY_SHOP_NAME_2

export interface ShopConfig {
  id: string; // stable key (the domain) used for token caching + as the stored `shop` value
  name: string; // human label shown in the UI badge
  domain: string;
  clientId?: string;
  clientSecret?: string;
  adminToken?: string; // legacy permanent token, if any
  authMode?: "client_credentials" | "oauth";
}

/** Accept a bare Shopify domain or its root HTTPS URL; never allow paths or other hosts. */
export function normalizeShopDomain(value: string): string {
  const raw = value.trim().toLowerCase();
  const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      url.pathname !== "/" || url.search || url.hash ||
      !/^[a-z0-9][a-z0-9-]{0,62}\.myshopify\.com$/.test(url.hostname)) {
    throw new Error("SHOPIFY_STORE_DOMAIN mora biti domen prodavnice na myshopify.com.");
  }
  return url.hostname;
}

function authMode(value?: string): ShopConfig["authMode"] {
  const mode = value?.trim() || "client_credentials";
  if (mode !== "oauth" && mode !== "client_credentials") {
    throw new Error("SHOPIFY_AUTH_MODE mora biti oauth ili client_credentials.");
  }
  return mode;
}

export function getConfiguredShops(): ShopConfig[] {
  const shops: ShopConfig[] = [];

  const primaryDomain = process.env.SHOPIFY_STORE_DOMAIN;
  if (primaryDomain) {
    shops.push({
      id: normalizeShopDomain(primaryDomain),
      name: process.env.SHOPIFY_SHOP_NAME || "Ortomed",
      domain: normalizeShopDomain(primaryDomain),
      clientId: process.env.SHOPIFY_CLIENT_ID?.trim(),
      clientSecret: process.env.SHOPIFY_CLIENT_SECRET?.trim(),
      adminToken: process.env.SHOPIFY_ADMIN_TOKEN,
      authMode: authMode(process.env.SHOPIFY_AUTH_MODE),
    });
  }

  const secondDomain = process.env.SHOPIFY_STORE_DOMAIN_2;
  if (secondDomain) {
    shops.push({
      id: normalizeShopDomain(secondDomain),
      name: process.env.SHOPIFY_SHOP_NAME_2 || "Shop 2",
      domain: normalizeShopDomain(secondDomain),
      clientId: process.env.SHOPIFY_CLIENT_ID_2?.trim(),
      clientSecret: process.env.SHOPIFY_CLIENT_SECRET_2?.trim(),
      adminToken: process.env.SHOPIFY_ADMIN_TOKEN_2,
      authMode: authMode(process.env.SHOPIFY_AUTH_MODE_2),
    });
  }

  return shops;
}

export function getPrimaryShop(): ShopConfig {
  const shops = getConfiguredShops();
  if (shops.length === 0) {
    throw new Error("Shopify nije konfigurisan (nedostaje SHOPIFY_STORE_DOMAIN).");
  }
  return shops[0];
}

export function shopAdminOrderUrl(shop: ShopConfig, orderNumericId: string): string {
  const shopName = shop.domain.replace(".myshopify.com", "");
  return `https://admin.shopify.com/store/${shopName}/orders/${orderNumericId}`;
}
