-- ============================================================
-- 050: Analytics Foundation — refresh function + pg_cron
-- ============================================================
-- Prerequisite: All 7 materialized views have UNIQUE indexes
-- ============================================================

-- 1. Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Initial refresh: populate data (non-concurrent, first time only)
REFRESH MATERIALIZED VIEW analytics.sales_daily;
REFRESH MATERIALIZED VIEW analytics.product_performance;
REFRESH MATERIALIZED VIEW analytics.customer_insights;
REFRESH MATERIALIZED VIEW analytics.ai_cost_daily;
REFRESH MATERIALIZED VIEW analytics.inventory_daily;
REFRESH MATERIALIZED VIEW analytics.product_margin;
REFRESH MATERIALIZED VIEW analytics.stock_health;

-- 3. Create concurrent refresh procedure (for subsequent refreshes)
CREATE OR REPLACE PROCEDURE analytics.refresh_analytics_views()
LANGUAGE plpgsql
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

-- 4. Wrapper function for pg_cron (pg_cron calls functions, not procedures)
CREATE OR REPLACE FUNCTION analytics.refresh_analytics_views_cron()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  CALL analytics.refresh_analytics_views();
END;
$$;

-- 5. Schedule: every hour
SELECT cron.schedule(
  'refresh-analytics-hourly',
  '0 * * * *',
  $$SELECT analytics.refresh_analytics_views_cron()$$
);

-- 6. Public wrapper for TypeScript RPC calls
CREATE OR REPLACE FUNCTION public.refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  CALL analytics.refresh_analytics_views();
END;
$$;
