-- ============================================================
-- Promo redemption lifecycle, enforced by the database.
--
-- Before: the app reserved a use (usage_count + 1, then a usage row) BEFORE the order existed,
-- and every place that changed an order's status had to remember to hand the use back or take it
-- again. Any refused or crashed checkout left a use stuck, and read-modify-write releases could drift.
--
-- Now:
--   * A use is a row with a status: reserved -> consumed, or released. Limits count live rows
--     (reserved + consumed) only. promo_codes.usage_count is a cache the database keeps exact.
--   * The use is created by a trigger in the SAME transaction as the order insert, with the promo row
--     locked: global and per-customer limits are checked atomically, and if the order isn't created
--     no use exists. A use always belongs to an existing order (foreign key).
--   * Order status changes drive the use: Paid/Completed consume it, Payment Failed/Cancelled/
--     Refunded/Failed release it, a recovered order takes it back. No app code involved.
--   * A pg_cron sweeper releases reservations whose hold expired (safety net if order expiry stalls).
-- Project: tkovigthghwpwbtjikyp
-- ============================================================

-- ── 1. Usage rows get a lifecycle ──────────────────────────────────────────────
alter table public.promo_code_usage
  add column if not exists status text not null default 'reserved',
  add column if not exists reserved_until timestamptz,
  add column if not exists consumed_at timestamptz,
  add column if not exists released_at timestamptz;

alter table public.promo_code_usage drop constraint if exists promo_code_usage_status_check;
alter table public.promo_code_usage
  add constraint promo_code_usage_status_check check (status in ('reserved', 'consumed', 'released'));

-- Order status -> use status. One place, used by backfill and triggers.
create or replace function public.promo_usage_status_for(p_order_status text)
returns text language sql immutable set search_path = public as $$
  select case
    when p_order_status in ('Paid', 'Completed') then 'consumed'
    when p_order_status in ('Payment Failed', 'Cancelled', 'Refunded', 'Failed') then 'released'
    else 'reserved'
  end
$$;

-- How long a reservation may wait for payment before the sweeper frees it. Order expiry
-- (api/cron/expire-stale-orders) normally fails the order first: Fonepay 5 min, Khalti 2 h, manual QR 48 h.
create or replace function public.promo_reservation_hold(p_payment_category text)
returns interval language sql immutable set search_path = public as $$
  select case when p_payment_category = 'static' then interval '49 hours' else interval '3 hours' end
$$;

-- ── 2. Backfill: every use belongs to a real order, with the right status ───────
-- Uses whose order never got created (refused/crashed checkouts) are the stuck ones: drop them.
delete from public.promo_code_usage u
where not exists (select 1 from public.transactions t where t.transaction_id = u.transaction_id);

update public.promo_code_usage u
set status = public.promo_usage_status_for(t.status),
    consumed_at = case when public.promo_usage_status_for(t.status) = 'consumed' then coalesce(u.consumed_at, u.used_at) end,
    released_at = case when public.promo_usage_status_for(t.status) = 'released' then coalesce(u.released_at, now()) end,
    reserved_until = case when public.promo_usage_status_for(t.status) = 'reserved'
                          then now() + public.promo_reservation_hold(t.payment_category) end
from public.transactions t
where t.transaction_id = u.transaction_id;

-- Orders that carry a promo but lost their use row to the old release/delete logic get one back,
-- so history and per-customer limits are complete.
insert into public.promo_code_usage
  (promo_code_id, code, user_email, user_id, transaction_id, product_id, original_price, discount_amount,
   final_price, ip_address, device_id, used_at, status, consumed_at, released_at, reserved_until)
select p.id, upper(t.promo_code), lower(coalesce(t.user_email, '')), t.user_id, t.transaction_id, t.product_id,
       coalesce(t.original_price, 0), coalesce(t.discount_amount, 0),
       case when t.price ~ '^\s*\d+(\.\d+)?\s*$' then t.price::numeric else 0 end,
       t.guest_user_data->>'ip', t.guest_user_data->>'deviceId', coalesce(t.created_at, now()),
       public.promo_usage_status_for(t.status),
       case when public.promo_usage_status_for(t.status) = 'consumed' then coalesce(t.created_at, now()) end,
       case when public.promo_usage_status_for(t.status) = 'released' then now() end,
       case when public.promo_usage_status_for(t.status) = 'reserved' then now() + public.promo_reservation_hold(t.payment_category) end
