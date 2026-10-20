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
}

export function getConfiguredShops(): ShopConfig[] {
  const shops: ShopConfig[] = [];

  const primaryDomain = process.env.SHOPIFY_STORE_DOMAIN;
  if (primaryDomain) {
    shops.push({
      id: primaryDomain,
      name: process.env.SHOPIFY_SHOP_NAME || "Ortomed",
      domain: primaryDomain,
      clientId: process.env.SHOPIFY_CLIENT_ID,
      clientSecret: process.env.SHOPIFY_CLIENT_SECRET,
      adminToken: process.env.SHOPIFY_ADMIN_TOKEN,
    });
  }

  const secondDomain = process.env.SHOPIFY_STORE_DOMAIN_2;
  if (secondDomain) {
    shops.push({
      id: secondDomain,
      name: process.env.SHOPIFY_SHOP_NAME_2 || "Shop 2",
      domain: secondDomain,
      clientId: process.env.SHOPIFY_CLIENT_ID_2,
      clientSecret: process.env.SHOPIFY_CLIENT_SECRET_2,
      adminToken: process.env.SHOPIFY_ADMIN_TOKEN_2,
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
