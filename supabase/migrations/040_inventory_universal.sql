-- =============================================
-- 040 Inventory Universal — assets polimórfico + ledger universal + predictions
--
-- Evoluciona el Inventory Hub (034) hacia el "Inventario Universal" multi-industria
-- (ecommerce / manufactura / inmobiliaria). ADR-020: modulo operativo aislado.
--
-- Nuevas tablas: inventory.locations, inventory.assets, inventory.asset_products,
-- inventory.predictions.
-- ALTER: inventory.stock_movements -> ledger universal (asset_id, costos, lot, lifecycle).
-- ALTER: inventory.business_settings -> vertical + prediction_mode + min/max defaults.
-- Backfill idempotente: stock_items -> assets (sku) + puente + movimientos -> asset_id.
--
-- Reglas de oro (heredadas de 034):
--   - stock bajo NUNCA bloquea la venta
--   - decremento atomico con guarda (sin negativo)
--   - idempotencia: UNIQUE parcial
--   - RLS ENABLE + FORCE + REVOKE en TODAS las tablas
-- =============================================

-- -------------------------------------------------
-- LOCATIONS (almacen / planta / sucursal / seccion)
-- -------------------------------------------------
CREATE TABLE inventory.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'warehouse' CHECK (kind IN ('warehouse', 'plant', 'store', 'section')),
  address TEXT,
  attributes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

CREATE INDEX idx_inventory_locations_business ON inventory.locations(business_id);

COMMENT ON TABLE inventory.locations IS
  'Ubicaciones operativas (almacen, planta, sucursal). Ancla de inventory.assets.location_id.';

-- -------------------------------------------------
-- ASSETS — el item universal
-- -------------------------------------------------
CREATE TABLE inventory.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'sku' CHECK (item_type IN ('sku', 'material', 'asset')),
  tracking_mode TEXT NOT NULL DEFAULT 'quantity' CHECK (tracking_mode IN ('quantity', 'serial', 'single')),
  code TEXT,
  name TEXT NOT NULL,
  attributes JSONB DEFAULT '{}'::jsonb,
  uom TEXT NOT NULL DEFAULT 'u',
  lifecycle_state TEXT NOT NULL DEFAULT 'active',
  location_id UUID REFERENCES inventory.locations(id) ON DELETE SET NULL,
  parent_asset_id UUID REFERENCES inventory.assets(id) ON DELETE SET NULL,
  current_qty INTEGER NOT NULL DEFAULT 0 CHECK (current_qty >= 0),
  min_qty INTEGER,
  max_qty INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_assets_business ON inventory.assets(business_id, is_active);
CREATE INDEX idx_inventory_assets_code ON inventory.assets(business_id, code);
CREATE INDEX idx_inventory_assets_location ON inventory.assets(location_id);
CREATE INDEX idx_inventory_assets_parent ON inventory.assets(parent_asset_id);
CREATE INDEX idx_inventory_assets_attrs_gin ON inventory.assets USING GIN (attributes);

COMMENT ON TABLE inventory.assets IS
  'Item universal agnostico al tipo de producto: SKU de ecommerce, material/PT de manufactura o activo inmobiliario. tracking_mode decide si se cuenta (quantity), se serializa (serial) o se gobierna por ciclo de vida (single). attributes JSONB guarda el perfil por vertical.';
COMMENT ON COLUMN inventory.assets.version IS
  'Optimistic concurrency: cada update atomico incrementa version.';
COMMENT ON COLUMN inventory.assets.current_qty IS
  'Solo relevante para tracking_mode=quantity. NULL-able via CHECK en el futuro; por ahora INTEGER >= 0 (coherente con stock_items).';
COMMENT ON COLUMN inventory.assets.parent_asset_id IS
  'BOM: producto terminado -> insumos (manufactura).';

