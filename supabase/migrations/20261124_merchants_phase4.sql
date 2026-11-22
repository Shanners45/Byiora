-- ============================================================
-- Seller platform, phase 4: spend limits, credit limits, low-balance alerts,
-- webhooks, test mode, per-merchant inventory, API customer details,
-- timezone-aware reports, Fonepay "failed" status - prepared 2026-11-24
-- Project: tkovigthghwpwbtjikyp
-- STATUS: APPLIED 2026-11-24 (as merchants_phase4).
-- ============================================================

alter table public.merchants
  add column credit_limit_paisa bigint not null default 0 check (credit_limit_paisa >= 0),
  add column limit_per_order_paisa bigint check (limit_per_order_paisa > 0),
  add column limit_daily_paisa bigint check (limit_daily_paisa > 0),
  add column limit_monthly_paisa bigint check (limit_monthly_paisa > 0),
  add column low_balance_threshold_paisa bigint not null default 0 check (low_balance_threshold_paisa >= 0),
  add column low_balance_alerted_at timestamptz,
  add column webhook_url text,
  add column webhook_secret_enc text,
  add column use_global_inventory boolean not null default true,
  add column resend_segment_id text;

-- Balance may go negative only within the credit limit the admin grants.
alter table public.merchants drop constraint merchants_wallet_balance_paisa_check;
alter table public.merchants add constraint merchants_wallet_within_credit check (wallet_balance_paisa + credit_limit_paisa >= 0);
alter table public.merchant_wallet_ledger drop constraint merchant_wallet_ledger_balance_after_paisa_check;

-- End-customer details sent with API orders; test-mode orders never touch money or stock.
alter table public.merchant_orders
  add column customer_email text,
  add column customer_name text,
  add column customer_phone text,
  add column is_test boolean not null default false;
create index merchant_orders_customer_idx on public.merchant_orders (merchant_id, customer_email) where customer_email is not null;

alter table public.merchant_api_keys add column mode text not null default 'live' check (mode in ('live', 'test'));

-- Fonepay top-ups end as credited or failed, like customer payments.
update public.merchant_topups set status = 'failed' where status = 'expired';
alter table public.merchant_topups drop constraint merchant_topups_status_check;
alter table public.merchant_topups add constraint merchant_topups_status_check
  check (status in ('awaiting_payment', 'pending', 'approved', 'rejected', 'failed'));

-- Per-merchant inventory: codes with a merchant_id belong to that merchant only.
alter table public.gift_card_inventory add column merchant_id uuid references public.merchants(id);
create index gift_card_inventory_merchant_available_idx on public.gift_card_inventory (merchant_id, product_id, denomination_label) where status = 'AVAILABLE' and merchant_id is not null;

-- Storefront checkout must never hand out a merchant's private codes.
create or replace function public.claim_gift_card(p_product_id text, p_denomination_label text, p_transaction_id text, p_user_id text)
 returns table(encrypted_code text)
 language plpgsql
 set search_path to 'public'
as $function$
begin
  perform pg_advisory_xact_lock(hashtext('claim_gift_card:' || p_transaction_id));

  return query
  select g.encrypted_code from public.gift_card_inventory g
  where g.transaction_id = p_transaction_id and g.status = 'DELIVERED'
  limit 1;
  if found then
    return;
  end if;

  return query
  update public.gift_card_inventory
  set status = 'DELIVERED',
      transaction_id = p_transaction_id,
      user_id = p_user_id,
      delivered_at = now()
  where id = (
    select id from public.gift_card_inventory
    where product_id = p_product_id
      and denomination_label = p_denomination_label
      and status = 'AVAILABLE'
      and merchant_id is null
    order by created_at asc
    limit 1
    for update skip locked
  )
  returning gift_card_inventory.encrypted_code;
end;
$function$;

create or replace function public.inventory_available_counts()
returns table (product_id text, denomination_label text, available bigint)
language sql stable security definer set search_path = public as $$
  select g.product_id, g.denomination_label, count(*) from public.gift_card_inventory g
  where g.status = 'AVAILABLE' and g.merchant_id is null group by g.product_id, g.denomination_label
$$;

create or replace function public.merchant_inventory_counts(p_merchant_id uuid)
returns table (product_id text, denomination_label text, available bigint, delivered bigint)
language sql stable security definer set search_path = public as $$
  select g.product_id, g.denomination_label, count(*) filter (where g.status = 'AVAILABLE'), count(*) filter (where g.status = 'DELIVERED')
  from public.gift_card_inventory g where g.merchant_id = p_merchant_id group by g.product_id, g.denomination_label
$$;

