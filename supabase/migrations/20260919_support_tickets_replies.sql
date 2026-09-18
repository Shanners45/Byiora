-- ============================================================================
-- Migration: 20260919_support_tickets_replies.sql
-- Description: Add replies JSONB column to support_tickets for full thread history.
-- ============================================================================

ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS replies JSONB DEFAULT '[]'::jsonb;

-- Backfill any existing single last_reply into the replies array
UPDATE public.support_tickets 
SET replies = jsonb_build_array(
  jsonb_build_object(
    'reply', last_reply,
    'reply_by', COALESCE(last_reply_by, 'Byiora Support'),
    'replied_at', COALESCE(replied_at, now())
  )
)
WHERE last_reply IS NOT NULL AND (replies IS NULL OR replies = '[]'::jsonb);
