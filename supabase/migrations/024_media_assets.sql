-- =============================================
-- 024: Multimedia Inteligente — media library
--
-- Extiende ADR-014 (Conditional Knowledge Media) SIN crear tablas
-- paralelas: knowledge_items ya guarda image_url + trigger_condition y
-- chat_media_dispatched ya evita doble envío por conversación.
--
-- Añade media_type para que los negocios clasifiquen sus assets
-- multimedia (imagen de producto, testimonio, flyer de pago, otro) y el
-- runtime pueda priorizar/adjuntar el recurso correcto.
-- =============================================

ALTER TABLE public.knowledge_items
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'other'
    CHECK (media_type IN ('image', 'testimonial', 'flyer', 'other'));

COMMENT ON COLUMN public.knowledge_items.media_type IS
  'Tipo de asset multimedia: image (foto de producto), testimonial (resultado/reseña), flyer (promoción o pago), other.';
