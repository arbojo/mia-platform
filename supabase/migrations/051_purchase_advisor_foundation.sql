-- ============================================================
-- 051: Purchase Advisor Foundation — Data corrections + new columns
-- ============================================================

-- ============================================================
-- 1. FIX: handle_sale_won v4 — use products.cost for unit_cost
-- ============================================================
-- The v3 trigger (migration 042) uses products.price as unit_cost proxy.
-- This is wrong: unit_cost should be the acquisition cost, not selling price.
-- ============================================================

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
  v_asset_id UUID;
  v_qty INTEGER;
  v_unit_cost NUMERIC(12, 2);
  v_updated INTEGER;
BEGIN
  IF NEW.event_type <> 'SALE_WON' THEN
    RETURN NEW;
  END IF;

  SELECT enabled INTO v_enabled FROM inventory.business_settings
    WHERE business_id = NEW.business_id;
  IF NOT FOUND OR NOT v_enabled THEN
    RETURN NEW;
  END IF;

  v_items := COALESCE(NEW.metadata->'items', '[]'::jsonb);

  IF jsonb_array_length(v_items) = 0 AND NEW.product_id IS NOT NULL THEN
    v_items := jsonb_build_array(
      jsonb_build_object('product_id', NEW.product_id::text, 'quantity', 1)
    );
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_asset_id := NULLIF(v_item->>'asset_id', '')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::int, 1);

    IF v_qty <= 0 THEN
      CONTINUE;
    END IF;

    IF v_asset_id IS NULL AND v_product_id IS NOT NULL THEN
      SELECT ap.asset_id INTO v_asset_id
        FROM inventory.asset_products ap
        WHERE ap.business_id = NEW.business_id
          AND ap.product_id = v_product_id;
    END IF;

    IF v_asset_id IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM inventory.assets a
      WHERE a.id = v_asset_id
        AND a.business_id = NEW.business_id
        AND a.tracking_mode <> 'quantity'
    ) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM inventory.stock_movements m
      WHERE m.business_id = NEW.business_id
        AND m.asset_id = v_asset_id
        AND m.reference_type = 'sales_event'
        AND m.reference_id = NEW.id
    ) THEN
      CONTINUE;
    END IF;

    BEGIN
      -- FIX v4: use products.cost (acquisition cost) instead of products.price (selling price)
      v_unit_cost := 0;
      IF v_product_id IS NOT NULL THEN
        SELECT COALESCE(cost, 0) INTO v_unit_cost FROM public.products WHERE id = v_product_id;
      END IF;

      UPDATE inventory.assets
      SET current_qty = current_qty - v_qty,
          version = version + 1,
          updated_at = now()
      WHERE business_id = NEW.business_id
        AND id = v_asset_id
        AND current_qty >= v_qty;

      GET DIAGNOSTICS v_updated = ROW_COUNT;

      IF v_updated = 0 THEN
        INSERT INTO inventory.ingest_errors (business_id, sales_event_id, error, payload)
        VALUES (
          NEW.business_id, NEW.id, 'INSUFFICIENT_STOCK',
          jsonb_build_object('asset_id', v_asset_id, 'product_id', v_product_id, 'quantity', v_qty)
        );
      ELSE
        INSERT INTO inventory.stock_movements (
          business_id, product_id, asset_id, quantity_delta, movement_type,
          unit_cost, total_cost, reference_id, reference_type, reason
        ) VALUES (
          NEW.business_id, v_product_id, v_asset_id, -v_qty, 'sale',
          v_unit_cost, v_unit_cost * v_qty,
          NEW.id, 'sales_event', 'Venta confirmada (SALE_WON)'
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO inventory.ingest_errors (business_id, sales_event_id, error, payload)
      VALUES (
        NEW.business_id, NEW.id, SQLERRM,
        jsonb_build_object('asset_id', v_asset_id, 'product_id', v_product_id, 'quantity', v_qty, 'attributes', (SELECT attributes FROM inventory.assets WHERE id = v_asset_id))
      );
    END;
  END LOOP;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION inventory.handle_sale_won() IS
  'Trigger v4: SALE_WON -> decremento atomico. v4 fix: usa products.cost (acquisition cost) en vez de products.price para unit_cost.';

-- ============================================================
-- 2. Backfill: correct historical unit_cost using products.cost
-- ============================================================
-- Only update rows where the old unit_cost matched products.price
-- and products.cost is available and different.

UPDATE inventory.stock_movements sm
SET unit_cost = p.cost,
    total_cost = ABS(sm.quantity_delta) * p.cost
FROM public.products p
WHERE sm.product_id = p.id
  AND sm.movement_type = 'sale'
  AND p.cost IS NOT NULL
  AND sm.unit_cost = p.price;

-- ============================================================
-- 3. Delivery cost per order
-- ============================================================

ALTER TABLE public.sales_events
  ADD COLUMN IF NOT EXISTS delivery_cost NUMERIC(12,2) DEFAULT 0;

ALTER TABLE delivery.orders
  ADD COLUMN IF NOT EXISTS delivery_cost NUMERIC(12,2) DEFAULT 0;

-- ============================================================
-- 4. Delivery zones
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  delivery_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  cities TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_business
  ON inventory.delivery_zones (business_id, is_active);

-- ============================================================
-- 5. Asset unit_cost (cost of acquisition)
-- ============================================================

ALTER TABLE inventory.assets
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,2);

-- Backfill from products.cost where asset is linked to a product
UPDATE inventory.assets a
SET unit_cost = p.cost
FROM inventory.asset_products ap
JOIN public.products p ON p.id = ap.product_id
WHERE a.id = ap.asset_id
  AND p.cost IS NOT NULL
  AND a.unit_cost IS NULL;

-- ============================================================
-- 6. Purchase order cost fields
-- ============================================================

ALTER TABLE inventory.purchase_orders
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS unit_cost_at_suggestion NUMERIC(12,2);

-- Backfill estimated_cost from existing suggested POs
UPDATE inventory.purchase_orders po
SET unit_cost_at_suggestion = a.unit_cost,
    estimated_cost = po.qty_suggested * COALESCE(a.unit_cost, 0)
FROM inventory.assets a
WHERE po.asset_id = a.id
  AND po.estimated_cost IS NULL
  AND a.unit_cost IS NOT NULL;

-- ============================================================
-- 7. Budget settings
-- ============================================================

ALTER TABLE inventory.business_settings
  ADD COLUMN IF NOT EXISTS monthly_purchase_budget NUMERIC(14,2);

-- NO current_month_spend column — calculated on the fly from POs
-- current_month_spend = SUM(estimated_cost) WHERE status IN ('ordered','in_transit','received')
--   AND created_at >= date_trunc('month', now())

-- ============================================================
-- 8. Refresh product_margin view (unit_cost now uses real costs)
-- ============================================================
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.product_margin;
