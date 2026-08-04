-- =============================================
-- 025 Sales Intelligence Events + Closing Flow
--
-- Activates the ADR-010 Sales Intelligence contract:
--   - sales_events table (event_type enum per ADR-010)
--   - conversations.outcome / deal_value / potential_value columns
--   - customers.address (delivery data captured at closing)
--   - RLS scoped to business owner
-- =============================================

-- -------------------------------------------------
-- SALES EVENTS
-- -------------------------------------------------
CREATE TABLE public.sales_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  assistant_id UUID REFERENCES public.assistants(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
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
    'PRICE_REJECTED'
  )),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_events_business ON public.sales_events(business_id, created_at DESC);
CREATE INDEX idx_sales_events_conversation ON public.sales_events(conversation_id);
CREATE INDEX idx_sales_events_customer ON public.sales_events(customer_id);
CREATE INDEX idx_sales_events_type ON public.sales_events(business_id, event_type, created_at DESC);

ALTER TABLE public.sales_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_owner_sales_events_all" ON public.sales_events
  FOR ALL
  USING (business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  ));

-- -------------------------------------------------
-- CONVERSATIONS: sales outcome columns
-- -------------------------------------------------
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS outcome TEXT
    CHECK (outcome IN ('pending', 'interested', 'not_interested', 'sold', 'needs_follow_up')),
  ADD COLUMN IF NOT EXISTS deal_value NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS potential_value NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS outcome_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outcome_history JSONB DEFAULT '[]'::jsonb;

-- -------------------------------------------------
-- CUSTOMERS: delivery address captured at closing
-- -------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS address TEXT;
