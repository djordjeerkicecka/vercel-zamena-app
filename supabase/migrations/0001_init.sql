-- Ortomed — Zamene i refundacije
-- Initial schema: tickets, ticket_items, ticket_images, ticket_notes
-- Run this in the Supabase SQL editor, or via `supabase db push` / the CLI migration workflow.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Ticket number generator: ZR-00001, ZR-00002, ...
-- ---------------------------------------------------------------------------

create sequence if not exists ticket_number_seq start 1;

create or replace function generate_ticket_number()
returns text
language plpgsql
as $$
declare
  next_val bigint;
begin
  next_val := nextval('ticket_number_seq');
  return 'ZR-' || lpad(next_val::text, 5, '0');
end;
$$;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- tickets
-- ---------------------------------------------------------------------------

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default generate_ticket_number(),

  shopify_order_id text not null,
  order_number text not null,

  customer_name text not null,
  email text not null,
  phone text not null,

  -- Shipping address for the exchange parcel; null for pure refund requests.
  shipping_address1 text,
  shipping_address2 text,
  shipping_city text,
  shipping_zip text,
  shipping_country text,

  type text not null check (type in ('ZAMENA', 'REFUNDACIJA')),
  status text not null default 'novo'
    check (status in ('novo', 'u_obradi', 'odobreno', 'odbijeno', 'arhivirano')),

  -- Refund-only fields (COD model — refunds are paid out to a bank account).
  bank_account text,
  bank_account_owner text,
  goods_received_date date,
  refund_terms_confirmed boolean not null default false,
  check (
    type <> 'REFUNDACIJA'
    or (bank_account is not null and bank_account_owner is not null and refund_terms_confirmed is true)
  ),

  images_deleted boolean not null default false,
  exchange_tracking_number text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tickets_order_number_idx on tickets (order_number);
create index if not exists tickets_status_idx on tickets (status);
create index if not exists tickets_type_idx on tickets (type);
create index if not exists tickets_created_at_idx on tickets (created_at desc);
create index if not exists tickets_customer_name_idx on tickets (lower(customer_name));

drop trigger if exists tickets_set_updated_at on tickets;
create trigger tickets_set_updated_at
  before update on tickets
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- ticket_items
-- ---------------------------------------------------------------------------

create table if not exists ticket_items (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,

  shopify_line_item_id text not null,
  product_title text not null,
  variant_title text,
  sku text,
  quantity integer not null default 1,
  price numeric(10, 2) not null,

  -- Reason is collected only for REFUNDACIJA items. For ZAMENA the customer simply picks a
  -- replacement variant/product, so no reason is required — hence nullable.
  reason text check (
    reason is null or reason in (
      'POGRESNA_VELICINA',
      'MODEL_NE_ODGOVARA',
      'NEUDOBNO',
      'OSTECENO',
      'POGRESAN_ARTIKAL',
      'DRUGO'
    )
  ),
  reason_text text,
  check (reason is null or reason <> 'DRUGO' or reason_text is not null),

  -- Populated only for ZAMENA. exchange_product_id is the target product: equal to the
  -- returned item's product for a same-model size/color swap, or a different product when the
  -- customer chose to exchange for another article.
  original_size numeric(5, 1),
  exchange_product_id text,
  exchange_variant_id text,
  exchange_variant_title text,
  -- SKU of the replacement variant — used for the "Kopiraj red za Sheets" export.
  exchange_sku text,
  exchange_size numeric(5, 1),
  -- size_direction is only meaningful for a same-model size swap (derived from the customer's
  -- actual variant choice, not the reason). It is null for refunds, different-product exchanges,
  -- and products without a size option.
  size_direction text check (size_direction in ('MANJA', 'VECA', 'ISTA')),

  created_at timestamptz not null default now()
);

create index if not exists ticket_items_ticket_id_idx on ticket_items (ticket_id);
create index if not exists ticket_items_reason_idx on ticket_items (reason);

-- ---------------------------------------------------------------------------
-- ticket_images
-- ---------------------------------------------------------------------------

create table if not exists ticket_images (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists ticket_images_ticket_id_idx on ticket_images (ticket_id);

-- ---------------------------------------------------------------------------
-- ticket_notes
-- ---------------------------------------------------------------------------

create table if not exists ticket_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  author_email text not null,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists ticket_notes_ticket_id_idx on ticket_notes (ticket_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- The public form never talks to Supabase directly — it POSTs to a server-side API
-- route which uses the service role key (bypasses RLS entirely). So there are
-- intentionally NO policies granting the `anon` role any access here: the default
-- is deny-all for anonymous requests.
--
-- Admin dashboard reads/writes go through the logged-in user's session (the
-- `authenticated` role), which IS subject to these policies. There is no separate
-- roles/permissions table — every Supabase Auth user is a support admin, created
-- manually by an existing admin (see README).
-- ---------------------------------------------------------------------------

alter table tickets enable row level security;
alter table ticket_items enable row level security;
alter table ticket_images enable row level security;
alter table ticket_notes enable row level security;

-- `drop policy if exists` before each create makes this migration safe to re-run.
drop policy if exists "authenticated_select_tickets" on tickets;
create policy "authenticated_select_tickets" on tickets
  for select to authenticated using (true);

drop policy if exists "authenticated_update_tickets" on tickets;
create policy "authenticated_update_tickets" on tickets
  for update to authenticated using (true) with check (true);

drop policy if exists "authenticated_delete_tickets" on tickets;
create policy "authenticated_delete_tickets" on tickets
  for delete to authenticated using (true);

drop policy if exists "authenticated_select_ticket_items" on ticket_items;
create policy "authenticated_select_ticket_items" on ticket_items
  for select to authenticated using (true);

drop policy if exists "authenticated_select_ticket_images" on ticket_images;
create policy "authenticated_select_ticket_images" on ticket_images
  for select to authenticated using (true);

drop policy if exists "authenticated_delete_ticket_images" on ticket_images;
create policy "authenticated_delete_ticket_images" on ticket_images
  for delete to authenticated using (true);

drop policy if exists "authenticated_select_ticket_notes" on ticket_notes;
create policy "authenticated_select_ticket_notes" on ticket_notes
  for select to authenticated using (true);

drop policy if exists "authenticated_insert_ticket_notes" on ticket_notes;
create policy "authenticated_insert_ticket_notes" on ticket_notes
  for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- Storage bucket for ticket images (private — served only via signed URLs
-- generated server-side with the service role key).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('ticket-images', 'ticket-images', false)
on conflict (id) do nothing;

-- Uploads, downloads and deletes from the app all go through the service role client
-- (see lib/supabase/storage.ts), which bypasses storage RLS. This policy is a defense-in-depth
-- fallback in case an admin session ever needs to read images directly via the client SDK.
drop policy if exists "authenticated_read_ticket_images" on storage.objects;
create policy "authenticated_read_ticket_images"
  on storage.objects for select to authenticated
  using (bucket_id = 'ticket-images');
