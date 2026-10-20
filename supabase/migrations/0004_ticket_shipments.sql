-- Ortomed — SlanjePaketa courier integration: links tickets to SP orders
-- (pickup of returned goods + sending the replacement). Run in the Supabase SQL editor.

create table if not exists ticket_shipments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  kind text not null check (kind in ('PREUZIMANJE', 'ZAMENA')),
  sp_order_id text not null,        -- SlanjePaketa _id
  sp_number integer,                -- SlanjePaketa order number
  custom_number text not null,      -- our unique reference (e.g. ZR-00012-P)
  status text not null default 'PROCESSING'
    check (status in ('PROCESSING', 'SENT', 'DELIVERED', 'RETURN', 'CANCELED', 'REJECTED')),
  tracking_code text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ticket_shipments_ticket_idx on ticket_shipments (ticket_id);
create unique index if not exists ticket_shipments_custom_idx on ticket_shipments (custom_number);

drop trigger if exists ticket_shipments_set_updated_at on ticket_shipments;
create trigger ticket_shipments_set_updated_at
  before update on ticket_shipments
  for each row
  execute function set_updated_at();

alter table ticket_shipments enable row level security;
drop policy if exists "authenticated_all_ticket_shipments" on ticket_shipments;
create policy "authenticated_all_ticket_shipments" on ticket_shipments
  for all to authenticated using (true) with check (true);
