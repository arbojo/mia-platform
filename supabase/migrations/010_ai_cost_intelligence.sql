-- =============================================
-- MIA - AI Cost & Usage Intelligence
-- Extends ai_usage with richer tracking fields
-- =============================================

-- Widen request_type CHECK to include new values
ALTER TABLE public.ai_usage DROP CONSTRAINT IF EXISTS ai_usage_request_type_check;

-- Make assistant_id nullable for demo/onboarding/background usage
ALTER TABLE public.ai_usage ALTER COLUMN assistant_id DROP NOT NULL;

-- Add new tracking columns
ALTER TABLE public.ai_usage
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Re-add CHECK with wider set (NOT VALID to avoid issues with existing data)
ALTER TABLE public.ai_usage ADD CONSTRAINT ai_usage_request_type_check
  CHECK (request_type IN ('training', 'simulation', 'live_customer', 'demo', 'onboarding', 'evaluation', 'memory_analysis', 'report_generation', 'extraction'))
  NOT VALID;

-- Add indexes for new query patterns
CREATE INDEX IF NOT EXISTS idx_ai_usage_source ON public.ai_usage(source);
CREATE INDEX IF NOT EXISTS idx_ai_usage_conversation ON public.ai_usage(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_customer ON public.ai_usage(customer_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_status ON public.ai_usage(status);
CREATE INDEX IF NOT EXISTS idx_ai_usage_source_date ON public.ai_usage(source, created_at);
