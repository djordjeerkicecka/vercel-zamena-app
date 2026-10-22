import { randomUUID } from "node:crypto";
import type { Session } from "@shopify/shopify-api";
import { decryptOAuthSession } from "./oauth-crypto";
import { shopifyOAuth, SHOPIFY_SCOPES } from "./oauth";
import { createOAuthConnectionStore, validateOfflineSession, type OAuthConnectionStore } from "./oauth-storage";
import type { ShopConfig } from "./shops";

export class ShopifyReconnectRequired extends Error {
  constructor() { super("Shopify prodavnica nije povezana ili je pristup opozvan. Administrator treba da je poveže na /admin/shopify."); }
}

export interface OAuthAccess {
  token: string;
  revision: string;
}

/** A database lease serializes rotation across Vercel instances; no token lives only in memory. */
export async function resolveOAuthAccess(
  shop: ShopConfig,
  store: OAuthConnectionStore,
  refresh: (refreshToken: string) => Promise<Session>,
  wait: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 200)),
): Promise<OAuthAccess> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const connection = await store.load(shop);
    if (!connection || connection.reauthorization_required) throw new ShopifyReconnectRequired();
    const session = decryptOAuthSession(connection.encrypted_session, shop);
    if (!session.isScopeIncluded(SHOPIFY_SCOPES)) {
      await store.invalidate(shop, connection.revision);
      throw new ShopifyReconnectRequired();
    }
    if (session.accessToken && session.expires && session.expires.getTime() > Date.now() + 60_000) {
      return { token: session.accessToken, revision: connection.revision };
    }
    if (!session.refreshToken || !session.refreshTokenExpires || session.refreshTokenExpires.getTime() <= Date.now()) {
      await store.invalidate(shop, connection.revision);
      throw new ShopifyReconnectRequired();
    }
    const lockId = randomUUID();
    const claimed = await store.claimRefresh(shop, lockId);
    if (!claimed) { await wait(); continue; }
    try {
      if (claimed.reauthorization_required) throw new ShopifyReconnectRequired();
      const latest = decryptOAuthSession(claimed.encrypted_session, shop);
      // Another instance may have completed a rotation just before we acquired the lease.
      if (latest.accessToken && latest.expires && latest.expires.getTime() > Date.now() + 60_000) {
        await store.releaseRefresh(shop, lockId);
        return { token: latest.accessToken, revision: claimed.revision };
      }
      const renewed = await refresh(latest.refreshToken!);
      validateOfflineSession(renewed, shop);
      if (await store.save(shop, renewed, lockId)) {
        // Re-read: a concurrent new authorization always takes precedence over this rotation.
        continue;
      }
      // Reauthorization superseded this lease. Discard its result and read the new connection.
    } catch (error) {
      const status = (error as { response?: { code?: number } })?.response?.code;
      await store.releaseRefresh(shop, lockId, status === 400 || status === 401);
      if (status === 400 || status === 401 || error instanceof ShopifyReconnectRequired) {
        throw new ShopifyReconnectRequired();
      }
      throw new Error("Shopify token trenutno ne može da se obnovi. Pokušajte ponovo kasnije.");
    }
  }
  throw new Error("Shopify veza se trenutno obnavlja. Pokušajte ponovo za nekoliko sekundi.");
}

const pending = new Map<string, Promise<OAuthAccess>>();

export async function getOAuthAccess(shop: ShopConfig): Promise<OAuthAccess> {
  if (!shop.clientId || !shop.clientSecret) {
    throw new Error("Shopify OAuth nije konfigurisan: nedostaje Client ID ili Client Secret.");
  }
  const key = `${shop.domain}:${shop.clientId}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const task = resolveOAuthAccess(shop, createOAuthConnectionStore(), async (refreshToken) => {
    const { session } = await shopifyOAuth(shop).auth.refreshToken({ shop: shop.domain, refreshToken });
    return session;
  });
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}
