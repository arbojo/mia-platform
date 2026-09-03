-- =============================================
-- MIA Async Learning Ingest — Migration 065
-- TASK-20260209-ASYNCLEARN001 (ratificado F0)
-- Ingesta asíncrona: progreso granular + lease de worker.
-- Aditiva: no modifica ni elimina columnas existentes.
-- =============================================

ALTER TABLE public.learning_reports
  ADD COLUMN IF NOT EXISTS files_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS files_done INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS locked_expire_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_token UUID,
  ADD COLUMN IF NOT EXISTS error_reason TEXT;

-- Índice parcial para que el worker encuentre reportes pendientes sin escanear.
CREATE INDEX IF NOT EXISTS idx_learning_reports_pending
  ON public.learning_reports (created_at)
  WHERE status = 'processing';
