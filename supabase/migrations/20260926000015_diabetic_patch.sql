-- =============================================
-- VITANOVA: DIABETIC PATCH (producto nuevo)
-- =============================================
-- Source: documento oficial de producto recibido por el negocio (2026-10-04).
-- 36 parches, $449 MXN, ~$13/día. Presentación de 36 únicamente.
--
-- WHY THE GUARDRAIL IS PART OF THIS MIGRATION
-- 20260926000014 removed MIA's authority to certify health. This product then
-- arrived: a patch whose own audience list says "personas que viven con
-- diabetes" and whose formula is glucose-oriented herbs. Loading it without a
-- boundary would have handed the model a glucose product and no rule about what
-- it may say, which is exactly how the old unbounded claim came back.
--
-- THE COMMERCIAL RULE (business owner, explicit)
-- MIA never says "cura", never says it is a medicine, never says the patch
-- works on its own. What she does: exalt the practical virtues and the routine.
-- The deal-killer is volunteering the limitation, so MIA does not volunteer it.
-- The discipline lives in the vocabulary, not in a disclaimer.
--   allowed : complementar, acompañar, hacer más completa la rutina, uso diario,
--             práctico, sencillo, fácil de sostener, apoyo, complemento
--   refused : cura, tratamiento, medicamento, baja/normaliza la glucosa,
--             reduce el azúcar, controla la diabetes, previene, es seguro,
--             sin riesgo, sin efectos secundarios, apto para diabéticos
-- "Cuidado de la glucosa" stays allowed as ROUTINE vocabulary; what is refused
-- is any verb asserting an EFFECT on glucose.
--
-- PRICE
-- The pack is 36 units at $449, so `price_ladder` carries a qty:36 tier. That is
-- deliberate: prompts.ts only renders the bare `products.price` when the first
-- ladder tier is qty 1 (priceIsSellable). With qty 36 the bare figure is
-- suppressed and the ladder states "36 pzas: $449", so MIA cannot quote a price
-- per single patch for a product that is not sold that way.
--
-- Also restores the "interpret before saying you have no information" rule from
-- the official product dictionary. It was in scripts/extracted-docs but was never
-- loaded into the database, so MIA had no instruction telling her to identify
-- the customer's intent before defaulting to "I have no information about that".
-- =============================================

DO $$
DECLARE
  v_business CONSTANT uuid := '4fb7418d-6c98-4a09-9094-4e4e4b2006a6';

  v_product CONSTANT uuid := '88beef61-0361-4e86-b024-5e48bab063f1';
  v_instr_product CONSTANT uuid := '3879e304-66c7-4f75-8002-b8c50d7f8b73';
  v_instr_intent  CONSTANT uuid := '52b6da3f-18a9-4cd4-affe-0a5a40dfda0e';
  v_ki_facts      CONSTANT uuid := '6d29598a-9a35-4881-ac3d-3e392583b960';
  v_ki_short      CONSTANT uuid := 'ac33c0f6-7751-4ca7-a40f-e4fa1c145460';

  v_count integer;
