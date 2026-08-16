-- =============================================
-- 042 Inventario Universal — Resolutor de Variantes Polimórficas
--
-- Un producto del catálogo puede tener MÚLTIPLES variantes como assets
-- (tallas, colores, packs). El puente asset_products deja de ser 1:1
-- (se relaja su UNIQUE(business_id, product_id)) y el trigger SALE_WON
-- resuelve el asset por product_id + attributes (JSONB) con el operador
-- GIN `@>` contra inventory.assets.attributes.
--
-- Reglas de oro (heredadas de 034/040/041):
--   - stock bajo NUNCA bloquea la venta (ingest_errors + sigue)
--   - decremento atomico con guarda (sin negativo)
--   - idempotencia: UNIQUE parcial en el ledger
--   - SECURITY DEFINER + search_path = '' + objetos calificados
--   - RLS ENABLE + FORCE + REVOKE
-- =============================================

-- ----------------------------------------------
-- 1) RELAJAR asset_products a N:M (product -> variantes)
--    El PK (business_id, asset_id) se conserva.
-- ----------------------------------------------
ALTER TABLE inventory.asset_products
  DROP CONSTRAINT IF EXISTS asset_products_business_id_product_id_key;

CREATE INDEX IF NOT EXISTS idx_inventory_asset_products_product
  ON inventory.asset_products(business_id, product_id);

COMMENT ON TABLE inventory.asset_products IS
  'Puente public.products <-> inventory.assets (N:M desde 042). Un producto puede tener varias variantes (tallas/colores/packs); el resolutor usa product_id + attributes. La variante por defecto se marca con attributes->>is_default=true.';

-- ----------------------------------------------
-- 2) ÍNDICE GIN sobre attributes (matcheo en ventas concurrentes)
-- ----------------------------------------------
CREATE INDEX IF NOT EXISTS idx_inventory_assets_attrs_gin
  ON inventory.assets USING GIN (attributes);

-- ----------------------------------------------
-- 3) RESOLVER: product_id + attributes -> asset_id
--    (a) match exacto de atributos (GIN @>)
--    (b) fallback: variante por defecto (is_default / primera creada)
-- ----------------------------------------------
CREATE OR REPLACE FUNCTION inventory.resolve_variant(
  p_business_id UUID,
  p_product_id UUID,
  p_attributes JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_asset_id UUID;
BEGIN
  IF p_product_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- (a) Variante exacta: el asset contiene TODOS los atributos de la linea
  --     de venta. Ej. Fajas Pack Negro-Gris: asset unico con
  --     attributes = {"color": ["negro","gris"], "pack": true}.
  SELECT a.id INTO v_asset_id
    FROM inventory.asset_products ap
    JOIN inventory.assets a ON a.id = ap.asset_id
    WHERE ap.business_id = p_business_id
      AND ap.product_id = p_product_id
      AND a.attributes @> p_attributes
    ORDER BY (a.attributes->>'is_default')::boolean DESC NULLS LAST, a.created_at
    LIMIT 1;

  IF v_asset_id IS NOT NULL THEN
    RETURN v_asset_id;
  END IF;

  -- (b) Sin match (atributos vacios o inexistentes): variante por defecto
  SELECT a.id INTO v_asset_id
    FROM inventory.asset_products ap
    JOIN inventory.assets a ON a.id = ap.asset_id
    WHERE ap.business_id = p_business_id
      AND ap.product_id = p_product_id
    ORDER BY (a.attributes->>'is_default')::boolean DESC NULLS LAST, a.created_at
    LIMIT 1;

  RETURN v_asset_id;
END $$;

COMMENT ON FUNCTION inventory.resolve_variant(UUID, UUID, JSONB) IS
  'Resolutor de variantes: matchea product_id + attributes contra los assets vinculados (GIN @>). Con attributes vacio o sin match, cae a la variante por defecto. Nunca aborta; NULL = no hay asset.';

-- ----------------------------------------------
-- 4) TRIGGER SALE_WON v3 — usa el resolutor de variantes
--    Reemplaza la v2 (041). Contrato conservado; unico cambio en (d).
-- ----------------------------------------------
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
    v_attributes := COALESCE(v_item->'attributes', '{}'::jsonb);
    v_qty := COALESCE((v_item->>'quantity')::int, 1);

    IF v_qty <= 0 THEN
      CONTINUE;
    END IF;

    -- (d) Resolucion de variante: asset directo o product_id + attributes
    IF v_asset_id IS NULL THEN
      v_asset_id := inventory.resolve_variant(NEW.business_id, v_product_id, v_attributes);
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
          jsonb_build_object(
            'asset_id', v_asset_id,
            'product_id', v_product_id,
            'attributes', v_attributes,
            'quantity', v_qty
          )
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
        jsonb_build_object(
          'asset_id', v_asset_id,
          'product_id', v_product_id,
          'attributes', v_attributes,
          'quantity', v_qty
        )
      );
    END;
  END LOOP;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION inventory.handle_sale_won() IS
  'Trigger v3 (Variantes): SALE_WON -> resuelve el asset por product_id + attributes via inventory.resolve_variant (GIN @>) y descuenta el ledger universal. Nunca aborta la venta.';

-- ----------------------------------------------
-- 5) RLS + grants
--    asset_products ya tiene policies de 040; se re-crean por si acaso
--    (DROP no las elimina; solo se asegura el grant de la funcion).
-- ----------------------------------------------

GRANT EXECUTE ON FUNCTION inventory.resolve_variant(UUID, UUID, JSONB) TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA inventory GRANT EXECUTE ON ROUTINES TO service_role;
