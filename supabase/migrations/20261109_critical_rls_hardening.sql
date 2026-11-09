-- ============================================================
-- Critical RLS hardening - 2026-11-09
-- ============================================================
-- Applied live as migration version 20261109084409
-- (name: critical_rls_hardening_20261109) on project tkovigthghwpwbtjikyp.
-- This file mirrors the exact statements executed in production.
-- ============================================================

-- 1) Secret tables: service-role only -------------------------
alter table public.promo_codes enable row level security;
alter table public.promo_codes force row level security;
revoke all on table public.promo_codes from anon, authenticated;

alter table public.promo_code_usage enable row level security;
alter table public.promo_code_usage force row level security;
revoke all on table public.promo_code_usage from anon, authenticated;

alter table public.payment_credentials enable row level security;
alter table public.payment_credentials force row level security;
revoke all on table public.payment_credentials from anon, authenticated;

alter table public.site_config enable row level security;
alter table public.site_config force row level security;
revoke all on table public.site_config from anon, authenticated;

alter table public.gift_card_inventory enable row level security;
alter table public.gift_card_inventory force row level security;
revoke all on table public.gift_card_inventory from anon, authenticated;

-- payment_settings had a public SELECT policy USING (true) - lock it down
alter table public.payment_settings enable row level security;
alter table public.payment_settings force row level security;
revoke all on table public.payment_settings from anon, authenticated;
do $$
declare r record;
begin
  for r in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'payment_settings'
  loop
    execute format('drop policy if exists %I on public.payment_settings', r.policyname);
  end loop;
end $$;

-- 2) admin_users: stop full-table read (password_hash leak) and role escalation
--    Drop every policy except the self-read one.
do $$
declare r record;
begin
  for r in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'admin_users'
              and policyname <> 'admin_users_self_read'
  loop
    execute format('drop policy if exists %I on public.admin_users', r.policyname);
  end loop;
end $$;

-- Writes to admin_users are service-role + verifySuperAdmin only (server actions).
revoke insert, update, delete, truncate, references, trigger
  on table public.admin_users from anon, authenticated;
-- SELECT stays granted so policy subqueries referencing admin_users remain valid;
-- with only admin_users_self_read left, anon sees nothing and an admin sees only their own row.

-- 3) Public content tables: keep reads, block client-side writes
revoke insert, update, delete, truncate, references, trigger
  on table public.banners from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.homepage_categories from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.store_announcements from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.payment_methods from anon, authenticated;

-- 4) Activity heartbeat column for the admin dashboard
 alter table public.users add column if not exists last_active_at timestamptz;
create index if not exists idx_users_last_active_at on public.users (last_active_at desc);