create table public.merchant_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  event text not null,
  payload jsonb not null,
  url text not null,
  livemode boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempts int not null default 0,
  response_status int,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index merchant_webhook_deliveries_merchant_idx on public.merchant_webhook_deliveries (merchant_id, created_at desc);
alter table public.merchant_webhook_deliveries enable row level security;
revoke all on public.merchant_webhook_deliveries from anon, authenticated;

-- ── Orders: limits, credit, own stock first, customer details ──
drop function public.merchant_place_order(uuid, text, text, text, int, bigint, bigint, text, text);
create function public.merchant_place_order(
  p_merchant_id uuid, p_product_id text, p_product_name text, p_denomination text, p_quantity int,
  p_unit_price_paisa bigint, p_retail_unit_price_paisa bigint, p_client_ref text, p_source text,
  p_customer_email text default null, p_customer_name text default null, p_customer_phone text default null
) returns table (order_id uuid, created boolean, error text)
language plpgsql security definer set search_path = public as $$
declare
  m public.merchants%rowtype;
  v_order uuid;
  v_total bigint;
  v_spent bigint;
  v_ids uuid[];
  v_more uuid[];
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 20 then
    return query select null::uuid, false, 'INVALID_QUANTITY'; return;
  end if;
  if p_unit_price_paisa is null or p_unit_price_paisa <= 0 then
    return query select null::uuid, false, 'INVALID_PRICE'; return;
  end if;
  select * into m from public.merchants where id = p_merchant_id for update;
  if not found or m.status <> 'active' or m.kyc_status <> 'approved' then
    return query select null::uuid, false, 'MERCHANT_INACTIVE'; return;
  end if;
  if p_client_ref is not null then
    select o.id into v_order from public.merchant_orders o where o.merchant_id = p_merchant_id and o.client_ref = p_client_ref;
    if found then
      return query select v_order, false, null::text; return;
    end if;
  end if;

  v_total := p_unit_price_paisa * p_quantity;
  if m.limit_per_order_paisa is not null and v_total > m.limit_per_order_paisa then
    return query select null::uuid, false, 'ORDER_LIMIT'; return;
  end if;
  if m.limit_daily_paisa is not null then
    select coalesce(sum(total_paisa), 0) into v_spent from public.merchant_orders
    where merchant_id = p_merchant_id and status = 'completed' and not is_test and created_at > now() - interval '24 hours';
    if v_spent + v_total > m.limit_daily_paisa then
      return query select null::uuid, false, 'DAILY_LIMIT'; return;
    end if;
  end if;
  if m.limit_monthly_paisa is not null then
    select coalesce(sum(total_paisa), 0) into v_spent from public.merchant_orders
    where merchant_id = p_merchant_id and status = 'completed' and not is_test and created_at > now() - interval '30 days';
    if v_spent + v_total > m.limit_monthly_paisa then
      return query select null::uuid, false, 'MONTHLY_LIMIT'; return;
    end if;
  end if;
  if m.wallet_balance_paisa + m.credit_limit_paisa < v_total then
    return query select null::uuid, false, 'INSUFFICIENT_BALANCE'; return;
  end if;

  -- The merchant's own codes first, then the shared stock if allowed.
  select coalesce(array_agg(s.id), '{}') into v_ids from (
    select g.id from public.gift_card_inventory g
    where g.merchant_id = p_merchant_id and g.product_id = p_product_id and g.denomination_label = p_denomination and g.status = 'AVAILABLE'
    order by g.created_at limit p_quantity for update skip locked
  ) s;
  if array_length(v_ids, 1) is distinct from p_quantity and m.use_global_inventory then
    select coalesce(array_agg(s.id), '{}') into v_more from (
      select g.id from public.gift_card_inventory g
      where g.merchant_id is null and g.product_id = p_product_id and g.denomination_label = p_denomination and g.status = 'AVAILABLE'
      order by g.created_at limit p_quantity - coalesce(array_length(v_ids, 1), 0) for update skip locked
    ) s;
    v_ids := v_ids || v_more;
  end if;
  if coalesce(array_length(v_ids, 1), 0) < p_quantity then
    return query select null::uuid, false, 'OUT_OF_STOCK'; return;
  end if;

  insert into public.merchant_orders (merchant_id, client_ref, product_id, product_name, denomination_label, quantity, unit_price_paisa, total_paisa, retail_unit_price_paisa, source, customer_email, customer_name, customer_phone)
  values (p_merchant_id, p_client_ref, p_product_id, p_product_name, p_denomination, p_quantity, p_unit_price_paisa, v_total, p_retail_unit_price_paisa, p_source, p_customer_email, p_customer_name, p_customer_phone)
  returning id into v_order;
  update public.gift_card_inventory
  set status = 'DELIVERED', transaction_id = 'MO-' || v_order, user_id = m.user_id::text, delivered_at = now(), updated_at = now()
  where id = any (v_ids);
  update public.merchants set wallet_balance_paisa = wallet_balance_paisa - v_total, updated_at = now() where id = p_merchant_id;
  insert into public.merchant_wallet_ledger (merchant_id, amount_paisa, balance_after_paisa, kind, reference, created_by)
  values (p_merchant_id, -v_total, m.wallet_balance_paisa - v_total, 'order', v_order::text, m.user_id);
  return query select v_order, true, null::text;
