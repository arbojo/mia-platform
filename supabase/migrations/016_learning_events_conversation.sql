-- =============================================
-- MIA Learning Loop — Migration 016
-- Link learning_events to conversations so corrections
-- can be recorded without depending on client-generated
-- message ids that never exist in public.messages.
-- =============================================

ALTER TABLE public.learning_events
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_learning_events_conversation
  ON public.learning_events(conversation_id);
