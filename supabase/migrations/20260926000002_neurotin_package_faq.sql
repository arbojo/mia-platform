-- =============================================
-- VITANOVA: NEUROTIN PACKAGE FAQ + MIX RULE
-- =============================================
-- Two active knowledge items answered the same question ("cuantas piezas tiene
-- el neurotin?") with the same fact, and both were incomplete: they listed only
-- the 3-pair tier and omitted the 5-pair tier, even though the commercial policy
-- prices both products at 3/$449 and 5/$599.
--
-- The "you can mix sizes and colors" rule is not invented here. It already
-- exists as active knowledge item 22a362af ("colores neurotin y neurofeet"):
-- blanco y negro, tallas S a XL, combinations allowed. That item is left
-- untouched and is now referenced by the package answer so the two agree.
--
-- The rule is also promoted into the product's price_ladder note, because that
-- note is what actually reaches the prompt: it tells MIA the package price
-- applies to any combination, so it does not have to guess or refuse.
-- =============================================

DO $$
DECLARE
  v_business CONSTANT uuid := '4fb7418d-6c98-4a09-9094-4e4e4b2006a6';
  v_new_answer constant text :=
    'el neurotin se vende en paquetes de 3 piezas por $449 o 5 piezas por $599. '
    'Se pueden hacer combinaciones de tallas y colores: hay en blanco y negro, '
    'y las tallas van de la S (chica) a la XL (extra grande). '
    'No se aplican descuentos adicionales.';
  v_new_ladder jsonb :=
    '{"tiers":[{"qty":3,"price":449},{"qty":5,"price":599}],'
    '"note":"No aplicar descuentos adicionales. Se pueden mezclar tallas y colores: blanco y negro, tallas S a XL."}'::jsonb;
  v_id uuid;
  v_old_answer text;
  v_old_ladder jsonb;
BEGIN
  -- 1. Canonical FAQ: rewrite the answer in place (keeps its question/trigger)
  SELECT k.id, k.answer INTO v_id, v_old_answer
  FROM public.knowledge_items k
  WHERE k.id = 'c9ea5043-d2c1-41c5-9d0c-88e03718891d'::uuid
    AND k.business_id = v_business;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'canonical neurotin FAQ c9ea5043 not found for Vitanova';
  END IF;

  UPDATE public.knowledge_items
  SET answer = v_new_answer, updated_at = now()
  WHERE id = v_id;

  INSERT INTO public.knowledge_versions
    (business_id, entity_type, entity_id, previous_value, new_value, change_source)
  VALUES (
    v_business, 'knowledge_item', v_id,
    jsonb_build_object('answer', v_old_answer),
    jsonb_build_object('answer', v_new_answer),
    'manual'
  );

  -- 2. Redundant duplicate: deactivate, do not delete (audit trail matters)
  SELECT k.id, k.answer INTO v_id, v_old_answer
  FROM public.knowledge_items k
  WHERE k.id = 'a304f354-e21c-48bb-b6f0-21b6cdff339d'::uuid
    AND k.business_id = v_business;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'duplicate neurotin FAQ a304f354 not found for Vitanova';
  END IF;

  UPDATE public.knowledge_items
  SET is_active = false, updated_at = now()
  WHERE id = v_id;

  INSERT INTO public.knowledge_versions
    (business_id, entity_type, entity_id, previous_value, new_value, change_source)
  VALUES (
    v_business, 'knowledge_item', v_id,
    jsonb_build_object('is_active', true, 'answer', v_old_answer),
    jsonb_build_object('is_active', false, 'answer', v_old_answer,
      'reason', 'duplicate of c9ea5043-d2c1-41c5-9d0c-88e03718891d'),
    'manual'
  );

  -- 3. Both compression products: surface the mix rule where MIA will read it
  FOR v_id IN
    SELECT p.id FROM public.products p
    WHERE p.business_id = v_business
      AND p.id IN (
        'c1c4c574-9109-44c3-9fae-07e5446d97b0'::uuid, -- Neurofeet
        'f747817e-ace6-4498-b21b-eddd5e8ef7e5'::uuid  -- Neurotin
      )
  LOOP
    SELECT p.price_ladder INTO v_old_ladder
    FROM public.products p WHERE p.id = v_id;

    UPDATE public.products
    SET price_ladder = v_new_ladder, updated_at = now()
    WHERE id = v_id;

    INSERT INTO public.knowledge_versions
      (business_id, entity_type, entity_id, previous_value, new_value, change_source)
    VALUES (
      v_business, 'product', v_id,
      jsonb_build_object('price_ladder', v_old_ladder),
      jsonb_build_object('price_ladder', v_new_ladder),
      'manual'
    );
  END LOOP;
END $$;
