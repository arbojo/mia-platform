-- =============================================
-- Assistant Lifecycle + Extended Conversation Statuses
-- 
-- Adds status tracking for assistants through
-- Draft → Training → Ready → Active → Inactive
-- and extends conversation statuses.
-- =============================================

-- Assistant status lifecycle
ALTER TABLE public.assistants
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'training', 'ready', 'active', 'inactive'));

-- Existing assistants go to 'training' (they passed onboarding)
UPDATE public.assistants SET status = 'training' WHERE status = 'draft';

-- Extend conversation statuses: add waiting, completed, abandoned
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_status_check;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_status_check
  CHECK (status IN ('active', 'waiting', 'completed', 'abandoned', 'archived'));

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_assistants_status ON public.assistants(status);
