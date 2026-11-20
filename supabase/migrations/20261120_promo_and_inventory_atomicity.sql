-- ============================================================
-- Promo + inventory atomicity - prepared 2026-11-20
-- Project: tkovigthghwpwbtjikyp
-- STATUS: APPLIED 2026-11-20 (as promo_and_inventory_atomicity).
-- ============================================================

begin;

-- 1) Increment + cap check in one statement (no lost updates).
-- p_usage_limit is accepted for the caller's signature but the row's own
-- usage_limit is authoritative. Returns NULL when inactive or exhausted.
create or replace function public.increment_promo_usage(p_promo_id uuid, p_usage_limit integer default null)
returns integer
language sql
security invoker
set search_path = public
as $$
  update public.promo_codes
  set usage_count = usage_count + 1,
      updated_at = now()
  where id = p_promo_id
    and is_active = true
    and (usage_limit is null or usage_count < usage_limit)
  returning usage_count;
$$;

revoke all on function public.increment_promo_usage(uuid, integer) from public, anon, authenticated;
grant execute on function public.increment_promo_usage(uuid, integer) to service_role;

-- 2) One inventory allocation per order: a retried or racing fulfillment
-- for the same transaction gets back the code already delivered instead of
-- claiming a second one.
create or replace function public.claim_gift_card(p_product_id text, p_denomination_label text, p_transaction_id text, p_user_id text)
returns table(encrypted_code text)
language plpgsql
security invoker
set search_path = public
as $function$
begin
  -- Serialise concurrent claims for the same order.
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
    order by created_at asc
    limit 1
    for update skip locked
  )
  returning gift_card_inventory.encrypted_code;
end;
$function$;

revoke all on function public.claim_gift_card(text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_gift_card(text, text, text, text) to service_role;

commit;
