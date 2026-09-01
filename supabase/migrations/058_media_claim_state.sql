-- =============================================
-- 058: Claims atómicos conversation × asset — estado del claim
--
-- P1-4 (doc 31): "Atomic conversation × asset claims".
--   Nueva columna state (claimed/dispatched/failed) sobre chat_media_dispatched.
--
-- Cadena de estados (doc 26 §1): CLAIMED → DISPATCHED → (FAILED | UNKNOWN)
--   - claimed     = reclamado atómicamente por el runtime pre-dispatch.
--   - dispatched  = entregado al transport/adapter (handoff).
--   - failed      = fallo de dispatch; re-enviable (D2 "recovery when applicable").
--
-- REGLA: CLAIMED ≠ DISPATCHED ≠ DELIVERED. DELIVERED es Fase 2 (D3, receipts),
-- por eso NO existe acá.
--
-- DEFAULT 'dispatched' = backfill semánticamente correcto para filas escritas
-- antes de Fase 1 (se escribieron cuando el dispatch ya se había decidido).
--
-- Rollback: tabla sin uso de la columna = sin impacto.
-- =============================================

ALTER TABLE public.chat_media_dispatched
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'dispatched'
  CONSTRAINT chat_media_dispatched_state_check CHECK (state IN ('claimed', 'dispatched', 'failed'));

COMMENT ON COLUMN public.chat_media_dispatched.state IS
  'Estado del claim (P1-4): claimed | dispatched | failed. CLAIMED ≠ DISPATCHED ≠ DELIVERED (delivered es Fase 2/D3). failed habilita re-claim (D2 recovery).';