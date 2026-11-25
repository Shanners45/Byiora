-- Every pack (denomination) gets a permanent id, like a Shopify variant or a Stripe price.
-- The title (label) becomes display text: two packs of one product may share a title, e.g.
-- Valorant "475 VP" in the Nepal and India categories. Stock, orders, SKUs and merchant pricing
-- are tied to the pack id; titles stay on rows only as a snapshot of what the customer saw.
--
-- Backward compatible: rows inserted by code that only knows titles get their pack id filled in
-- by trigger (when the title is unique in its product), and the RPCs accept the id as an extra,
-- optional argument. 20261205_denomination_ids_finish.sql drops the old title-based uniqueness.

-- ── 1. A permanent id for every pack ────────────────────────────────────────────────────────────

-- Keeps ids stable across saves: a pack saved without an id (or with a duplicated one) takes the
-- id of the pack with the same title and category from before the save, else a fresh one.
create or replace function public.products_keep_denomination_ids() returns trigger
language plpgsql set search_path = public as $$
declare
  arr jsonb := '[]'::jsonb;
  d jsonb;
  prev_id text;
  used text[] := '{}';
begin
  if new.denominations is null or jsonb_typeof(new.denominations) <> 'array' then
    return new;
  end if;
  for d in select x from jsonb_array_elements(new.denominations) x loop
    if jsonb_typeof(d) = 'object' and (coalesce(d->>'id', '') = '' or (d->>'id') = any (used)) then
      prev_id := null;
      if tg_op = 'UPDATE' and old.denominations is not null and jsonb_typeof(old.denominations) = 'array' then
        select o->>'id' into prev_id
        from jsonb_array_elements(old.denominations) o
        where o->>'label' = d->>'label'
          and coalesce(o->>'categoryId', '') = coalesce(d->>'categoryId', '')
          and coalesce(o->>'id', '') <> ''
          and not ((o->>'id') = any (used))
        limit 1;
      end if;
      d := d || jsonb_build_object('id', coalesce(prev_id, gen_random_uuid()::text));
    end if;
    if jsonb_typeof(d) = 'object' then
      used := used || (d->>'id');
    end if;
    arr := arr || jsonb_build_array(d);
  end loop;
  new.denominations := arr;
  return new;
end $$;

drop trigger if exists products_keep_denomination_ids on public.products;
create trigger products_keep_denomination_ids
  before insert or update of denominations on public.products
  for each row execute function public.products_keep_denomination_ids();

-- Backfill: re-saving each product runs the trigger above.
update public.products set denominations = denominations
where jsonb_typeof(denominations) = 'array'
  and exists (select 1 from jsonb_array_elements(denominations) d where coalesce(d->>'id', '') = '');

-- ── 2. Pack lookup ──────────────────────────────────────────────────────────────────────────────

-- Product (id or slug) + pack id or title -> pack id. A title only resolves when it is unique in
-- the product; an ambiguous title returns null rather than guessing.
create or replace function public.resolve_denomination_id(p_product_id text, p_key text) returns text
language sql stable set search_path = public as $$
  with d as (
    select x->>'id' as id, x->>'label' as label
    from public.products p, jsonb_array_elements(coalesce(p.denominations, '[]'::jsonb)) x
    where p.id::text = p_product_id or p.slug = p_product_id
  )
  select coalesce(
    (select id from d where id = p_key limit 1),
    (select min(id) from d where label = p_key having count(*) = 1)
  )
$$;
revoke all on function public.resolve_denomination_id(text, text) from public, anon, authenticated;
grant execute on function public.resolve_denomination_id(text, text) to service_role;

-- ── 3. Pack id on every table that references a pack ────────────────────────────────────────────

alter table public.transactions          add column if not exists denomination_id text;
alter table public.gift_card_inventory   add column if not exists denomination_id text;
alter table public.product_skus          add column if not exists denomination_id text;
alter table public.merchant_skus         add column if not exists denomination_id text;
alter table public.merchant_price_rules  add column if not exists denomination_id text;
alter table public.merchant_orders       add column if not exists denomination_id text;

