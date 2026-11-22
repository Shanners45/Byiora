-- ============================================================
-- Backorders: an API order that can't be filled from stock is accepted as
-- "pending" (wallet charged) and filled later by an admin, or cancelled + refunded.
-- Project: tkovigthghwpwbtjikyp
-- ============================================================

alter table public.merchant_orders drop constraint merchant_orders_status_check;
alter table public.merchant_orders add constraint merchant_orders_status_check check (status in ('pending', 'completed', 'refunded'));
alter table public.merchant_orders add column if not exists fulfilled_at timestamptz;
create index if not exists merchant_orders_pending_idx on public.merchant_orders (created_at) where status = 'pending';

drop function public.merchant_place_order(uuid, text, text, text, int, bigint, bigint, text, text, text, text, text);
create function public.merchant_place_order(
  p_merchant_id uuid, p_product_id text, p_product_name text, p_denomination text, p_quantity int,
  p_unit_price_paisa bigint, p_retail_unit_price_paisa bigint, p_client_ref text, p_source text,
  p_customer_email text default null, p_customer_name text default null, p_customer_phone text default null,
  p_allow_pending boolean default false
) returns table (order_id uuid, created boolean, error text, pending boolean)
language plpgsql security definer set search_path = public as $$
declare
  m public.merchants%rowtype;
  v_order uuid;
  v_total bigint;
  v_spent bigint;
  v_ids uuid[];
  v_more uuid[];
  v_pending boolean := false;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 20 then
    return query select null::uuid, false, 'INVALID_QUANTITY', false; return;
  end if;
  if p_unit_price_paisa is null or p_unit_price_paisa <= 0 then
    return query select null::uuid, false, 'INVALID_PRICE', false; return;
  end if;
  select * into m from public.merchants where id = p_merchant_id for update;
  if not found or m.status <> 'active' or m.kyc_status <> 'approved' then
    return query select null::uuid, false, 'MERCHANT_INACTIVE', false; return;
  end if;
  if p_client_ref is not null then
    select o.id, o.status = 'pending' into v_order, v_pending from public.merchant_orders o where o.merchant_id = p_merchant_id and o.client_ref = p_client_ref;
    if found then
      return query select v_order, false, null::text, v_pending; return;
    end if;
  end if;

  v_total := p_unit_price_paisa * p_quantity;
  if m.limit_per_order_paisa is not null and v_total > m.limit_per_order_paisa then
    return query select null::uuid, false, 'ORDER_LIMIT', false; return;
  end if;
  -- Pending orders already took the money, so they count toward spend limits.
  if m.limit_daily_paisa is not null then
    select coalesce(sum(total_paisa), 0) into v_spent from public.merchant_orders
    where merchant_id = p_merchant_id and status in ('completed', 'pending') and not is_test and created_at > now() - interval '24 hours';
    if v_spent + v_total > m.limit_daily_paisa then
      return query select null::uuid, false, 'DAILY_LIMIT', false; return;
    end if;
  end if;
  if m.limit_monthly_paisa is not null then
    select coalesce(sum(total_paisa), 0) into v_spent from public.merchant_orders
    where merchant_id = p_merchant_id and status in ('completed', 'pending') and not is_test and created_at > now() - interval '30 days';
    if v_spent + v_total > m.limit_monthly_paisa then
      return query select null::uuid, false, 'MONTHLY_LIMIT', false; return;
    end if;
  end if;
  if m.wallet_balance_paisa + m.credit_limit_paisa < v_total then
    return query select null::uuid, false, 'INSUFFICIENT_BALANCE', false; return;
  end if;

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
    if not p_allow_pending then
      return query select null::uuid, false, 'OUT_OF_STOCK', false; return;
    end if;
    -- All-or-nothing: no codes are taken now; the whole order is filled later.
    v_pending := true;
    v_ids := '{}';
  end if;

  insert into public.merchant_orders (merchant_id, client_ref, product_id, product_name, denomination_label, quantity, unit_price_paisa, total_paisa, retail_unit_price_paisa, source, customer_email, customer_name, customer_phone, status, fulfilled_at)
  values (p_merchant_id, p_client_ref, p_product_id, p_product_name, p_denomination, p_quantity, p_unit_price_paisa, v_total, p_retail_unit_price_paisa, p_source, p_customer_email, p_customer_name, p_customer_phone,
    case when v_pending then 'pending' else 'completed' end, case when v_pending then null else now() end)
  returning id into v_order;
  if not v_pending then
    update public.gift_card_inventory
    set status = 'DELIVERED', transaction_id = 'MO-' || v_order, user_id = m.user_id::text, delivered_at = now(), updated_at = now()
    where id = any (v_ids);
  end if;
  update public.merchants set wallet_balance_paisa = wallet_balance_paisa - v_total, updated_at = now() where id = p_merchant_id;
  insert into public.merchant_wallet_ledger (merchant_id, amount_paisa, balance_after_paisa, kind, reference, created_by)
  values (p_merchant_id, -v_total, m.wallet_balance_paisa - v_total, 'order', v_order::text, m.user_id);
  return query select v_order, true, null::text, v_pending;
