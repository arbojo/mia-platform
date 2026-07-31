-- =============================================
-- MIA - Sprint 4 MVP: Continuous Sales Improvement
-- Extends knowledge_suggestions for coaching lifecycle
-- =============================================

-- 1. Make report_id nullable for standalone coaching recommendations
ALTER TABLE public.knowledge_suggestions ALTER COLUMN report_id DROP NOT NULL;

-- 2. Add suggestion_type to separate coaching from knowledge studio
ALTER TABLE public.knowledge_suggestions
  ADD COLUMN suggestion_type TEXT CHECK (suggestion_type IN ('coaching', 'success_pattern'));

-- 3. Coaching lifecycle state machine
ALTER TABLE public.knowledge_suggestions
  ADD COLUMN lifecycle_state TEXT DEFAULT 'draft'
    CHECK (lifecycle_state IN ('draft','active','accepted','practiced','applied','verified','completed','archived'));

-- 4. Structured recommendation fields
ALTER TABLE public.knowledge_suggestions ADD COLUMN observation TEXT;
ALTER TABLE public.knowledge_suggestions ADD COLUMN suggested_improvement TEXT;
ALTER TABLE public.knowledge_suggestions ADD COLUMN recommended_practice TEXT;
ALTER TABLE public.knowledge_suggestions ADD COLUMN behavior_key TEXT;

-- 5. Tracking fields
ALTER TABLE public.knowledge_suggestions ADD COLUMN applied_at TIMESTAMPTZ;
ALTER TABLE public.knowledge_suggestions ADD COLUMN rejection_reason TEXT;

-- 6. Index for active recommendation lookup
CREATE INDEX idx_suggestions_coaching_active
  ON public.knowledge_suggestions(business_id, lifecycle_state)
  WHERE suggestion_type = 'coaching' AND lifecycle_state = 'active';
