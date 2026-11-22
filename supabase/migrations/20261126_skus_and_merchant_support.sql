-- ============================================================
-- 1. Byiora SKUs: a stable code for every product amount, assigned by us
--    (the industry norm). Merchants may still add their own alias.
-- 2. Merchant support tickets with a message thread.
-- Project: tkovigthghwpwbtjikyp
-- STATUS: APPLIED 2026-11-22 (as skus_and_merchant_support).
-- ============================================================

create table public.product_skus (
  sku text primary key check (sku ~ '^[A-Z0-9-]{3,64}$'),
  product_id text not null,
  denomination_label text not null,
  created_at timestamptz not null default now(),
  unique (product_id, denomination_label)
);
alter table public.product_skus enable row level security;
revoke all on public.product_skus from anon, authenticated;

-- Creates SKUs for any amount that doesn't have one yet, e.g. GOOGLE-PLAY-100INR, AMAZON-5USD.
-- Existing SKUs never change.
create or replace function public.ensure_product_skus()
returns int
language plpgsql security definer set search_path = public as $$
declare
  r record; base text; candidate text; n int; added int := 0;
begin
  for r in
    select p.id as product_id, d->>'label' as label
    from public.products p, jsonb_array_elements(coalesce(p.denominations, '[]'::jsonb)) d
    where coalesce(d->>'label', '') <> ''
      and not exists (select 1 from public.product_skus s where s.product_id = p.id and s.denomination_label = d->>'label')
  loop
    base := upper(regexp_replace(r.product_id, '[^A-Za-z0-9]+', '-', 'g'))
      || '-' || coalesce(nullif(regexp_replace(r.label, '[^0-9]', '', 'g'), ''), 'X')
      || case when r.label like '%₹%' or r.label ilike '%inr%' then 'INR'
              when r.label like '%$%' or r.label ilike '%usd%' then 'USD'
              when r.label like '%€%' or r.label ilike '%eur%' then 'EUR'
              when r.label like '%£%' or r.label ilike '%gbp%' then 'GBP'
              else '' end;
    base := left(trim(both '-' from base), 58);
    candidate := base;
    n := 1;
    while exists (select 1 from public.product_skus where sku = candidate) loop
      n := n + 1;
      candidate := base || '-' || n;
    end loop;
    insert into public.product_skus (sku, product_id, denomination_label) values (candidate, r.product_id, r.label);
    added := added + 1;
  end loop;
  return added;
end $$;
revoke all on function public.ensure_product_skus() from public, anon, authenticated;
select public.ensure_product_skus();

-- ── Merchant support ──
create table public.merchant_tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  category text not null check (category in ('order', 'refund', 'wallet', 'limits', 'api', 'account', 'other')),
  subject text not null check (char_length(subject) between 3 and 150),
  order_ref text check (char_length(order_ref) <= 100),
  status text not null default 'open' check (status in ('open', 'awaiting_merchant', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  last_message_at timestamptz not null default now(),
  last_message_by text not null default 'merchant' check (last_message_by in ('merchant', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index merchant_tickets_merchant_idx on public.merchant_tickets (merchant_id, last_message_at desc);
create index merchant_tickets_status_idx on public.merchant_tickets (status, last_message_at desc);

create table public.merchant_ticket_messages (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.merchant_tickets(id) on delete cascade,
  author_type text not null check (author_type in ('merchant', 'admin')),
  author_id uuid,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index merchant_ticket_messages_ticket_idx on public.merchant_ticket_messages (ticket_id, id);

alter table public.merchant_tickets enable row level security;
alter table public.merchant_ticket_messages enable row level security;
revoke all on public.merchant_tickets, public.merchant_ticket_messages from anon, authenticated;
