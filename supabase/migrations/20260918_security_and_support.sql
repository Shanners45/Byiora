-- ============================================================================
-- Migration: 20260918_security_and_support.sql
-- Description: Create banned_entities and support_tickets tables with RLS policies.
-- ============================================================================

-- 1. Create Banned Entities Table
CREATE TABLE IF NOT EXISTS public.banned_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('email', 'ip', 'email_domain', 'device_id')),
  value TEXT NOT NULL,
  reason TEXT,
  banned_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE(type, value)
);

CREATE INDEX IF NOT EXISTS idx_banned_entities_type_value ON public.banned_entities(type, value);

-- 2. Create Support Tickets Table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'replied', 'resolved', 'closed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  replied_at TIMESTAMPTZ,
  last_reply TEXT,
  last_reply_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_email ON public.support_tickets(email);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.banned_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- 4. Service Role Policies (Server Actions execute via service role)
DROP POLICY IF EXISTS "Service role full access on banned_entities" ON public.banned_entities;
CREATE POLICY "Service role full access on banned_entities" ON public.banned_entities
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on support_tickets" ON public.support_tickets;
CREATE POLICY "Service role full access on support_tickets" ON public.support_tickets
  FOR ALL USING (auth.role() = 'service_role');

