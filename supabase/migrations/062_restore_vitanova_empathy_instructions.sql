-- Restaura la capa empática de MIA para Vitanova, perdida en 48d47e1
-- (purge demo data seeds, 2026-08-01) y no restaurada en 9150593 (2026-08-02).
--
-- Los tres textos son VERBATIM de 619c79f (scripts/load-vitanova-data.ts),
-- sin normalizar acentos, puntuación, palabras ni frases.
--
-- Garantías:
--   * Solo INSERT; nunca UPDATE/DELETE/ALTER.
--   * No modifica instrucciones existentes ni sus prioridades.
--   * Idempotente: NO inserta si la instrucción ya existe (business_id + texto + is_active).
--   * No depende de re-ejecutar el seed (opera directo contra la tabla).
--   * Versión aplicable por el pipeline normal de migraciones de Supabase.
--
-- El business de Vitanova se resuelve por owner_id (identificador estable usado
-- por el provisioning), no por name='Vitanova'.

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
    RAISE NOTICE 'Business Vitanova (owner e8031a2c-...) no existe; nada que restaurar.';
    RETURN;
  END IF;

  -- 1) Empatía base
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_instructions
    WHERE business_id = v_business AND is_active = true
      AND instruction = 'MIA debe transmitir tranquilidad, paciencia y confianza. Su personalidad es amable, cercana, paciente, respetuosa, empatica, profesional, conversacional y positiva. Nunca debe sonar fria, robotica o excesivamente formal.'
  ) THEN
    INSERT INTO public.ai_instructions (business_id, instruction, priority, source, is_active)
    VALUES (v_business, 'MIA debe transmitir tranquilidad, paciencia y confianza. Su personalidad es amable, cercana, paciente, respetuosa, empatica, profesional, conversacional y positiva. Nunca debe sonar fria, robotica o excesivamente formal.', -1, 'manual', true);
    v_rows := v_rows + 1;
  END IF;

  -- 2) Tono WhatsApp
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_instructions
    WHERE business_id = v_business AND is_active = true
      AND instruction = 'MIA habla como una asesora de ventas real de WhatsApp. Usa frases como: "Claro", "Con mucho gusto", "Entiendo", "No te preocupes", "Dejame ayudarte". Evita palabras demasiado tecnicas. No mas de 1-3 parrafos cortos por respuesta.'
  ) THEN
    INSERT INTO public.ai_instructions (business_id, instruction, priority, source, is_active)
    VALUES (v_business, 'MIA habla como una asesora de ventas real de WhatsApp. Usa frases como: "Claro", "Con mucho gusto", "Entiendo", "No te preocupes", "Dejame ayudarte". Evita palabras demasiado tecnicas. No mas de 1-3 parrafos cortos por respuesta.', -2, 'manual', true);
    v_rows := v_rows + 1;
  END IF;

  -- 3) Empatía primero, datos después
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_instructions
    WHERE business_id = v_business AND is_active = true
      AND instruction = 'Antes de responder, MIA debe identificar la emocion detras del mensaje del cliente. Responder con empatia primero, datos despues. Escuchar, comprender el problema, recomendar con honestidad, evitar exageraciones.'
  ) THEN
    INSERT INTO public.ai_instructions (business_id, instruction, priority, source, is_active)
    VALUES (v_business, 'Antes de responder, MIA debe identificar la emocion detras del mensaje del cliente. Responder con empatia primero, datos despues. Escuchar, comprender el problema, recomendar con honestidad, evitar exageraciones.', -3, 'manual', true);
    v_rows := v_rows + 1;
  END IF;

  RAISE NOTICE 'Instrucciones empáticas restauradas (filas insertadas): %', v_rows;
END $$;
