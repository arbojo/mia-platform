-- =============================================
-- MIA Stage-Based Learning — Migration 009
-- Sprint 1: Maturity Engine & Learning Foundations
-- =============================================

-- ============================================================
-- 1. READINESS SNAPSHOTS: Add maturity stage
-- ============================================================
ALTER TABLE public.readiness_snapshots
  ADD COLUMN maturity_stage TEXT
  CHECK (maturity_stage IN ('observation', 'understanding', 'mentor', 'advisor', 'autonomous'));

CREATE INDEX idx_readiness_maturity
  ON public.readiness_snapshots(business_id, maturity_stage)
  WHERE maturity_stage IS NOT NULL;

-- ============================================================
-- 2. BUSINESS MEMORY: Add decision type + priority + rationale
-- ============================================================

-- Relax memory_type CHECK to include 'decision'
ALTER TABLE public.business_memory
  DROP CONSTRAINT IF EXISTS business_memory_memory_type_check;

ALTER TABLE public.business_memory
  ADD CONSTRAINT business_memory_memory_type_check
  CHECK (memory_type IN ('pattern', 'experience', 'insight', 'trend', 'decision'));

-- Add decision-specific columns
ALTER TABLE public.business_memory
  ADD COLUMN rationale TEXT;

ALTER TABLE public.business_memory
  ADD COLUMN is_immutable BOOLEAN DEFAULT FALSE;

ALTER TABLE public.business_memory
  ADD COLUMN expires_at TIMESTAMPTZ;

ALTER TABLE public.business_memory
  ADD COLUMN decision_priority TEXT DEFAULT 'normal'
  CHECK (decision_priority IN ('critical', 'high', 'normal'));

-- Relax category CHECK to allow 'decision' and future custom categories
ALTER TABLE public.business_memory
  DROP CONSTRAINT IF EXISTS business_memory_category_check;

-- ============================================================
-- 3. LEARNING EVENTS: Add mistake prevention + severity + expiry
-- ============================================================

-- Add business_id for direct querying
ALTER TABLE public.learning_events
  ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;

-- Populate business_id from assistants table
UPDATE public.learning_events le
  SET business_id = a.business_id
  FROM public.assistants a
  WHERE le.assistant_id = a.id;

-- Make business_id NOT NULL after population
ALTER TABLE public.learning_events
  ALTER COLUMN business_id SET NOT NULL;

-- Extend correction_type to include product + mistake_prevention
ALTER TABLE public.learning_events
  DROP CONSTRAINT IF EXISTS learning_events_correction_type_check;

ALTER TABLE public.learning_events
  ADD CONSTRAINT learning_events_correction_type_check
  CHECK (correction_type IN ('knowledge', 'rule', 'instruction', 'product', 'mistake_prevention'));

-- Add mistake prevention columns
ALTER TABLE public.learning_events
  ADD COLUMN severity TEXT DEFAULT 'medium'
  CHECK (severity IN ('low', 'medium', 'high', 'critical'));

ALTER TABLE public.learning_events
  ADD COLUMN category TEXT;

ALTER TABLE public.learning_events
  ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE public.learning_events
  ADD COLUMN expires_at TIMESTAMPTZ;

-- Index for efficient mistake prevention queries
CREATE INDEX idx_learning_events_mistake_prevention
  ON public.learning_events(business_id, severity, created_at DESC)
  WHERE correction_type = 'mistake_prevention' AND is_active = TRUE;

CREATE INDEX idx_learning_events_business
  ON public.learning_events(business_id);

-- ============================================================
-- 4. LAB SESSIONS: Add mentor mode (prep for Sprint 4)
-- ============================================================
ALTER TABLE public.lab_sessions
  DROP CONSTRAINT IF EXISTS lab_sessions_mode_check;

ALTER TABLE public.lab_sessions
  ADD CONSTRAINT lab_sessions_mode_check
  CHECK (mode IN ('normal', 'indecisive', 'difficult', 'critical', 'mentor'));
