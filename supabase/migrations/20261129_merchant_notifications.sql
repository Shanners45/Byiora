-- ============================================================
-- Merchant notifications: admin messages to every merchant (merchant_id null) or to one.
-- Project: tkovigthghwpwbtjikyp
-- STATUS: APPLIED 2026-11-22 (as merchant_notifications).
-- ============================================================

create table if not exists public.merchant_notifications (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade, -- null = all merchants
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  emailed boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists merchant_notifications_merchant_idx on public.merchant_notifications (merchant_id, created_at desc);
create index if not exists merchant_notifications_created_idx on public.merchant_notifications (created_at desc);
alter table public.merchant_notifications enable row level security;
revoke all on public.merchant_notifications from anon, authenticated;

-- Everything newer than this is unread (null = nothing read yet).
alter table public.merchants add column if not exists notifications_seen_at timestamptz;
