-- =============================================
-- 041 Inventory Universal — trigger handle_sale_won v2 (ledger universal)
--
-- Reemplaza el handle_sale_won de 034. Contrato conservado:
--   - stock bajo NUNCA bloquea la venta (ingest_errors + sigue)
--   - decremento atomico con guarda `current_qty >= qty` (sin negativo)
--   - idempotencia: UNIQUE parcial (dedupe legacy por product_id + nuevo por asset_id)
--   - SECURITY DEFINER, search_path = '' y objetos calificados
--
-- Cambios v2:
--   - resuelve producto -> asset via inventory.asset_products (o asset_id directo)
--   - solo opera tracking_mode='quantity' (serial/single lifecycle -> F2/F3)
--   - escribe ledger universal con unit_cost/total_cost (proxy: public.products.price)
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
  v_asset_id UUID;
  v_qty INTEGER;
  v_unit_cost NUMERIC(12, 2);
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
    v_asset_id := NULLIF(v_item->>'asset_id', '')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::int, 1);

    IF v_qty <= 0 THEN
      CONTINUE;
    END IF;

    -- (d) Resolver asset: directo o via puente asset_products
    IF v_asset_id IS NULL AND v_product_id IS NOT NULL THEN
      SELECT ap.asset_id INTO v_asset_id
        FROM inventory.asset_products ap
        WHERE ap.business_id = NEW.business_id
          AND ap.product_id = v_product_id;
    END IF;

    IF v_asset_id IS NULL THEN
      CONTINUE;
    END IF;

    -- (e) Solo tracking_mode=quantity en esta version (F1)
    IF EXISTS (
      SELECT 1 FROM inventory.assets a
      WHERE a.id = v_asset_id
        AND a.business_id = NEW.business_id
        AND a.tracking_mode <> 'quantity'
    ) THEN
      CONTINUE;
    END IF;

    -- (f) Idempotencia: el evento ya fue procesado para este asset
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
      -- (g) unit_cost proxy desde el precio del producto
      v_unit_cost := 0;
      IF v_product_id IS NOT NULL THEN
        SELECT price INTO v_unit_cost FROM public.products WHERE id = v_product_id;
        v_unit_cost := COALESCE(v_unit_cost, 0);
      END IF;

      -- (h) Decremento atomico con guarda
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
        jsonb_build_object('asset_id', v_asset_id, 'product_id', v_product_id, 'quantity', v_qty)
      );
    END;
  END LOOP;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION inventory.handle_sale_won() IS
  'Trigger v2 (Inventario Universal F1): SALE_WON -> decremento atomico de inventory.assets.current_qty via asset_products y registro en el ledger universal con costos. Nunca aborta la venta.';
