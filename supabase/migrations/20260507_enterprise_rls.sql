-- Enterprise-grade RLS and integrity hardening
-- Apply via Supabase SQL editor or migration runner.

-- ==============
-- Core tables
-- ==============

ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.homepage_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.products FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_users FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.banners FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.homepage_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications FORCE ROW LEVEL SECURITY;

-- Clean slate (idempotent)
DO $$
BEGIN
  -- products
  EXECUTE 'DROP POLICY IF EXISTS products_public_read ON public.products';

  -- transactions
  EXECUTE 'DROP POLICY IF EXISTS transactions_anon_insert ON public.transactions';
  EXECUTE 'DROP POLICY IF EXISTS transactions_owner_read ON public.transactions';
  EXECUTE 'DROP POLICY IF EXISTS transactions_owner_update ON public.transactions';

  -- users
  EXECUTE 'DROP POLICY IF EXISTS users_owner_read ON public.users';
  EXECUTE 'DROP POLICY IF EXISTS users_owner_update ON public.users';
  EXECUTE 'DROP POLICY IF EXISTS users_insert_self ON public.users';

  -- admin_users
  EXECUTE 'DROP POLICY IF EXISTS admin_users_self_read ON public.admin_users';

  -- banners
  EXECUTE 'DROP POLICY IF EXISTS banners_public_read ON public.banners';

  -- homepage_categories
  EXECUTE 'DROP POLICY IF EXISTS homepage_categories_public_read ON public.homepage_categories';

  -- notifications
  EXECUTE 'DROP POLICY IF EXISTS notifications_owner_read ON public.notifications';
  EXECUTE 'DROP POLICY IF EXISTS notifications_owner_update ON public.notifications';
END $$;

-- Public catalog read (active only)
CREATE POLICY products_public_read
ON public.products
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Users table: self only
CREATE POLICY users_owner_read
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY users_owner_update
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY users_insert_self
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Admin users: allow self-read only (enables safe `exists(...)` checks)
CREATE POLICY admin_users_self_read
ON public.admin_users
FOR SELECT
TO authenticated
USING (id = auth.uid() AND status = 'active');

-- Transactions: guest checkout + strict invariants
ALTER TABLE IF EXISTS public.transactions
  ALTER COLUMN status SET DEFAULT 'Processing';

-- Ensure status values are constrained
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_status_check'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_status_check
      CHECK (status IN ('Completed','Failed','Processing','Cancelled'));
  END IF;
END $$;

-- Ensure transaction_id uniqueness
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_transaction_id_unique'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_transaction_id_unique UNIQUE (transaction_id);
  END IF;
END $$;

-- Allow anon+auth to INSERT, but prevent privileged fields from being set client-side
-- (server-side service role can still write anything).
CREATE POLICY transactions_anon_insert
ON public.transactions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'Processing'
  AND giftcard_code IS NULL
  AND failure_remarks IS NULL
  AND encrypted_checkout_data IS NULL
  AND (user_id IS NULL OR user_id = auth.uid())
);

-- Owners can read their transactions
CREATE POLICY transactions_owner_read
ON public.transactions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Owners cannot update status/giftcard fields safely at column-level; keep updates limited to their rows.
-- Application code should avoid exposing this broadly.
CREATE POLICY transactions_owner_update
ON public.transactions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Banners + homepage categories public read (active only)
CREATE POLICY banners_public_read
ON public.banners
FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE POLICY homepage_categories_public_read
ON public.homepage_categories
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Notifications: user can read own + broadcast, update only own
CREATE POLICY notifications_owner_read
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY notifications_owner_update
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ==============
-- Storage hardening (bucket: product-images)
-- ==============
-- Public read for product assets, admin-only writes.
-- Requires the `admin_users_self_read` policy above for `exists(...)` checks.

DO $$
BEGIN
  -- Read
  EXECUTE 'DROP POLICY IF EXISTS product_images_public_read ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS product_images_admin_insert ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS product_images_admin_update ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS product_images_admin_delete ON storage.objects';
END $$;

CREATE POLICY product_images_public_read
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');

CREATE POLICY product_images_admin_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.id = auth.uid()
      AND au.status = 'active'
  )
);

CREATE POLICY product_images_admin_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.id = auth.uid()
      AND au.status = 'active'
  )
)
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.id = auth.uid()
      AND au.status = 'active'
  )
);

CREATE POLICY product_images_admin_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.id = auth.uid()
      AND au.status = 'active'
  )
);

