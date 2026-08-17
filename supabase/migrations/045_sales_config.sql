-- =============================================
-- 045 Sales Config + Cancellation Events
--
-- Adds conversational sales configuration per business:
--   - business_sales_config (message templates, data capture toggles, cancellation policy)
--   - sales_order_counters (fallback sequential ID for tenants without Delivery)
--   - SALE_CONFIRMED / SALE_CANCELLED event types
--   - conversations.sales_cancelled_at timestamp
--
-- This migration is fully autonomous in the public schema.
-- Zero references to delivery.* or inventory.* schemas.
-- =============================================

-- -------------------------------------------------
-- BUSINESS SALES CONFIGURATION
-- -------------------------------------------------
CREATE TABLE public.business_sales_config (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,

  -- Message templates (editable with variables)
  confirmation_message TEXT NOT NULL DEFAULT
    '¡Gracias por tu compra, {customer_name}! Tu pedido {order_id} está confirmado. Resumen: {productos}. Total: {total}.',
  cancellation_message TEXT NOT NULL DEFAULT
    'Tu pedido {order_id} ha sido cancelado. Si realizaste un pago, nos pondremos en contacto contigo.',

  -- Data capture toggles
  ask_address BOOLEAN NOT NULL DEFAULT true,
  ask_phone BOOLEAN NOT NULL DEFAULT true,

  -- Cancellation policy
  allow_cancellation BOOLEAN NOT NULL DEFAULT true,
  cancellation_window_hours INTEGER NOT NULL DEFAULT 24
    CHECK (cancellation_window_hours >= 0 AND cancellation_window_hours <= 720),

  -- Follow-up
  follow_up_hours INTEGER NOT NULL DEFAULT 48
    CHECK (follow_up_hours > 0),

  -- Timezone
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.business_sales_config IS
  'Conversational sales configuration per business. Controls message templates, data capture, and cancellation policy.';

ALTER TABLE public.business_sales_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_sales_config_owner" ON public.business_sales_config
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_sales_config_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sales_config_updated
  BEFORE UPDATE ON public.business_sales_config
  FOR EACH ROW EXECUTE FUNCTION public.update_sales_config_timestamp();

-- -------------------------------------------------
-- SALES ORDER COUNTERS (fallback for tenants without Delivery)
-- -------------------------------------------------
CREATE TABLE public.sales_order_counters (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.sales_order_counters IS
  'Fallback sequential counter for sales confirmation IDs (VTA-XXXXXX) when Delivery module is not enabled.';

-- -------------------------------------------------
-- SALES EVENTS: Add SALE_CONFIRMED and SALE_CANCELLED
-- -------------------------------------------------
ALTER TABLE public.sales_events DROP CONSTRAINT sales_events_event_type_check;

ALTER TABLE public.sales_events ADD CONSTRAINT sales_events_event_type_check CHECK (event_type IN (
  'SALE_STARTED',
  'PRODUCT_SELECTED',
  'OBJECTION_DETECTED',
  'OBJECTION_RESOLVED',
  'UPSELL_ACCEPTED',
  'CROSSSELL_ACCEPTED',
  'FOLLOWUP_REQUIRED',
  'SALE_WON',
  'SALE_LOST',
  'CUSTOMER_HESITATION',
  'PRICE_ACCEPTED',
  'PRICE_REJECTED',
  'SALE_CONFIRMED',
  'SALE_CANCELLED'
));

-- -------------------------------------------------
-- CONVERSATIONS: cancellation timestamp
-- -------------------------------------------------
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS sales_cancelled_at TIMESTAMPTZ;
