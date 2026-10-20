# Zamene i tiketi — support aplikacija za Shopify + SlanjePaketa

Aplikacija za obradu zamena i reklamacija u COD Shopify prodavnici:

- **Javna forma za kupce** (`/zahtev`): kupac unese broj porudžbine ili telefon,
  app povuče porudžbinu iz Shopify-ja, kupac izabere artikle za zamenu/refundaciju,
  veličine, slike, kontakt — i dobije potvrdu.
- **Admin panel** (`/admin/tiketi`): lista tiketa, statusi, beleške, slike,
  i **kurir dugmad** — zakaži otkup paketa (pickup) i pošalji zamenski paket
  direktno kroz SlanjePaketa API, sa praćenjem statusa pošiljke.

Stack: Next.js 14 (App Router) + Supabase (baza, auth, storage) + Vercel.

## Podešavanje (korak po korak)

### 1. Supabase
1. Napravi projekat na [supabase.com](https://supabase.com) (besplatan tier je dovoljan za početak).
2. U **SQL Editor** pokreni migracije iz `supabase/migrations/` redom:
   `0001_init.sql`, `0002_paketi.sql`, `0003_admin_panel.sql`, `0004_ticket_shipments.sql`.
3. U **Storage** napravi bucket `ticket-images` (private).
4. U **Authentication -> Users** dodaj naloge za support (email + lozinka).
5. U tabeli `app_settings` postavi svoj mejl kao vlasnika:
   `update app_settings set value = 'tvoj@mejl.com' where key = 'admin_panel_emails';`

### 2. Shopify
1. U svom shopu: **Settings -> Apps and sales channels -> Develop apps -> Create an app**.
2. Admin API scopes: `read_orders`, `read_products`.
3. Prepiši **Client ID** i **Client secret** u `.env.local`
   (app koristi token-exchange, ne stari trajni token).

### 3. SlanjePaketa
1. Traži API token od SlanjePaketa podrške.
2. Upiši ga u `.env.local` (`SLANJEPAKETA_TOKEN`).

### 4. Pokretanje
```bash
cp .env.example .env.local   # pa popuni vrednosti
npm install
npm run dev                  # http://localhost:3000
```
Za probu bez ijednog naloga: postavi `DEMO_MODE=1` u `.env.local` — app radi sa
fiktivnim podacima.

### 5. Deploy (Vercel)
1. Push u svoj GitHub repo, importuj u Vercel.
2. Prekopiraj sve promenljive iz `.env.local` u Vercel **Environment Variables**.
3. Kupcima daješ link `https://tvoj-domen/zahtev`, support koristi `/admin/tiketi`.

## Brendiranje
Nazivi/boje se menjaju na par mesta: `components/Logo.tsx`, `app/admin/layout.tsx`
(naslov), `tailwind.config.ts` (boje `brand`), `app/layout.tsx` (naslov sajta),
tekstovi u `components/wizard/` po želji.

## Napomene
- Poštarina na SP nalozima: pickup ide na pošiljaoca, slanje zamene na kupca —
  podešeno u `lib/slanjepaketa.ts` (`pay: "SENDER"` / `pay: "RECIPIENT"`), promeni
  po svom dogovoru sa kurirom.
- App NIKAD ne piše u Shopify (samo čita porudžbine/proizvode).
- Svi kredencijali žive isključivo u `.env.local` / Vercel env — u kodu ih nema.
