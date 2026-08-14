-- =============================================
-- 038: Envío único de imagen por producto/sesión — media_sent_products
--
-- Flag de sesión en conversations: registra los product_id cuya imagen ya
-- fue enviada al cliente en esa conversación, para que el bot nunca vuelva
-- a adjuntar la imagen de un producto ya mostrado (solo texto).
--
-- Complementa chat_media_dispatched (016, dedup por knowledge_item_id):
-- aquí el dedup es por PRODUCTO, de modo que dos knowledge_items que
-- apunten al mismo product_id no generan spam visual en turnos distintos.
--
-- No altera RLS: las políticas existentes de conversations ya restringen
-- tenant (business) y propietario.
-- =============================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS media_sent_products UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_conversations_media_sent_products
  ON public.conversations USING GIN (media_sent_products);

COMMENT ON COLUMN public.conversations.media_sent_products IS
  'Productos cuya imagen ya fue enviada en esta conversación. El bot omite la imagen (envía solo texto) si el producto ya está en la lista.';
