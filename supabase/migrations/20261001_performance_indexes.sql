-- ============================================================================
-- Migration: 20261001_performance_indexes.sql
-- Description: High-performance composite and partial indexes for high-frequency
-- queries across transactions, promo codes, and user audit tables.
-- ============================================================================

-- 1. Transactions Indexes
-- High-frequency sorting and filtering in Admin Orders and Customer Dashboard
CREATE INDEX IF NOT EXISTS idx_transactions_created_at_desc
ON public.transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_status_created
ON public.transactions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id
ON public.transactions(user_id)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_email
ON public.transactions(user_email);

-- Partial index for fast bank transaction verification and duplicate detection
CREATE INDEX IF NOT EXISTS idx_transactions_bank_txn_id
ON public.transactions(bank_txn_id)
WHERE bank_txn_id IS NOT NULL;

-- 2. Promo Code Usage Indexes
-- Accelerate validation checks during high-concurrency checkout
CREATE INDEX IF NOT EXISTS idx_promo_usage_code_email
ON public.promo_code_usage(promo_code_id, user_email);

CREATE INDEX IF NOT EXISTS idx_promo_usage_code_device
ON public.promo_code_usage(promo_code_id, device_id)
WHERE device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promo_usage_transaction_id
ON public.promo_code_usage(transaction_id);

CREATE INDEX IF NOT EXISTS idx_promo_usage_status
ON public.promo_code_usage(status);

-- 3. Notifications Indexes
-- Accelerate user notification feed queries and unread count queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
ON public.notifications(user_id, created_at DESC);
