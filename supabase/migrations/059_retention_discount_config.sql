-- =============================================
-- 059: Retention Discount Config (Behavior/Policy)
--
-- ADR-028 (Decision 1 + Decisión Especial): el descuento de retención
-- (ofrecer descuento UNA vez ante intento de cancelación) deja de estar
-- hardcodeado en el canal WhatsApp y pasa a configuración del negocio
-- (Dashboard = fuente de verdad). Está migración SOLO da soporte a la
-- configuración (T1-1 del implementation plan); el motor de retención que
-- la consume es T1-2 (no incluido aquí).
--
-- Aditiva sobre business_sales_config (045). RLS heredado del owner policy.
-- Rollback: columnas ignoradas por el código = comportamiento anterior.
-- =============================================

ALTER TABLE public.business_sales_config
  ADD COLUMN IF NOT EXISTS retention_discount_percent INTEGER NOT NULL DEFAULT 10;

ALTER TABLE public.business_sales_config
  ADD COLUMN IF NOT EXISTS retention_discount_message TEXT NOT NULL DEFAULT
    'Entiendo tu preocupación, {customer_name}. Para agradecerte tu interés, puedo ofrecerte un *{discount_percent}% de descuento* en tu pedido. ¿Te gustaría que te aplique el descuento y confirmemos tu compra?';

-- Guard del rango (idempotente)
ALTER TABLE public.business_sales_config
  DROP CONSTRAINT IF EXISTS business_sales_config_retention_discount_percent_check;
ALTER TABLE public.business_sales_config
  ADD CONSTRAINT business_sales_config_retention_discount_percent_check
  CHECK (retention_discount_percent >= 5 AND retention_discount_percent <= 20);

COMMENT ON COLUMN public.business_sales_config.retention_discount_percent IS
  'Descuento de retención (%) que MIA ofrece UNA vez ante un intento de cancelación. Rango 5-20.';
COMMENT ON COLUMN public.business_sales_config.retention_discount_message IS
  'Mensaje de la oferta de retención. Placeholders: {customer_name}, {discount_percent}.';