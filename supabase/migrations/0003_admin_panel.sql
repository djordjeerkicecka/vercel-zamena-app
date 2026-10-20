-- Ortomed — Admin panel (owner-only section): incoming shipments, transport options,
-- report cache, and the access allowlist. Run in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- incoming_shipments — goods ordered from suppliers, not yet in Shopify stock.
-- Tracked ONLY in this app (never written to Shopify); when a shipment arrives,
-- the warehouse books it into Shopify manually as before.
-- ---------------------------------------------------------------------------

create table if not exists incoming_shipments (
  id uuid primary key default gen_random_uuid(),
  supplier text not null default '',
  product_title text not null,
  shopify_product_id text,
  quantity integer not null,
  unit_cost numeric(12, 2),          -- purchase price per unit (RSD); null = use Shopify cost
  eta date,
  status text not null default 'poruceno'
    check (status in ('poruceno', 'u_transportu', 'stiglo')),
  cbm numeric(10, 2),                -- shipment volume, entered when moving to u_transportu
  transport_cost numeric(12, 2),     -- forwarder price for this shipment (RSD)
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists incoming_shipments_status_idx on incoming_shipments (status);

drop trigger if exists incoming_shipments_set_updated_at on incoming_shipments;
create trigger incoming_shipments_set_updated_at
  before update on incoming_shipments
  for each row
  execute function set_updated_at();

alter table incoming_shipments enable row level security;
drop policy if exists "authenticated_all_incoming_shipments" on incoming_shipments;
create policy "authenticated_all_incoming_shipments" on incoming_shipments
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- transport_options — editable shipping modes used by the "Kada da poručim"
-- section (name, transit days, price per CBM).
-- ---------------------------------------------------------------------------

create table if not exists transport_options (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  days_min integer not null,
  days_max integer,
  price_per_cbm numeric(12, 2),
  sort integer not null default 0
);

alter table transport_options enable row level security;
drop policy if exists "authenticated_all_transport_options" on transport_options;
create policy "authenticated_all_transport_options" on transport_options
  for all to authenticated using (true) with check (true);

insert into transport_options (name, days_min, days_max, price_per_cbm, sort)
select * from (values
  ('Avion', 10, null::int, null::numeric, 1),
  ('Kontejner', 35, null::int, null::numeric, 2),
  ('Brod', 60, 90, null::numeric, 3)
) as v(name, days_min, days_max, price_per_cbm, sort)
where not exists (select 1 from transport_options);

-- ---------------------------------------------------------------------------
-- panel_cache — cached Shopify aggregations (inventory report, sales), so the
-- panel doesn't hammer the Shopify API on every open.
-- ---------------------------------------------------------------------------

create table if not exists panel_cache (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table panel_cache enable row level security;
drop policy if exists "authenticated_read_panel_cache" on panel_cache;
create policy "authenticated_read_panel_cache" on panel_cache
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Admin panel allowlist — only these emails see /admin/panel.
-- ---------------------------------------------------------------------------

insert into app_settings (key, value) values ('admin_panel_emails', 'vlasnik@example.com')
on conflict (key) do update set value = excluded.value;
