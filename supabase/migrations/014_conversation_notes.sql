-- =============================================
-- Conversation Notes
-- Adds notes column for sales team annotations.
-- =============================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS notes TEXT;
