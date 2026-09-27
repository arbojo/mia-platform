-- =============================================
-- FIX: replace (not append) the Clean Nails "¿Funciona de verdad?" FAQ
-- =============================================
-- 20260926000003 built the updated FAQ with `v_old_faq || jsonb_build_array(...)`,
-- which APPENDS. That left the old contradictory answer ("no promete una
-- curación") at index 0 — the slot the prompt actually renders, since
-- formatProducts uses faq.slice(0, 3) — and pushed the new answer to index 3,
-- where it was silently dropped. Net effect of that migration was "no change".
--
-- This rebuilds the array properly: de-duplicate by question (keeping the
-- earliest occurrence, which discards the accidental duplicate) and replace the
-- answer of "¿Funciona de verdad?" in place.
-- =============================================

DO $$
DECLARE
  v_business CONSTANT uuid := '4fb7418d-6c98-4a09-9094-4e4e4b2006a6';
  v_product constant uuid := '96c33f39-0cf0-4b1b-994b-181acbef7c57';
  v_target_q constant text := '¿Funciona de verdad?';
  v_new_a constant text :=
    'Sí, está diseñada para eliminar el hongo de la uña, y lo consigue con uso constante. '
    'Se usa dos veces al día en sesiones de 7 minutos y notarás la mejoría conforme crece la uña nueva. '
    'La constancia es la clave.';
  v_old_faq jsonb;
  v_new_faq jsonb;
BEGIN
  SELECT p.faq INTO v_old_faq
  FROM public.products p
  WHERE p.id = v_product AND p.business_id = v_business;

  IF v_old_faq IS NULL THEN
    RAISE EXCEPTION 'Clean Nails faq not found for Vitanova';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      CASE WHEN d.elem->>'q' = v_target_q
        THEN jsonb_build_object('q', d.elem->>'q', 'a', v_new_a)
        ELSE d.elem
      END
      ORDER BY d.ord
    ),
    '[]'::jsonb
  )
  INTO v_new_faq
  FROM (
    SELECT DISTINCT ON (elem->>'q') elem, ord
    FROM jsonb_array_elements(v_old_faq) WITH ORDINALITY AS t(elem, ord)
    ORDER BY elem->>'q', ord
  ) d;

  UPDATE public.products SET faq = v_new_faq, updated_at = now()
  WHERE id = v_product;

  INSERT INTO public.knowledge_versions
    (business_id, entity_type, entity_id, previous_value, new_value, change_source)
  VALUES (
    v_business, 'product', v_product,
    jsonb_build_object('faq', v_old_faq),
    jsonb_build_object('faq', v_new_faq),
    'manual'
  );
END $$;
