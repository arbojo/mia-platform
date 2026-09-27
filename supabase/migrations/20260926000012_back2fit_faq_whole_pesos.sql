-- =============================================
-- BACK2FIT: LA FAQ SIGUE CON LA FRASE DE PORCENTAJE
-- =============================================
-- 20260926000011 sustituyo "20% de descuento" por "$399" en la nota de la
-- escalera y en la sales_rule, pero apuntando la FAQ a knowledge_items. La FAQ
-- de producto no vive en esa tabla: vive en products.faq, un jsonb de pares
-- {q, a}. El UPDATE no encontro filas y salio sin hacer nada, en silencio.
--
-- Se corrige sobre products.faq. Se recorre el arreglo entrada por entrada en
-- lugar de reescribirlo completo, para no volver a perder redaccion ajena al
-- precio (los demas pares de la FAQ no cambian).
--
-- Idempotente: si ninguna entrada matchea la frase, el arreglo reconstruido es
-- identico al anterior y no se escribe ni se ensucia el audit trail.
-- =============================================

DO $$
DECLARE
  v_business CONSTANT uuid := '4fb7418d-6c98-4a09-9094-4e4e4b2006a6';
  v_product  CONSTANT uuid := '17dc64f6-8e8e-4e9b-a5e7-ab7098a5e23c';

  v_old_faq jsonb;
  v_new_faq jsonb;
BEGIN
  SELECT p.faq INTO v_old_faq
    FROM public.products p
   WHERE p.id = v_product AND p.business_id = v_business;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Back2Fit (%) not found for Vitanova', v_product;
  END IF;

  IF v_old_faq IS NULL THEN
    RAISE EXCEPTION 'Back2Fit (%) has no faq to update', v_product;
  END IF;

  SELECT jsonb_agg(
           CASE
             WHEN e.entry ->> 'a' LIKE '%se agrega con 20% de descuento%'
               THEN jsonb_set(
                      e.entry, '{a}',
                      to_jsonb(replace(e.entry ->> 'a',
                                       'esa pieza se agrega con 20% de descuento',
                                       'esa pieza se agrega a $399')))
             ELSE e.entry
           END
           ORDER BY e.ord
         )
    INTO v_new_faq
    FROM jsonb_array_elements(v_old_faq) WITH ORDINALITY AS e(entry, ord);

  IF v_new_faq IS DISTINCT FROM v_old_faq THEN
    UPDATE public.products
       SET faq = v_new_faq, updated_at = now()
     WHERE id = v_product;

    INSERT INTO public.knowledge_versions
      (business_id, entity_type, entity_id, previous_value, new_value, change_source)
    VALUES
      (v_business, 'product', v_product,
       jsonb_build_object('faq', v_old_faq),
       jsonb_build_object('faq', v_new_faq),
       'manual');
  END IF;
END $$;
