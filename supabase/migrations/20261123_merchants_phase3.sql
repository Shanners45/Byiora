-- ============================================================
-- Seller platform, phase 3: catalog control, per-merchant pricing, Fonepay
-- wallet top-ups, revenue reports, realtime - prepared 2026-11-23
-- Project: tkovigthghwpwbtjikyp
-- STATUS: APPLIED 2026-11-23 (as merchants_phase3).
-- ============================================================

-- Which products merchants can see at all. No row = hidden (new products are opt-in).
create table public.merchant_catalog (
  product_id text primary key,
  enabled boolean not null default true,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
-- Keep today's behaviour: everything currently active stays visible to merchants.
insert into public.merchant_catalog (product_id, enabled) select id, true from public.products where is_active is true on conflict do nothing;

-- 'all' = every enabled product unless hidden by a rule; 'selected' = only products a rule makes visible.
alter table public.merchants add column catalog_mode text not null default 'all' check (catalog_mode in ('all', 'selected'));

-- Per-merchant rules. denomination_label '' = the whole product.
-- Price precedence per amount: fixed price > amount discount > product discount > merchant discount.
create table public.merchant_price_rules (
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  product_id text not null,
  denomination_label text not null default '',
  visible boolean,
  discount_percent numeric(5,2) check (discount_percent >= 0 and discount_percent <= 90),
  fixed_price_paisa bigint check (fixed_price_paisa > 0),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (merchant_id, product_id, denomination_label),
  check (denomination_label <> '' or fixed_price_paisa is null)
);

-- Global wallet top-up switches (single row).
create table public.merchant_settings (
  id boolean primary key default true check (id),
  fonepay_topup_enabled boolean not null default false,
  manual_topup_enabled boolean not null default true,
  fonepay_topup_min_rupees int not null default 100 check (fonepay_topup_min_rupees >= 10),
  fonepay_topup_max_rupees int not null default 100000 check (fonepay_topup_max_rupees >= fonepay_topup_min_rupees),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.merchant_settings default values;

-- Fonepay top-ups live in the same table as manual ones.
alter table public.merchant_topups
  add column provider text not null default 'manual' check (provider in ('manual', 'fonepay')),
  add column qr_payload text,
  add column validation_trace_id text,
  add column bank_txn_id text,
  add column paid_paisa bigint,
  add column expires_at timestamptz;
alter table public.merchant_topups drop constraint merchant_topups_status_check;
alter table public.merchant_topups add constraint merchant_topups_status_check
  check (status in ('awaiting_payment', 'pending', 'approved', 'rejected', 'expired'));
create unique index merchant_topups_fonepay_ref_idx on public.merchant_topups (reference) where provider = 'fonepay';
-- One bank payment can never credit two wallets or one wallet twice.
create unique index merchant_topups_bank_txn_idx on public.merchant_topups (bank_txn_id) where bank_txn_id is not null;

alter table public.merchant_catalog enable row level security;
alter table public.merchant_price_rules enable row level security;
alter table public.merchant_settings enable row level security;
revoke all on public.merchant_catalog, public.merchant_price_rules, public.merchant_settings from anon, authenticated;

-- Bank-confirmed Fonepay payment → credit once. Returns the new balance, or null if already handled.
create or replace function public.merchant_complete_fonepay_topup(p_topup_id uuid, p_bank_txn_id text, p_paid_paisa bigint)
returns bigint
language plpgsql security definer set search_path = public as $$
declare t public.merchant_topups%rowtype;
begin
  update public.merchant_topups
  set status = 'approved', bank_txn_id = p_bank_txn_id, paid_paisa = p_paid_paisa, reviewed_at = now(), admin_note = 'Paid via Fonepay'
  where id = p_topup_id and provider = 'fonepay' and status in ('awaiting_payment', 'expired')
  returning * into t;
  if not found then return null; end if;
  return public.merchant_wallet_apply(t.merchant_id, t.amount_paisa, 'topup', t.reference, 'Fonepay QR payment', null);
end $$;

-- Revenue time series in Nepal time. p_merchant_id null = all merchants. p_bucket: day | week | month.
create or replace function public.merchant_revenue_series(p_merchant_id uuid, p_from timestamptz, p_to timestamptz, p_bucket text)
returns table (bucket date, revenue_paisa bigint, orders bigint, codes bigint, saved_paisa bigint, refunded_paisa bigint)
language sql stable security definer set search_path = public as $$
  select date_trunc(case when p_bucket in ('day', 'week', 'month') then p_bucket else 'day' end, o.created_at at time zone 'Asia/Kathmandu')::date,
    coalesce(sum(o.total_paisa) filter (where o.status = 'completed'), 0)::bigint,
    count(*) filter (where o.status = 'completed'),
    coalesce(sum(o.quantity) filter (where o.status = 'completed'), 0)::bigint,
    coalesce(sum((o.retail_unit_price_paisa - o.unit_price_paisa) * o.quantity) filter (where o.status = 'completed'), 0)::bigint,
    coalesce(sum(o.total_paisa) filter (where o.status = 'refunded'), 0)::bigint
  from public.merchant_orders o
  where (p_merchant_id is null or o.merchant_id = p_merchant_id) and o.created_at >= p_from and o.created_at < p_to
  group by 1 order by 1
$$;

create or replace function public.merchant_revenue_by_product(p_merchant_id uuid, p_from timestamptz, p_to timestamptz)
returns table (product_id text, product_name text, denomination_label text, revenue_paisa bigint, orders bigint, codes bigint)
language sql stable security definer set search_path = public as $$
  select o.product_id, max(o.product_name), o.denomination_label, sum(o.total_paisa)::bigint, count(*), sum(o.quantity)::bigint
  from public.merchant_orders o
  where (p_merchant_id is null or o.merchant_id = p_merchant_id) and o.status = 'completed' and o.created_at >= p_from and o.created_at < p_to
  group by o.product_id, o.denomination_label order by 4 desc
$$;

revoke all on function public.merchant_complete_fonepay_topup(uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.merchant_revenue_series(uuid, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function public.merchant_revenue_by_product(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- Realtime: private broadcast channels carry data-free "refresh" pings only.
-- A merchant can join only their own channel; admins can join the admin one.
create policy merchant_own_channel on realtime.messages for select to authenticated
using ((select realtime.topic()) = 'merchant:' || (select m.id::text from public.merchants m where m.user_id = (select auth.uid())));
create policy admin_merchants_channel on realtime.messages for select to authenticated
using ((select realtime.topic()) = 'admin:merchants' and (select public.is_admin()));
