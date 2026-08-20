-- ============================================================
-- 047 + 048: Analytics schema + views + inventory integration
-- Combined migration (047 was never applied on remote)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS analytics;

-- ============================================================
-- Materialized View: sales_daily
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
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.ai_cost_daily AS
WITH daily AS (
  SELECT
    au.business_id,
    (au.created_at AT TIME ZONE 'UTC')::date AS date,
    au.request_type,
    au.cost,
    au.tokens_input + au.tokens_output AS tokens,
    au.duration_ms
  FROM public.ai_usage au
),
daily_agg AS (
  SELECT
    business_id,
    date,
    COUNT(*) AS total_requests,
    SUM(tokens) AS total_tokens,
    ROUND(SUM(cost)::numeric, 4) AS total_cost,
    ROUND(AVG(cost)::numeric, 6) AS avg_cost_per_request,
    SUM(duration_ms) AS total_duration_ms,
    ROUND(AVG(duration_ms)::numeric, 0) AS avg_duration_ms
  FROM daily
  GROUP BY business_id, date
),
by_type AS (
  SELECT
    business_id,
    date,
    request_type,
    COUNT(*) AS type_count,
    ROUND(SUM(cost)::numeric, 4) AS type_cost
  FROM daily
  WHERE request_type IS NOT NULL
  GROUP BY business_id, date, request_type
),
type_agg AS (
  SELECT
    business_id,
    date,
    jsonb_object_agg(
      request_type,
      jsonb_build_object('count', type_count, 'cost', type_cost)
    ) AS cost_by_type
  FROM by_type
  GROUP BY business_id, date
)
SELECT
  d.business_id,
  d.date,
  d.total_requests,
  d.total_tokens,
  d.total_cost,
  d.avg_cost_per_request,
  d.total_duration_ms,
  d.avg_duration_ms,
  COALESCE(t.cost_by_type, '{}') AS cost_by_type
FROM daily_agg d
LEFT JOIN type_agg t ON t.business_id = d.business_id AND t.date = d.date
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_cost_daily_unique
  ON analytics.ai_cost_daily (business_id, date);

-- ============================================================
-- Table: ai_insights
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

ALTER TABLE analytics.ai_insights ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Materialized View: inventory_daily
-- Daily inventory movement summary per business
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.inventory_daily AS
SELECT
  sm.business_id,
  (sm.created_at AT TIME ZONE 'UTC')::date AS date,
  COALESCE(SUM(sm.quantity_delta) FILTER (WHERE sm.quantity_delta > 0), 0) AS stock_in,
  COALESCE(SUM(CASE WHEN sm.quantity_delta < 0 THEN -sm.quantity_delta ELSE 0 END), 0) AS stock_out,
  COALESCE(SUM(sm.quantity_delta), 0) AS net_change,
  COALESCE(SUM(CASE WHEN sm.movement_type = 'adjustment' THEN ABS(sm.quantity_delta) ELSE 0 END), 0) AS adjustments,
  COALESCE(SUM(CASE WHEN sm.movement_type = 'waste' THEN ABS(sm.quantity_delta) ELSE 0 END), 0) AS waste,
  COALESCE(SUM(CASE WHEN sm.movement_type = 'sale' THEN ABS(sm.quantity_delta) ELSE 0 END), 0) AS items_sold,
  COALESCE(SUM(sm.total_cost) FILTER (WHERE sm.quantity_delta > 0), 0) AS total_cost_in,
  COALESCE(SUM(sm.total_cost) FILTER (WHERE sm.quantity_delta < 0), 0) AS total_cost_out
FROM inventory.stock_movements sm
GROUP BY sm.business_id, (sm.created_at AT TIME ZONE 'UTC')::date
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_daily_unique
  ON analytics.inventory_daily (business_id, date);

-- ============================================================
-- Materialized View: product_margin
-- Per-product margin analysis (revenue vs COGS)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.product_margin AS
SELECT
  pp.business_id,
  pp.product_id,
  pp.product_name,
  pp.revenue,
  COALESCE(cogs_agg.cogs, 0) AS cogs,
  pp.revenue - COALESCE(cogs_agg.cogs, 0) AS gross_margin,
  CASE
    WHEN pp.revenue > 0
    THEN ROUND(
      (pp.revenue - COALESCE(cogs_agg.cogs, 0)) / pp.revenue * 100,
      1
    )
    ELSE 0
  END AS gross_margin_pct,
  pp.times_sold AS units_sold,
  CASE
    WHEN pp.times_sold > 0
    THEN ROUND(COALESCE(cogs_agg.cogs, 0) / pp.times_sold, 2)
    ELSE 0
  END AS avg_unit_cost,
  pp.avg_deal_value AS avg_selling_price
FROM analytics.product_performance pp
LEFT JOIN LATERAL (
  SELECT
    SUM(ABS(sm.quantity_delta) * sm.unit_cost) AS cogs
  FROM inventory.stock_movements sm
  WHERE sm.product_id = pp.product_id
    AND sm.movement_type = 'sale'
    AND sm.unit_cost IS NOT NULL
) cogs_agg ON true
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_margin_unique
  ON analytics.product_margin (business_id, product_id);

-- ============================================================
-- Materialized View: stock_health
-- Inventory health dashboard (semaphore, value, scores)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.stock_health AS
SELECT
  a.business_id,
  COUNT(*) AS total_items,
  COUNT(*) FILTER (WHERE rd.semaforo = 'verde') AS items_green,
  COUNT(*) FILTER (WHERE rd.semaforo = 'amarillo') AS items_yellow,
  COUNT(*) FILTER (WHERE rd.semaforo = 'rojo') AS items_red,
  COALESCE(SUM(a.current_qty * COALESCE(sm_avg.avg_cost, 0)), 0) AS total_stock_value,
  COUNT(*) FILTER (WHERE a.current_qty <= COALESCE(a.min_qty, 0)) AS low_stock_count,
  COUNT(*) FILTER (WHERE a.current_qty = 0) AS out_of_stock_count,
  CASE
    WHEN COUNT(*) > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE rd.semaforo = 'verde')::numeric / COUNT(*) * 100,
      1
    )
    ELSE 0
  END AS health_score
FROM inventory.assets a
LEFT JOIN inventory.replenishment_dashboard rd ON rd.asset_id = a.id
LEFT JOIN LATERAL (
  SELECT AVG(sm.unit_cost) AS avg_cost
  FROM inventory.stock_movements sm
  WHERE sm.asset_id = a.id
    AND sm.unit_cost IS NOT NULL
) sm_avg ON true
WHERE a.is_active = true
GROUP BY a.business_id
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_health_unique
  ON analytics.stock_health (business_id);
