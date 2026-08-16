-- =============================================
-- 044 Logística Predictiva y Compensación CX
--
-- Transferencias multi-nodo + ETA dinámica + Token de Promesa de Entrega
-- con compensación automática (descuento) cuando el ETA excede el umbral.
-- El trigger SALE_WON (CX) predice el incumplimiento y deja el "cascarón"
-- de pasarela listo: payment_context con monto ajustado y justificación.
--
-- Cumplimiento ADR-020 (flujo 1-way): el modulo NUNCA escribe en public;
-- la compensación vive en inventory.delivery_promises y se expone como
-- proyección de lectura (API) junto a la venta. El ledger se amplía con
-- transfer_out / transfer_in y product_id pasa a nullable (el ancla es
-- asset_id desde 040).
--
-- Reglas de oro:
--   - RLS ENABLE + FORCE + REVOKE en TODAS las tablas
--   - transferencia atomica: debit origen + credit destino en la misma tx
--   - idempotencia: UNIQUE parcial en ledger + idempotency_key
--   - SECURITY DEFINER + search_path = '' + objetos calificados
-- =============================================

-- ----------------------------------------------
-- LEDGER: ampliar movement_type + product_id nullable
-- ----------------------------------------------
ALTER TABLE inventory.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;
ALTER TABLE inventory.stock_movements
  ADD CONSTRAINT stock_movements_movement_type_check
  CHECK (movement_type IN (
    'initial', 'sale', 'purchase', 'adjustment', 'restock',
    'waste', 'return', 'import', 'transfer_out', 'transfer_in'
  ));

ALTER TABLE inventory.stock_movements ALTER COLUMN product_id DROP NOT NULL;

-- Idempotencia: un transfer registra transfer_out Y transfer_in por asset.
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_movements_transfer_dedupe
  ON inventory.stock_movements(business_id, asset_id, reference_id, movement_type)
  WHERE reference_type = 'transfer' AND reference_id IS NOT NULL AND asset_id IS NOT NULL;

-- ----------------------------------------------
-- ASSETS: network_key agrupa el mismo item a traves de nodos
-- ----------------------------------------------
ALTER TABLE inventory.assets
  ADD COLUMN IF NOT EXISTS network_key TEXT;

CREATE INDEX IF NOT EXISTS idx_inventory_assets_network
  ON inventory.assets(business_id, network_key, location_id);

COMMENT ON COLUMN inventory.assets.network_key IS
  'Agrupa replicas del mismo item logico en distintos nodos (sucursales). NULL en tenancies de un solo nodo.';

-- ----------------------------------------------
-- TRANSFERS (rebalanceo entre nodos del tenant)
-- ----------------------------------------------
CREATE TABLE inventory.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  transfer_number TEXT NOT NULL,
  from_location_id UUID NOT NULL REFERENCES inventory.locations(id) ON DELETE RESTRICT,
  to_location_id UUID NOT NULL REFERENCES inventory.locations(id) ON DELETE RESTRICT,
  asset_id UUID NOT NULL REFERENCES inventory.assets(id) ON DELETE RESTRICT,
  qty INTEGER NOT NULL CHECK (qty > 0),
  status TEXT NOT NULL DEFAULT 'in_transit'
    CHECK (status IN ('in_transit', 'arrived', 'cancelled')),
  estimated_arrival TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  arrived_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transfers_nodos_distintos CHECK (from_location_id <> to_location_id),
  UNIQUE (business_id, transfer_number)
);

CREATE INDEX idx_inventory_transfers_business ON inventory.transfers(business_id, status, created_at DESC);

