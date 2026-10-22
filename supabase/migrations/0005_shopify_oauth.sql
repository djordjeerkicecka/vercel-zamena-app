-- Additive migration: existing tickets, users, policies and storage are not modified.
begin;

create table if not exists public.shopify_oauth_connections (
  shop text not null check (shop ~ '^[a-z0-9][a-z0-9-]{0,62}\.myshopify\.com$'),
  client_id text not null,
  revision uuid not null,
  encrypted_session text not null,
  scope text not null,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  reauthorization_required boolean not null default false,
  refresh_lock_id uuid,
  refresh_lock_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (shop, client_id),
  check ((refresh_lock_id is null) = (refresh_lock_until is null))
);

alter table public.shopify_oauth_connections enable row level security;
-- No browser role gets a policy or table privilege. Only Vercel's service role may use it.
revoke all on table public.shopify_oauth_connections from public, anon, authenticated;
grant select, insert, update on table public.shopify_oauth_connections to service_role;

commit;
