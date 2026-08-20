-- ============================================================
-- 050b: Add public wrapper for analytics refresh (RPC access)
-- ============================================================
-- The analytics.refresh_analytics_views() procedure exists but
-- TypeScript calls rpc('refresh_analytics_views') which looks
-- in the public schema. This wrapper bridges the gap.
-- ============================================================

CREATE OR REPLACE FUNCTION public.refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  CALL analytics.refresh_analytics_views();
END;
$$;
