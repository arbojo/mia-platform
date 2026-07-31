-- =============================================
-- MIA - Safety Layer: Post-generation validation
-- Extends knowledge_suggestions for safety events
-- Adds channel_messages dedup index
-- =============================================

-- 1. Extend suggestion_type CHECK to include 'safety'
ALTER TABLE public.knowledge_suggestions DROP CONSTRAINT IF EXISTS knowledge_suggestions_suggestion_type_check;
ALTER TABLE public.knowledge_suggestions
  ADD CONSTRAINT knowledge_suggestions_suggestion_type_check
  CHECK (suggestion_type IN ('coaching', 'success_pattern', 'safety'));

-- 2. Dedup index for channel_messages (prevent double-send)
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_messages_dedup
  ON public.channel_messages(business_id, external_id, channel)
  WHERE external_id IS NOT NULL;