-- Fills denomination_id from the row's title when the writer did not send it.
-- Product-level merchant price rules use the empty title; they keep an empty id.
create or replace function public.fill_denomination_id() returns trigger
language plpgsql set search_path = public as $$
declare
  v_label text := coalesce(to_jsonb(new)->>'denomination_label', to_jsonb(new)->>'amount');
begin
  if new.denomination_id is null and new.product_id is not null and v_label is not null then
    new.denomination_id := case when v_label = '' then '' else public.resolve_denomination_id(new.product_id, v_label) end;
  end if;
  return new;
end $$;

drop trigger if exists fill_denomination_id on public.transactions;
create trigger fill_denomination_id before insert on public.transactions for each row execute function public.fill_denomination_id();
drop trigger if exists fill_denomination_id on public.gift_card_inventory;
create trigger fill_denomination_id before insert on public.gift_card_inventory for each row execute function public.fill_denomination_id();
drop trigger if exists fill_denomination_id on public.product_skus;
create trigger fill_denomination_id before insert on public.product_skus for each row execute function public.fill_denomination_id();
drop trigger if exists fill_denomination_id on public.merchant_skus;
create trigger fill_denomination_id before insert or update on public.merchant_skus for each row execute function public.fill_denomination_id();
drop trigger if exists fill_denomination_id on public.merchant_price_rules;
create trigger fill_denomination_id before insert or update on public.merchant_price_rules for each row execute function public.fill_denomination_id();
drop trigger if exists fill_denomination_id on public.merchant_orders;
create trigger fill_denomination_id before insert on public.merchant_orders for each row execute function public.fill_denomination_id();

-- Backfill by unique title.
update public.gift_card_inventory  set denomination_id = public.resolve_denomination_id(product_id, denomination_label) where denomination_id is null;
update public.product_skus         set denomination_id = public.resolve_denomination_id(product_id, denomination_label) where denomination_id is null;
update public.merchant_skus        set denomination_id = public.resolve_denomination_id(product_id, denomination_label) where denomination_id is null;
update public.merchant_orders      set denomination_id = public.resolve_denomination_id(product_id, denomination_label) where denomination_id is null;
update public.merchant_price_rules set denomination_id = case when denomination_label = '' then '' else public.resolve_denomination_id(product_id, denomination_label) end where denomination_id is null;
update public.transactions         set denomination_id = public.resolve_denomination_id(product_id, amount) where denomination_id is null and product_id is not null and amount is not null;

-- Valorant ("mobile-legends"): its India packs used to be titled "<n> VP (IND Region Only)" and now
-- share titles with the Nepal packs. Old India titles go to the India pack, plain titles to Nepal.
with packs as (
  select x->>'id' as id, x->>'label' as label, x->>'categoryId' as category_id
  from public.products p, jsonb_array_elements(p.denominations) x
  where p.id::text = 'mobile-legends'
),
mapped as (
  select l.label as old_label,
         (select id from packs where packs.label = regexp_replace(l.label, '\s*\(IND Region Only\)$', '')
            and packs.category_id = case when l.label ~ '\(IND Region Only\)$'
                                         then '1d14ffb9-c15a-41da-be61-346827a401cd'
                                         else 'c96d8e01-96a5-47df-a166-552653a633fc' end) as id
  from (select distinct denomination_label as label from public.gift_card_inventory where product_id = 'mobile-legends'
        union select distinct denomination_label from public.product_skus where product_id = 'mobile-legends') l
)
update public.gift_card_inventory g set denomination_id = m.id
from mapped m where g.product_id = 'mobile-legends' and g.denomination_label = m.old_label and g.denomination_id is null and m.id is not null;

