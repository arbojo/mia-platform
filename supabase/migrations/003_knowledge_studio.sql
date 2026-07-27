-- =============================================
-- KNOWLEDGE STUDIO — Analysis Reports & Suggestions
-- =============================================

-- Analysis reports: stores each analysis run and its results
CREATE TABLE public.knowledge_analysis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'completed', 'failed')),
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  completeness_score INTEGER CHECK (completeness_score >= 0 AND completeness_score <= 100),
  consistency_score INTEGER CHECK (consistency_score >= 0 AND consistency_score <= 100),
  readiness_score INTEGER CHECK (readiness_score >= 0 AND readiness_score <= 100),
  gaps JSONB DEFAULT '[]'::jsonb,
  conflicts JSONB DEFAULT '[]'::jsonb,
  readiness_issues JSONB DEFAULT '[]'::jsonb,
  analysis_model TEXT,
  tokens_used INTEGER DEFAULT 0,
  cost NUMERIC(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_analysis_business ON public.knowledge_analysis_reports(business_id);
CREATE INDEX idx_analysis_status ON public.knowledge_analysis_reports(status);

-- Suggestions: stores individual improvement suggestions from analysis
CREATE TABLE public.knowledge_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.knowledge_analysis_reports(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('missing_knowledge', 'missing_product', 'missing_rule', 'contradiction', 'improvement')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  suggested_category TEXT,
  suggested_question TEXT,
  suggested_answer TEXT,
  suggested_rule_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  knowledge_item_id UUID REFERENCES public.knowledge_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_suggestions_report ON public.knowledge_suggestions(report_id);
CREATE INDEX idx_suggestions_business ON public.knowledge_suggestions(business_id);
CREATE INDEX idx_suggestions_status ON public.knowledge_suggestions(status);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.knowledge_analysis_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_analysis_reports FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_reports"
  ON public.knowledge_analysis_reports FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "users_can_insert_reports"
  ON public.knowledge_analysis_reports FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

ALTER TABLE public.knowledge_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_suggestions FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_suggestions"
  ON public.knowledge_suggestions FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "users_can_insert_suggestions"
  ON public.knowledge_suggestions FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "users_can_update_own_suggestions"
  ON public.knowledge_suggestions FOR UPDATE TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));
