-- =============================================
-- MIA Laboratory — Migration 002
-- =============================================

-- Lab Sessions
CREATE TABLE public.lab_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  assistant_id UUID NOT NULL REFERENCES public.assistants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  mode TEXT NOT NULL CHECK (mode IN ('normal', 'indecisive', 'difficult', 'critical')),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  score INTEGER CHECK (score >= 1 AND score <= 10),
  criteria JSONB DEFAULT '{}'::jsonb,
  strengths TEXT[] DEFAULT '{}',
  weaknesses TEXT[] DEFAULT '{}',
  suggestions TEXT[] DEFAULT '{}',
  evaluation_model TEXT DEFAULT 'gpt-4o-mini',
  message_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  cost DECIMAL(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lab_sessions_business ON public.lab_sessions(business_id);
CREATE INDEX idx_lab_sessions_assistant ON public.lab_sessions(assistant_id);

ALTER TABLE public.lab_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_lab_sessions"
  ON public.lab_sessions FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_insert_lab_sessions"
  ON public.lab_sessions FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_update_own_lab_sessions"
  ON public.lab_sessions FOR UPDATE TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

-- Add request_type to ai_usage
ALTER TABLE public.ai_usage ADD COLUMN request_type TEXT NOT NULL DEFAULT 'training'
  CHECK (request_type IN ('training', 'simulation', 'live_customer'));
