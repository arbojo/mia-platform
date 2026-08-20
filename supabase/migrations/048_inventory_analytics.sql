-- ============================================================
-- 048 Analytics × Inventory Integration
-- 3 materialized views: inventory_daily, product_margin, stock_health
-- ============================================================

-- ============================================================
-- Materialized View: inventory_daily
-- Daily inventory movement summary per business
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.inventory_daily AS
SELECT
  sm.business_id,
  (sm.created_at AT TIME ZONE 'UTC')::date AS date,
  COALESCE(SUM(sm.quantity_delta) FILTER (WHERE sm.quantity_delta > 0), 0) AS stock_in,
  COALESCE(ABS(SUM(sm.quantity_delta)) FILTER (WHERE sm.quantity_delta < 0), 0) AS stock_out,
  COALESCE(SUM(sm.quantity_delta), 0) AS net_change,
  COALESCE(SUM(ABS(sm.quantity_delta)) FILTER (WHERE sm.movement_type = 'adjustment'), 0) AS adjustments,
  COALESCE(SUM(ABS(sm.quantity_delta)) FILTER (WHERE sm.movement_type = 'waste'), 0) AS waste,
  COALESCE(SUM(ABS(sm.quantity_delta)) FILTER (WHERE sm.movement_type = 'sale'), 0) AS items_sold,
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
