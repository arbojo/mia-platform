-- =============================================
-- 023: Automated inactivity follow-up
--
-- Añade la marca de último follow-up por cliente para evitar spam: el worker
-- del bridge solo recontacta a un cliente si el último follow-up se envió
-- ANTES de su última interacción (es decir, no se le ha vuelto a escribir
-- desde que atendió el negocio).
--
-- La configuración del reenganche vive en channel_connections.configuration:
--   follow_up_enabled      (boolean)
--   follow_up_delay_minutes(number)
--   follow_up_template     (text | null)
-- =============================================

ALTER TABLE public.customers
  ADD COLUMN last_follow_up_at TIMESTAMPTZ;
