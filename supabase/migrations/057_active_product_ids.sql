-- =============================================
-- 057: Contexto comercial de conversación — active_product_ids
--
-- P1-1 (docs/research/context-idempotency/31-IMPLEMENTATION-PHASE-BOUNDARY.md):
--   "Conversation-scoped context (`active_product_ids[]`)".
--   1 migración aditiva sobre conversations, sin backfill necesario.
--
-- Semántica (docs 24-CONTEXT-CONTRACT):
--   - Lista ORDENADA más-reciente-primero de productos bajo consideración.
--   - La muta SOLO el explicit-scope determinístico (nombre literal / SKU) o
--     el productId determinístico proveniente de landing/pre-resuelto (D5).
--   - Un trigger aislado NO cambia el producto activo (INV-1).
--   - TTL = vida de la conversación (D1).
--
-- Rollback: columna ignorada por código = comportamiento anterior.
-- =============================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS active_product_ids UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_conversations_active_product_ids
  ON public.conversations USING GIN (active_product_ids);

COMMENT ON COLUMN public.conversations.active_product_ids IS
  'Contexto comercial de la conversación (P1-1). Ordenado más-reciente-primero; solo lo muta el explicit-scope determinístico (literal/SKU/landing). TTL = vida de conversación (D1).';