import { Session } from "@shopify/shopify-api";
import { randomUUID } from "node:crypto";
import { createSupabaseServiceRoleClient } from "../supabase/server";
import { encryptOAuthSession } from "./oauth-crypto";
import { SHOPIFY_SCOPES } from "./oauth";
import type { ShopConfig } from "./shops";

export interface OAuthConnection {
  revision: string;
  encrypted_session: string;
  scope: string;
  access_expires_at: string;
  refresh_expires_at: string;
  reauthorization_required: boolean;
}

export interface OAuthConnectionStore {
  load(shop: ShopConfig): Promise<OAuthConnection | null>;
  claimRefresh(shop: ShopConfig, lockId: string): Promise<OAuthConnection | null>;
  save(shop: ShopConfig, session: Session, lockId?: string): Promise<boolean>;
  releaseRefresh(shop: ShopConfig, lockId: string, reauthorize?: boolean): Promise<void>;
  invalidate(shop: ShopConfig, revision: string): Promise<void>;
}

export function validateOfflineSession(session: Session, shop: ShopConfig): void {
  if (session.shop !== shop.domain || session.isOnline || !session.accessToken ||
      !session.refreshToken || !session.expires || !session.refreshTokenExpires ||
      !Number.isFinite(session.expires.getTime()) || !Number.isFinite(session.refreshTokenExpires.getTime()) ||
      session.expires.getTime() <= Date.now() || session.refreshTokenExpires.getTime() <= Date.now() ||
      !SHOPIFY_SCOPES.every((scope) => new Set(session.scope?.split(",").map((entry) => entry.trim())).has(scope))) {
    throw new Error("Shopify nije vratio važeći offline token sa potrebnim dozvolama.");
  }
}

function databaseFailure(): never {
  throw new Error("Shopify veza nije sačuvana. Proverite migraciju 0005 i dozvole baze.");
}

export function createOAuthConnectionStore(): OAuthConnectionStore {
  const db = createSupabaseServiceRoleClient();
  const table = () => db.from("shopify_oauth_connections");
  const identity = (shop: ShopConfig) => {
    if (!shop.clientId) throw new Error("Nedostaje Shopify Client ID za sačuvanu vezu.");
    return { shop: shop.domain, client_id: shop.clientId };
  };
  return {
    async load(shop) {
      const { data, error } = await table().select("revision,encrypted_session,scope,access_expires_at,refresh_expires_at,reauthorization_required")
        .match(identity(shop)).maybeSingle();
      if (error) databaseFailure();
      return data as OAuthConnection | null;
    },
    async claimRefresh(shop, lockId) {
      const now = Date.now();
      const { data, error } = await table().update({
        refresh_lock_id: lockId, refresh_lock_until: new Date(now + 60_000).toISOString(),
      }).match(identity(shop))
        .or(`refresh_lock_until.is.null,refresh_lock_until.lt.${new Date(now).toISOString()}`)
        .select("revision,encrypted_session,scope,access_expires_at,refresh_expires_at,reauthorization_required").maybeSingle();
      if (error) databaseFailure();
      return data as OAuthConnection | null;
    },
    async save(shop, session, lockId) {
      validateOfflineSession(session, shop);
      const record = {
        ...identity(shop), revision: randomUUID(), encrypted_session: encryptOAuthSession(session, shop), scope: session.scope!,
        access_expires_at: session.expires!.toISOString(), refresh_expires_at: session.refreshTokenExpires!.toISOString(),
        reauthorization_required: false, refresh_lock_id: null, refresh_lock_until: null,
        updated_at: new Date().toISOString(),
      };
      const result = lockId
        ? await table().update(record).match(identity(shop)).eq("refresh_lock_id", lockId).select("shop").maybeSingle()
        : await table().upsert(record, { onConflict: "shop,client_id" }).select("shop").single();
      if (result.error) databaseFailure();
      return !!result.data;
    },
    async releaseRefresh(shop, lockId, reauthorize = false) {
      const { error } = await table().update({
        refresh_lock_id: null, refresh_lock_until: null,
        ...(reauthorize ? { reauthorization_required: true } : {}),
      }).match(identity(shop)).eq("refresh_lock_id", lockId);
      if (error) databaseFailure();
    },
    async invalidate(shop, revision) {
      // A late 401 from an old request must not invalidate a newer connection/token.
      const { error } = await table().update({ reauthorization_required: true })
        .match(identity(shop)).eq("revision", revision);
      if (error) databaseFailure();
    },
  };
}
