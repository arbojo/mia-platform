-- =============================================
-- 034 Inventory Hub — schema `inventory` + triggers
--
-- ADR-020: modulo operativo aislado (patron ADR-019).
-- El core de ventas (public) permanece purista; el stock vive
-- en su propio schema y el unico puente con MIA es el trigger
-- sobre public.sales_events (SALE_WON).
--
-- Reglas de oro:
--   - stock bajo NUNCA bloquea la venta (ingest_errors + sigue)
--   - decremento atomico con guarda `quantity >= qty` (sin negativo)
--   - idempotencia: UNIQUE parcial (business_id, product_id, sales_event_id)
--   - RLS ENABLE + FORCE + REVOKE en TODAS las tablas
-- =============================================

CREATE SCHEMA IF NOT EXISTS inventory;

-- -------------------------------------------------
-- BUSINESS SETTINGS (gate por negocio)
-- -------------------------------------------------
CREATE TABLE inventory.business_settings (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  default_low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (default_low_stock_threshold >= 0),
  lead_time_days INTEGER NOT NULL DEFAULT 3 CHECK (lead_time_days >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE inventory.business_settings IS
  'Habilitacion por negocio del Inventory Hub. Sin enabled=true el trigger no descuenta stock.';

-- -------------------------------------------------
-- STOCK ITEMS
-- -------------------------------------------------
CREATE TABLE inventory.stock_items (
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, product_id)
);

CREATE INDEX idx_inventory_stock_business ON inventory.stock_items(business_id, updated_at DESC);
CREATE INDEX idx_inventory_stock_product ON inventory.stock_items(product_id);

COMMENT ON COLUMN inventory.stock_items.version IS
  'Optimistic concurrency: cada update atómico incrementa version. Los ajustes admin concurrentes detectan conflicto.';

-- -------------------------------------------------
-- STOCK MOVEMENTS (ledger append-only)
-- -------------------------------------------------
CREATE TABLE inventory.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_delta INTEGER NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'initial', 'sale', 'purchase', 'adjustment', 'restock', 'waste', 'return', 'import'
  )),
  reference_id UUID,
  reference_type TEXT,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_movements_business ON inventory.stock_movements(business_id, created_at DESC);
CREATE INDEX idx_inventory_movements_product ON inventory.stock_movements(product_id);

-- Idempotencia del trigger: un sales_event solo descuenta una vez por producto.
CREATE UNIQUE INDEX idx_inventory_movements_sale_dedupe
  ON inventory.stock_movements(business_id, product_id, reference_id)
  WHERE reference_type = 'sales_event' AND reference_id IS NOT NULL;

COMMENT ON INDEX inventory.idx_inventory_movements_sale_dedupe IS
  'Garantiza que la re-emision del mismo SALE_WON no descuente stock dos veces.';

-- -------------------------------------------------
-- RESTOCK SUGGESTIONS (determinista + IA on-demand)
-- -------------------------------------------------
CREATE TABLE inventory.restock_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  current_quantity INTEGER NOT NULL,
  low_stock_threshold INTEGER NOT NULL,
  suggested_qty INTEGER NOT NULL,
  reason JSONB DEFAULT '{}'::jsonb,
  ai_summary TEXT,
  ai_used BOOLEAN NOT NULL DEFAULT false,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed', 'done')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_suggestions_business
  ON inventory.restock_suggestions(business_id, status, generated_at DESC);

-- -------------------------------------------------
-- INGEST ERRORS (fallos del trigger; nunca abortan la venta)
-- -------------------------------------------------
CREATE TABLE inventory.ingest_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sales_event_id UUID REFERENCES public.sales_events(id) ON DELETE SET NULL,
  error TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_ingest_errors_created ON inventory.ingest_errors(created_at DESC);

-- -------------------------------------------------
-- AUDIT LOG
-- -------------------------------------------------
CREATE TABLE inventory.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL,
  actor_id UUID,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_audit_business ON inventory.audit_log(business_id, created_at DESC);

-- =============================================
-- RLS: ENABLE + FORCE + REVOKE en TODAS las tablas inventory.*
-- =============================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'inventory'
  LOOP
    EXECUTE format('ALTER TABLE inventory.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE inventory.%I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON inventory.%I FROM anon, authenticated', tbl);
    EXECUTE format('REVOKE ALL ON inventory.%I FROM PUBLIC', tbl);
  END LOOP;
