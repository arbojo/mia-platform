-- =============================================
-- Customer Memory Column
-- Adds memory JSONB to store extracted customer
-- preferences, interests, and objections.
-- =============================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS memory JSONB DEFAULT '{}'::jsonb;
