-- =============================================
-- 037: Edición por negocio (tenant) - columna edition en businesses
--
-- Habilita capacidades "premier" por NEGOCIO (tenant), no por persona:
--   edition NULL      = usar MIA_EDITION global (fallback; default evaluation)
--   edition definida  = capacidades de esa edición para ese negocio
--
-- Vitanova (primer cliente / live test) recibe 'enterprise' para que su
-- owner vea la interfaz completa (WhatsApp, delivery, inventario) sin
-- exponer features premium a leads demo ni a negocios sin edición.
--
-- Un perfil/correo nuevo recibe su propio business auto-provisionado
-- (migración 018) con edition NULL -> queda gateado por el env global.
-- Las atribuciones pertenecen al tenant, nunca a la identidad.
-- =============================================

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS edition TEXT
  CHECK (edition IS NULL OR edition IN ('evaluation', 'professional', 'enterprise', 'cloud'));

COMMENT ON COLUMN public.businesses.edition IS
  'Edición efectiva del negocio (tenant). NULL = usar MIA_EDITION global. Solo se lee server-side con el client admin.';

-- Backfill: Vitanova (primer cliente / live test) -> enterprise (interfaz completa)
UPDATE public.businesses
SET edition = 'enterprise'
WHERE id = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'
  AND (edition IS NULL OR edition = 'evaluation');
