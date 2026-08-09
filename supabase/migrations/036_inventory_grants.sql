-- =============================================
-- 036 Inventory Hub — Grant service_role access
--
-- Igual que 033 (delivery): Supabase solo auto-garantiza schema/tablas
-- en 'public'. El schema inventory queda totalmente aislado: el admin
-- client (service_role, BYPASSRLS) es la UNICA via hacia inventory.*
-- anon/authenticated mantienen CERO privilegios (ya REVOKEd por 034);
-- esta migracion solo abre la puerta al service role server-side.
-- =============================================

GRANT USAGE ON SCHEMA inventory TO service_role;
GRANT USAGE ON SCHEMA inventory TO authenticator;

GRANT ALL ON ALL TABLES IN SCHEMA inventory TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA inventory TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA inventory TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA inventory GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA inventory GRANT ALL ON SEQUENCES TO service_role;
