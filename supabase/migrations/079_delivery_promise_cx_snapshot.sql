-- ==========================================
-- 079: delivery promise CX desde el snapshot comercial
-- inventory.handle_sale_won_cx() — multi-producto via metadata->items
-- ==========================================
-- Problema: sales_events.product_id es la identidad canónica ESTRICTA (C4,
-- columna), a menudo NULL desde el contrato FASE 1. El trigger CX de promesa
-- de entrega resolvía el asset con resolve_variant(NEW.product_id) → con
-- product_id NULL la venta nacía SIN promesa predictiva aunque metadata->items
-- traiga el snapshot comercial completo.
--
-- Este fix alinea handle_sale_won_cx() con delivery.handle_sale_won() e
-- inventory.handle_sale_won() (052/076/078): el scope se resuelve desde
-- metadata->items, usando el PEOR ETA (max) de los ítems — la promesa de
-- entrega cubre el pedido completo, no un solo producto.
--
-- Decisiones FASE 4:
--   A) scope = metadata->items (fallback NEW.product_id si el snapshot está vacío)
--   B) promesa con el peor ETA de los ítems resueltos (max)
--   C) original_amount = NEW.amount (total determinista/descontado, sin cambio)
--   D) migración nueva (044 es inmutable, regla DB §9); sin schema nuevo
--   E) sin ítems resueltos → sin promesa (igual que 044); las promesas
--      históricas no se re-generan
--
-- Preservado de 044:
--   - Protección por settings (cx_promise_enabled + umbral) y amount NULL
--   - try/EXCEPTION → la venta nunca aborta sin promesa
--   - Idempotencia por idempotency_key 'sale_<id>' en create_delivery_promise
--   - SECURITY DEFINER + search_path = '' + objetos calificados
-- ==========================================

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
  v_items JSONB;
  v_item JSONB;
  v_product_id UUID;
  v_asset_id UUID;
  v_attributes JSONB;
  v_eta_days INTEGER;
  v_worst_eta INTEGER := NULL;
  v_had_asset BOOLEAN := FALSE;
BEGIN
  IF NEW.event_type <> 'SALE_WON' THEN
    RETURN NEW;
  END IF;

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

    -- Scope del pedido: snapshot comercial (metadata->items) o la columna
    -- canónica estricta si el snapshot está vacío (compat 044 / histórico).
    v_items := COALESCE(NEW.metadata->'items', '[]'::jsonb);
    IF jsonb_array_length(v_items) = 0 THEN
      v_items := jsonb_build_array(
        jsonb_build_object('product_id', NEW.product_id::text)
      );
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
      v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
      IF v_product_id IS NULL THEN
        CONTINUE;
      END IF;

      v_attributes := COALESCE(v_item->'attributes', '{}'::jsonb);

      SELECT inventory.resolve_variant(NEW.business_id, v_product_id, v_attributes)
        INTO v_asset_id;
      IF v_asset_id IS NULL THEN
        CONTINUE;
      END IF;

      SELECT eta_days INTO v_eta_days
        FROM inventory.calcular_eta(v_asset_id, v_default_location);
      IF v_eta_days IS NOT NULL THEN
        v_had_asset := TRUE;
        IF v_worst_eta IS NULL OR v_eta_days > v_worst_eta THEN
          v_worst_eta := v_eta_days;
        END IF;
      END IF;
    END LOOP;

    -- Sin assets resueltos → sin promesa (decisión E, compat 044)
    IF NOT v_had_asset OR v_worst_eta IS NULL OR v_worst_eta <= v_threshold THEN
      RETURN NEW;
    END IF;

    PERFORM inventory.create_delivery_promise(
      NEW.business_id, NEW.id, NULL,
      now() + make_interval(days => v_worst_eta),
      NEW.amount,
      'sale_' || NEW.id::text
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO inventory.ingest_errors (business_id, sales_event_id, error, payload)
    VALUES (
      NEW.business_id, NEW.id, SQLERRM,
      jsonb_build_object(
        'promise_attempt', true,
        'worst_eta', v_worst_eta,
        'had_asset', v_had_asset
      )
    );
  END;

  RETURN NEW;
END $$;

-- El trigger trg_sales_events_to_cx_promises (044) invoca la función por
-- nombre con firma () → CREATE OR REPLACE la reemplaza sin recrear el trigger.