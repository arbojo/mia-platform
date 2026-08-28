-- =============================================
-- 055: Capability Foundation
-- capability-contract-v2.md §Phase 3, §Phase 4
-- Adds: businesses.industry, businesses.capabilities,
--        businesses.onboarding_answers, businesses.capability_sources
-- =============================================

-- Industry: controlled slug taxonomy (nullable, free-form TEXT)
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS industry TEXT;

COMMENT ON COLUMN public.businesses.industry IS
  'Business vertical/industry slug. Controlled taxonomy with free-form fallback. '
  'Suggested values: wellness_beauty, inmobiliaria, calzado, ropa, general. '
  'Nullable — system functions without it. Used for onboarding UX and experience memory.';

-- Capabilities: configuration source of truth (TEXT[] array)
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS capabilities TEXT[];

COMMENT ON COLUMN public.businesses.capabilities IS
  'Array of active CapabilityId strings (e.g. {SALES_EXPERIENCE, MOD_INVENTORY}). '
  'Configuration state — what the business wants. Resolved state computed at query time '
  'by resolveCapabilities() which applies edition ceiling + dependencies. '
  'Nullable — empty/null means only core capabilities are active.';

-- Onboarding answers: raw quiz responses for re-derivation
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS onboarding_answers JSONB;

COMMENT ON COLUMN public.businesses.onboarding_answers IS
  'Raw onboarding quiz responses. Preserved for re-derivation if business model changes. '
  'Not read by resolution engine — configuration state only.';

-- Capability sources: debugging metadata
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS capability_sources JSONB;

COMMENT ON COLUMN public.businesses.capability_sources IS
  'How each capability was activated: {CAPABILITY_ID: source}. '
  'Sources: default (core), edition, config (manual), onboarding (industry), dependency. '
  'For debugging only — not read by resolution engine.';

-- Index for capability queries (GIN for TEXT[] @> contains operator)
CREATE INDEX IF NOT EXISTS idx_businesses_capabilities
  ON public.businesses USING GIN (capabilities);

-- Index for industry filtering
CREATE INDEX IF NOT EXISTS idx_businesses_industry
  ON public.businesses(industry) WHERE industry IS NOT NULL;
