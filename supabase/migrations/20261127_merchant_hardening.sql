-- ============================================================
-- Merchant platform hardening after the security/performance review.
-- Project: tkovigthghwpwbtjikyp
-- STATUS: APPLIED 2026-11-22 (as merchant_hardening).
-- ============================================================

create index if not exists merchant_kyc_submissions_reviewed_by_idx on public.merchant_kyc_submissions (reviewed_by);
create index if not exists merchants_invited_by_idx on public.merchants (invited_by);

-- Order totals in one query instead of loading every order into the app.
create or replace function public.merchant_order_totals(p_merchant_id uuid)
returns table (orders bigint, spend_paisa bigint, codes bigint, refunded bigint, refunded_paisa bigint)
language sql stable security definer set search_path = public as $$
  select count(*) filter (where status = 'completed'),
    coalesce(sum(total_paisa) filter (where status = 'completed'), 0)::bigint,
    coalesce(sum(quantity) filter (where status = 'completed'), 0)::bigint,
    count(*) filter (where status = 'refunded'),
    coalesce(sum(total_paisa) filter (where status = 'refunded'), 0)::bigint
  from public.merchant_orders where merchant_id = p_merchant_id and not is_test
$$;
revoke all on function public.merchant_order_totals(uuid) from public, anon, authenticated;

-- One bank reference can only be claimed once across all merchants' manual top-ups.
create unique index if not exists merchant_topups_manual_ref_idx on public.merchant_topups (lower(trim(reference))) where provider = 'manual' and status in ('pending', 'approved');
