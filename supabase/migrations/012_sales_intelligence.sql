-- =============================================
-- MIA - Sales Intelligence
-- Sprint 3: Conversation outcomes, deal values,
--          customer pipeline automation
-- =============================================

-- =============================================
-- 1. CONVERSATIONS: Add outcome tracking
-- =============================================
ALTER TABLE public.conversations
  ADD COLUMN outcome TEXT
    CHECK (outcome IN ('pending', 'interested', 'not_interested', 'sold', 'needs_follow_up'));

ALTER TABLE public.conversations
  ADD COLUMN deal_value DECIMAL(10,2);

ALTER TABLE public.conversations
  ADD COLUMN potential_value DECIMAL(10,2);

ALTER TABLE public.conversations
  ADD COLUMN outcome_updated_at TIMESTAMPTZ;

ALTER TABLE public.conversations
  ADD COLUMN outcome_history JSONB DEFAULT '[]'::jsonb;

CREATE INDEX idx_conversations_outcome
  ON public.conversations(assistant_id, outcome)
  WHERE outcome IS NOT NULL;

-- =============================================
-- 2. RLS: Add UPDATE policy for conversations
--    (currently only SELECT and INSERT exist)
-- =============================================
CREATE POLICY "users_can_update_own_conversations"
  ON public.conversations FOR UPDATE TO authenticated
  USING (assistant_id IN (
    SELECT id FROM public.assistants
    WHERE business_id IN (SELECT public.get_user_business_ids())
  ));
