-- ============================================================
-- Seller platform, phase 1: merchants, KYC, audit log - prepared 2026-11-21
-- Project: tkovigthghwpwbtjikyp
-- STATUS: APPLIED 2026-11-21 (as merchants_phase1).
--
-- Additive only (new tables + one private bucket). RLS is on with no policies,
-- so only the service role (server actions behind requireMerchant / admin
-- checks) can read or write. The browser never queries these tables directly.
-- ============================================================

create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 120),
  contact_name text not null check (char_length(contact_name) between 2 and 80),
  email text not null unique check (email = lower(email)),
  phone text,
  -- Admin lifecycle. Feature access also needs onboarding done and kyc_status = 'approved'.
  status text not null default 'active' check (status in ('active', 'suspended', 'banned')),
  status_reason text,
  kyc_status text not null default 'not_submitted'
    check (kyc_status in ('not_submitted', 'submitted', 'more_info', 'rejected', 'approved')),
  must_change_password boolean not null default true,
  email_verified_at timestamptz,
  email_otp_hash text,
  email_otp_expires_at timestamptz,
  email_otp_attempts int not null default 0,
  invited_by uuid references auth.users(id) on delete set null,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per KYC attempt; files are never overwritten, a resubmission is a new version.
create table public.merchant_kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  version int not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'more_info')),
  legal_name text not null,
  business_type text not null,
  pan_number text not null,
  registration_number text,
  address text not null,
  website text,
  -- [{ "type": "pan_certificate", "path": "<merchant_id>/v1/...", "mime": "application/pdf", "size": 12345 }]
  documents jsonb not null default '[]'::jsonb,
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (merchant_id, version)
);
create index merchant_kyc_pending_idx on public.merchant_kyc_submissions (created_at) where status = 'pending';

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_type text not null check (actor_type in ('admin', 'merchant', 'system')),
  actor_id uuid,
  merchant_id uuid references public.merchants(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index audit_log_merchant_idx on public.audit_log (merchant_id, created_at desc);

alter table public.merchants enable row level security;
alter table public.merchant_kyc_submissions enable row level security;
alter table public.audit_log enable row level security;
revoke all on public.merchants, public.merchant_kyc_submissions, public.audit_log from anon, authenticated;

-- Private KYC bucket: the storage layer itself enforces the 5 MB cap and file types.
-- Uploads go through server-issued signed upload URLs; reads through 60 s signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('merchant-kyc', 'merchant-kyc', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
