-- =============================================
-- 060 Retention Idempotency (H1 / ADR-030)
--
-- Hace imposible la doble oferta de retención y la doble cancelación real
-- a nivel de base de datos mediante dos índices UNIQUE parciales sobre
-- sales_events. La escritura del evento ES el commit point (first-write-wins);
-- el motor maneja el 23505 resultante como ACK determinista (sin LLM, sin
-- evento propio, sin señales duplicadas).
--
-- Predicados (particionan el dominio SALE_CANCELLED de forma complementaria):
--   - oferta  : metadata.reason = 'discount_offered'   (siempre sin original_sale_event_id)
--   - cancel. : cualquier otro SALE_CANCELLED (carried original_sale_event_id)
--
-- Escritores existentes que cubren ambos predicados sin cambios:
--   - Core:   src/lib/sales/retention.ts:124-126  (offer, reason='discount_offered')
--   - Core:   src/lib/sales/cancel.ts:99-111       (real, reason=detection.reason + original_sale_event_id)
--   - Legacy: src/lib/sales/process.ts:217-219     (interceptor WhatsApp, offer)
--
-- PRE-FLIGHT obligatorio antes de aplicar (ADR-030 §8):
--   SELECT conversation_id, count(*)
--     FROM public.sales_events
--    WHERE event_type = 'SALE_CANCELLED'
--      AND metadata @> '{"reason":"discount_offered"}'
--    GROUP BY conversation_id HAVING count(*) > 1;
--
--   SELECT conversation_id, count(*)
--     FROM public.sales_events
--    WHERE event_type = 'SALE_CANCELLED'
--      AND NOT (metadata @> '{"reason":"discount_offered"}')
--    GROUP BY conversation_id HAVING count(*) > 1;
--
-- Si existe algún duplicado: STOP — resolver antes (conservar min(id), eliminar
-- posteriores) antes de ejecutar esta migración.
--
-- Rollback (reversible, sin pérdida de datos):
--   DROP INDEX public.uq_sales_events_retention_offer_once;
--   DROP INDEX public.uq_sales_events_cancellation_once;
-- =============================================

-- Garantía 1.1 — una única oferta de retención por conversación:
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_events_retention_offer_once
  ON public.sales_events (conversation_id)
  WHERE event_type = 'SALE_CANCELLED'
    AND metadata @> '{"reason":"discount_offered"}';

-- Garantía 1.2 — una única cancelación real por conversación:
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_events_cancellation_once
  ON public.sales_events (conversation_id)
  WHERE event_type = 'SALE_CANCELLED'
    AND NOT (metadata @> '{"reason":"discount_offered"}');