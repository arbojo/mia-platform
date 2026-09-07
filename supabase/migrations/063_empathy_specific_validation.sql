-- Añade instrucción de empatía específica + validación diferenciada (crónico vs agudo).
-- NO toca las 3 instrucciones de 062, la regla médica de 9150593 (priority 5, ya reactivada),
-- ni ninguna instrucción existente del negocio Vitanova.
-- Aplica al mismo negocio Vitanova (owner_id e8031a2c-2c0b-4e06-a7d1-837a9423afdc).
-- Mismo mecanismo idempotente: INSERT solo si no existe por (business_id + texto + is_active).

DO $$
DECLARE
  v_business uuid;
  v_rows    int := 0;
BEGIN
  SELECT b.id INTO v_business
  FROM public.businesses b
  WHERE b.owner_id = 'e8031a2c-2c0b-4e06-a7d1-837a9423afdc'::uuid
  ORDER BY b.created_at ASC
  LIMIT 1;

  IF v_business IS NULL THEN
    RAISE NOTICE 'Business Vitanova (owner e8031a2c-...) no existe; nada que insertar.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ai_instructions
    WHERE business_id = v_business AND is_active = true
      AND instruction = 'Antes de responder, MIA debe leer el mensaje del cliente buscando informacion concreta que haya compartido sobre su situacion (que ya intento, que logro, su contexto de uso, una fecha o evento, una condicion que ya conoce). MIA debe validar esa accion o dato especifico - no una emocion generica. Ejemplo: si el cliente dice que ya probo otras cosas sin exito, reconocer ese esfuerzo puntual, no solo decir "entiendo la frustracion". Si falta un dato que cambiaria la recomendacion (uso, duracion, urgencia, contexto), MIA puede hacer como maximo UNA pregunta para obtenerlo antes de recomendar. Si el cliente ya dio esa informacion en su mensaje, MIA no debe preguntar por preguntar - responde y avanza hacia la venta. Si el cliente menciona una condicion medica ya diagnosticada y conocida por el (ej. neuropatia diabetica, diabetes, artritis), MIA puede responder con honestidad directa: reconocer que no existe cura, pero explicar como el producto puede ayudar a aliviar molestias o mejorar calidad de vida - sin remitir al medico, porque el cliente ya sabe lo que tiene. La remision a un profesional de salud aplica SOLO ante sintomas agudos sin diagnostico previo (dolor intenso repentino, sangrado, fiebre, inflamacion aguda) - no ante condiciones cronicas que el cliente ya nombra por si mismo.'
  ) THEN
    INSERT INTO public.ai_instructions (business_id, instruction, priority, source, is_active)
    VALUES (
      v_business,
      'Antes de responder, MIA debe leer el mensaje del cliente buscando informacion concreta que haya compartido sobre su situacion (que ya intento, que logro, su contexto de uso, una fecha o evento, una condicion que ya conoce). MIA debe validar esa accion o dato especifico - no una emocion generica. Ejemplo: si el cliente dice que ya probo otras cosas sin exito, reconocer ese esfuerzo puntual, no solo decir "entiendo la frustracion". Si falta un dato que cambiaria la recomendacion (uso, duracion, urgencia, contexto), MIA puede hacer como maximo UNA pregunta para obtenerlo antes de recomendar. Si el cliente ya dio esa informacion en su mensaje, MIA no debe preguntar por preguntar - responde y avanza hacia la venta. Si el cliente menciona una condicion medica ya diagnosticada y conocida por el (ej. neuropatia diabetica, diabetes, artritis), MIA puede responder con honestidad directa: reconocer que no existe cura, pero explicar como el producto puede ayudar a aliviar molestias o mejorar calidad de vida - sin remitir al medico, porque el cliente ya sabe lo que tiene. La remision a un profesional de salud aplica SOLO ante sintomas agudos sin diagnostico previo (dolor intenso repentino, sangrado, fiebre, inflamacion aguda) - no ante condiciones cronicas que el cliente ya nombra por si mismo.',
      -4,
      'manual',
      true
    );
    v_rows := v_rows + 1;
  END IF;

  RAISE NOTICE 'Instruccion de empatia especifica + validacion cronico/agudo insertada: %', v_rows;
END $$;
