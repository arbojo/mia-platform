-- ============================================================
-- 061 C1 - Sales Orders Durable Identity
-- ADITIVE only. Preserves existing data; never fabricates values.
--   C1  sales_orders durable identity (order_id != conversation_id)
--       order_id propagation in sales_events
--       idempotent SALE_WON by (business_id, order_id)
--       recompra permitida en misma conversacion
-- ============================================================

-- ------------------------------------------------------------
-- C1 - SALES ORDERS (durable identity)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  assistant_id UUID REFERENCES public.assistants(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  order_number TEXT,
  state TEXT NOT NULL DEFAULT 'draft',
    CHECK (state IN ('draft', 'pending_confirmation', 'confirmed', 'cancelled')),
  amount NUMERIC(12, 2) CHECK (amount >= 0),
  delivery_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  customer_snapshot JSONB DEFAULT '{}'::jsonb,
  channel TEXT,
  source JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_business_state
  ON public.sales_orders(business_id, state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_orders_conversation
  ON public.sales_orders(conversation_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer
  ON public.sales_orders(customer_id);

COMMENT ON TABLE public.sales_orders IS
  'C1: durable Order identity. conversation_id is context/source, never the identity.';

-- ------------------------------------------------------------
-- C1 - ORDER LINES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  sku TEXT,
  unit_price NUMERIC(12, 2),
  original_price NUMERIC(12, 2),
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  variant JSONB DEFAULT '{}'::jsonb,
  subtotal NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_order_lines_order
  ON public.sales_order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_lines_product
  ON public.sales_order_lines(product_id);

COMMENT ON TABLE public.sales_order_lines IS
  'C1: order lines. product_id resolved via canonical resolver (C4); NULL if ambiguous/unresolved.';

-- ------------------------------------------------------------
-- 1. Extender sales_events con order_id + nuevos event_types
-- ------------------------------------------------------------
ALTER TABLE public.sales_events
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL;

ALTER TABLE public.sales_events
  DROP CONSTRAINT IF EXISTS sales_events_event_type_check;
ALTER TABLE public.sales_events
  ADD CONSTRAINT sales_events_event_type_check
  CHECK (event_type IN (
    'SALE_STARTED', 'PRODUCT_SELECTED', 'OBJECTION_DETECTED',
    'OBJECTION_RESOLVED', 'UPSELL_ACCEPTED', 'CROSSSELL_ACCEPTED',
    'FOLLOWUP_REQUIRED', 'SALE_WON', 'SALE_LOST',
    'CUSTOMER_HESITATION', 'PRICE_ACCEPTED', 'PRICE_REJECTED',
    'SALE_CONFIRMED', 'SALE_CANCELLED'
  ));

CREATE INDEX IF NOT EXISTS idx_sales_events_order_id
  ON public.sales_events(order_id);

-- ------------------------------------------------------------
-- C4 - Canonical product resolver RPC (sin ilike/fuzzy/substring)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.canonical_product_resolver(
  p_business_id UUID,
  p_product_id UUID,
  p_sku TEXT,
  p_name TEXT
) RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id UUID;
  v_count INT;
BEGIN
  IF p_product_id IS NOT NULL THEN
    SELECT id INTO v_product_id
    FROM public.products
    WHERE business_id = p_business_id AND id = p_product_id;
    RETURN v_product_id;
  END IF;

  IF p_sku IS NOT NULL AND trim(p_sku) != '' THEN
    SELECT id INTO v_product_id
    FROM public.products
    WHERE business_id = p_business_id AND sku = trim(p_sku);
    IF FOUND THEN
      RETURN v_product_id;
    END IF;
  END IF;

  IF p_name IS NOT NULL AND trim(p_name) != '' THEN
    SELECT count(*) INTO v_count
    FROM public.products
    WHERE business_id = p_business_id
      AND lower(trim(name)) = lower(trim(p_name));

    IF v_count = 1 THEN
      SELECT id INTO v_product_id
      FROM public.products
      WHERE business_id = p_business_id
        AND lower(trim(name)) = lower(trim(p_name));
      RETURN v_product_id;
    END IF;
  END IF;

  RETURN NULL;
END $$;

COMMENT ON FUNCTION public.canonical_product_resolver(UUID, UUID, TEXT, TEXT) IS
  'C4: canonical product resolver. exact SKU > exact unique name > NULL. Never ilike/fuzzy/substring.';
GRANT EXECUTE ON FUNCTION public.canonical_product_resolver(UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.canonical_product_resolver(UUID, UUID, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- C1 - Idempotent SALE_WON por (business_id, order_id)
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sale_won_per_order
  ON public.sales_events(business_id, order_id)
  WHERE event_type = 'SALE_WON' AND order_id IS NOT NULL;

COMMENT ON INDEX public.uniq_sale_won_per_order IS
  'C1: idempotency. One SALE_WON per (business_id, order_id). Recompra en misma conversacion permitida porque order_id != conversation_id.';

-- ------------------------------------------------------------
-- RLS - Sales Orders / Lines
-- ------------------------------------------------------------
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_orders_owner_policy" ON public.sales_orders;
CREATE POLICY "sales_orders_owner_policy" ON public.sales_orders
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_orders TO service_role;

ALTER TABLE public.sales_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_lines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_order_lines_owner_policy" ON public.sales_order_lines;
CREATE POLICY "sales_order_lines_owner_policy" ON public.sales_order_lines
  FOR ALL TO authenticated
  USING (order_id IN (SELECT id FROM public.sales_orders
    WHERE business_id IN (SELECT public.get_user_business_ids())))
  WITH CHECK (order_id IN (SELECT id FROM public.sales_orders
    WHERE business_id IN (SELECT public.get_user_business_ids())));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_order_lines TO service_role;