END $$;

CREATE POLICY "inventory_settings_owner" ON inventory.business_settings
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "inventory_stock_items_owner" ON inventory.stock_items
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "inventory_movements_owner" ON inventory.stock_movements
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "inventory_suggestions_owner" ON inventory.restock_suggestions
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "inventory_ingest_errors_owner" ON inventory.ingest_errors
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "inventory_audit_owner" ON inventory.audit_log
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

-- =============================================
-- Extender ai_usage.request_type para el modulo de inventario
-- =============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_usage_request_type_check'
      AND conrelid = 'public.ai_usage'::regclass
  ) THEN
    ALTER TABLE public.ai_usage DROP CONSTRAINT ai_usage_request_type_check;
  END IF;
END $$;

ALTER TABLE public.ai_usage ADD CONSTRAINT ai_usage_request_type_check
  CHECK (request_type IN ('training', 'simulation', 'live_customer', 'inventory'));

-- =============================================
-- TRIGGER: Replicacion SALE_WON -> stock (decremento atomico)
-- SECURITY DEFINER con search_path='' y objetos calificados.
-- Un fallo aqui NUNCA aborta la venta: se registra en ingest_errors.
-- =============================================

CREATE OR REPLACE FUNCTION inventory.handle_sale_won()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_items JSONB;
  v_item JSONB;
  v_product_id UUID;
  v_qty INTEGER;
  v_updated INTEGER;
BEGIN
  IF NEW.event_type <> 'SALE_WON' THEN
    RETURN NEW;
  END IF;

  -- (a) Negocio sin modulo habilitado -> no descuenta
  SELECT enabled INTO v_enabled FROM inventory.business_settings
    WHERE business_id = NEW.business_id;
  IF NOT FOUND OR NOT v_enabled THEN
    RETURN NEW;
  END IF;

  -- (b) Lineas de la venta desde metadata->items
  v_items := COALESCE(NEW.metadata->'items', '[]'::jsonb);

  IF jsonb_array_length(v_items) = 0 AND NEW.product_id IS NOT NULL THEN
    v_items := jsonb_build_array(
      jsonb_build_object('product_id', NEW.product_id::text, 'quantity', 1)
    );
  END IF;

  -- (c) Decremento atomico por linea (idempotente, sin stock negativo)
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::int, 1);

    IF v_product_id IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM inventory.stock_movements m
      WHERE m.business_id = NEW.business_id
        AND m.product_id = v_product_id
        AND m.reference_type = 'sales_event'
        AND m.reference_id = NEW.id
    ) THEN
      CONTINUE;
    END IF;

    BEGIN
      UPDATE inventory.stock_items
      SET quantity = quantity - v_qty,
          version = version + 1,
          updated_at = now()
      WHERE business_id = NEW.business_id
        AND product_id = v_product_id
        AND quantity >= v_qty;

      GET DIAGNOSTICS v_updated = ROW_COUNT;

      IF v_updated = 0 THEN
        INSERT INTO inventory.ingest_errors (business_id, sales_event_id, error, payload)
        VALUES (
          NEW.business_id, NEW.id, 'INSUFFICIENT_STOCK',
          jsonb_build_object('product_id', v_product_id, 'quantity', v_qty)
        );
      ELSE
        INSERT INTO inventory.stock_movements (
          business_id, product_id, quantity_delta, movement_type,
          reference_id, reference_type, reason
        ) VALUES (
          NEW.business_id, v_product_id, -v_qty, 'sale',
          NEW.id, 'sales_event', 'Venta confirmada (SALE_WON)'
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO inventory.ingest_errors (business_id, sales_event_id, error, payload)
      VALUES (
        NEW.business_id, NEW.id, SQLERRM,
        jsonb_build_object('product_id', v_product_id, 'quantity', v_qty)
      );
    END;
  END LOOP;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_sales_events_to_inventory
AFTER INSERT ON public.sales_events
FOR EACH ROW WHEN (NEW.event_type = 'SALE_WON')
EXECUTE FUNCTION inventory.handle_sale_won();
