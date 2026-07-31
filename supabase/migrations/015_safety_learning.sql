-- 015_safety_learning.sql
-- Safety Events raw log + Learning Analyzer support

-- 1. Raw safety events table (separada de knowledge_suggestions)
CREATE TABLE public.safety_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  assistant_id UUID REFERENCES public.assistants(id) ON DELETE SET NULL,
  original_response TEXT NOT NULL,
  corrected_response TEXT,
  triggers JSONB NOT NULL DEFAULT '[]',
  trigger_types TEXT[] NOT NULL DEFAULT '{}',
  outcome TEXT NOT NULL CHECK (outcome IN ('passed','blocked_with_retry','pending_ai','error')),
  context_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_safety_events_business_created ON public.safety_events(business_id, created_at DESC);
CREATE INDEX idx_safety_events_outcome ON public.safety_events(outcome);
CREATE INDEX idx_safety_events_trigger_types ON public.safety_events USING GIN(trigger_types);
CREATE INDEX idx_safety_events_weekly ON public.safety_events(business_id, created_at) WHERE created_at >= now() - interval '7 days';

ALTER TABLE public.safety_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_admin_select_safety_events"
  ON public.safety_events FOR SELECT
  USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "service_role_insert_safety_events"
  ON public.safety_events FOR INSERT
  WITH CHECK (true);

-- 2. Extender knowledge_suggestions.suggestion_type para incluir safety (idempotente)
ALTER TABLE public.knowledge_suggestions
  DROP CONSTRAINT IF EXISTS knowledge_suggestions_suggestion_type_check;

ALTER TABLE public.knowledge_suggestions
  ADD CONSTRAINT knowledge_suggestions_suggestion_type_check
  CHECK (suggestion_type IN ('coaching','success_pattern','safety'));