from public.transactions t
join public.promo_codes p on upper(p.code) = upper(t.promo_code)
where t.promo_code is not null
  and not exists (select 1 from public.promo_code_usage u where u.transaction_id = t.transaction_id);

-- One use per order, and a use can't outlive (or exist without) its order.
create unique index if not exists promo_code_usage_transaction_id_key on public.promo_code_usage (transaction_id);
alter table public.promo_code_usage drop constraint if exists promo_code_usage_transaction_fkey;
alter table public.promo_code_usage
  add constraint promo_code_usage_transaction_fkey foreign key (transaction_id)
  references public.transactions (transaction_id) on delete cascade;

create index if not exists promo_code_usage_live_idx on public.promo_code_usage (promo_code_id) where status <> 'released';
create index if not exists promo_code_usage_hold_idx on public.promo_code_usage (reserved_until) where status = 'reserved';

-- ── 3. usage_count is derived from live uses, never incremented by hand ─────────
create or replace function public.promo_refresh_usage_count(p_promo_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.promo_codes p
  set usage_count = (select count(*) from public.promo_code_usage u where u.promo_code_id = p_promo_id and u.status <> 'released'),
      updated_at = now()
  where p.id = p_promo_id
$$;

create or replace function public.promo_code_usage_sync_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' then perform public.promo_refresh_usage_count(old.promo_code_id); end if;
  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.promo_code_id is distinct from old.promo_code_id or new.status is distinct from old.status) then
    perform public.promo_refresh_usage_count(new.promo_code_id);
  end if;
  return null;
end $$;

drop trigger if exists promo_code_usage_sync_count on public.promo_code_usage;
create trigger promo_code_usage_sync_count
after insert or update or delete on public.promo_code_usage
for each row execute function public.promo_code_usage_sync_count();

-- ── 4. Redeem atomically with the order insert ─────────────────────────────────
-- Raises (aborting the order insert) with one of these messages, which checkout maps to customer text:
--   PROMO_UNAVAILABLE   code missing, inactive, not started or expired
--   PROMO_LIMIT_REACHED global usage_limit hit
--   PROMO_ALREADY_USED  per_user_limit hit for this account, email or device
create or replace function public.transactions_redeem_promo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_promo public.promo_codes%rowtype;
  v_device text := nullif(new.guest_user_data->>'deviceId', '');
  v_email text := lower(trim(coalesce(new.user_email, '')));
  v_live integer;
  v_mine integer;
  v_status text := public.promo_usage_status_for(new.status);
begin
  -- Lock the code so concurrent checkouts serialize on it: the last use can only go once.
  select * into v_promo from public.promo_codes where upper(code) = upper(trim(new.promo_code)) for update;

  if not found or not v_promo.is_active
     or (v_promo.starts_at is not null and v_promo.starts_at > now())
     or (v_promo.expires_at is not null and v_promo.expires_at <= now()) then
    raise exception 'PROMO_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if v_status <> 'released' then
    if v_promo.usage_limit is not null then
      select count(*) into v_live from public.promo_code_usage
      where promo_code_id = v_promo.id and status <> 'released';
      if v_live >= v_promo.usage_limit then
        raise exception 'PROMO_LIMIT_REACHED' using errcode = 'P0001';
      end if;
    end if;

    if coalesce(v_promo.per_user_limit, 0) > 0 then
      select count(*) into v_mine from public.promo_code_usage
      where promo_code_id = v_promo.id and status <> 'released'
        and ((new.user_id is not null and user_id = new.user_id)
             or (v_email <> '' and lower(user_email) = v_email)
             or (v_device is not null and device_id = v_device));
      if v_mine >= v_promo.per_user_limit then
        raise exception 'PROMO_ALREADY_USED' using errcode = 'P0001';
      end if;
    end if;
  end if;

  insert into public.promo_code_usage
    (promo_code_id, code, user_email, user_id, transaction_id, product_id, original_price, discount_amount,
     final_price, ip_address, device_id, used_at, status, reserved_until, consumed_at, released_at)
  values
    (v_promo.id, upper(v_promo.code), v_email, new.user_id, new.transaction_id, new.product_id,
     coalesce(new.original_price, 0), coalesce(new.discount_amount, 0),
     case when new.price ~ '^\s*\d+(\.\d+)?\s*$' then new.price::numeric else 0 end,
     new.guest_user_data->>'ip', v_device, now(), v_status,
     case when v_status = 'reserved' then now() + public.promo_reservation_hold(new.payment_category) end,
     case when v_status = 'consumed' then now() end,
     case when v_status = 'released' then now() end);

  return null;