end $$;

-- Late but bank-confirmed Fonepay money is still credited, even after the QR was marked failed.
create or replace function public.merchant_complete_fonepay_topup(p_topup_id uuid, p_bank_txn_id text, p_paid_paisa bigint)
returns bigint
language plpgsql security definer set search_path = public as $$
declare t public.merchant_topups%rowtype;
begin
  update public.merchant_topups
  set status = 'approved', bank_txn_id = p_bank_txn_id, paid_paisa = p_paid_paisa, reviewed_at = now(), admin_note = 'Paid via Fonepay'
  where id = p_topup_id and provider = 'fonepay' and status in ('awaiting_payment', 'failed')
  returning * into t;
  if not found then return null; end if;
  return public.merchant_wallet_apply(t.merchant_id, t.amount_paisa, 'topup', t.reference, 'Fonepay QR payment', null);
end $$;

-- ── Reports in the viewer's time zone, excluding test orders ──
drop function public.merchant_revenue_series(uuid, timestamptz, timestamptz, text);
create function public.merchant_revenue_series(p_merchant_id uuid, p_from timestamptz, p_to timestamptz, p_bucket text, p_tz text default 'UTC')
returns table (bucket date, revenue_paisa bigint, orders bigint, codes bigint, saved_paisa bigint, refunded_paisa bigint)
language sql stable security definer set search_path = public as $$
  select date_trunc(case when p_bucket in ('day', 'week', 'month') then p_bucket else 'day' end, o.created_at at time zone coalesce(nullif(p_tz, ''), 'UTC'))::date,
    coalesce(sum(o.total_paisa) filter (where o.status = 'completed'), 0)::bigint,
    count(*) filter (where o.status = 'completed'),
    coalesce(sum(o.quantity) filter (where o.status = 'completed'), 0)::bigint,
    coalesce(sum((o.retail_unit_price_paisa - o.unit_price_paisa) * o.quantity) filter (where o.status = 'completed'), 0)::bigint,
    coalesce(sum(o.total_paisa) filter (where o.status = 'refunded'), 0)::bigint
  from public.merchant_orders o
  where (p_merchant_id is null or o.merchant_id = p_merchant_id) and not o.is_test and o.created_at >= p_from and o.created_at < p_to
  group by 1 order by 1
$$;

create or replace function public.merchant_revenue_by_product(p_merchant_id uuid, p_from timestamptz, p_to timestamptz)
returns table (product_id text, product_name text, denomination_label text, revenue_paisa bigint, orders bigint, codes bigint)
language sql stable security definer set search_path = public as $$
  select o.product_id, max(o.product_name), o.denomination_label, sum(o.total_paisa)::bigint, count(*), sum(o.quantity)::bigint
  from public.merchant_orders o
  where (p_merchant_id is null or o.merchant_id = p_merchant_id) and o.status = 'completed' and not o.is_test and o.created_at >= p_from and o.created_at < p_to
  group by o.product_id, o.denomination_label order by 4 desc
$$;

create or replace function public.merchant_revenue_totals()
returns table (merchant_id uuid, revenue_paisa bigint, month_revenue_paisa bigint, orders bigint, last_order_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.merchant_id,
    coalesce(sum(o.total_paisa), 0)::bigint,
    coalesce(sum(o.total_paisa) filter (where o.created_at >= date_trunc('month', now() at time zone 'Asia/Kathmandu') at time zone 'Asia/Kathmandu'), 0)::bigint,
    count(*),
    max(o.created_at)
  from public.merchant_orders o where o.status = 'completed' and not o.is_test group by o.merchant_id
$$;

revoke all on function public.merchant_place_order(uuid, text, text, text, int, bigint, bigint, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.merchant_revenue_series(uuid, timestamptz, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.merchant_inventory_counts(uuid) from public, anon, authenticated;
revoke all on function public.inventory_available_counts() from public, anon, authenticated;
revoke all on function public.merchant_revenue_by_product(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.merchant_revenue_totals() from public, anon, authenticated;
revoke all on function public.merchant_complete_fonepay_topup(uuid, text, bigint) from public, anon, authenticated;
