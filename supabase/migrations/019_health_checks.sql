-- =============================================
-- 019: Motor de salud persistente (No Pass No Commit)
--
-- Registra cada ejecución del health-check del sistema:
-- conectividad/latencia de Supabase, tokens Google Auth,
-- persistencia de chat (write/read round-trip) e indexación Vitanova.
-- El reporte se muestra en /dashboard/health con el origen de la
-- falla y la ruta de solución; los scripts npm run doctor y
-- npm run environment-check bloquean (exit != 0) si algo falla.
-- =============================================

CREATE TABLE IF NOT EXISTS public.health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'system'
    CHECK (scope IN ('system', 'dashboard', 'precommit')),
  status TEXT NOT NULL DEFAULT 'passed'
    CHECK (status IN ('passed', 'warning', 'failed')),
  checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT NOT NULL DEFAULT '',
  latency_ms INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'dashboard', 'precommit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_checks_business_created
  ON public.health_checks(business_id, created_at DESC);

-- RLS: el owner del business ve (y solo el sistema inserta vía admin).
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS health_checks_select_own ON public.health_checks;
CREATE POLICY health_checks_select_own
  ON public.health_checks
  FOR SELECT
  USING (
    business_id IS NULL
    OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );
