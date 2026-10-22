import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "../supabase/requireUser";
import { isPanelAdmin } from "../adminPanel";
import { OAUTH_BINDING_COOKIE, OAUTH_CALLBACK_PATH, getShopifyAppUrl } from "./oauth";

export async function connectionAdministrator() {
  const user = await getAuthenticatedAdmin();
  return user && await isPanelAdmin(user.email) ? user : null;
}

export function privateResponse(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export function connectionResult(result: "connected" | "failed", sdkHeaders?: Headers): NextResponse {
  const location = new URL("/admin/shopify", getShopifyAppUrl());
  location.searchParams.set("connection", result);
  const headers = new Headers(sdkHeaders);
  // This integration stores offline tokens on the server. The dashboard continues
  // using Supabase login, so it must not acquire a second SDK browser login cookie.
  headers.delete("Set-Cookie");
  const response = new NextResponse(null, { status: 303, headers });
  response.headers.set("Location", location.toString());
  for (const name of [OAUTH_BINDING_COOKIE, "shopify_app_state", "shopify_app_state.sig"]) {
    response.cookies.set(name, "", { path: OAUTH_CALLBACK_PATH, maxAge: 0, secure: true, httpOnly: true, sameSite: "lax" });
  }
  return privateResponse(response);
}
