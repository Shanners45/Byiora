-- ============================================================
-- Merchant SKUs: each merchant can give any product amount their own code and
-- display name, then order by that code instead of our product/amount text.
-- Project: tkovigthghwpwbtjikyp
-- STATUS: APPLIED 2026-11-22 (as merchant_skus).
-- ============================================================

create table public.merchant_skus (
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  sku text not null check (sku ~ '^[A-Za-z0-9._-]{1,64}$'),
  product_id text not null,
  denomination_label text not null,
  display_name text check (char_length(display_name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (merchant_id, sku),
  unique (merchant_id, product_id, denomination_label)
);
alter table public.merchant_skus enable row level security;
revoke all on public.merchant_skus from anon, authenticated;

-- The SKU and name the merchant used, kept on the order for their records.
alter table public.merchant_orders add column merchant_sku text, add column merchant_display_name text;
