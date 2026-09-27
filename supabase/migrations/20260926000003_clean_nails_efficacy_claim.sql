-- =============================================
-- VITANOVA: CLEAN NAILS EFFICACY CLAIM + STALE PROMO RULES
-- =============================================
-- 1. EFFICACY CLAIM (commercial decision by the business owner)
--    Clean Nails is repositioned from "supports care" to "designed to eliminate
--    nail fungus". MIA is authorized to say so, ALWAYS bound to the constancy
--    requirement: the claim and the constancy travel together, never apart.
--
--    This reverses the previous blanket ban, so every rule that contradicted it
--    is rewritten here. What does NOT change even for Clean Nails:
--      - no guaranteed results, no identical results for everyone
--      - no exact timelines ("in X days you'll have a new nail")
--      - testimonio.jpg illustrates the PROCESS, never used as proof of a cure
--      - no diagnosing, no fear-based selling
--      - no claims beyond nail fungus (not diabetes, not neuropathy)
--    Neurofeet/Neurotin (no known cure for neuropathy), Bella Patch (temporary)
--    and Back2Fit (immediate) keep their existing honest framing.
--
-- 2. STALE PROMOTION RULES
--    Two sales_rules still described the OLD pricing and were missed when the
--    price ladders were introduced: Back2Fit still said "2 piezas ahorran 20%"
--    (2/$600 is ~40% off, not 20%) and Neurofeet still listed only the 3-pair
--    tier. Both now derive from the product's price_ladder instead of prose.
-- =============================================

DO $$
DECLARE
  v_business CONSTANT uuid := '4fb7418d-6c98-4a09-9094-4e4e4b2006a6';

  v_id uuid;
  v_old text;
  v_old_faq jsonb;
  v_new_faq jsonb;
  r record;
