-- =============================================
-- 080: Cierre de gaps de RLS en tablas tardías
--
-- Dos tablas quedaron SIN RLS porque se crearon DESPUÉS de los
-- loops/grants que protegían su schema:
--   1. public.sales_order_counters  (migración 045) — el schema public
--      se protegió en 001, pero esta tabla se creó después con solo
--      la config (business_sales_config) cubierta.
--   2. inventory.delivery_zones     (migración 051) — el loop RLS de
--      inventory corrió en 044 (antes de que existiera), por lo que
--      nunca se habilitó RLS ni hay policies/grants.
--
-- NOTA: Este archivo reemplaza al borrador roto
-- "20260920022853_add_rls_policies_critical.sql" que apuntaba a
-- `public.delivery_orders` (tabla que NO existe; el pedido real es
-- delivery.orders, ya protegido en 031).
-- =============================================

--------------------------------------------------------------
-- 1. public.sales_order_counters
--------------------------------------------------------------
ALTER TABLE public.sales_order_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_counters FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.sales_order_counters FROM anon, authenticated;
REVOKE ALL ON public.sales_order_counters FROM PUBLIC;

CREATE POLICY "sales_order_counters_owner"
  ON public.sales_order_counters FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_order_counters TO service_role;

--------------------------------------------------------------
-- 2. inventory.delivery_zones
--------------------------------------------------------------
ALTER TABLE inventory.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.delivery_zones FORCE ROW LEVEL SECURITY;

REVOKE ALL ON inventory.delivery_zones FROM anon, authenticated;
REVOKE ALL ON inventory.delivery_zones FROM PUBLIC;

CREATE POLICY "delivery_zones_owner"
  ON inventory.delivery_zones FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON inventory.delivery_zones TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory.delivery_zones TO authenticated;
