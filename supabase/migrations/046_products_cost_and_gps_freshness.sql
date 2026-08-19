-- =============================================
-- 046 Delivery Hub Command Center
--
-- 1. products.cost: costo de adquisicion/fabricacion
--    para calculo de margen de utilidad (Delivery Hub).
--    Nullable porque products existentes no lo tienen.
--
-- 2. drivers.last_gps_at: timestamp de la ultima
--    posicion GPS conocida. Usado para detectar
--    GPS congelado (tunel/pila muerta) en el mapa.
-- =============================================

-- 1. Campo cost en products (schema public)
ALTER TABLE public.products
  ADD COLUMN cost NUMERIC(10,2);

COMMENT ON COLUMN public.products.cost
  IS 'Costo de adquisicion/fabricacion del producto. Nullable — productos sin costo excluidos del calculo de margen.';

-- 2. Campo last_gps_at en drivers (schema delivery)
ALTER TABLE delivery.drivers
  ADD COLUMN last_gps_at TIMESTAMPTZ;

COMMENT ON COLUMN delivery.drivers.last_gps_at
  IS 'Timestamp de la ultima posicion GPS recibida del driver. Usado para detectar staleness en el mapa del command center.';
