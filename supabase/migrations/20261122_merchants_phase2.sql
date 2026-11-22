-- ============================================================
-- Seller platform, phase 2: wallet, top-ups, orders, API keys - prepared 2026-11-22
-- Project: tkovigthghwpwbtjikyp
-- STATUS: APPLIED 2026-11-22 (as merchants_phase2).
--
-- Money is integer paisa. Every balance change goes through one SQL function
-- that locks the merchant row, so balance and ledger can never drift apart and
-- two orders can never spend the same rupee. Only the service role can call them.
-- ============================================================

alter table public.merchants
  add column wallet_balance_paisa bigint not null default 0 check (wallet_balance_paisa >= 0),
  add column discount_percent numeric(5,2) not null default 0 check (discount_percent >= 0 and discount_percent <= 90),
  add column api_rate_limit_per_min int not null default 60 check (api_rate_limit_per_min between 1 and 1000);

-- Append-only statement. balance_after makes every line self-checking.
create table public.merchant_wallet_ledger (
  id bigint generated always as identity primary key,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  amount_paisa bigint not null check (amount_paisa <> 0),
  balance_after_paisa bigint not null check (balance_after_paisa >= 0),
  kind text not null check (kind in ('topup', 'order', 'refund', 'adjustment')),
  reference text,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index merchant_wallet_ledger_merchant_idx on public.merchant_wallet_ledger (merchant_id, created_at desc);

create table public.merchant_topups (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  amount_paisa bigint not null check (amount_paisa > 0),
  method text not null check (method in ('bank_transfer', 'esewa', 'khalti', 'fonepay', 'other')),
  reference text not null,
  proof_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index merchant_topups_pending_idx on public.merchant_topups (created_at) where status = 'pending';
create index merchant_topups_merchant_idx on public.merchant_topups (merchant_id, created_at desc);

create table public.merchant_orders (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  client_ref text,
  product_id text not null,
  product_name text not null,
  denomination_label text not null,
  quantity int not null check (quantity between 1 and 20),
  unit_price_paisa bigint not null check (unit_price_paisa > 0),
  total_paisa bigint not null check (total_paisa > 0),
  retail_unit_price_paisa bigint not null,
  status text not null default 'completed' check (status in ('completed', 'refunded')),
  source text not null check (source in ('dashboard', 'api')),
  refunded_at timestamptz,
  refund_note text,
  created_at timestamptz not null default now(),
  unique (merchant_id, client_ref)
);
create index merchant_orders_merchant_idx on public.merchant_orders (merchant_id, created_at desc);

create table public.merchant_api_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  prefix text not null,
  secret_hash text not null unique,
  ip_allowlist text[] not null default '{}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index merchant_api_keys_merchant_idx on public.merchant_api_keys (merchant_id);

-- Merchant orders tag their codes with transaction_id = 'MO-<order id>'.
create index if not exists gift_card_inventory_transaction_idx on public.gift_card_inventory (transaction_id);
create index if not exists gift_card_inventory_available_idx on public.gift_card_inventory (product_id, denomination_label) where status = 'AVAILABLE';

alter table public.merchant_wallet_ledger enable row level security;
alter table public.merchant_topups enable row level security;
alter table public.merchant_orders enable row level security;
alter table public.merchant_api_keys enable row level security;
revoke all on public.merchant_wallet_ledger, public.merchant_topups, public.merchant_orders, public.merchant_api_keys from anon, authenticated;

-- ── Place an order: lock merchant, idempotency, balance, claim codes, debit ──
create or replace function public.merchant_place_order(
  p_merchant_id uuid,
  p_product_id text,
  p_product_name text,
  p_denomination text,
  p_quantity int,
  p_unit_price_paisa bigint,
  p_retail_unit_price_paisa bigint,
  p_client_ref text,
  p_source text
) returns table (order_id uuid, created boolean, error text)
language plpgsql security definer set search_path = public as $$
declare
  m public.merchants%rowtype;
  v_order uuid;
  v_total bigint;
  v_ids uuid[];
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

  -- Same client_ref = same order: retries never charge twice.
  if p_client_ref is not null then
    select o.id into v_order from public.merchant_orders o where o.merchant_id = p_merchant_id and o.client_ref = p_client_ref;
    if found then
      return query select v_order, false, null::text; return;
    end if;
  end if;

  v_total := p_unit_price_paisa * p_quantity;
  if m.wallet_balance_paisa < v_total then
    return query select null::uuid, false, 'INSUFFICIENT_BALANCE'; return;
  end if;

  select array_agg(s.id) into v_ids from (
    select g.id from public.gift_card_inventory g
    where g.product_id = p_product_id and g.denomination_label = p_denomination and g.status = 'AVAILABLE'
    order by g.created_at
    limit p_quantity
    for update skip locked
  ) s;
  if coalesce(array_length(v_ids, 1), 0) < p_quantity then
    return query select null::uuid, false, 'OUT_OF_STOCK'; return;
  end if;

  insert into public.merchant_orders (merchant_id, client_ref, product_id, product_name, denomination_label, quantity, unit_price_paisa, total_paisa, retail_unit_price_paisa, source)
  values (p_merchant_id, p_client_ref, p_product_id, p_product_name, p_denomination, p_quantity, p_unit_price_paisa, v_total, p_retail_unit_price_paisa, p_source)
  returning id into v_order;

  update public.gift_card_inventory
  set status = 'DELIVERED', transaction_id = 'MO-' || v_order, user_id = m.user_id::text, delivered_at = now(), updated_at = now()
  where id = any (v_ids);

  update public.merchants set wallet_balance_paisa = wallet_balance_paisa - v_total, updated_at = now() where id = p_merchant_id;
  insert into public.merchant_wallet_ledger (merchant_id, amount_paisa, balance_after_paisa, kind, reference, created_by)
  values (p_merchant_id, -v_total, m.wallet_balance_paisa - v_total, 'order', v_order::text, m.user_id);

  return query select v_order, true, null::text;
end $$;

-- ── Credit or debit a wallet (top-up approval, refund, manual adjustment) ──
create or replace function public.merchant_wallet_apply(
  p_merchant_id uuid, p_amount bigint, p_kind text, p_reference text, p_note text, p_actor uuid
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_balance bigint;
begin
  if p_amount = 0 then raise exception 'ZERO_AMOUNT'; end if;
  update public.merchants set wallet_balance_paisa = wallet_balance_paisa + p_amount, updated_at = now()
  where id = p_merchant_id returning wallet_balance_paisa into v_balance;
  if not found then raise exception 'MERCHANT_NOT_FOUND'; end if;
  insert into public.merchant_wallet_ledger (merchant_id, amount_paisa, balance_after_paisa, kind, reference, note, created_by)
  values (p_merchant_id, p_amount, v_balance, p_kind, p_reference, p_note, p_actor);
  return v_balance;
end $$;

create or replace function public.merchant_approve_topup(p_topup_id uuid, p_actor uuid, p_note text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare t public.merchant_topups%rowtype;
begin
  update public.merchant_topups set status = 'approved', reviewed_by = p_actor, reviewed_at = now(), admin_note = p_note
  where id = p_topup_id and status = 'pending' returning * into t;
  if not found then raise exception 'TOPUP_NOT_PENDING'; end if;
  return public.merchant_wallet_apply(t.merchant_id, t.amount_paisa, 'topup', t.id::text, p_note, p_actor);
end $$;

create or replace function public.merchant_refund_order(p_order_id uuid, p_actor uuid, p_note text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare o public.merchant_orders%rowtype;
begin
  update public.merchant_orders set status = 'refunded', refunded_at = now(), refund_note = p_note
  where id = p_order_id and status = 'completed' returning * into o;
  if not found then raise exception 'ORDER_NOT_REFUNDABLE'; end if;
  return public.merchant_wallet_apply(o.merchant_id, o.total_paisa, 'refund', o.id::text, p_note, p_actor);
end $$;

-- Stock per denomination without shipping every inventory row to the app.
create or replace function public.inventory_available_counts()
returns table (product_id text, denomination_label text, available bigint)
language sql stable security definer set search_path = public as $$
  select g.product_id, g.denomination_label, count(*) from public.gift_card_inventory g
  where g.status = 'AVAILABLE' group by g.product_id, g.denomination_label
$$;

-- Lifetime and this-month revenue per merchant for the admin list.
create or replace function public.merchant_revenue_totals()
returns table (merchant_id uuid, revenue_paisa bigint, month_revenue_paisa bigint, orders bigint, last_order_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.merchant_id,
    coalesce(sum(o.total_paisa), 0)::bigint,
    coalesce(sum(o.total_paisa) filter (where o.created_at >= date_trunc('month', now() at time zone 'Asia/Kathmandu') at time zone 'Asia/Kathmandu'), 0)::bigint,
    count(*),
    max(o.created_at)
  from public.merchant_orders o where o.status = 'completed' group by o.merchant_id
$$;

revoke all on function public.merchant_place_order(uuid, text, text, text, int, bigint, bigint, text, text) from public, anon, authenticated;
revoke all on function public.merchant_wallet_apply(uuid, bigint, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.merchant_approve_topup(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.merchant_refund_order(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.inventory_available_counts() from public, anon, authenticated;
revoke all on function public.merchant_revenue_totals() from public, anon, authenticated;
