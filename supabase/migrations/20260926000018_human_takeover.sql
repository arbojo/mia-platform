-- =============================================
-- 018 Human Takeover (per-conversation AI pause)
--
-- When a business-side human replies in a conversation, MIA must go silent in
-- that conversation only (not the whole channel) until a resume command is
-- sent from the business phone. A timestamp is used instead of `status`
-- because resolveConversation keys the active thread on status='active':
-- reusing status would fork a new conversation instead of pausing the thread.
--
-- ai_paused_at IS NULL  -> MIA active
-- ai_paused_at NOT NULL -> MIA paused in this conversation since that instant
-- =============================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS ai_paused_at TIMESTAMPTZ;

COMMENT ON COLUMN public.conversations.ai_paused_at IS
  'Set when a business-side human takes over; MIA stays silent for this conversation until it is cleared by the resume command. NULL means MIA is active.';
