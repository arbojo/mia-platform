-- Migration 003: Add correction_type to learning_events
-- Sprint 7: Memory, Learning and Continuous Improvement

-- Add correction_type column to distinguish between different types of corrections
ALTER TABLE public.learning_events 
  ADD COLUMN correction_type TEXT CHECK (correction_type IN ('knowledge', 'rule', 'instruction'));

-- Populate correction_type for existing events based on knowledge_item_id presence
-- If it has a knowledge_item_id, it's a knowledge correction
UPDATE public.learning_events 
SET correction_type = 'knowledge' 
WHERE correction_type IS NULL AND knowledge_item_id IS NOT NULL;

-- For events without knowledge_item_id, default to 'knowledge' as it was the original behavior
UPDATE public.learning_events 
SET correction_type = 'knowledge' 
WHERE correction_type IS NULL;

-- Make correction_type NOT NULL after populating existing records
ALTER TABLE public.learning_events 
  ALTER COLUMN correction_type SET NOT NULL;

-- Add index for efficient querying of recent lessons
CREATE INDEX IF NOT EXISTS idx_learning_events_correction_type 
  ON public.learning_events(correction_type);

-- Add index for efficient querying of approved/modified lessons
CREATE INDEX IF NOT EXISTS idx_learning_events_status_created 
  ON public.learning_events(status, created_at DESC);
