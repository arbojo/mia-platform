-- =============================================
-- 030: Catálogo SKU-Centric — columna sku en products
--
-- Añade el identificador de inventario (SKU) al producto como campo
-- opcional. Es la base del rediseño de catálogo estilo QuickSell
-- (hub por producto): la tarjeta y el detalle muestran Título, SKU,
-- Precio y multimedia atada al product_id.
--
-- sku es NULLABLE:
--   NULL  = producto sin SKU (onboarding y carga manual sin fricción)
--   valor = identificador único DENTRO del negocio (índice parcial)
--
-- El índice único parcial garantiza unicidad por negocio solo cuando
-- el usuario completa el SKU, sin romper filas existentes ni obligar
-- a migrar datos previos.
-- =============================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_business
  ON public.products(business_id, sku)
  WHERE sku IS NOT NULL;

COMMENT ON COLUMN public.products.sku IS
  'Identificador de inventario (SKU) del producto. Opcional y único por negocio. NULL = sin SKU definido.';
