-- =============================================
-- MIA Readiness Index — Migration 006
-- =============================================

-- Historical readiness snapshots
CREATE TABLE public.readiness_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  preparation INTEGER NOT NULL CHECK (preparation >= 0 AND preparation <= 100),
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  performance INTEGER CHECK (performance >= 0 AND performance <= 100),
  overall INTEGER NOT NULL CHECK (overall >= 0 AND overall <= 100),
  metadata JSONB DEFAULT '{}'::jsonb,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_readiness_business_date
  ON public.readiness_snapshots(business_id, calculated_at DESC);

ALTER TABLE public.readiness_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readiness_snapshots FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_readiness"
  ON public.readiness_snapshots FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_insert_readiness"
  ON public.readiness_snapshots FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));