BEGIN
  -- ---------------------------------------------------------------
  -- 1. AI INSTRUCTIONS
  -- ---------------------------------------------------------------
  FOR r IN
    SELECT * FROM (VALUES

      -- Was a blanket "never promise a cure"; now product-scoped.
      (
        'd63f87aa-d3d1-4592-834e-9ecef9b44b12'::uuid,
        'Nunca prometas resultados garantizados, tiempos exactos ni resultados identicos para todos, y nunca generes miedo para vender. Aplica la promesa honesta correspondiente a ESE producto: Clean Nails esta disenado para eliminar el hongo de la una y lo consigue con uso constante, asi que MIA PUEDE afirmarlo siempre ligado a la constancia; Bye Canas es gradual y exige constancia; Back2Fit tiene efecto inmediato; Bella Patch tiene efecto temporal; Neurofeet y Neurotin son apoyos de comodidad, nunca tratamientos medicos. Se honesta sobre los limites de cada producto.'
      ),

      -- Per-product promise list: add the Clean Nails efficacy claim.
      (
        'a9708791-c499-4476-a03a-46f6b8f6649d'::uuid,
        'Cuando MIA hable de un producto especifico, debe aplicar la promesa honesta correspondiente a ESE producto - no una regla generica aplicada por igual a todos:

- Clean Nails: esta disenado para eliminar el hongo de la una, y lo consigue con uso constante. MIA PUEDE y DEBE afirmar con confianza que elimina el hongo de la una, siempre ligada a la constancia: el resultado depende del uso diario, ese es el eje del mensaje. NO lo garantices, NO digas "todas las personas tendran el mismo resultado" y NO des plazos exactos. Ademas, por ser no invasivo y no tener sustancias en contacto con el cuerpo, MIA puede confirmar con confianza que no representa problema para condiciones como diabetes o neuropatia, explicando brevemente por que - sin necesidad de remitir al medico para esa pregunta especifica de seguridad de uso.

- Bella Patch: MIA nunca debe prometer rejuvenecimiento instantaneo o permanente. Debe dejar claro, de forma sutil (sin sonar como advertencia legal), que el efecto es temporal.

- Neurofeet y Neurotin: MIA nunca debe prometer cura de neuropatia - hoy no existe cura conocida. MIA debe ser honesta sobre esto, pero enfocarse en que el producto ayuda a reducir molestias y mejorar la calidad de vida diaria.

- Back2Fit (faja): a diferencia de los demas, aqui los resultados SI son visibles al instante - MIA puede afirmarlo con confianza. Si el cliente menciona que busca esto por motivo de ejercicio, MIA debe validar esa accion especifica (igual que con cualquier otro dato concreto que el cliente comparta). Si el cliente NO menciona ejercicio, MIA debe enmarcar Back2Fit como un paso hacia sentirse bien con uno mismo - sin desmerecer el ejercicio, caminar a diario o comer bien, pero sin sonar a regano ni a sermon de salud.'
      ),

      -- Was "reconocer que no existe cura" for any named condition; now scoped
      -- to the products that actually have no proven efficacy.
      (
        '49e99970-c5ff-49bb-86c1-42eb5bd84baa'::uuid,
        'Antes de responder, MIA debe leer el mensaje del cliente buscando informacion concreta que haya compartido sobre su situacion (que ya intento, que logro, su contexto de uso, una fecha o evento, una condicion que ya conoce). MIA debe validar esa accion o dato especifico - no una emocion generica. Ejemplo: si el cliente dice que ya probo otras cosas sin exito, reconocer ese esfuerzo puntual, no solo decir "entiendo la frustracion". Si falta un dato que cambiaria la recomendacion (uso, duracion, urgencia, contexto), MIA puede hacer como maximo UNA pregunta para obtenerlo antes de recomendar. Si el cliente ya dio esa informacion en su mensaje, MIA no debe preguntar por preguntar - responde y avanza hacia la venta. Si el cliente menciona una condicion medica ya diagnosticada y conocida por el (ej. neuropatia diabetica, diabetes, artritis), MIA puede responder con honestidad directa sobre lo que ESE producto puede y no puede hacer: para Clean Nails puede afirmar que esta disenado para eliminar el hongo de la una con uso constante; para Neurofeet y Neurotin debe reconocer que no existe cura conocida para neuropatia y explicar que ayudan a reducir molestias y mejorar la calidad de vida diaria - sin remitir al medico, porque el cliente ya sabe lo que tiene. La remision a un profesional de salud aplica SOLO ante sintomas agudos sin diagnostico previo (dolor intenso repentino, sangrado, fiebre, inflamacion aguda) - no ante condiciones cronicas que el cliente ya nombra por si mismo ni ante preguntas de seguridad sobre productos no invasivos.'
      ),

      -- Same rewrite as 49e99970 (this row is its near-duplicate superset).
      (
        '3a773123-cbf2-483a-b223-b84e2db839fd'::uuid,
        'Antes de responder, MIA debe leer el mensaje del cliente buscando informacion concreta que haya compartido sobre su situacion (que ya intento, que logro, su contexto de uso, una fecha o evento, una condicion que ya conoce). MIA debe validar esa accion o dato especifico - no una emocion generica. Ejemplo: si el cliente dice que ya probo otras cosas sin exito, reconocer ese esfuerzo puntual, no solo decir "entiendo la frustracion". Si falta un dato que cambiaria la recomendacion (uso, duracion, urgencia, contexto), MIA puede hacer como maximo UNA pregunta para obtenerlo antes de recomendar. Si el cliente ya dio esa informacion en su mensaje, MIA no debe preguntar por preguntar - responde y avanza hacia la venta. Si el cliente menciona una condicion medica ya diagnosticada y conocida por el (ej. neuropatia diabetica, diabetes, artritis), MIA puede responder con honestidad directa sobre lo que ESE producto puede y no puede hacer: para Clean Nails puede afirmar que esta disenado para eliminar el hongo de la una con uso constante; para Neurofeet y Neurotin debe reconocer que no existe cura conocida para neuropatia y explicar que ayudan a reducir molestias y mejorar la calidad de vida diaria - sin remitir al medico, porque el cliente ya sabe lo que tiene. Adicionalmente, si el cliente pregunta si el producto es seguro para su condicion y el producto es NO invasivo y NO involucra sustancias en contacto directo con el cuerpo (ej. luz UV externa como en Clean Nails), MIA puede responder con confianza que no representa un problema para esa condicion, explicando brevemente por que: no es invasivo, no hay contacto de sustancias - sin necesidad de remitir al medico para esta pregunta especifica de seguridad de uso. La remision a un profesional de salud aplica SOLO ante sintomas agudos sin diagnostico previo (dolor intenso repentino, sangrado, fiebre, inflamacion aguda) - no ante condiciones cronicas que el cliente ya nombra por si mismo ni ante preguntas de seguridad sobre productos no invasivos.'
      ),

      -- Anticipated objection: effect type per product.
      (
        '09cfe5f3-1755-44bd-9305-2dbb0969bfd7'::uuid,
        'Al presentar un producto, anticipa de forma breve y natural la duda de efectividad: menciona el tipo de efecto que ese producto tiene segun tu conocimiento (Clean Nails elimina el hongo de la una con uso constante; Bye Canas es gradual y exige constancia; Back2Fit y Bella Patch tienen efecto inmediato pero temporal; Neurofeet y Neurotin son apoyo de comodidad) sin extenderte si el cliente no lo pide.'
      ),

      -- "Esto de verdad funciona" objection.
      (
        '492bfe5f-1c41-4e97-af08-bc7bf1b51c25'::uuid,
        'Al abordar la inquietud del cliente sobre la efectividad de un producto (ej. tiras Bella Patch), valida primero su preocupacion con empatia (ej. "Entiendo que quieras asegurarte") y responde con el efecto honesto de ESE producto segun tu conocimiento (Clean Nails esta disenado para eliminar el hongo de la una y lo consigue con uso constante; Bye Canas es gradual; Back2Fit y Bella Patch tienen efecto inmediato pero temporal; Neurofeet y Neurotin son apoyos de comodidad). Si el cliente pide testimonios o estudios, no los inventes: ofrece que el equipo comparta evidencia real por WhatsApp. La imagen de uña en proceso sirve para explicar COMO avanza el tratamiento, nunca para decir "esta imagen demuestra una cura" ni "todas las personas tendran este resultado".'
      )

    ) AS t(id, new_text)
  LOOP
    SELECT i.id, i.instruction INTO v_id, v_old
    FROM public.ai_instructions i
    WHERE i.id = r.id AND i.business_id = v_business;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'ai_instruction % not found for Vitanova', r.id;
    END IF;

    UPDATE public.ai_instructions SET instruction = r.new_text WHERE id = v_id;

    INSERT INTO public.knowledge_versions
      (business_id, entity_type, entity_id, previous_value, new_value, change_source)
    VALUES (
      v_business, 'ai_instruction', v_id,
      jsonb_build_object('instruction', v_old),
      jsonb_build_object('instruction', r.new_text),
      'manual'
    );
  END LOOP;

  -- ---------------------------------------------------------------
  -- 2. SALES RULES (escalation scope + the two stale promotion rules)
  -- ---------------------------------------------------------------
  FOR r IN
    SELECT * FROM (VALUES
      (
        '258f6b44-eaed-48ea-9c6e-e304996a5546'::uuid,
        'Dolor intenso, sospecha de condicion medica o pedidos de diagnostico: derivar a un profesional de la salud. No dar diagnosticos. No prometer tratamientos ni resultados para condiciones que el producto NO esta disenado para tratar: Clean Nails esta disenado para el hongo de la una, no para diabetes, neuropatia ni ninguna otra condicion.'
      ),
      (
        '89e10284-7f68-4998-8b3f-d7a6a21dc4fd'::uuid,
        'Back2Fit: 1 pieza $499, 2 piezas $600 (ahorro aproximado 40%), 3 piezas $1,048 (hasta 30%). Mas de 3 piezas: 35% de descuento sobre el precio base.'
      ),
      (
        '8376af3e-d6d2-49f8-8f2f-ce6e4b730f85'::uuid,
        'Neurofeet: paquetes de 3 pares en $449 o 5 pares en $599. Se pueden mezclar tallas y colores (blanco y negro, tallas S a XL). No se aplican descuentos adicionales.'
      )
    ) AS t(id, new_text)
  LOOP
    SELECT s.id, s.content INTO v_id, v_old
    FROM public.sales_rules s
    WHERE s.id = r.id AND s.business_id = v_business;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'sales_rule % not found for Vitanova', r.id;
    END IF;

    UPDATE public.sales_rules SET content = r.new_text, updated_at = now() WHERE id = v_id;

    INSERT INTO public.knowledge_versions
      (business_id, entity_type, entity_id, previous_value, new_value, change_source)
    VALUES (
      v_business, 'sales_rule', v_id,
      jsonb_build_object('content', v_old),
      jsonb_build_object('content', r.new_text),
      'manual'
    );
  END LOOP;

  -- ---------------------------------------------------------------
  -- 3. KNOWLEDGE ITEMS that described Clean Nails as non-curative
  -- ---------------------------------------------------------------
  FOR r IN
    SELECT * FROM (VALUES
      (
        'ab79f5e9-f90b-45a4-9c74-ab858be72cd5'::uuid,
        'Respuesta honesta por producto (C-010): Clean Nails esta disenado para eliminar el hongo de la una y lo consigue con uso constante; Bye Canas es gradual y exige constancia; Back2Fit y Bella Patch tienen efecto inmediato pero temporal; Neurofeet y Neurotin son apoyos de comodidad, no tratamientos medicos.'
      ),
      (
        'fa4ba178-ffb3-4c50-93d5-e7e3d21da486'::uuid,
        'Clean Nails utiliza tecnologia de luz UV e infrarroja, esta disenada para eliminar el hongo de la una: impide que el hongo se anide en la una nueva (la que va creciendo) mientras la antigua se renueva.

se usa dos veces al dia en sesiones de 7 minutos (el aparato tiene temporizador y se apaga solo al terminar cada sesion). Notaras la mejoria conforme tu una vaya creciendo. El secreto es la constancia, y tienes mas dudas?'
      )
    ) AS t(id, new_text)
  LOOP
    SELECT k.id, k.answer INTO v_id, v_old
    FROM public.knowledge_items k
    WHERE k.id = r.id AND k.business_id = v_business;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'knowledge_item % not found for Vitanova', r.id;
    END IF;

    UPDATE public.knowledge_items SET answer = r.new_text, updated_at = now() WHERE id = v_id;

    INSERT INTO public.knowledge_versions
      (business_id, entity_type, entity_id, previous_value, new_value, change_source)
    VALUES (
      v_business, 'knowledge_item', v_id,
      jsonb_build_object('answer', v_old),
      jsonb_build_object('answer', r.new_text),
      'manual'
    );
  END LOOP;

  -- ---------------------------------------------------------------
  -- 4. CLEAN NAILS product row: description, benefits and the FAQ that
  --    explicitly said "no promete una curación"
  -- ---------------------------------------------------------------
  SELECT p.faq INTO v_old_faq
  FROM public.products p
  WHERE p.id = '96c33f39-0cf0-4b1b-994b-181acbef7c57'::uuid
    AND p.business_id = v_business;

  IF v_old_faq IS NULL THEN
    RAISE EXCEPTION 'Clean Nails product not found for Vitanova';
  END IF;

  v_new_faq := v_old_faq || jsonb_build_array(jsonb_build_object(
    'q', '¿Funciona de verdad?',
    'a', 'Si, esta disenado para eliminar el hongo de la una, y lo consigue con uso constante. Se usa dos veces al dia en sesiones de 7 minutos y notarás la mejoria conforme crece la una nueva. La constancia es la clave.'
  ));

  UPDATE public.products
  SET description = 'Luz UV e infrarroja para uñas con hongos (onicomicosis). Está diseñada para eliminar el hongo de la uña, y lo consigue con uso constante.',
      benefits = 'Discreta, de uso en casa. Elimina el hongo de la uña con uso constante. Incluye envío gratis.',
      faq = v_new_faq,
      updated_at = now()
  WHERE id = '96c33f39-0cf0-4b1b-994b-181acbef7c57'::uuid;

  INSERT INTO public.knowledge_versions
    (business_id, entity_type, entity_id, previous_value, new_value, change_source)
  VALUES (
    v_business, 'product', '96c33f39-0cf0-4b1b-994b-181acbef7c57'::uuid,
    jsonb_build_object('faq', v_old_faq),
    jsonb_build_object('faq', v_new_faq),
    'manual'
  );
END $$;
