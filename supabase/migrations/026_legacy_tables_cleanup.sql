-- =============================================
-- 026 Legacy Tables Cleanup
--
-- Removes three orphaned tables inherited from the
-- legacy project (old Vitanova landing/analytics):
--   - analytics_events
--   - analytics_sessions
--   - order_requests
--
-- Rationale (see docs/audits/legacy-project-security-report.md):
--   - Not created by any migration (001-025) and unused by code
--   - 0 rows, no tenant/business scoping column
--   - RLS disabled with full anon grants -> exposed via Data API
--   - order_requests is outside the MIA domain boundary (ADR-010)
--
-- DROP order respects FK chain:
--   analytics_events.session_id -> analytics_sessions.id
--   analytics_sessions.order_request_id -> order_requests.id
-- =============================================

DROP TABLE IF EXISTS public.analytics_events;
DROP TABLE IF EXISTS public.analytics_sessions;
DROP TABLE IF EXISTS public.order_requests;
