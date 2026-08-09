-- =============================================
-- 035 Inventory Hub — Expose schema to PostgREST
--
-- Igual que 032 (delivery): el schema inventory esta aislado de
-- public y solo es alcanzable server-side via admin client.
-- PostgREST debe exponer el schema para que supabase-js
-- (db.schema = 'inventory') pueda consultarlo con service_role.
--
-- anon/authenticated mantienen CERO privilegios sobre inventory.*
-- (RLS es FORCE y todos los privilegios fueron REVOKEd por 034).
-- =============================================

ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, delivery, inventory';

NOTIFY pgrst, 'reload config';