BEGIN
  -- ---------------------------------------------------------------
  -- 1. PRODUCT
  -- ---------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = v_product AND business_id = v_business
  ) THEN
    INSERT INTO public.products
      (id, business_id, name, price, description, benefits, faq, price_ladder, is_active)
    VALUES (
      v_product,
      v_business,
      'Diabetic Patch',
      449,
      'Parche de uso diario pensado para acompañar la rutina de cuidado de la glucosa. Se coloca uno cada 24 horas en hombro, espalda o vientre bajo; al día siguiente se retira y se coloca uno nuevo.',
      'Práctico y sencillo de incorporar a la rutina diaria. Complementa hábitos de alimentación y ejercicio. Presentación de 36 parches.',
      jsonb_build_array(
        jsonb_build_object(
          'q', '¿Qué es y cómo se usa?',
          'a', 'Es un parche de uso diario. Se coloca uno en hombro, espalda o vientre bajo, se deja 24 horas, y al día siguiente se retira y se coloca uno nuevo.'
        ),
        jsonb_build_object(
          'q', '¿Cuánto cuesta?',
          'a', 'La presentación trae 36 parches y cuesta $449, que equivale a aproximadamente $13 al día usando uno diario.'
        ),
        jsonb_build_object(
          'q', '¿Es un medicamento?',
          'a', 'No. Es un parche de apoyo para completar la rutina de cuidado diario. Su valor es que hace mucho más fácil sostener los hábitos de alimentación y ejercicio del día a día.'
        )
      ),
      jsonb_build_object(
        'tiers', jsonb_build_array(jsonb_build_object('qty', 36, 'price', 449)),
        'note', 'Solo se vende la presentación de 36 parches. No hay precio por parche suelto. Con uso de uno al día alcanza para aproximadamente 36 días.'
      ),
      true
    );
  END IF;

  -- ---------------------------------------------------------------
  -- 2. AI INSTRUCTIONS
  -- ---------------------------------------------------------------
  -- 2a. The product itself: facts, identification, vocabulary, tone.
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_instructions
    WHERE id = v_instr_product AND business_id = v_business
  ) THEN
    INSERT INTO public.ai_instructions
      (id, business_id, instruction, priority, source)
    VALUES (
      v_instr_product,
      v_business,
      'Diabetic Patch (parche de uso diario):

- Identificación: si el cliente habla de diabetes, de cuidar la glucosa, o pide algo para esa condición, MIA identifica Diabetic Patch. OJO: "parche" a secas es AMBIGUO (este y Bella Patch), así que si el cliente solo dice "parche" sin contexto, MIA pregunta de qué se trata antes de recomendar uno.

- Qué es y cómo se usa: un parche de uso diario. Uno cada 24 horas, colocado en hombro, espalda o vientre bajo; al día siguiente se retira y se coloca uno nuevo. La presentación trae 36 parches.

- Precio: 36 parches por $449, aproximadamente $13 al día. NUNCA cites el precio de un parche suelto: ese producto no se vende así.

- Cómo debe hablarlo MIA: como un complemento práctico que hace más completa la rutina que el cliente ya lleva con alimentación y ejercicio. Vocabulario permitido: complementar, acompañar, hacer más completa la rutina, uso diario, práctico, sencillo, fácil de sostener, apoyo, complemento, hábitos. "Cuidado de la glucosa" y "niveles de glucosa" son válidos cuando hablan de la RUTINA.

- Límites: MIA NUNCA dice que cura, ni que es un tratamiento o un medicamento, ni que baja o normaliza la glucosa, ni que reduce el azúcar, ni que controla la diabetes, ni que previene. Tampoco dice que es seguro, sin riesgo, sin efectos secundarios, ni "apto para diabéticos". MIA describe el producto y la rutina; no firma un resultado de salud.

- Si el cliente pregunta directo si le va a ayudar con su diabetes, MIA NO responde "no" y NO deriva al médico: reencuadra en positivo y le da el beneficio real. "Justamente no tiene que ver con sintetizar nada: su valor es que hace mucho más fácil sostener la rutina que ya llevas con comida y ejercicio. Pones un parche en el hombro o la espalda, se queda 24 horas y al día siguiente cambias. Son 36 por $449, como $13 al día."

- Tono: comercial, cercano y confiable. NO conviertas la conversación en una explicación técnica de los ingredientes. Si el cliente pregunta de qué está hecho, MIA responde que es una fórmula de ingredientes de origen vegetal y hierbas adaptógenas, sin presentarlos como tratamiento ni entrar en farmacología.

- Prioridad de MIA: explicar rápido qué es, cómo se usa, cuánto cuesta y por qué le conviene, y después avanzar hacia el cierre.',
      8,
      'manual'
    );
  END IF;

  -- 2b. Intent before "I have no information" (restored from the official
  --     dictionary, which was never loaded into the database).
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_instructions
    WHERE id = v_instr_intent AND business_id = v_business
  ) THEN
    INSERT INTO public.ai_instructions
      (id, business_id, instruction, priority, source)
    VALUES (
      v_instr_intent,
      v_business,
      'Regla de interpretación: antes de responder que no hay información sobre lo que el cliente pide, MIA debe intentar identificar la INTENCIÓN detrás de sus palabras y buscar el producto que la resuelve. Decir "no tengo información sobre eso" es un último recurso, no una respuesta. Mapeo de intención a producto: alguien con panza o que quiere disimular el abdomen -> Back2Fit. Alguien a quien le da pena usar sandalias, o que tiene uñas amarillas o con hongo -> Clean Nails. Alguien con piernas cansadas, várices, mala circulación o dolor por debajo de la rodilla -> Neurofeet. Alguien con hormigueo, pies dormidos, ardor o sensibilidad en el pie o el tobillo -> Neurotin. Alguien con canas que no quiere teñirse -> Bye Canas. Alguien con piel floja o marcas de la edad -> Bella Patch. Alguien que menciona diabetes o el cuidado de la glucosa -> Diabetic Patch.',
      8,
      'manual'
    );
  END IF;

  -- ---------------------------------------------------------------
  -- 3. KNOWLEDGE ITEMS
  -- ---------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM public.knowledge_items
    WHERE id = v_ki_facts AND business_id = v_business
  ) THEN
    INSERT INTO public.knowledge_items
      (id, business_id, category, question, answer, source, confidence)
    VALUES (
      v_ki_facts,
      v_business,
      'faq',
      'Diabetic Patch: qué es, cómo se usa y cuánto cuesta',
      'Es un parche de uso diario pensado para acompañar la rutina de cuidado de la glucosa. Se usa UNO cada 24 horas, colocado en hombro, espalda o vientre bajo; después de 24 horas se retira y se coloca un parche nuevo. La idea es que sea fácil de incorporar al día a día: un parche al día y listo. La presentación trae 36 parches por $449, que equivale a aproximadamente $13 al día usando uno diario.',
      'document',
      'high'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.knowledge_items
    WHERE id = v_ki_short AND business_id = v_business
  ) THEN
    INSERT INTO public.knowledge_items
      (id, business_id, category, question, answer, source, confidence)
    VALUES (
      v_ki_short,
      v_business,
      'faq',
      'Diabetic Patch: respuesta corta para el cliente',
      'Te ayuda a hacer más completa la rutina que ya llevas con alimentación y ejercicio. Es un parche al día: se coloca en hombro, espalda o vientre bajo, se deja 24 horas y cambias. Trae 36, así que es como $13 al día y no te complica nada la rutina.',
      'document',
      'high'
    );
  END IF;

  -- ---------------------------------------------------------------
  -- 4. POST-CONDITIONS
  -- ---------------------------------------------------------------
  SELECT count(*) INTO v_count
  FROM public.products
  WHERE id = v_product AND business_id = v_business AND is_active AND price = 449;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Diabetic Patch product not in expected state (count=%)', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ai_instructions
    WHERE id = v_instr_product AND business_id = v_business AND is_active
  ) THEN
    RAISE EXCEPTION 'Diabetic Patch instruction not active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ai_instructions
    WHERE id = v_instr_intent AND business_id = v_business AND is_active
  ) THEN
    RAISE EXCEPTION 'intent interpretation instruction not active';
  END IF;

  -- The authorizing construction must still be gone after loading a glucose
  -- product. Re-checked here so this migration can never reintroduce it.
  IF EXISTS (
    SELECT 1 FROM public.ai_instructions
    WHERE business_id = v_business AND is_active
      AND (
        instruction ILIKE '%confianza que no representa%'
        OR instruction ILIKE '%puede confirmar que no representa%'
        OR instruction ILIKE '%puede responder que no representa%'
        OR instruction ILIKE '%confirmar con confianza que no representa%'
      )
  ) THEN
    RAISE EXCEPTION 'unsupportable health claim still authorized in ai_instructions';
  END IF;
END $$;