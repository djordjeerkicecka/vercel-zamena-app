import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Session } from "@shopify/shopify-api";
import type { ShopConfig } from "./shops";

export function tokenEncryptionKey(): Buffer {
  const value = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY || "";
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) {
    throw new Error("SHOPIFY_TOKEN_ENCRYPTION_KEY mora biti base64 ključ od 32 bajta.");
  }
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("Neispravan ključ za šifrovanje Shopify tokena.");
  return key;
}

function aad(shop: ShopConfig): Buffer {
  return Buffer.from(JSON.stringify([shop.domain, shop.clientId]));
}

export function encryptOAuthSession(session: Session, shop: ShopConfig): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenEncryptionKey(), iv);
  cipher.setAAD(aad(shop));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session.toObject()), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptOAuthSession(payload: string, shop: ShopConfig): Session {
  try {
    const [version, iv, tag, encrypted, extra] = payload.split(".");
    if (version !== "v1" || !iv || !tag || !encrypted || extra) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", tokenEncryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAAD(aad(shop));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const raw = JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8"));
    const session = new Session({ ...raw,
      expires: raw.expires ? new Date(raw.expires) : undefined,
      refreshTokenExpires: raw.refreshTokenExpires ? new Date(raw.refreshTokenExpires) : undefined,
    });
    if (session.shop !== shop.domain || session.isOnline) throw new Error();
    return session;
  } catch {
    throw new Error("Sačuvana Shopify veza ne može da se pročita. Proverite ključ za šifrovanje ili ponovo povežite prodavnicu.");
  }
}
