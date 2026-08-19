CREATE SCHEMA IF NOT EXISTS analytics;

-- ============================================================
-- Materialized View: sales_daily
-- Daily sales summary per business
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.sales_daily AS
SELECT
  se.business_id,
  (se.created_at AT TIME ZONE 'UTC')::date AS date,
  COUNT(*) FILTER (WHERE se.event_type = 'SALE_WON') AS won_count,
  COUNT(*) FILTER (WHERE se.event_type = 'SALE_LOST') AS lost_count,
  COUNT(*) FILTER (WHERE se.event_type = 'SALE_CANCELLED') AS cancelled_count,
  COUNT(*) FILTER (WHERE se.event_type = 'SALE_STARTED') AS started_count,
  COUNT(*) FILTER (WHERE se.event_type = 'PRODUCT_SELECTED') AS selected_count,
  COUNT(*) FILTER (WHERE se.event_type = 'PRICE_ACCEPTED') AS price_accepted_count,
  COUNT(*) FILTER (WHERE se.event_type = 'PRICE_REJECTED') AS price_rejected_count,
  COALESCE(SUM(se.amount) FILTER (WHERE se.event_type = 'SALE_WON'), 0) AS revenue,
  CASE
    WHEN COUNT(*) FILTER (WHERE se.event_type = 'SALE_STARTED') > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE se.event_type = 'SALE_WON')::numeric /
      COUNT(*) FILTER (WHERE se.event_type = 'SALE_STARTED')::numeric * 100,
      1
    )
    ELSE 0
  END AS conversion_rate,
  CASE
    WHEN COUNT(*) FILTER (WHERE se.event_type = 'SALE_WON') > 0
    THEN ROUND(
      COALESCE(SUM(se.amount) FILTER (WHERE se.event_type = 'SALE_WON'), 0) /
      COUNT(*) FILTER (WHERE se.event_type = 'SALE_WON'),
      2
    )
    ELSE 0
  END AS avg_order_value
FROM public.sales_events se
GROUP BY se.business_id, (se.created_at AT TIME ZONE 'UTC')::date
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_daily_unique
  ON analytics.sales_daily (business_id, date);

-- ============================================================
-- Materialized View: product_performance
-- Per-product sales performance
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.product_performance AS
SELECT
  se.business_id,
  se.product_id,
  p.name AS product_name,
  COUNT(*) FILTER (WHERE se.event_type = 'SALE_STARTED') AS times_presented,
  COUNT(*) FILTER (WHERE se.event_type = 'PRODUCT_SELECTED') AS times_selected,
  COUNT(*) FILTER (WHERE se.event_type = 'SALE_WON') AS times_sold,
  COALESCE(SUM(se.amount) FILTER (WHERE se.event_type = 'SALE_WON'), 0) AS revenue,
  CASE
    WHEN COUNT(*) FILTER (WHERE se.event_type = 'SALE_STARTED') > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE se.event_type = 'SALE_WON')::numeric /
      COUNT(*) FILTER (WHERE se.event_type = 'SALE_STARTED')::numeric * 100,
      1
    )
    ELSE 0
  END AS conversion_rate,
  CASE
    WHEN COUNT(*) FILTER (WHERE se.event_type = 'SALE_WON') > 0
    THEN ROUND(
      COALESCE(SUM(se.amount) FILTER (WHERE se.event_type = 'SALE_WON'), 0) /
      COUNT(*) FILTER (WHERE se.event_type = 'SALE_WON'),
      2
    )
    ELSE 0
  END AS avg_deal_value
FROM public.sales_events se
LEFT JOIN public.products p ON p.id = se.product_id
WHERE se.product_id IS NOT NULL
GROUP BY se.business_id, se.product_id, p.name
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_performance_unique
  ON analytics.product_performance (business_id, product_id);

-- ============================================================
-- Materialized View: customer_insights
-- Customer-level sales insights
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.customer_insights AS
SELECT
  se.business_id,
  se.customer_id,
  c.name AS customer_name,
  c.city AS customer_city,
  c.status AS customer_status,
  COUNT(*) FILTER (WHERE se.event_type = 'SALE_STARTED') AS conversations_started,
  COUNT(*) FILTER (WHERE se.event_type = 'SALE_WON') AS sales_won,
  COUNT(*) FILTER (WHERE se.event_type = 'SALE_LOST') AS sales_lost,
  COUNT(*) FILTER (WHERE se.event_type = 'SALE_CANCELLED') AS sales_cancelled,
  COALESCE(SUM(se.amount) FILTER (WHERE se.event_type = 'SALE_WON'), 0) AS total_value,
  MAX(se.created_at) FILTER (WHERE se.event_type = 'SALE_WON') AS last_purchase_at
FROM public.sales_events se
LEFT JOIN public.customers c ON c.id = se.customer_id
WHERE se.customer_id IS NOT NULL
GROUP BY se.business_id, se.customer_id, c.name, c.city, c.status
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_insights_unique
  ON analytics.customer_insights (business_id, customer_id);

-- ============================================================
-- Materialized View: ai_cost_daily
-- Daily AI usage costs
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.ai_cost_daily AS
SELECT
  au.business_id,
  (au.created_at AT TIME ZONE 'UTC')::date AS date,
  COUNT(*) AS total_requests,
  SUM(au.tokens_input + au.tokens_output) AS total_tokens,
  ROUND(SUM(au.cost)::numeric, 4) AS total_cost,
  ROUND(AVG(au.cost)::numeric, 6) AS avg_cost_per_request,
  SUM(au.duration_ms) AS total_duration_ms,
  ROUND(AVG(au.duration_ms)::numeric, 0) AS avg_duration_ms,
  jsonb_object_agg(
    au.request_type,
    jsonb_build_object(
      'count', COUNT(*),
      'cost', ROUND(SUM(au.cost)::numeric, 4)
    )
  ) FILTER (WHERE au.request_type IS NOT NULL) AS cost_by_type
FROM public.ai_usage au
GROUP BY au.business_id, (au.created_at AT TIME ZONE 'UTC')::date
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_cost_daily_unique
  ON analytics.ai_cost_daily (business_id, date);

-- ============================================================
-- Table: ai_insights
-- AI-generated insights for the business owner
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'revenue_trend', 'conversion_change', 'product_alert',
    'customer_pattern', 'cost_anomaly', 'recommendation'
  )),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_business
  ON analytics.ai_insights (business_id, created_at DESC)
  WHERE dismissed_at IS NULL;

-- ============================================================
-- RLS: analytics is service-role only, no public access
-- ============================================================
ALTER TABLE analytics.ai_insights ENABLE ROW LEVEL SECURITY;

-- No policies = no access via PostgREST (service-role only)
