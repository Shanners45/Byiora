-- ============================================================================
-- Migration: 20260910_lockdown_transactions_rls.sql
-- Description: Lock down public.transactions RLS policies to enterprise standard.
-- 
-- 1. DROP transactions_owner_update: Normal users must NEVER update transactions
--    directly from client-side via Supabase PostgREST (all status updates and
--    fulfillments are performed server-side via Service Role in Server Actions/Webhooks).
-- 2. DROP transactions_anon_insert: Normal users must NEVER insert transactions
--    directly from client-side (all orders must go through addTransactionAction
--    which enforces server-side pricing validation, cooldowns, and audit logging).
-- 3. ENSURE transactions_owner_read: Authenticated users can ONLY SELECT rows where
--    user_id = auth.uid().
-- ============================================================================

-- Step 1: Drop client-side UPDATE policy
DROP POLICY IF EXISTS transactions_owner_update ON public.transactions;

-- Step 2: Drop client-side INSERT policy
DROP POLICY IF EXISTS transactions_anon_insert ON public.transactions;

-- Step 3: Ensure read policy is strictly restricted to row owner
DROP POLICY IF EXISTS transactions_owner_read ON public.transactions;
CREATE POLICY transactions_owner_read
ON public.transactions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Step 4: Ensure RLS is active on public.transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
