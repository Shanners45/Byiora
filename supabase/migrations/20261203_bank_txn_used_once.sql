-- ============================================================
-- One bank payment can be credited once, anywhere.
-- transactions.bank_txn_id is already unique among storefront orders, but a Fonepay payment
-- credited to a merchant wallet top-up (merchant_topups.bank_txn_id) could also be claimed for a
-- storefront order through the manual "I have paid" form, or the other way round. These triggers
-- refuse to record a bank transaction ID on one side when the other side already has it.
-- Project: tkovigthghwpwbtjikyp
-- ============================================================

create or replace function public.bank_txn_not_credited_to_topup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.bank_txn_id is not null and trim(new.bank_txn_id) <> ''
     and exists (select 1 from public.merchant_topups where bank_txn_id = new.bank_txn_id) then
    raise exception 'BANK_TXN_ALREADY_USED' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.bank_txn_not_credited_to_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.bank_txn_id is not null and trim(new.bank_txn_id) <> ''
     and exists (select 1 from public.transactions where bank_txn_id = new.bank_txn_id) then
    raise exception 'BANK_TXN_ALREADY_USED' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists transactions_bank_txn_used_once on public.transactions;
create trigger transactions_bank_txn_used_once
before insert or update of bank_txn_id on public.transactions
for each row when (new.bank_txn_id is not null)
execute function public.bank_txn_not_credited_to_topup();

drop trigger if exists merchant_topups_bank_txn_used_once on public.merchant_topups;
create trigger merchant_topups_bank_txn_used_once
before insert or update of bank_txn_id on public.merchant_topups
for each row when (new.bank_txn_id is not null)
execute function public.bank_txn_not_credited_to_order();

revoke all on function public.bank_txn_not_credited_to_topup() from public, anon, authenticated;
revoke all on function public.bank_txn_not_credited_to_order() from public, anon, authenticated;

create index if not exists merchant_topups_bank_txn_id_idx on public.merchant_topups (bank_txn_id) where bank_txn_id is not null;
create index if not exists transactions_bank_txn_id_idx on public.transactions (bank_txn_id) where bank_txn_id is not null;
