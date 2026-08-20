-- ============================================================
-- 050c: Grant analytics schema + fix refresh permissions
-- ============================================================

GRANT USAGE ON SCHEMA analytics TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA analytics TO service_role;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA analytics TO service_role;

-- Also grant to authenticated for future RLS-enabled tables
GRANT USAGE ON SCHEMA analytics TO authenticated;

-- Fix: REFRESH MATERIALIZED VIEW requires owner or superuser.
-- Recreate the refresh procedure as SECURITY DEFINER so it runs as the owner.
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

-- Recreate the public wrapper too
CREATE OR REPLACE FUNCTION public.refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CALL analytics.refresh_analytics_views();
END;
$$;
