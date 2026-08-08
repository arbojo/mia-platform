-- =============================================
-- 033 Delivery Hub — Grant service_role access
--
-- Supabase only auto-grants schema/tables on 'public'.
-- The delivery schema is fully isolated: the admin client
-- (service_role, BYPASSRLS) is the ONLY path into delivery.*
-- from the app. anon/authenticated keep ZERO privileges
-- (already REVOKEd by 031); this migration only opens the
-- door for the service role used server-side.
-- =============================================

GRANT USAGE ON SCHEMA delivery TO service_role;
GRANT USAGE ON SCHEMA delivery TO authenticator;

GRANT ALL ON ALL TABLES IN SCHEMA delivery TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA delivery TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA delivery TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA delivery GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA delivery GRANT ALL ON SEQUENCES TO service_role;
