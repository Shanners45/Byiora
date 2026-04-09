-- ============================================================================
-- BYIORA RLS POLICIES - SAFE IMPLEMENTATION
-- ============================================================================
-- This script enables Row Level Security (RLS) on all tables while maintaining
-- application functionality through strategic policy design.
--
-- ARCHITECTURAL PRINCIPLES:
-- 1. Admin operations use Service Role key (bypasses RLS entirely)
-- 2. Guest checkout allows anon INSERT on transactions
-- 3. Registered users can only access their own data
-- 4. Public reads allowed for product catalog
-- ============================================================================

-- ============================================================================
-- STEP 1: ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: DROP ALL EXISTING POLICIES (clean slate)
-- ============================================================================

-- Products table policies
DROP POLICY IF EXISTS "products_select_all" ON products;
DROP POLICY IF EXISTS "products_admin_all" ON products;
DROP POLICY IF EXISTS "products_public_read" ON products;

-- Transactions table policies
DROP POLICY IF EXISTS "transactions_owner_read" ON transactions;
DROP POLICY IF EXISTS "transactions_admin_all" ON transactions;
DROP POLICY IF EXISTS "transactions_anon_insert" ON transactions;
DROP POLICY IF EXISTS "transactions_guest_read" ON transactions;

-- Users table policies
DROP POLICY IF EXISTS "users_owner_read" ON users;
DROP POLICY IF EXISTS "users_owner_update" ON users;
DROP POLICY IF EXISTS "users_admin_all" ON users;
DROP POLICY IF EXISTS "users_insert_self" ON users;

-- Admin users table policies
DROP POLICY IF EXISTS "admin_users_admin_all" ON admin_users;
DROP POLICY IF EXISTS "admin_users_service_role" ON admin_users;

-- Banners table policies
DROP POLICY IF EXISTS "banners_public_read" ON banners;
DROP POLICY IF EXISTS "banners_admin_all" ON banners;

-- Homepage categories policies
DROP POLICY IF EXISTS "homepage_categories_public_read" ON homepage_categories;
DROP POLICY IF EXISTS "homepage_categories_admin_all" ON homepage_categories;

-- Notifications table policies
DROP POLICY IF EXISTS "notifications_owner_read" ON notifications;
DROP POLICY IF EXISTS "notifications_owner_update" ON notifications;
DROP POLICY IF EXISTS "notifications_admin_insert" ON notifications;
DROP POLICY IF EXISTS "notifications_broadcast" ON notifications;

-- ============================================================================
-- STEP 3: CREATE POLICIES FOR PRODUCTS TABLE
-- ============================================================================
-- Public can view active products, but only admins can modify (via Service Role)

CREATE POLICY "products_public_read"
ON products
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Note: Admin operations (INSERT/UPDATE/DELETE) are handled via Service Role key
-- which bypasses RLS entirely. No policy needed for admin modifications.

-- ============================================================================
-- STEP 4: CREATE POLICIES FOR TRANSACTIONS TABLE
-- ============================================================================
-- CRITICAL: Guest checkout support + registered user isolation

-- Allow anonymous/guest users to INSERT new transactions (for guest checkout)
CREATE POLICY "transactions_anon_insert"
ON transactions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow registered users to view their own transactions
CREATE POLICY "transactions_owner_read"
ON transactions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow guests to view transactions by transaction_id (for receipt lookup)
-- This uses a separate server action with Service Role for security
-- Note: Guest receipt reads are handled via Service Role server action

-- Allow users to update their own transactions (if needed)
CREATE POLICY "transactions_owner_update"
ON transactions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Note: Admin operations (status updates, etc.) are handled via Service Role key

-- ============================================================================
-- STEP 5: CREATE POLICIES FOR USERS TABLE
-- ============================================================================

-- Allow users to view their own profile
CREATE POLICY "users_owner_read"
ON users
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Allow users to update their own profile
CREATE POLICY "users_owner_update"
ON users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Allow new user registration (insert their own record)
CREATE POLICY "users_insert_self"
ON users
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Note: Admin operations on users are handled via Service Role key

-- ============================================================================
-- STEP 6: CREATE POLICIES FOR ADMIN_USERS TABLE
-- ============================================================================
-- Admin table is locked down - all access via Service Role only

-- No policies needed - all operations via Service Role key
-- This ensures only server-side admin actions can access this table

-- ============================================================================
-- STEP 7: CREATE POLICIES FOR BANNERS TABLE
-- ============================================================================

-- Public can view active banners
CREATE POLICY "banners_public_read"
ON banners
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Note: Admin operations handled via Service Role key

-- ============================================================================
-- STEP 8: CREATE POLICIES FOR HOMEPAGE_CATEGORIES TABLE
-- ============================================================================

-- Public can view active categories
CREATE POLICY "homepage_categories_public_read"
ON homepage_categories
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Note: Admin operations handled via Service Role key

-- ============================================================================
-- STEP 9: CREATE POLICIES FOR NOTIFICATIONS TABLE
-- ============================================================================

-- Users can view their own notifications OR broadcast notifications (user_id IS NULL)
CREATE POLICY "notifications_owner_read"
ON notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL);

-- Users can mark their own notifications as read
CREATE POLICY "notifications_owner_update"
ON notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Note: Admin insert operations (sending notifications) handled via Service Role key

-- ============================================================================
-- STEP 10: FORCE RLS FOR TABLE OWNERS (bypass disabled)
-- ============================================================================
-- This ensures even the table owner (postgres) must use policies
-- Admin operations MUST go through Service Role key

ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE admin_users FORCE ROW LEVEL SECURITY;
ALTER TABLE banners FORCE ROW LEVEL SECURITY;
ALTER TABLE homepage_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION QUERIES (run these to verify policies are correct)
-- ============================================================================

-- List all policies on each table
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- Check RLS status on tables
-- SELECT relname, relrowsecurity, relforcerowsecurity
-- FROM pg_class
-- WHERE relname IN ('products', 'transactions', 'users', 'admin_users', 'banners', 'homepage_categories', 'notifications');
