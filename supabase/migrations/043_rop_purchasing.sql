-- =============================================
-- 043 Motor ROP, Orquestación de Compras y Comprador Autónomo
--
-- Punto de Reorden (ROP) = (Venta_Diaria_Promedio * Lead_Time) + Safety_Stock.
-- purchase_orders formaliza las sugerencias del "Comprador Autónomo":
--   status: suggested -> approved -> ordered -> in_transit -> received.
-- El dashboard de reposición compara current_qty vs ROP con semáforo
-- (verde / amarillo / rojo). Incluye BOM (explosión de insumos) y el
-- shell del webhook de proveedores (verificación HMAC en app, TS).
--
-- Reglas de oro:
--   - RLS ENABLE + FORCE + REVOKE en TODAS las tablas
--   - SECURITY DEFINER + search_path = '' + objetos calificados
--   - una sola sugerencia abierta por asset (UNIQUE parcial = idempotencia)
--   - umbrales configurables por tenant (business_settings.safety_stock_days)
-- =============================================

-- ----------------------------------------------
-- BUSINESS SETTINGS: safety stock configurable por tenant
-- ----------------------------------------------
ALTER TABLE inventory.business_settings
  ADD COLUMN IF NOT EXISTS safety_stock_days INTEGER NOT NULL DEFAULT 2
    CHECK (safety_stock_days >= 0);

COMMENT ON COLUMN inventory.business_settings.safety_stock_days IS
  'Días de venta promedio que se reservan como stock de seguridad. ROP = ADS*(lead_time + safety_stock_days). Configurable por tenant.';

-- ----------------------------------------------
-- SUPPLIERS (con score de confiabilidad del consejo)
-- ----------------------------------------------
CREATE TABLE inventory.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  lead_time_days INTEGER NOT NULL DEFAULT 3 CHECK (lead_time_days >= 0),
  lead_time_variance_days INTEGER NOT NULL DEFAULT 0 CHECK (lead_time_variance_days >= 0),
  supplier_reliability_score NUMERIC(3, 2) NOT NULL DEFAULT 0.90
    CHECK (supplier_reliability_score >= 0 AND supplier_reliability_score <= 1),
  webhook_secret TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

CREATE INDEX idx_inventory_suppliers_business ON inventory.suppliers(business_id, is_active);

COMMENT ON TABLE inventory.suppliers IS
  'Proveedores del tenant. supplier_reliability_score (0-1) y lead_time_variance_days permiten elegir al proveedor mas confiable (menor variacion de lead time), no solo al mas barato.';
COMMENT ON COLUMN inventory.suppliers.webhook_secret IS
  'Secreto para verificar webhooks de tracking (HMAC-SHA256, verificado en app). CASCARON: mover a Supabase Vault en produccion; solo es legible por service_role.';

-- ----------------------------------------------
-- PURCHASE ORDERS (sugerencias formalizadas del comprador autonomo)
-- ----------------------------------------------
CREATE TABLE inventory.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES inventory.assets(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES inventory.suppliers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'approved', 'ordered', 'in_transit', 'received', 'cancelled')),
  qty_suggested INTEGER NOT NULL CHECK (qty_suggested > 0),
  qty_ordered INTEGER CHECK (qty_ordered >= 0),
  expected_at TIMESTAMPTZ,
  search_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  suggestion_reason JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_po_business_status ON inventory.purchase_orders(business_id, status, created_at DESC);
CREATE INDEX idx_inventory_po_asset ON inventory.purchase_orders(asset_id);

-- Idempotencia del comprador autonomo: una sola sugerencia/orden abierta por asset
CREATE UNIQUE INDEX idx_inventory_po_open_suggestion
  ON inventory.purchase_orders(business_id, asset_id)
  WHERE status IN ('suggested', 'approved', 'ordered', 'in_transit');

COMMENT ON TABLE inventory.purchase_orders IS
  'Orden de compra sugerida/formalizada. search_metadata guarda resultados de busqueda externa (proveedores, precios, ETA web). El UNIQUE parcial evita sugerencias duplicadas por asset.';

