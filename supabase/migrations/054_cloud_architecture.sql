-- =============================================
-- 054: MIA Cloud Architecture — tenant deployment + lifecycle status
-- ADR-027 §3.3, §10.1 — Model A (managed) default for cloud edition
-- =============================================

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS deployment_model TEXT NOT NULL DEFAULT 'self-hosted'
    CHECK (deployment_model IN ('self-hosted', 'managed', 'dedicated'));

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'deleted'));

COMMENT ON COLUMN public.businesses.deployment_model IS
  'Infrastructure topology: self-hosted (enterprise), managed (cloud shared), dedicated (enterprise isolated). Server-side only.';

COMMENT ON COLUMN public.businesses.status IS
  'Tenant lifecycle: active, suspended (RLS blocks access), deleted (cascade pending). Platform Admin managed.';

-- Cloud edition tenants default to managed deployment (Model A)
UPDATE public.businesses
SET deployment_model = 'managed'
WHERE edition = 'cloud'
  AND deployment_model = 'self-hosted';

CREATE INDEX IF NOT EXISTS idx_businesses_deployment_model ON public.businesses(deployment_model);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON public.businesses(status);