-- ----------------------------------------------
-- TRANSFER COUNTERS (numeración por negocio)
-- ----------------------------------------------
CREATE TABLE inventory.transfer_counters (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- ----------------------------------------------
-- EXECUTE TRANSFER (atómico): debit origen, credit destino, ledger
-- ----------------------------------------------
CREATE OR REPLACE FUNCTION inventory.execute_transfer(
  p_business_id UUID,
  p_from_location_id UUID,
  p_to_location_id UUID,
  p_asset_id UUID,
  p_qty INTEGER,
  p_estimated_arrival TIMESTAMPTZ,
  p_created_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_transfer_id UUID;
  v_number INTEGER;
  v_to_asset UUID;
  v_key TEXT;
  v_tracking TEXT;
  v_item_type TEXT;
  v_code TEXT;
  v_name TEXT;
  v_uom TEXT;
  v_updated INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM inventory.locations WHERE id = p_from_location_id AND business_id = p_business_id
  ) OR NOT EXISTS (
    SELECT 1 FROM inventory.locations WHERE id = p_to_location_id AND business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'ubicacion_no_pertenece_al_negocio';
  END IF;

  INSERT INTO inventory.transfer_counters (business_id, last_number) VALUES (p_business_id, 1)
  ON CONFLICT (business_id) DO UPDATE SET last_number = inventory.transfer_counters.last_number + 1
  RETURNING last_number INTO v_number;

  SELECT network_key, tracking_mode, item_type, code, name, uom
    INTO v_key, v_tracking, v_item_type, v_code, v_name, v_uom
    FROM inventory.assets
    WHERE id = p_asset_id AND business_id = p_business_id AND location_id = p_from_location_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'asset_origen_no_valido';
  END IF;

  -- Debit origen (guarda, sin negativo)
  UPDATE inventory.assets
  SET current_qty = current_qty - p_qty, version = version + 1, updated_at = now()
  WHERE id = p_asset_id AND current_qty >= p_qty;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'stock_insuficiente_en_origen';
  END IF;

  -- Credit destino: replica existente (network_key + location) o auto-provision
  SELECT id INTO v_to_asset FROM inventory.assets
    WHERE business_id = p_business_id
      AND network_key IS NOT DISTINCT FROM v_key
      AND location_id = p_to_location_id;
  IF NOT FOUND THEN
    INSERT INTO inventory.assets (
      business_id, item_type, tracking_mode, code, name, attributes, uom,
      lifecycle_state, location_id, current_qty, version, is_active, network_key
    ) VALUES (
      p_business_id, v_item_type, v_tracking, v_code, v_name, '{}'::jsonb, v_uom,
      'active', p_to_location_id, p_qty, 1, true, v_key
    ) RETURNING id INTO v_to_asset;
  ELSE
    UPDATE inventory.assets
    SET current_qty = current_qty + p_qty, version = version + 1, updated_at = now()
    WHERE id = v_to_asset;
  END IF;

  INSERT INTO inventory.transfers (
    business_id, transfer_number, from_location_id, to_location_id, asset_id,
    qty, status, estimated_arrival, created_by
  ) VALUES (
    p_business_id, 'TF-' || lpad(v_number::text, 6, '0'),
    p_from_location_id, p_to_location_id, p_asset_id,
    p_qty, 'in_transit', p_estimated_arrival, p_created_by
  ) RETURNING id INTO v_transfer_id;

  INSERT INTO inventory.stock_movements (
    business_id, asset_id, quantity_delta, movement_type,
    unit_cost, total_cost, location_id, reference_id, reference_type, reason, created_by
  ) VALUES
    (p_business_id, p_asset_id, -p_qty, 'transfer_out',
     0, 0, p_from_location_id, v_transfer_id, 'transfer', 'Transferencia saliente', p_created_by),
    (p_business_id, v_to_asset, p_qty, 'transfer_in',
     0, 0, p_to_location_id, v_transfer_id, 'transfer', 'Transferencia entrante', p_created_by);

  RETURN jsonb_build_object(
    'transfer_id', v_transfer_id,
    'transfer_number', 'TF-' || lpad(v_number::text, 6, '0')
  );
END $$;

-- ----------------------------------------------
-- COMPLETE TRANSFER (operativo; el ledger ya es consistente)
-- ----------------------------------------------
CREATE OR REPLACE FUNCTION inventory.complete_transfer(
  p_transfer_id UUID,
  p_business_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status TEXT;
BEGIN
  UPDATE inventory.transfers
  SET status = 'arrived', arrived_at = now(), updated_at = now()
  WHERE id = p_transfer_id AND business_id = p_business_id AND status = 'in_transit'
  RETURNING status INTO v_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer_no_encontrado_o_cerrado';
  END IF;

  RETURN jsonb_build_object('transfer_id', p_transfer_id, 'status', 'arrived');
END $$;

-- ----------------------------------------------
-- CALCULAR ETA (asset, nodo destino): local > transit > purchase > lead
-- ----------------------------------------------
CREATE OR REPLACE FUNCTION inventory.calcular_eta(
  p_asset_id UUID,
  p_location_id UUID
)
RETURNS TABLE (
  source TEXT,
  eta_days INTEGER,
  available_qty INTEGER,
  message TEXT,
  breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business_id UUID;
  v_code TEXT;
  v_network TEXT;
  v_local_qty INTEGER;
  v_transit_qty INTEGER := 0;
  v_transit_eta INTEGER := 0;
  v_po_qty INTEGER := 0;
  v_po_eta INTEGER := 0;
  v_lead INTEGER;
BEGIN
  SELECT a.business_id, a.code, a.network_key, a.current_qty
    INTO v_business_id, v_code, v_network, v_local_qty
    FROM inventory.assets a
    WHERE a.id = p_asset_id AND a.location_id = p_location_id;
  IF NOT FOUND THEN
    RETURN NEXT ROW('unavailable', NULL, 0, 'asset_no_encontrado_en_nodo', '{}'::jsonb);
    RETURN;
  END IF;

  -- (a) Local: hay stock en el nodo destino
  IF v_local_qty > 0 THEN
    RETURN NEXT ROW('local', 0, v_local_qty, 'Disponible en el nodo destino', '{}'::jsonb);
    RETURN;
  END IF;

  -- (b) En tránsito: transferencias abiertas hacia el nodo (mismo item)
  SELECT COALESCE(sum(t.qty), 0)::int,
         COALESCE(min(ceil(extract(epoch FROM (t.estimated_arrival - now())) / 86400)), 0)::int
    INTO v_transit_qty, v_transit_eta
    FROM inventory.transfers t
    JOIN inventory.assets a ON a.id = t.asset_id
    WHERE t.business_id = v_business_id
      AND t.to_location_id = p_location_id
      AND t.status = 'in_transit'
      AND t.estimated_arrival IS NOT NULL
      AND (a.network_key IS NOT DISTINCT FROM v_network
           OR (v_network IS NULL AND v_code IS NOT NULL AND a.code IS NOT DISTINCT FROM v_code));

  IF v_transit_qty > 0 THEN
    RETURN NEXT ROW('transit', GREATEST(v_transit_eta, 0), v_transit_qty,
      'Stock en transito hacia el nodo',
      jsonb_build_object('transit_qty', v_transit_qty, 'eta_dias', GREATEST(v_transit_eta, 0)));
    RETURN;
  END IF;

  -- (c) Reabastecimiento externo: PO ordenada/en transito (mismo item)
  SELECT COALESCE(sum(
            CASE WHEN po.status IN ('ordered', 'in_transit')
                 THEN COALESCE(po.qty_ordered, po.qty_suggested) ELSE 0 END), 0)::int,
         COALESCE(min(ceil(extract(epoch FROM (po.expected_at - now())) / 86400)), 0)::int
    INTO v_po_qty, v_po_eta
    FROM inventory.purchase_orders po
    JOIN inventory.assets a ON a.id = po.asset_id
    WHERE po.business_id = v_business_id
      AND po.status IN ('ordered', 'in_transit')
      AND po.expected_at IS NOT NULL
      AND (a.network_key IS NOT DISTINCT FROM v_network
           OR (v_network IS NULL AND v_code IS NOT NULL AND a.code IS NOT DISTINCT FROM v_code));

  IF v_po_qty > 0 THEN
    RETURN NEXT ROW('purchase', GREATEST(v_po_eta, 0), v_po_qty,
      'Reposicion externa en transito',
      jsonb_build_object('po_qty', v_po_qty, 'eta_dias', GREATEST(v_po_eta, 0)));
    RETURN;
  END IF;

  -- (d) Sin stock comprometido: lead time de prediccion o settings
  v_lead := COALESCE(
    (SELECT lead_time_days FROM inventory.predictions p
      WHERE p.business_id = v_business_id AND p.asset_id = p_asset_id
      ORDER BY p.generated_at DESC LIMIT 1),
    (SELECT lead_time_days FROM inventory.business_settings WHERE business_id = v_business_id),
    3
  );

  RETURN NEXT ROW('purchase', v_lead, 0, 'Requiere reabastecimiento externo',
    jsonb_build_object('lead_time_dias', v_lead));
END $$;

COMMENT ON FUNCTION inventory.calcular_eta(UUID, UUID) IS
  'ETA dinamica: local > en transito (transferencias/PO) > lead time externo. Pura (no muta datos); consumida por la politica CX y por la UI.';

-- ----------------------------------------------
-- BUSINESS SETTINGS: politica CX configurable por tenant
-- ----------------------------------------------
ALTER TABLE inventory.business_settings
  ADD COLUMN IF NOT EXISTS cx_promise_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS late_delivery_threshold_days INTEGER NOT NULL DEFAULT 2
    CHECK (late_delivery_threshold_days >= 0),
  ADD COLUMN IF NOT EXISTS late_delivery_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 5.00
    CHECK (late_delivery_discount_percent >= 0 AND late_delivery_discount_percent <= 100),
  ADD COLUMN IF NOT EXISTS compensation_max_amount NUMERIC(12, 2)
    CHECK (compensation_max_amount >= 0);

COMMENT ON COLUMN inventory.business_settings.late_delivery_threshold_days IS
  'Umbral de tolerancia: si ETA > umbral -> compensacion automatica.';
COMMENT ON COLUMN inventory.business_settings.late_delivery_discount_percent IS
  'Descuento automatico aplicado al monto cuando la entrega excede el umbral.';

-- ----------------------------------------------
-- DELIVERY PROMISES (Token de Promesa de Entrega + cascaron de pasarela)
-- ----------------------------------------------
CREATE TABLE inventory.delivery_promises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sales_event_id UUID REFERENCES public.sales_events(id) ON DELETE SET NULL,
  delivery_order_id UUID REFERENCES delivery.orders(id) ON DELETE SET NULL,
  promise_token TEXT NOT NULL UNIQUE,
  promised_delivery_date TIMESTAMPTZ NOT NULL,
  tolerance_days INTEGER NOT NULL DEFAULT 2 CHECK (tolerance_days >= 0),
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 5.00
    CHECK (discount_percent >= 0 AND discount_percent <= 100),
  original_amount NUMERIC(12, 2) NOT NULL,
  adjusted_amount NUMERIC(12, 2),
  discount_amount NUMERIC(12, 2),
  status TEXT NOT NULL DEFAULT 'pending_fulfillment'
    CHECK (status IN ('pending_fulfillment', 'fulfilled', 'compensated', 'void')),
  compensated_at TIMESTAMPTZ,
  gateway_status TEXT NOT NULL DEFAULT 'not_configured'
    CHECK (gateway_status IN ('not_configured', 'ready_capture', 'captured', 'failed')),
  payment_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, sales_event_id) WHERE sales_event_id IS NOT NULL
);

CREATE INDEX idx_inventory_promises_business ON inventory.delivery_promises(business_id, status, created_at DESC);
CREATE INDEX idx_inventory_promises_order ON inventory.delivery_promises(delivery_order_id);

COMMENT ON TABLE inventory.delivery_promises IS
  'Promesa de entrega (token) emitida al cierre de venta. Cuando el ETA predice incumplimiento, la promesa nace compensada con el monto ajustado y payment_context listo para la futura pasarela. No escribe en public (ADR-020).';

-- ----------------------------------------------
-- CREATE DELIVERY PROMISE (compensación predictiva)
-- ----------------------------------------------
CREATE OR REPLACE FUNCTION inventory.create_delivery_promise(
  p_business_id UUID,
  p_sales_event_id UUID,
  p_delivery_order_id UUID,
  p_promised_delivery_date TIMESTAMPTZ,
  p_original_amount NUMERIC(12, 2),
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_promise_id UUID;
  v_token TEXT;
  v_tolerance INTEGER;
  v_discount_pct NUMERIC(5, 2);
  v_cap NUMERIC(12, 2);
  v_discount NUMERIC(12, 2);
BEGIN
  SELECT late_delivery_threshold_days, late_delivery_discount_percent, compensation_max_amount
    INTO v_tolerance, v_discount_pct, v_cap
    FROM inventory.business_settings
    WHERE business_id = p_business_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'business_settings_no_encontradas';
  END IF;

  SELECT id INTO v_promise_id FROM inventory.delivery_promises WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('promise_id', v_promise_id, 'idempotent', true);
  END IF;

  v_token := 'PROM-' || replace(gen_random_uuid()::text, '-', '');
  v_discount := round(p_original_amount * v_discount_pct / 100, 2);
  IF v_cap IS NOT NULL THEN
    v_discount := LEAST(v_discount, v_cap);
  END IF;

  INSERT INTO inventory.delivery_promises (
    business_id, sales_event_id, delivery_order_id, promise_token,
    promised_delivery_date, tolerance_days, discount_percent,
    original_amount, adjusted_amount, discount_amount,
    status, gateway_status, payment_context, idempotency_key
  ) VALUES (
    p_business_id, p_sales_event_id, p_delivery_order_id, v_token,
    p_promised_delivery_date, v_tolerance, v_discount_pct,
    p_original_amount, p_original_amount - v_discount, v_discount,
    'compensated', 'ready_capture',
    jsonb_build_object(
      'provider', 'stripe',
      'currency', 'USD',
      'amount', p_original_amount - v_discount,
      'original_amount', p_original_amount,
      'discount', jsonb_build_object(
        'percent', v_discount_pct,
        'amount', v_discount,
        'reason', 'late_delivery',
        'justification', format(
          'ETA estimado supera el umbral de tolerancia (%s dias) del tenant',
          v_tolerance
        )
      ),
      'metadata', jsonb_build_object(
        'promise_token', v_token,
        'sales_event_id', p_sales_event_id,
        'delivery_order_id', p_delivery_order_id
      ),
      'payload_version', 1
    ),
    p_idempotency_key
  ) RETURNING id INTO v_promise_id;

  RETURN jsonb_build_object(
    'promise_id', v_promise_id, 'promise_token', v_token,
    'idempotent', false, 'discount_amount', v_discount
  );
END $$;

-- ----------------------------------------------
-- TRIGGER CX (no bloqueante): SALE_WON -> ETA predictivo -> compensacion
-- ----------------------------------------------
CREATE OR REPLACE FUNCTION inventory.handle_sale_won_cx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_threshold INTEGER;
  v_default_location UUID;
  v_asset_id UUID;
  v_eta_days INTEGER;
BEGIN
  IF NEW.event_type <> 'SALE_WON' THEN
    RETURN NEW;
  END IF;

  -- Toda la logica CX queda protegida: si algo falla (settings, resolucion
  -- de variante, ETA o creacion de promesa) se registra en ingest_errors y
  -- la venta completa SIN promesa. Nunca aborta el INSERT de sales_events
  -- (y por ende nunca revierte el decremento de stock del trigger v3).
  BEGIN
    SELECT cx_promise_enabled, late_delivery_threshold_days
      INTO v_enabled, v_threshold
      FROM inventory.business_settings
      WHERE business_id = NEW.business_id;
    IF NOT FOUND OR NOT v_enabled OR NEW.amount IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT id INTO v_default_location FROM inventory.locations
      WHERE business_id = NEW.business_id
      ORDER BY created_at LIMIT 1;
    IF v_default_location IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT inventory.resolve_variant(NEW.business_id, NEW.product_id, '{}'::jsonb)
      INTO v_asset_id;
    IF v_asset_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT eta_days INTO v_eta_days FROM inventory.calcular_eta(v_asset_id, v_default_location);
    IF v_eta_days IS NULL OR v_eta_days <= v_threshold THEN
      RETURN NEW;
    END IF;

    PERFORM inventory.create_delivery_promise(
      NEW.business_id, NEW.id, NULL,
      now() + make_interval(days => v_eta_days),
      NEW.amount,
      'sale_' || NEW.id::text
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO inventory.ingest_errors (business_id, sales_event_id, error, payload)
    VALUES (NEW.business_id, NEW.id, SQLERRM,
      jsonb_build_object('promise_attempt', true, 'asset_id', v_asset_id, 'eta_days', v_eta_days));
  END;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sales_events_to_cx_promises ON public.sales_events;
CREATE TRIGGER trg_sales_events_to_cx_promises
AFTER INSERT ON public.sales_events
FOR EACH ROW WHEN (NEW.event_type = 'SALE_WON')
EXECUTE FUNCTION inventory.handle_sale_won_cx();

-- =============================================
-- RLS: ENABLE + FORCE + REVOKE en las tablas nuevas
-- =============================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['transfers', 'delivery_promises', 'transfer_counters'])
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

-- ----------------------------------------------
-- Grants de funciones (solo service_role)
-- ----------------------------------------------
GRANT EXECUTE ON FUNCTION inventory.execute_transfer(UUID, UUID, UUID, UUID, INTEGER, TIMESTAMPTZ, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION inventory.complete_transfer(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION inventory.calcular_eta(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION inventory.create_delivery_promise(UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT) TO service_role;
