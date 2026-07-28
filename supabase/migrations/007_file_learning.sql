-- =============================================
-- MIA File Learning — Migration 007
-- =============================================

-- Learning Reports: stores extraction results before user approval
CREATE TABLE public.learning_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed')),

  -- Summary stats (what MIA learned)
  products_found INTEGER DEFAULT 0,
  knowledge_found INTEGER DEFAULT 0,
  rules_found INTEGER DEFAULT 0,
  prices_found INTEGER DEFAULT 0,
  benefits_found INTEGER DEFAULT 0,
  faqs_found INTEGER DEFAULT 0,
  promotions_found INTEGER DEFAULT 0,
  missing_fields JSONB DEFAULT '[]'::jsonb,

  -- AI-extracted data
  extracted_products JSONB DEFAULT '[]'::jsonb,
  extracted_knowledge JSONB DEFAULT '[]'::jsonb,
  extracted_rules JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  files_processed JSONB DEFAULT '[]'::jsonb,
  preparation_before INTEGER,
  preparation_after INTEGER,
  analysis_model TEXT DEFAULT 'gpt-4o-mini',
  tokens_used INTEGER DEFAULT 0,
  cost DECIMAL(10,6) DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_learning_reports_business
  ON public.learning_reports(business_id, created_at DESC);

ALTER TABLE public.learning_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_reports FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_reports"
  ON public.learning_reports FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_insert_reports"
  ON public.learning_reports FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_update_own_reports"
  ON public.learning_reports FOR UPDATE TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));
