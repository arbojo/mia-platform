-- ============================================================
-- 20260820000003: Fix refresh permissions — SECURITY DEFINER
-- ============================================================

-- SECURITY DEFINER so service_role can call REFRESH even though
-- it's not the owner of the materialized views.
CREATE OR REPLACE PROCEDURE analytics.refresh_analytics_views()
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.sales_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.product_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.customer_insights;
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.ai_cost_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.inventory_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.product_margin;
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.stock_health;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CALL analytics.refresh_analytics_views();
END;
$$;