-- -------------------------------------------------
-- ASSET PRODUCTS — puente producto <-> asset (trigger SALE_WON)
-- -------------------------------------------------
CREATE TABLE inventory.asset_products (
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES inventory.assets(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  PRIMARY KEY (business_id, asset_id),
  UNIQUE (business_id, product_id)
);

CREATE INDEX idx_inventory_asset_products_product ON inventory.asset_products(product_id);

COMMENT ON TABLE inventory.asset_products IS
  'Puente public.products <-> inventory.assets. El trigger SALE_WON resuelve el producto de la venta a su asset para descontar el ledger universal.';

-- -------------------------------------------------
-- LEDGER UNIVERSAL: ALTER stock_movements
-- -------------------------------------------------
ALTER TABLE inventory.stock_movements
  ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES inventory.assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS total_cost NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS lot_id TEXT,
  ADD COLUMN IF NOT EXISTS lifecycle_from TEXT,
  ADD COLUMN IF NOT EXISTS lifecycle_to TEXT,
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES inventory.locations(id) ON DELETE SET NULL;

COMMENT ON COLUMN inventory.stock_movements.unit_cost IS
  'Costo unitario en el momento del movimiento (base para FIFO/promedio en fase de valoracion posterior).';
COMMENT ON COLUMN inventory.stock_movements.total_cost IS
  'unit_cost * |quantity_delta|.';
COMMENT ON COLUMN inventory.stock_movements.lifecycle_from IS
  'Transicion de estado (ej. raw -> wip -> finished) para tracking_mode serial/single (F2/F3).';
COMMENT ON COLUMN inventory.stock_movements.asset_id IS
  'Nuevo ancla universal; product_id se conserva por compatibilidad con el trigger y el modelo legacy.';

-- Dedupe universal: una venta descuenta una sola vez por asset.
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_movements_sale_dedupe_asset
  ON inventory.stock_movements(business_id, asset_id, reference_id)
  WHERE reference_type = 'sales_event' AND reference_id IS NOT NULL AND asset_id IS NOT NULL;

COMMENT ON INDEX inventory.idx_inventory_movements_sale_dedupe_asset IS
  'Idempotencia del trigger v2: un sales_event solo descuenta una vez por asset. Complementa el dedupe legacy por product_id.';

-- -------------------------------------------------
-- PREDICTIONS — salida normalizada del motor hibrido
-- -------------------------------------------------
CREATE TABLE inventory.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES inventory.assets(id) ON DELETE CASCADE,
  horizon_days INTEGER NOT NULL DEFAULT 30,
  model TEXT NOT NULL DEFAULT 'hybrid' CHECK (model IN ('minmax', 'trend', 'hybrid')),
  forecast_qty NUMERIC(12, 2),
  suggested_qty INTEGER,
  reorder_point INTEGER,
  min_qty INTEGER,
  max_qty INTEGER,
  velocity7d INTEGER NOT NULL DEFAULT 0,
  velocity30d INTEGER NOT NULL DEFAULT 0,
  lead_time_days INTEGER NOT NULL DEFAULT 3,
  confidence NUMERIC(5, 4),
  inputs JSONB DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_inventory_predictions_unique
  ON inventory.predictions(business_id, asset_id, horizon_days, model);
CREATE INDEX idx_inventory_predictions_business
  ON inventory.predictions(business_id, generated_at DESC);

COMMENT ON TABLE inventory.predictions IS
  'Resultado normalizado del motor de prediccion hibrido (minmax/trend/hybrid). Determinista por defecto; la interpretacion en lenguaje natural (opcional) se trackea aparte via ai_usage.';

-- -------------------------------------------------
-- BUSINESS SETTINGS: vertical + config de prediccion
-- -------------------------------------------------
ALTER TABLE inventory.business_settings
  ADD COLUMN IF NOT EXISTS vertical TEXT NOT NULL DEFAULT 'ecommerce'
    CHECK (vertical IN ('ecommerce', 'manufacturing', 'realestate')),
  ADD COLUMN IF NOT EXISTS prediction_mode TEXT NOT NULL DEFAULT 'hybrid'
    CHECK (prediction_mode IN ('minmax', 'trend', 'hybrid')),
  ADD COLUMN IF NOT EXISTS default_min_qty INTEGER,
  ADD COLUMN IF NOT EXISTS default_max_qty INTEGER;

COMMENT ON COLUMN inventory.business_settings.vertical IS
  'Vertical del negocio: ecommerce | manufacturing | realestate. Selecciona el engine de prediccion y los paneles de UI.';
COMMENT ON COLUMN inventory.business_settings.prediction_mode IS
  'Logica de reabastecimiento: minmax (reglas), trend (historico), hybrid (mezcla).';

-- =============================================
-- BACKFILL IDEMPOTENTE: stock_items -> assets
-- =============================================
INSERT INTO inventory.assets (
  business_id, item_type, tracking_mode, code, name, attributes, uom,
  lifecycle_state, current_qty, min_qty, version, is_active, created_at, updated_at
)
SELECT
  si.business_id, 'sku', 'quantity', p.sku, p.name,
  jsonb_build_object('product_id', si.product_id::text),
  'u', 'active', si.quantity, si.low_stock_threshold, si.version, true,
  si.created_at, si.updated_at
FROM inventory.stock_items si
JOIN public.products p ON p.id = si.product_id
WHERE NOT EXISTS (
  SELECT 1 FROM inventory.asset_products ap
  WHERE ap.business_id = si.business_id AND ap.product_id = si.product_id
);

-- Puente asset_products desde el atributo temporal 'product_id'
INSERT INTO inventory.asset_products (business_id, asset_id, product_id)
SELECT a.business_id, a.id, (a.attributes->>'product_id')::uuid
FROM inventory.assets a
WHERE a.item_type = 'sku'
  AND a.attributes ? 'product_id'
ON CONFLICT (business_id, product_id) DO NOTHING;

-- Ledger legacy -> asset_id (solo los que no lo tienen)
UPDATE inventory.stock_movements m
SET asset_id = ap.asset_id
FROM inventory.asset_products ap
WHERE m.business_id = ap.business_id
  AND m.product_id = ap.product_id
  AND m.asset_id IS NULL;

-- =============================================
-- RLS: ENABLE + FORCE + REVOKE en las tablas nuevas
-- =============================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['locations', 'assets', 'asset_products', 'predictions'])
  LOOP
    EXECUTE format('ALTER TABLE inventory.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE inventory.%I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON inventory.%I FROM anon, authenticated', tbl);
    EXECUTE format('REVOKE ALL ON inventory.%I FROM PUBLIC', tbl);
  END LOOP;
END $$;

CREATE POLICY "inventory_locations_owner" ON inventory.locations
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "inventory_assets_owner" ON inventory.assets
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "inventory_asset_products_owner" ON inventory.asset_products
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "inventory_predictions_owner" ON inventory.predictions
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));
