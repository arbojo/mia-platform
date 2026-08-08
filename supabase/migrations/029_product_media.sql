-- =============================================
-- 029: Medios por Producto — product_id en multimedia
--
-- Asocia cada knowledge_item multimedia (image_url) al producto del
-- catálogo al que pertenece explícitamente. Elimina la ambigüedad del
-- matcher por keywords cuando varios productos comparten gatillo
-- (ej. "precio").
--
-- product_id es NULLABLE:
--   NULL  = medio genérico (aplica a cualquier producto)
--   valor = medio específico del producto
--
-- No crea tablas paralelas (respeta ADR-014): el medio sigue viviendo
-- en knowledge_items y solo se etiqueta con su producto.
-- =============================================

ALTER TABLE public.knowledge_items
  ADD COLUMN IF NOT EXISTS product_id UUID
    REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_product
  ON public.knowledge_items(product_id);

COMMENT ON COLUMN public.knowledge_items.product_id IS
  'Producto del catálogo al que pertenece el medio. NULL = medio genérico (aplica a cualquier producto).';

COMMENT ON COLUMN public.knowledge_items.trigger_condition IS
  'Gatillo por palabras clave. Con product_id se interpreta como refinamiento DENTRO de ese producto, eliminando conflictos de keywords compartidas entre productos.';
