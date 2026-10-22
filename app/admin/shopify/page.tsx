import { redirect } from "next/navigation";
import { connectionAdministrator } from "@/lib/shopify/oauth-admin";
import { getConfiguredShops } from "@/lib/shopify/shops";
import { createOAuthConnectionStore } from "@/lib/shopify/oauth-storage";
import { getShopifyAppUrl, OAUTH_CALLBACK_PATH } from "@/lib/shopify/oauth";
import { tokenEncryptionKey } from "@/lib/shopify/oauth-crypto";

export const dynamic = "force-dynamic";

export default async function ShopifyConnectionPage({ searchParams }: { searchParams: { connection?: string } }) {
  if (!await connectionAdministrator()) redirect("/admin/tiketi");
  let configurationReady = true;
  try { getShopifyAppUrl(); tokenEncryptionKey(); } catch { configurationReady = false; }
  const shops = getConfiguredShops();
  const connections = await Promise.all(shops.map(async (shop) => {
    if (shop.authMode !== "oauth") return { shop, connection: null, storageReady: true };
    try { return { shop, connection: await createOAuthConnectionStore().load(shop), storageReady: true }; }
    catch { return { shop, connection: null, storageReady: false }; }
  }));
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-bold">Shopify povezivanje</h1>
      <p className="text-gray-600">Ovo povezivanje obavlja administrator. Kupci nastavljaju da koriste formu na sajtu prodavnice.</p>
      {searchParams.connection === "connected" && <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">Shopify veza je sačuvana. Proverite pretragu porudžbine na sajtu prodavnice.</p>}
      {searchParams.connection === "failed" && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">Povezivanje nije završeno. Pokrenite ga ponovo i odobrite pristup u roku od jednog minuta. Proverite OAuth podešavanja ako se greška ponovi.</p>}
      {!configurationReady && <p role="alert" className="rounded-lg bg-amber-50 p-4">U Vercel okruženju podesite SHOPIFY_APP_URL i SHOPIFY_TOKEN_ENCRYPTION_KEY pre povezivanja.</p>}
      {connections.map(({ shop, connection, storageReady }) => {
        const refreshExpired = connection && Date.parse(connection.refresh_expires_at) <= Date.now();
        const connected = connection && !connection.reauthorization_required && !refreshExpired;
        return <article key={shop.domain} className="card space-y-3">
          <h2 className="text-lg font-semibold">{shop.name}</h2>
          <p>{shop.domain}</p>
          {shop.authMode === "oauth" ? <>
            <p>Stanje: <strong>{connected ? "Povezano" : "Potrebno povezivanje"}</strong></p>
            {!storageReady && <p role="alert" className="text-red-700">Primenite migraciju 0005 za Shopify veze i proverite dozvole baze.</p>}
            {connection && <p className="text-sm text-gray-600">Dozvole: {connection.scope}</p>}
            <form method="post" action="/api/shopify/auth">
              <input type="hidden" name="shop" value={shop.domain} />
              <button className="btn-primary" disabled={!configurationReady || !storageReady || !shop.clientId || !shop.clientSecret}>
                {connected ? "Ponovo poveži prodavnicu" : "Poveži prodavnicu sa Shopify-jem"}
              </button>
            </form>
          </> : <p className="text-gray-600">Prodavnica koristi postojeći način autentifikacije. OAuth se uključuje promenljivom SHOPIFY_AUTH_MODE{shops.indexOf(shop) === 1 ? "_2" : ""}=oauth.</p>}
        </article>;
      })}
      {shops.length === 0 && <p>Shopify prodavnica nije konfigurisana.</p>}
      <p className="text-sm text-gray-600">Callback putanja: <code>{OAUTH_CALLBACK_PATH}</code>. Povezivanje koristi postojeće dozvole za čitanje porudžbina i proizvoda i za app proxy.</p>
    </section>
  );
}
