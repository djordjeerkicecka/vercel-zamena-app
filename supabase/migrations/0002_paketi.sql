-- Ortomed — "Paketi" (order follow-ups) feature.
-- Adds a table for support-owned follow-up state on Shopify orders, plus a small
-- key/value settings table. Run in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- order_followups — support-owned state for problematic orders.
-- Shopify stays the read-only source of order data; only status/note live here.
-- Rows are created lazily (first status change or note).
-- ---------------------------------------------------------------------------

create table if not exists order_followups (
  shopify_order_id text primary key,
  shop text not null,
  status text not null default 'novo'
    check (status in ('novo', 'poruka_poslata', 'pozvan', 'reseno')),
  note text default '',
  updated_by text,
  updated_at timestamptz default now(),
  resolved_at timestamptz
);

create index if not exists order_followups_shop_idx on order_followups (shop);
create index if not exists order_followups_status_idx on order_followups (status);

alter table order_followups enable row level security;

drop policy if exists "authenticated_all_order_followups" on order_followups;
create policy "authenticated_all_order_followups" on order_followups
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- app_settings — simple key/value config editable without a redeploy.
-- ---------------------------------------------------------------------------

create table if not exists app_settings (
  key text primary key,
  value text not null
);

alter table app_settings enable row level security;

drop policy if exists "authenticated_all_app_settings" on app_settings;
create policy "authenticated_all_app_settings" on app_settings
  for all to authenticated using (true) with check (true);

insert into app_settings (key, value) values
  ('neposlati_prag_dana', '5'),
  ('neposlati_max_dana', '50'),
  ('dana_crveno_prag', '10'),
  ('vraceni_lookback_dana', '90')
on conflict (key) do nothing;
