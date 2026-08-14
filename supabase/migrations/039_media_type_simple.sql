-- =============================================
-- 039: Simplificar media_type a image | testimonial
--
-- flyer y other nunca tuvieron comportamiento diferenciado: el runtime
-- envia todo el media como imagen+caption y media_type no participa en la
-- seleccion de envio (solo trigger_condition + prioridad de producto).
-- Decision del negocio: conservar image (foto de producto) y testimonial
-- (prueba social). Los datos existentes flyer/other se normalizan a image
-- sin cambio de comportamiento.
-- =============================================

UPDATE public.knowledge_items
SET media_type = 'image'
WHERE media_type IN ('flyer', 'other');

-- Elimina cualquier CHECK constraint existente sobre media_type (nombre
-- auto-generado por la migracion 024) de forma robusta.
DO $$
DECLARE
  conname TEXT;
BEGIN
  SELECT pg_constraint.conname INTO conname
  FROM pg_constraint
  JOIN pg_attribute ON pg_attribute.attrelid = pg_constraint.conrelid
     AND pg_attribute.attnum = ANY(pg_constraint.conkey)
  WHERE pg_constraint.conrelid = 'public.knowledge_items'::regclass
    AND pg_attribute.attname = 'media_type'
    AND pg_constraint.contype = 'c'
  LIMIT 1;

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.knowledge_items DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE public.knowledge_items
  ADD CONSTRAINT knowledge_items_media_type_check
  CHECK (media_type IN ('image', 'testimonial'));

ALTER TABLE public.knowledge_items
  ALTER COLUMN media_type SET DEFAULT 'image';

COMMENT ON COLUMN public.knowledge_items.media_type IS
  'Tipo de asset multimedia: image (foto de producto), testimonial (resultado/resena).';