with packs as (
  select x->>'id' as id, x->>'label' as label, x->>'categoryId' as category_id
  from public.products p, jsonb_array_elements(p.denominations) x
  where p.id::text = 'mobile-legends'
)
update public.product_skus s set denomination_id = (
  select id from packs where packs.label = regexp_replace(s.denomination_label, '\s*\(IND Region Only\)$', '')
    and packs.category_id = case when s.denomination_label ~ '\(IND Region Only\)$'
                                 then '1d14ffb9-c15a-41da-be61-346827a401cd'
                                 else 'c96d8e01-96a5-47df-a166-552653a633fc' end)
where s.product_id = 'mobile-legends' and s.denomination_id is null;

-- Orders with a shared title: the pack whose list price matches what was charged before any discount.
update public.transactions t set denomination_id = (
  select min(x->>'id')
  from public.products p, jsonb_array_elements(p.denominations) x
  where (p.id::text = t.product_id or p.slug = t.product_id)
    and x->>'label' = t.amount
    and replace(x->>'price', ',', '') ~ '^[0-9]+(\.[0-9]+)?$'
    and replace(x->>'price', ',', '')::numeric = coalesce(t.original_price::text, t.price)::numeric
  having count(*) = 1
)
where t.denomination_id is null and t.product_id is not null and t.amount is not null
  and coalesce(t.original_price::text, t.price) ~ '^[0-9]+(\.[0-9]+)?$';

-- Unique per pack (title-based uniqueness is dropped in the finishing migration).
create unique index if not exists product_skus_product_denomination_id_key on public.product_skus (product_id, denomination_id);
create unique index if not exists merchant_skus_merchant_product_denomination_id_key on public.merchant_skus (merchant_id, product_id, denomination_id);
create unique index if not exists merchant_price_rules_merchant_product_denomination_id_key on public.merchant_price_rules (merchant_id, product_id, denomination_id);
create index if not exists gift_card_inventory_available_denom_idx on public.gift_card_inventory (product_id, denomination_id) where status = 'AVAILABLE';
create index if not exists gift_card_inventory_merchant_available_denom_idx on public.gift_card_inventory (merchant_id, product_id, denomination_id) where status = 'AVAILABLE' and merchant_id is not null;

-- A product's SKU rows must not block a second pack with the same title.
alter table public.product_skus drop constraint if exists product_skus_product_id_denomination_label_key;

-- ── 4. RPCs: take the pack id when given, fall back to the title for old callers ───────────────

drop function if exists public.claim_gift_card(text, text, text, text);
create function public.claim_gift_card(p_product_id text, p_denomination_label text, p_transaction_id text, p_user_id text, p_denomination_id text default null)
returns table(encrypted_code text)
language plpgsql set search_path = public as $$
declare
  v_denom text := coalesce(nullif(p_denomination_id, ''), public.resolve_denomination_id(p_product_id, p_denomination_label));
begin
  perform pg_advisory_xact_lock(hashtext('claim_gift_card:' || p_transaction_id));

  return query
  select g.encrypted_code from public.gift_card_inventory g
  where g.transaction_id = p_transaction_id and g.status = 'DELIVERED'
  limit 1;
  if found then
    return;
  end if;

  -- An unknown or ambiguous pack claims nothing: the order stays Paid for staff to fulfil.
  if v_denom is null then
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
      and denomination_id = v_denom
      and status = 'AVAILABLE'
      and merchant_id is null
    order by created_at asc
    limit 1
    for update skip locked
  )
  returning gift_card_inventory.encrypted_code;