end $$;

drop trigger if exists transactions_redeem_promo on public.transactions;
create trigger transactions_redeem_promo
after insert on public.transactions
for each row when (new.promo_code is not null and trim(new.promo_code) <> '')
execute function public.transactions_redeem_promo();

-- ── 5. Order status drives the use ─────────────────────────────────────────────
-- Moving back to a live status (payment arrived after expiry, or an admin reopens the order) takes
-- the use again without re-checking the limit: the customer has paid at that price, so it is honoured.
create or replace function public.transactions_sync_promo_usage()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status text := public.promo_usage_status_for(new.status);
begin
  update public.promo_code_usage
  set status = v_status,
      reserved_until = case when v_status = 'reserved' then now() + public.promo_reservation_hold(new.payment_category) end,
      consumed_at = case when v_status = 'consumed' then coalesce(consumed_at, now()) end,
      released_at = case when v_status = 'released' then now() end
  where transaction_id = new.transaction_id and status is distinct from v_status;
  return null;
end $$;

drop trigger if exists transactions_sync_promo_usage on public.transactions;
create trigger transactions_sync_promo_usage
after update of status on public.transactions
for each row when (new.promo_code is not null and old.status is distinct from new.status)
execute function public.transactions_sync_promo_usage();

-- ── 6. Sweeper: free reservations whose hold expired ────────────────────────────
create or replace function public.promo_release_expired_reservations()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  update public.promo_code_usage
  set status = 'released', released_at = now(), reserved_until = null
  where status = 'reserved' and reserved_until < now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;

do $$
begin
  perform cron.unschedule('promo_release_expired_reservations')
  where exists (select 1 from cron.job where jobname = 'promo_release_expired_reservations');
  perform cron.schedule('promo_release_expired_reservations', '* * * * *',
    'select public.promo_release_expired_reservations()');
end $$;

-- ── 7. Lock it down; retire the app-side counter ───────────────────────────────
revoke all on function public.promo_usage_status_for(text) from public, anon, authenticated;
revoke all on function public.promo_reservation_hold(text) from public, anon, authenticated;
revoke all on function public.promo_refresh_usage_count(uuid) from public, anon, authenticated;
revoke all on function public.promo_code_usage_sync_count() from public, anon, authenticated;
revoke all on function public.transactions_redeem_promo() from public, anon, authenticated;
revoke all on function public.transactions_sync_promo_usage() from public, anon, authenticated;
revoke all on function public.promo_release_expired_reservations() from public, anon, authenticated;

-- Resync every cached counter with the live rows.
select public.promo_refresh_usage_count(id) from public.promo_codes;

-- The old "+1 before the order exists" RPC is replaced by the insert trigger. App code deployed before
-- this migration still calls it, so it stays (same signature) but no longer changes anything: it only
-- answers "is there a use left?" from the live rows. Drop it once no deployed code calls it.
create or replace function public.increment_promo_usage(p_promo_id uuid, p_usage_limit integer default null)
returns integer language sql stable set search_path = public as $$
  select live + 1
  from (select p.usage_limit,
               (select count(*) from public.promo_code_usage u where u.promo_code_id = p.id and u.status <> 'released')::integer as live
        from public.promo_codes p where p.id = p_promo_id and p.is_active) s
  where s.usage_limit is null or s.live < s.usage_limit
$$;
revoke all on function public.increment_promo_usage(uuid, integer) from public, anon, authenticated;
grant execute on function public.increment_promo_usage(uuid, integer) to service_role;