-- Trazabilidad de transiciones de estado (audit)
CREATE TABLE inventory.purchase_order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES inventory.purchase_orders(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_po_events_po ON inventory.purchase_order_events(purchase_order_id, created_at DESC);

-- ----------------------------------------------
-- BOM (Bill of Materials) — explosión de insumos (consejo del concilio)
-- ----------------------------------------------
CREATE TABLE inventory.bom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  parent_asset_id UUID NOT NULL REFERENCES inventory.assets(id) ON DELETE CASCADE,
  component_asset_id UUID NOT NULL REFERENCES inventory.assets(id) ON DELETE CASCADE,
  qty_per_unit NUMERIC(10, 4) NOT NULL DEFAULT 1 CHECK (qty_per_unit > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bom_no_auto_referencia CHECK (parent_asset_id <> component_asset_id),
  UNIQUE (business_id, parent_asset_id, component_asset_id)
);

CREATE INDEX idx_inventory_bom_parent ON inventory.bom(business_id, parent_asset_id);
CREATE INDEX idx_inventory_bom_component ON inventory.bom(business_id, component_asset_id);

COMMENT ON TABLE inventory.bom IS
  'Producto terminado (parent) -> materias primas (component) con qty_per_unit. Permite que MIA sugiera comprar insumos (hilos, latex, suelas) en base a la produccion proyectada.';

-- ----------------------------------------------
-- WEBHOOK DE PROVEEDORES (cascarón: verificación HMAC en app/TS)
-- ----------------------------------------------
CREATE TABLE inventory.supplier_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES inventory.suppliers(id) ON DELETE CASCADE,
  purchase_order_id UUID REFERENCES inventory.purchase_orders(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('shipped', 'in_transit', 'received', 'tracking_update')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'failed')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_inventory_webhook_status ON inventory.supplier_webhook_events(status, received_at DESC);

-- =============================================
-- FUNCIONES (SECURITY DEFINER, search_path='')
-- =============================================

-- ----------------------------------------------
-- CALCULAR ROP: (ADS * lead_time) + safety_stock
-- ----------------------------------------------
CREATE OR REPLACE FUNCTION inventory.calculate_rop_for_asset(
  p_asset_id UUID,
  p_lead_time_days INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business_id UUID;
  v_window_days INTEGER := 30;
  v_ads NUMERIC(12, 4) := 0;
  v_lead INTEGER;
  v_safety_days INTEGER := 2;
  v_rop NUMERIC(12, 4);
BEGIN
  SELECT business_id INTO v_business_id FROM inventory.assets WHERE id = p_asset_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'asset_no_encontrado';
  END IF;

  -- Venta diaria promedio sobre el ledger (movimientos 'sale' de los ultimos 30 dias)
  SELECT COALESCE(sum(abs(m.quantity_delta)), 0)::numeric / v_window_days INTO v_ads
    FROM inventory.stock_movements m
    WHERE m.asset_id = p_asset_id
      AND m.business_id = v_business_id
      AND m.movement_type = 'sale'
      AND m.created_at >= now() - make_interval(days => v_window_days);

  SELECT safety_stock_days INTO v_safety_days
    FROM inventory.business_settings WHERE business_id = v_business_id;
  v_safety_days := COALESCE(v_safety_days, 2);

  -- Lead time: parametro > prediccion > settings > default
  v_lead := COALESCE(
    p_lead_time_days,
    (SELECT lead_time_days FROM inventory.predictions p
      WHERE p.business_id = v_business_id AND p.asset_id = p_asset_id
      ORDER BY p.generated_at DESC LIMIT 1),
    (SELECT lead_time_days FROM inventory.business_settings WHERE business_id = v_business_id),
    3
  );

  v_rop := ceil(v_ads * v_lead + v_ads * v_safety_days);
  RETURN GREATEST(0, v_rop::int);
END $$;

COMMENT ON FUNCTION inventory.calculate_rop_for_asset(UUID, INTEGER) IS
  'Punto de Reorden = (Venta_Diaria_Promedio * Lead_Time) + Safety_Stock. ADS sobre 30 dias del ledger; lead_time por parametro, prediccion o settings; safety por business_settings.safety_stock_days.';

-- ----------------------------------------------
-- TRANSICIÓN DE ESTADO (máquina de estados + auditoría)
-- ----------------------------------------------
CREATE OR REPLACE FUNCTION inventory.transition_purchase_order(
  p_purchase_order_id UUID,
  p_business_id UUID,
  p_to_status TEXT,
  p_created_by UUID,
  p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_from inventory.purchase_orders.status%TYPE;
  v_allowed TEXT[];
BEGIN
  SELECT status INTO v_from FROM inventory.purchase_orders
    WHERE id = p_purchase_order_id AND business_id = p_business_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'purchase_order_no_encontrada';
  END IF;

  v_allowed := CASE v_from
    WHEN 'suggested'  THEN ARRAY['approved', 'cancelled']
    WHEN 'approved'   THEN ARRAY['ordered', 'cancelled']
    WHEN 'ordered'    THEN ARRAY['in_transit', 'received', 'cancelled']
    WHEN 'in_transit' THEN ARRAY['received', 'cancelled']
    ELSE '{}'::text[]
  END;

  IF NOT (p_to_status = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'transicion_invalida';
  END IF;

  UPDATE inventory.purchase_orders
  SET status = p_to_status,
      updated_at = now(),
      qty_ordered = CASE
        WHEN p_to_status = 'ordered' AND qty_ordered IS NULL THEN qty_suggested
        ELSE qty_ordered
      END
  WHERE id = p_purchase_order_id;

  INSERT INTO inventory.purchase_order_events (
    purchase_order_id, business_id, from_status, to_status, note, created_by
  ) VALUES (p_purchase_order_id, p_business_id, v_from, p_to_status, p_note, p_created_by);

  RETURN jsonb_build_object(
    'purchase_order_id', p_purchase_order_id, 'from', v_from, 'to', p_to_status
  );
END $$;

-- ----------------------------------------------
-- COMPRADOR AUTÓNOMO: barre el dashboard y crea sugerencias
-- ----------------------------------------------
CREATE OR REPLACE FUNCTION inventory.suggest_purchase_orders(p_business_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r RECORD;
  v_qty INTEGER;
  v_inserted INTEGER := 0;
  v_new_id UUID;
BEGIN
  FOR r IN
    SELECT asset_id, current_qty, rop, min_qty, max_qty, suggested_qty, lead_time_days, semaforo
    FROM inventory.replenishment_dashboard
    WHERE business_id = p_business_id
      AND semaforo IN ('amarillo', 'rojo')
  LOOP
    IF EXISTS (
      SELECT 1 FROM inventory.purchase_orders po
      WHERE po.business_id = p_business_id
        AND po.asset_id = r.asset_id
        AND po.status IN ('suggested', 'approved', 'ordered', 'in_transit')
    ) THEN
      CONTINUE;
    END IF;

    v_qty := COALESCE(
      r.suggested_qty,
      CASE
        WHEN r.max_qty IS NOT NULL THEN GREATEST(r.max_qty - r.current_qty, 1)
        ELSE GREATEST(r.rop * 2 - r.current_qty, 1)
      END
    );

    INSERT INTO inventory.purchase_orders (
      business_id, asset_id, status, qty_suggested, suggestion_reason
    ) VALUES (
      p_business_id, r.asset_id, 'suggested', v_qty,
      jsonb_build_object(
        'engine', 'autonomous_buyer',
        'semaforo', r.semaforo,
        'rop', r.rop,
        'current_qty', r.current_qty,
        'lead_time_days', r.lead_time_days
      )
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN v_inserted;
END $$;

COMMENT ON FUNCTION inventory.suggest_purchase_orders(UUID) IS
  'Comprador Autonomo: para assets en semaforo amarillo/rojo sin orden abierta crea una purchase_order con status suggested. Idempotente por el UNIQUE parcial. Devuelve cuantas sugerencias creo.';

-- ----------------------------------------------
-- EXPLOSIÓN BOM: sugiere compras de insumos por producción proyectada
-- ----------------------------------------------
CREATE OR REPLACE FUNCTION inventory.suggest_bom_procurement(
  p_business_id UUID,
  p_parent_asset_id UUID,
  p_projected_qty INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r RECORD;
  v_required INTEGER;
  v_qty INTEGER;
  v_new_id UUID;
  v_created INTEGER := 0;
BEGIN
  IF p_projected_qty <= 0 THEN
    RAISE EXCEPTION 'proyeccion_invalida';
  END IF;

  FOR r IN
    SELECT b.component_asset_id, b.qty_per_unit, a.current_qty
    FROM inventory.bom b
    JOIN inventory.assets a
      ON a.id = b.component_asset_id AND a.business_id = p_business_id
    WHERE b.parent_asset_id = p_parent_asset_id
      AND b.business_id = p_business_id
  LOOP
    v_required := ceil(r.qty_per_unit * p_projected_qty);
    v_qty := GREATEST(v_required - r.current_qty, 0);
    IF v_qty = 0 THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM inventory.purchase_orders po
      WHERE po.business_id = p_business_id
        AND po.asset_id = r.component_asset_id
        AND po.status IN ('suggested', 'approved', 'ordered', 'in_transit')
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO inventory.purchase_orders (
      business_id, asset_id, status, qty_suggested, suggestion_reason
    ) VALUES (
      p_business_id, r.component_asset_id, 'suggested', v_qty,
      jsonb_build_object(
        'engine', 'bom_explosion',
        'parent_asset_id', p_parent_asset_id,
        'projected_qty', p_projected_qty,
        'required', v_required,
        'on_hand', r.current_qty
      )
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN
      v_created := v_created + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('created', v_created);
END $$;

-- ----------------------------------------------
-- WEBHOOK DE PROVEEDOR: registra evento y transiciona la PO
-- (la firma HMAC-SHA256 se verifica en la app; aqui el efecto)
-- ----------------------------------------------
CREATE OR REPLACE FUNCTION inventory.handle_supplier_webhook(
  p_business_id UUID,
  p_supplier_id UUID,
  p_purchase_order_id UUID,
  p_event_type TEXT,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM inventory.suppliers s
    WHERE s.id = p_supplier_id AND s.business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'proveedor_no_valido';
  END IF;

  IF p_purchase_order_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM inventory.purchase_orders po
    WHERE po.id = p_purchase_order_id
      AND po.business_id = p_business_id
      AND po.supplier_id = p_supplier_id
  ) THEN
    RAISE EXCEPTION 'purchase_order_no_valida_para_proveedor';
  END IF;

  INSERT INTO inventory.supplier_webhook_events (
    business_id, supplier_id, purchase_order_id, event_type, payload, status
  ) VALUES (
    p_business_id, p_supplier_id, p_purchase_order_id, p_event_type, p_payload, 'pending'
  ) RETURNING id INTO v_event_id;

  IF p_purchase_order_id IS NOT NULL AND p_event_type IN ('shipped', 'in_transit') THEN
    UPDATE inventory.purchase_orders
    SET status = 'in_transit', updated_at = now()
    WHERE id = p_purchase_order_id
      AND status IN ('approved', 'ordered');
  ELSIF p_purchase_order_id IS NOT NULL AND p_event_type = 'received' THEN
    UPDATE inventory.purchase_orders
    SET status = 'received', updated_at = now()
    WHERE id = p_purchase_order_id;
  END IF;

  UPDATE inventory.supplier_webhook_events
  SET status = 'processed', processed_at = now()
  WHERE id = v_event_id;

  RETURN jsonb_build_object('event_id', v_event_id, 'status', 'processed');
END $$;

-- =============================================
-- VISTA: DASHBOARD DE REPOSICIÓN (semáforo verde/amarillo/rojo)
-- =============================================
CREATE VIEW inventory.replenishment_dashboard AS
WITH base AS (
  SELECT
    a.business_id,
    a.id AS asset_id,
    a.code,
    a.name,
    a.item_type,
    a.location_id,
    a.current_qty,
    a.min_qty,
    a.max_qty,
    p.suggested_qty,
    COALESCE(p.lead_time_days, NULL) AS lead_time_days,
    COALESCE(p.velocity30d, 0) AS velocity30d,
    inventory.calculate_rop_for_asset(a.id, COALESCE(p.lead_time_days, NULL)) AS rop
  FROM inventory.assets a
  LEFT JOIN inventory.predictions p
    ON p.business_id = a.business_id
   AND p.asset_id = a.id
   AND p.horizon_days = 30
   AND p.model = 'hybrid'
  WHERE a.is_active = true AND a.tracking_mode = 'quantity'
)
SELECT b.*,
  CASE
    WHEN b.current_qty = 0 THEN 'rojo'
    WHEN b.current_qty <= GREATEST(b.rop, 1) THEN 'amarillo'
    ELSE 'verde'
  END AS semaforo
FROM base b;

COMMENT ON VIEW inventory.replenishment_dashboard IS
  'Compara current_qty vs ROP por asset (semáforo). rojo = sin stock; amarillo = en/por debajo del ROP; verde = saludable. La vista se puede materializar si el volumen lo exige (calcular_rop_for_asset se ejecuta por fila).';

-- =============================================
-- RLS: ENABLE + FORCE + REVOKE en las tablas nuevas
-- =============================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'suppliers', 'purchase_orders', 'purchase_order_events',
    'bom', 'supplier_webhook_events'
  ])
  LOOP
    EXECUTE format('ALTER TABLE inventory.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE inventory.%I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON inventory.%I FROM anon, authenticated', tbl);
    EXECUTE format('REVOKE ALL ON inventory.%I FROM PUBLIC', tbl);
    EXECUTE format(
      'CREATE POLICY "inventory_%I_owner" ON inventory.%I
       FOR ALL TO authenticated
       USING (business_id IN (SELECT public.get_user_business_ids()))
       WITH CHECK (business_id IN (SELECT public.get_user_business_ids()))',
      tbl, tbl
    );
  END LOOP;
END $$;

-- La vista hereda RLS de sus tablas base; se revoca acceso directo a roles publicos
REVOKE ALL ON inventory.replenishment_dashboard FROM anon, authenticated, PUBLIC;
GRANT ALL ON inventory.replenishment_dashboard TO service_role;

-- ----------------------------------------------
-- Grants de funciones (solo service_role; PostgREST no las expone)
-- ----------------------------------------------
GRANT EXECUTE ON FUNCTION inventory.calculate_rop_for_asset(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION inventory.transition_purchase_order(UUID, UUID, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION inventory.suggest_purchase_orders(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION inventory.suggest_bom_procurement(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION inventory.handle_supplier_webhook(UUID, UUID, UUID, TEXT, JSONB) TO service_role;
