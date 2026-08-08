-- =============================================
-- 032 Delivery Hub — Expose schema to PostgREST
--
-- The delivery schema is isolated from public and only
-- reachable server-side via the admin client. PostgREST
-- must expose the schema so supabase-js (db.schema =
-- 'delivery') can query it with the service role.
--
-- The driver portal and the admin section NEVER use
-- anon/authenticated against delivery.* (RLS is FORCE
-- and ALL privileges are REVOKEd from those roles).
-- =============================================

ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, delivery';

NOTIFY pgrst, 'reload config';
