-- ==========================================
-- 052: Fix triggers — delivery + inventory
-- F1: delivery.handle_sale_won() — address from metadata + delivery_cost
-- F2: inventory.handle_sale_won() — polymorphic variants + correct column names
-- ==========================================

-- ============================================================
-- FIX F1: delivery.handle_sale_won()
-- Changes from original 031:
--   - Address/name/phone extracted from NEW.metadata->'customer' (Fix #1)
--   - Fallback to public.customers if metadata missing
--   - delivery_cost copied from NEW.delivery_cost (Fix #4)
-- Preserved from original:
--   - order_number via order_counters (sequential ORD-XXXXXX)
--   - All FK columns (conversation_id, customer_id, product_id)
--   - Correct column names (phone, address, city — NOT customer_phone etc.)
--   - Status 'pending_assignment' (NOT 'pending')
--   - Error column name 'error' (NOT 'error_message')
-- ============================================================

CREATE OR REPLACE FUNCTION delivery.handle_sale_won()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_settings delivery.business_settings%ROWTYPE;
  v_cust_name TEXT;
  v_cust_phone TEXT;
  v_cust_address TEXT;
  v_cust_city TEXT;
  v_reference TEXT;
  v_next INTEGER;
BEGIN
  IF NEW.event_type <> 'SALE_WON' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_settings FROM delivery.business_settings
    WHERE business_id = NEW.business_id AND enabled = true;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- FIX #1: Extract customer data from event metadata (captures chat-time address)
  v_cust_name := NEW.metadata->'customer'->>'name';
  v_cust_phone := NEW.metadata->'customer'->>'phone';
  v_cust_address := NEW.metadata->'customer'->>'address';
  v_cust_city := NEW.metadata->'customer'->>'city';
  v_reference := NEW.metadata->'customer'->>'reference';

  -- Fallback: if metadata missing address, query customer profile
  IF v_cust_address IS NULL AND NEW.customer_id IS NOT NULL THEN
    SELECT name, phone, address, city
      INTO v_cust_name, v_cust_phone, v_cust_address, v_cust_city
    FROM public.customers WHERE id = NEW.customer_id;
  END IF;

  -- Sequential order numbering per business (atomic)
  INSERT INTO delivery.order_counters (business_id, last_number)
    VALUES (NEW.business_id, 1)
  ON CONFLICT (business_id)
    DO UPDATE SET last_number = delivery.order_counters.last_number + 1
  RETURNING last_number INTO v_next;

  BEGIN
    INSERT INTO delivery.orders (
      business_id, sales_event_id, conversation_id, customer_id, product_id,
      order_number, customer_name, phone, address, city,
      amount, paid_at_sale, items, source,
      delivery_cost
    ) VALUES (
      NEW.business_id, NEW.id, NEW.conversation_id, NEW.customer_id, NEW.product_id,
      'ORD-' || lpad(v_next::text, 6, '0'),
      COALESCE(v_cust_name, 'Cliente'),
      v_cust_phone,
      v_cust_address,
      v_cust_city,
      NEW.amount,
      COALESCE((NEW.metadata->>'paid_at_sale')::boolean, true),
      COALESCE(NEW.metadata->'items', '[]'::jsonb),
      NEW.metadata,
      COALESCE(NEW.delivery_cost, 0.00)
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO delivery.ingest_errors (business_id, sales_event_id, error, payload)
    VALUES (NEW.business_id, NEW.id, SQLERRM, NEW.metadata);
  END;

  RETURN NEW;
END $$;


-- ============================================================
-- FIX F2: inventory.handle_sale_won()
-- Changes from v4 (051):
--   - Restored polymorphic variant resolution via resolve_variant() (Fix #5)
--   - COGS from assets.unit_cost with fallback to products.cost
-- Preserved from v4:
--   - Targets inventory.assets (current_qty), NOT stock_items
--   - products.cost (NOT products.price)
--   - Per-item BEGIN/EXCEPTION error isolation
--   - Idempotency check on stock_movements
--   - tracking_mode filter (skip serial/single)
-- Preserved from v3:
--   - resolve_variant() for polymorphic attributes
-- Correct column names:
--   - reference_id + reference_type (NOT 'reference')
--   - error (NOT 'error_message')
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
  v_attributes JSONB;
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
    v_attributes := COALESCE(v_item->'attributes', '{}'::jsonb);
    v_qty := COALESCE((v_item->>'quantity')::int, 1);

    IF v_qty <= 0 THEN
      CONTINUE;
    END IF;

    -- FIX #5: Polymorphic variant resolution (restored from v3)
    -- If item has attributes (size, color), resolve specific variant
    IF v_asset_id IS NULL AND v_product_id IS NOT NULL THEN
      v_asset_id := inventory.resolve_variant(NEW.business_id, v_product_id, v_attributes);
    END IF;

    -- Fallback: 1:1 asset_products lookup (v2 style)
    IF v_asset_id IS NULL AND v_product_id IS NOT NULL THEN
      SELECT ap.asset_id INTO v_asset_id
        FROM inventory.asset_products ap
        WHERE ap.business_id = NEW.business_id
          AND ap.product_id = v_product_id;
    END IF;

    IF v_asset_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Skip non-quantity tracking (serial/single assets)
    IF EXISTS (
      SELECT 1 FROM inventory.assets a
      WHERE a.id = v_asset_id
        AND a.business_id = NEW.business_id
        AND a.tracking_mode <> 'quantity'
    ) THEN
      CONTINUE;
    END IF;

    -- Idempotency: skip if movement already recorded for this event+asset
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
      -- COGS: asset-level unit_cost > product-level cost > 0
      v_unit_cost := 0;
      IF v_asset_id IS NOT NULL THEN
        SELECT COALESCE(unit_cost, 0) INTO v_unit_cost
          FROM inventory.assets WHERE id = v_asset_id;
      END IF;
      IF v_unit_cost = 0 AND v_product_id IS NOT NULL THEN
        SELECT COALESCE(cost, 0) INTO v_unit_cost
          FROM public.products WHERE id = v_product_id;
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


-- ============================================================
-- Backfill: fix historical delivery_cost on existing orders
-- where the sales_events already have a delivery_cost set
-- ============================================================
UPDATE delivery.orders o
SET delivery_cost = se.delivery_cost
FROM public.sales_events se
WHERE o.sales_event_id = se.id
  AND o.delivery_cost = 0
  AND se.delivery_cost > 0;