end;
$$;
revoke all on function public.claim_gift_card(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_gift_card(text, text, text, text, text) to service_role;

drop function if exists public.inventory_available_counts();
create function public.inventory_available_counts()
returns table(product_id text, denomination_label text, available bigint, denomination_id text)
language sql stable security definer set search_path = public as $$
  select g.product_id, max(g.denomination_label), count(*), g.denomination_id from public.gift_card_inventory g
  where g.status = 'AVAILABLE' and g.merchant_id is null group by g.product_id, g.denomination_id
$$;
revoke all on function public.inventory_available_counts() from public, anon, authenticated;
grant execute on function public.inventory_available_counts() to service_role;

drop function if exists public.merchant_inventory_counts(uuid);
create function public.merchant_inventory_counts(p_merchant_id uuid)
returns table(product_id text, denomination_label text, available bigint, delivered bigint, denomination_id text)
language sql stable security definer set search_path = public as $$
  select g.product_id, max(g.denomination_label), count(*) filter (where g.status = 'AVAILABLE'), count(*) filter (where g.status = 'DELIVERED'), g.denomination_id
  from public.gift_card_inventory g where g.merchant_id = p_merchant_id group by g.product_id, g.denomination_id
$$;
revoke all on function public.merchant_inventory_counts(uuid) from public, anon, authenticated;
grant execute on function public.merchant_inventory_counts(uuid) to service_role;

drop function if exists public.merchant_revenue_by_product(uuid, timestamptz, timestamptz);
create function public.merchant_revenue_by_product(p_merchant_id uuid, p_from timestamptz, p_to timestamptz)
returns table(product_id text, product_name text, denomination_label text, revenue_paisa bigint, orders bigint, codes bigint, denomination_id text)
language sql stable security definer set search_path = public as $$
  select o.product_id, max(o.product_name), max(o.denomination_label), sum(o.total_paisa)::bigint, count(*), sum(o.quantity)::bigint, o.denomination_id
  from public.merchant_orders o
  where (p_merchant_id is null or o.merchant_id = p_merchant_id) and o.status = 'completed' and not o.is_test and o.created_at >= p_from and o.created_at < p_to
  group by o.product_id, coalesce(o.denomination_id, o.denomination_label), o.denomination_id order by 4 desc
$$;
revoke all on function public.merchant_revenue_by_product(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.merchant_revenue_by_product(uuid, timestamptz, timestamptz) to service_role;

-- One Byiora SKU per pack.
create or replace function public.ensure_product_skus() returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record; base text; candidate text; n int; added int := 0;
begin
  for r in
    select p.id::text as product_id, d->>'label' as label, d->>'id' as denom_id
    from public.products p, jsonb_array_elements(coalesce(p.denominations, '[]'::jsonb)) d
    where coalesce(d->>'label', '') <> '' and coalesce(d->>'id', '') <> ''
      and not exists (select 1 from public.product_skus s where s.product_id = p.id::text and s.denomination_id = d->>'id')
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
    insert into public.product_skus (sku, product_id, denomination_label, denomination_id) values (candidate, r.product_id, r.label, r.denom_id);
    added := added + 1;
  end loop;
  return added;
end $$;
revoke all on function public.ensure_product_skus() from public, anon, authenticated;
grant execute on function public.ensure_product_skus() to service_role;

drop function if exists public.merchant_place_order(uuid, text, text, text, integer, bigint, bigint, text, text, text, text, text, boolean);
create function public.merchant_place_order(
  p_merchant_id uuid, p_product_id text, p_product_name text, p_denomination text, p_quantity integer,
  p_unit_price_paisa bigint, p_retail_unit_price_paisa bigint, p_client_ref text, p_source text,
  p_customer_email text default null, p_customer_name text default null, p_customer_phone text default null,
  p_allow_pending boolean default false, p_denomination_id text default null)
returns table(order_id uuid, created boolean, error text, pending boolean)
language plpgsql security definer set search_path = public as $$
declare
  m public.merchants%rowtype;
  v_order uuid;
  v_total bigint;
  v_spent bigint;
  v_ids uuid[];
  v_more uuid[];
  v_pending boolean := false;
  v_denom text := coalesce(nullif(p_denomination_id, ''), public.resolve_denomination_id(p_product_id, p_denomination));
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
  if v_denom is null then
    return query select null::uuid, false, 'INVALID_DENOMINATION', false; return;
  end if;

  v_total := p_unit_price_paisa * p_quantity;
  if m.limit_per_order_paisa is not null and v_total > m.limit_per_order_paisa then
    return query select null::uuid, false, 'ORDER_LIMIT', false; return;
  end if;
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
    where g.merchant_id = p_merchant_id and g.product_id = p_product_id and g.denomination_id = v_denom and g.status = 'AVAILABLE'
    order by g.created_at limit p_quantity for update skip locked
  ) s;
  if array_length(v_ids, 1) is distinct from p_quantity and m.use_global_inventory then
    select coalesce(array_agg(s.id), '{}') into v_more from (
      select g.id from public.gift_card_inventory g
      where g.merchant_id is null and g.product_id = p_product_id and g.denomination_id = v_denom and g.status = 'AVAILABLE'
      order by g.created_at limit p_quantity - coalesce(array_length(v_ids, 1), 0) for update skip locked
    ) s;
    v_ids := v_ids || v_more;
  end if;
  if coalesce(array_length(v_ids, 1), 0) < p_quantity then
    if not p_allow_pending then
      return query select null::uuid, false, 'OUT_OF_STOCK', false; return;
    end if;
    v_pending := true;
    v_ids := '{}';
  end if;

  insert into public.merchant_orders (merchant_id, client_ref, product_id, product_name, denomination_label, denomination_id, quantity, unit_price_paisa, total_paisa, retail_unit_price_paisa, source, customer_email, customer_name, customer_phone, status, fulfilled_at)
  values (p_merchant_id, p_client_ref, p_product_id, p_product_name, p_denomination, v_denom, p_quantity, p_unit_price_paisa, v_total, p_retail_unit_price_paisa, p_source, p_customer_email, p_customer_name, p_customer_phone,
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
revoke all on function public.merchant_place_order(uuid, text, text, text, integer, bigint, bigint, text, text, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.merchant_place_order(uuid, text, text, text, integer, bigint, bigint, text, text, text, text, text, boolean, text) to service_role;

create or replace function public.merchant_fulfil_order(p_order_id uuid, p_codes jsonb, p_actor uuid, p_allow_global boolean default true)
returns text
language plpgsql security definer set search_path = public as $$
declare
  o public.merchant_orders%rowtype;
  v_user text;
  v_ids uuid[];
  v_more uuid[];
  v_denom text;
begin
  select * into o from public.merchant_orders where id = p_order_id for update;
  if not found or o.status <> 'pending' then return 'NOT_PENDING'; end if;
  select user_id::text into v_user from public.merchants where id = o.merchant_id;
  v_denom := coalesce(o.denomination_id, public.resolve_denomination_id(o.product_id, o.denomination_label));

  if p_codes is not null then
    if jsonb_typeof(p_codes) <> 'array' or jsonb_array_length(p_codes) <> o.quantity then return 'WRONG_COUNT'; end if;
    insert into public.gift_card_inventory (product_id, denomination_label, denomination_id, encrypted_code, code_hash, added_by, merchant_id, status, transaction_id, user_id, delivered_at)
    select o.product_id, o.denomination_label, v_denom, c->>'encrypted_code', c->>'code_hash', p_actor::text, o.merchant_id, 'DELIVERED', 'MO-' || o.id, v_user, now()
    from jsonb_array_elements(p_codes) c;
  else
    if v_denom is null then return 'OUT_OF_STOCK'; end if;
    select coalesce(array_agg(s.id), '{}') into v_ids from (
      select g.id from public.gift_card_inventory g
      where g.merchant_id = o.merchant_id and g.product_id = o.product_id and g.denomination_id = v_denom and g.status = 'AVAILABLE'
      order by g.created_at limit o.quantity for update skip locked
    ) s;
    if coalesce(array_length(v_ids, 1), 0) < o.quantity and p_allow_global then
      select coalesce(array_agg(s.id), '{}') into v_more from (
        select g.id from public.gift_card_inventory g
        where g.merchant_id is null and g.product_id = o.product_id and g.denomination_id = v_denom and g.status = 'AVAILABLE'
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
grant execute on function public.merchant_fulfil_order(uuid, jsonb, uuid, boolean) to service_role;