end $$;

-- Fill a pending order: p_codes = [{encrypted_code, code_hash}, ...] typed by an admin,
-- or null to take codes from stock (merchant's own first, then shared).
create or replace function public.merchant_fulfil_order(p_order_id uuid, p_codes jsonb, p_actor uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  o public.merchant_orders%rowtype;
  v_user text;
  v_ids uuid[];
  v_more uuid[];
begin
  select * into o from public.merchant_orders where id = p_order_id for update;
  if not found or o.status <> 'pending' then return 'NOT_PENDING'; end if;
  select user_id::text into v_user from public.merchants where id = o.merchant_id;

  if p_codes is not null then
    if jsonb_typeof(p_codes) <> 'array' or jsonb_array_length(p_codes) <> o.quantity then return 'WRONG_COUNT'; end if;
    insert into public.gift_card_inventory (product_id, denomination_label, encrypted_code, code_hash, added_by, merchant_id, status, transaction_id, user_id, delivered_at)
    select o.product_id, o.denomination_label, c->>'encrypted_code', c->>'code_hash', p_actor::text, o.merchant_id, 'DELIVERED', 'MO-' || o.id, v_user, now()
    from jsonb_array_elements(p_codes) c;
  else
    select coalesce(array_agg(s.id), '{}') into v_ids from (
      select g.id from public.gift_card_inventory g
      where g.merchant_id = o.merchant_id and g.product_id = o.product_id and g.denomination_label = o.denomination_label and g.status = 'AVAILABLE'
      order by g.created_at limit o.quantity for update skip locked
    ) s;
    if coalesce(array_length(v_ids, 1), 0) < o.quantity then
      select coalesce(array_agg(s.id), '{}') into v_more from (
        select g.id from public.gift_card_inventory g
        where g.merchant_id is null and g.product_id = o.product_id and g.denomination_label = o.denomination_label and g.status = 'AVAILABLE'
        order by g.created_at limit o.quantity - coalesce(array_length(v_ids, 1), 0) for update skip locked
      ) s;
      v_ids := v_ids || v_more;
    end if;
    if coalesce(array_length(v_ids, 1), 0) < o.quantity then return 'OUT_OF_STOCK'; end if;
    update public.gift_card_inventory
    set status = 'DELIVERED', transaction_id = 'MO-' || o.id, user_id = v_user, delivered_at = now(), updated_at = now()
    where id = any (v_ids);
  end if;

  update public.merchant_orders set status = 'completed', fulfilled_at = now() where id = o.id;
  return null;
end $$;

-- Refund also cancels a pending order (money back, nothing delivered).
create or replace function public.merchant_refund_order(p_order_id uuid, p_actor uuid, p_note text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare o public.merchant_orders%rowtype;
begin
  update public.merchant_orders set status = 'refunded', refunded_at = now(), refund_note = p_note
  where id = p_order_id and status in ('completed', 'pending') returning * into o;
  if not found then raise exception 'ORDER_NOT_REFUNDABLE'; end if;
  return public.merchant_wallet_apply(o.merchant_id, o.total_paisa, 'refund', o.id::text, p_note, p_actor);
end $$;

revoke all on function public.merchant_place_order(uuid, text, text, text, int, bigint, bigint, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.merchant_fulfil_order(uuid, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.merchant_refund_order(uuid, uuid, text) from public, anon, authenticated;

-- ── Follow-up: auto-fill respects the merchant's shared-stock setting ──
-- p_allow_global = false only takes the merchant's own codes (used when stock is added and
-- waiting orders are filled automatically). Admin "Use codes from stock" passes true.
drop function public.merchant_fulfil_order(uuid, jsonb, uuid);
create function public.merchant_fulfil_order(p_order_id uuid, p_codes jsonb, p_actor uuid, p_allow_global boolean default true)
returns text
language plpgsql security definer set search_path = public as $$
declare
  o public.merchant_orders%rowtype;
  v_user text;
  v_ids uuid[];
  v_more uuid[];
begin
  select * into o from public.merchant_orders where id = p_order_id for update;
  if not found or o.status <> 'pending' then return 'NOT_PENDING'; end if;
  select user_id::text into v_user from public.merchants where id = o.merchant_id;

  if p_codes is not null then
    if jsonb_typeof(p_codes) <> 'array' or jsonb_array_length(p_codes) <> o.quantity then return 'WRONG_COUNT'; end if;
    insert into public.gift_card_inventory (product_id, denomination_label, encrypted_code, code_hash, added_by, merchant_id, status, transaction_id, user_id, delivered_at)
    select o.product_id, o.denomination_label, c->>'encrypted_code', c->>'code_hash', p_actor::text, o.merchant_id, 'DELIVERED', 'MO-' || o.id, v_user, now()
    from jsonb_array_elements(p_codes) c;
  else
    select coalesce(array_agg(s.id), '{}') into v_ids from (
      select g.id from public.gift_card_inventory g
      where g.merchant_id = o.merchant_id and g.product_id = o.product_id and g.denomination_label = o.denomination_label and g.status = 'AVAILABLE'
      order by g.created_at limit o.quantity for update skip locked
    ) s;
    if coalesce(array_length(v_ids, 1), 0) < o.quantity and p_allow_global then
      select coalesce(array_agg(s.id), '{}') into v_more from (
        select g.id from public.gift_card_inventory g
        where g.merchant_id is null and g.product_id = o.product_id and g.denomination_label = o.denomination_label and g.status = 'AVAILABLE'
        order by g.created_at limit o.quantity - coalesce(array_length(v_ids, 1), 0) for update skip locked
      ) s;
      v_ids := v_ids || v_more;
    end if;
    if coalesce(array_length(v_ids, 1), 0) < o.quantity then return 'OUT_OF_STOCK'; end if;
    update public.gift_card_inventory
    set status = 'DELIVERED', transaction_id = 'MO-' || o.id, user_id = v_user, delivered_at = now(), updated_at = now()
    where id = any (v_ids);
  end if;

  update public.merchant_orders set status = 'completed', fulfilled_at = now() where id = o.id;
  return null;
end $$;
revoke all on function public.merchant_fulfil_order(uuid, jsonb, uuid, boolean) from public, anon, authenticated;

-- ── Per-merchant switch: off = out-of-stock API orders fail with OUT_OF_STOCK (default);
-- on = they are accepted as pending and delivered manually. Applied as merchant_manual_delivery.
alter table public.merchants add column if not exists manual_delivery boolean not null default false;
