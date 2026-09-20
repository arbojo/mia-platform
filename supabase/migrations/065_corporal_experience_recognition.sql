-- Añade la instrucción de reconocimiento de la experiencia corporal (antes de
-- hablar del producto) para Vitanova. Mismo mecanismo que 062/063/064: INSERT
-- idempotente en ai_instructions, mismo business_id (v_business vía owner_id),
-- priority -6 (sigue la secuencia -1 a -5 ya usada).
--
-- Garantías:
--   * Solo INSERT; nunca UPDATE/DELETE/ALTER.
--   * No modifica instrucciones existentes ni sus prioridades.
--   * Idempotente: NO inserta si la instrucción ya existe (business_id + texto + is_active).
--   * No toca 062, 9150593, 063, 064, humanHandoff/salesPurpose/whatsappTone.
--   * Sin cambios de schema.
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
    RAISE NOTICE 'Business Vitanova (owner e8031a2c-...) no existe; nada que insertar.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ai_instructions
    WHERE business_id = v_business AND is_active = true
      AND instruction = 'Cuando el cliente describa una sensacion corporal extrana, incomoda o diferente (ej. pies dormidos, hormigueo, entumecimiento, ardor, sensibilidad reducida o alterada, algo que "se siente distinto"), MIA debe reconocer primero la experiencia humana antes de hablar del producto. Principio: algo puede seguir estando ahi y, sin embargo, sentirse completamente diferente. NUNCA digas "se exactamente lo que sientes", "esto es neuropatia", "esto significa que tienes X", "este producto va a quitarte el problema", ni "yo tambien lo he vivido". SI puedes decir cosas como "a veces una parte del cuerpo sigue estando ahi, pero la forma en que la sentimos puede cambiar" o "debe ser extrano notar que algo tan cotidiano se siente diferente". Despues de reconocer la experiencia, aterriza de inmediato en lo concreto: que necesita el cliente, que puede aportar realmente el producto, y sus limites - nunca uses la empatia como presion para cerrar la venta. La metafora sirve para reconocer la experiencia, NUNCA para diagnosticar: si el cliente describe sintomas medicos que puedan requerir valoracion, MIA debe evitar afirmar una causa o diagnostico y recomendar valoracion profesional cuando corresponda.'
  ) THEN
    INSERT INTO public.ai_instructions (business_id, instruction, priority, source, is_active)
    VALUES (
      v_business,
      'Cuando el cliente describa una sensacion corporal extrana, incomoda o diferente (ej. pies dormidos, hormigueo, entumecimiento, ardor, sensibilidad reducida o alterada, algo que "se siente distinto"), MIA debe reconocer primero la experiencia humana antes de hablar del producto. Principio: algo puede seguir estando ahi y, sin embargo, sentirse completamente diferente. NUNCA digas "se exactamente lo que sientes", "esto es neuropatia", "esto significa que tienes X", "este producto va a quitarte el problema", ni "yo tambien lo he vivido". SI puedes decir cosas como "a veces una parte del cuerpo sigue estando ahi, pero la forma en que la sentimos puede cambiar" o "debe ser extrano notar que algo tan cotidiano se siente diferente". Despues de reconocer la experiencia, aterriza de inmediato en lo concreto: que necesita el cliente, que puede aportar realmente el producto, y sus limites - nunca uses la empatia como presion para cerrar la venta. La metafora sirve para reconocer la experiencia, NUNCA para diagnosticar: si el cliente describe sintomas medicos que puedan requerir valoracion, MIA debe evitar afirmar una causa o diagnostico y recomendar valoracion profesional cuando corresponda.',
      -6,
      'manual',
      true
    );
    v_rows := v_rows + 1;
  END IF;

  RAISE NOTICE 'Instruccion de reconocimiento de experiencia corporal insertada: %', v_rows;
END $$;