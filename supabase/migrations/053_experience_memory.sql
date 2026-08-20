-- =============================================================================
-- MIGRACIÓN 053: SISTEMA DE EXPERIENCE MEMORY Y RECOMENDACIÓN DE OBJECIONES
-- Modelo C Híbrido: 70% Global/Industria + 30% Negocio
-- =============================================================================

-- 1. Tipo ENUM para el ámbito de la memoria
CREATE TYPE public.experience_scope AS ENUM ('global', 'industry', 'business');

-- 2. Tabla principal de patrones de experiencia acumulada
CREATE TABLE IF NOT EXISTS public.experience_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    scope public.experience_scope NOT NULL DEFAULT 'business',
    industry TEXT,

    -- Patrón semántico de la objeción
    pattern_key TEXT NOT NULL,
    customer_objection TEXT NOT NULL,
    sample_raw_query TEXT,

    -- Respuesta recomendada
    suggested_response TEXT NOT NULL,

    -- Datos estadísticos (Wilson Score Confidence Interval)
    conversion_probability NUMERIC(4,3) NOT NULL DEFAULT 0.000,
    confidence_level NUMERIC(4,3) NOT NULL DEFAULT 0.000,
    observation_count INT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Validación de integridad: scope business requiere business_id, global/industry lo prohíbe
    CONSTRAINT check_scope_business CHECK (
        (scope = 'business' AND business_id IS NOT NULL) OR
        (scope IN ('global', 'industry') AND business_id IS NULL)
    )
);

-- 3. Índices parciales de unicidad (maneja NULLs correctamente en PostgreSQL)
CREATE UNIQUE INDEX idx_experience_memory_unique_global
    ON public.experience_memory (pattern_key)
    WHERE scope = 'global';

CREATE UNIQUE INDEX idx_experience_memory_unique_industry
    ON public.experience_memory (industry, pattern_key)
    WHERE scope = 'industry';

CREATE UNIQUE INDEX idx_experience_memory_unique_business
    ON public.experience_memory (business_id, pattern_key)
    WHERE scope = 'business';

-- 4. RLS en experience_memory
ALTER TABLE public.experience_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_memory FORCE ROW LEVEL SECURITY;

-- SELECT público para datos globales e industriales (anónimos, sin PII)
CREATE POLICY "users_can_view_global_industry_memory"
    ON public.experience_memory FOR SELECT
    TO authenticated
    USING (scope IN ('global', 'industry'));

-- CRUD completo para memorias del propio negocio
CREATE POLICY "users_can_manage_own_business_memory"
    ON public.experience_memory FOR ALL
    TO authenticated
    USING (business_id IN (SELECT public.get_user_business_ids()))
    WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

-- 5. Tabla de sugerencias (cola de aprobación / "Tinder de Objeciones")
CREATE TABLE IF NOT EXISTS public.experience_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    parent_memory_id UUID NOT NULL REFERENCES public.experience_memory(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'dismissed')),
    customized_response TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_business_suggestion UNIQUE (business_id, parent_memory_id)
);

-- 6. RLS en experience_suggestions
ALTER TABLE public.experience_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_suggestions FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_can_manage_own_suggestions"
    ON public.experience_suggestions FOR ALL
    TO authenticated
    USING (business_id IN (SELECT public.get_user_business_ids()))
    WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

-- 7. ALTER knowledge_items.source para permitir 'experience_memory'
ALTER TABLE public.knowledge_items
    DROP CONSTRAINT IF EXISTS knowledge_items_source_check;

ALTER TABLE public.knowledge_items
    ADD CONSTRAINT knowledge_items_source_check
    CHECK (source IN ('onboarding', 'manual', 'document', 'correction', 'experience_memory', 'audio'));
