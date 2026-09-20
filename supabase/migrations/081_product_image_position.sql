-- =============================================
-- ADD position COLUMN FOR IMAGE ORDERING
-- =============================================
-- Add position INT column to knowledge_items for deterministic image ordering.
-- NULL means ordering is by created_at (legacy). When set, images are ordered
-- by position ASC NULLS LAST, then created_at ASC.
--
-- This is part of the Product Asset Unification (DEC-20260825-PRODUCT-ASSETS).
-- Position is nullable for backward compatibility; existing rows get NULL.
-- =============================================

ALTER TABLE public.knowledge_items
  ADD COLUMN IF NOT EXISTS position INT;

COMMENT ON COLUMN public.knowledge_items.position IS
  'Posición determinista para el orden de imágenes del producto. NULL = order por created_at (legado).';
