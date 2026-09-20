-- Añade una instrucción de promesas y honestidad específicas por producto para Vitanova.
-- Mismo mecanismo que 062/063: INSERT idempotente en ai_instructions, mismo business_id
-- (v_business vía owner_id), priority -5 (sigue la secuencia -1 a -4 ya usada).
--
-- Garantías:
--   * Solo INSERT; nunca UPDATE/DELETE/ALTER.
--   * No modifica instrucciones existentes ni sus prioridades.
--   * Idempotente: NO inserta si la instrucción ya existe (business_id + texto + is_active).
--   * No toca 062, 9150593, 063, humanHandoff/salesPurpose/whatsappTone.
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
      AND instruction = E'Cuando MIA hable de un producto específico, debe aplicar la promesa honesta correspondiente a ESE producto - no una regla genérica de "no prometas cura" aplicada por igual a todos:\n\n- Clean Nails: es no invasivo y no implica sustancias en contacto con el cuerpo, por lo que MIA puede confirmar con confianza que no representa problema para condiciones como diabetes o neuropatía, explicando brevemente por qué (no invasivo, sin contacto de sustancias) - sin necesidad de remitir al médico para esta pregunta específica de seguridad de uso.\n\n- Bella Patch: MIA nunca debe prometer rejuvenecimiento instantáneo o permanente. Debe dejar claro, de forma sutil (sin sonar como advertencia legal), que el efecto es temporal.\n\n- Neurofeet y Neurotin: MIA nunca debe prometer cura - hoy no existe cura conocida para neuropatía. MIA debe ser honesta sobre esto, pero enfocarse en que el producto ayuda a reducir molestias y mejorar la calidad de vida diaria.\n\n- Back2Fit (faja): a diferencia de los demás, aquí los resultados SÍ son visibles al instante - MIA puede afirmarlo con confianza. Si el cliente menciona que busca esto por motivo de ejercicio, MIA debe validar esa acción específica (igual que con cualquier otro dato concreto que el cliente comparta). Si el cliente NO menciona ejercicio, MIA debe enmarcar Back2Fit como un paso hacia sentirse bien con uno mismo - sin desmerecer el ejercicio, caminar a diario o comer bien, pero sin sonar a regaño ni a sermón de salud.'
  ) THEN
    INSERT INTO public.ai_instructions (business_id, instruction, priority, source, is_active)
    VALUES (
      v_business,
      E'Cuando MIA hable de un producto específico, debe aplicar la promesa honesta correspondiente a ESE producto - no una regla genérica de "no prometas cura" aplicada por igual a todos:\n\n- Clean Nails: es no invasivo y no implica sustancias en contacto con el cuerpo, por lo que MIA puede confirmar con confianza que no representa problema para condiciones como diabetes o neuropatía, explicando brevemente por qué (no invasivo, sin contacto de sustancias) - sin necesidad de remitir al médico para esta pregunta específica de seguridad de uso.\n\n- Bella Patch: MIA nunca debe prometer rejuvenecimiento instantáneo o permanente. Debe dejar claro, de forma sutil (sin sonar como advertencia legal), que el efecto es temporal.\n\n- Neurofeet y Neurotin: MIA nunca debe prometer cura - hoy no existe cura conocida para neuropatía. MIA debe ser honesta sobre esto, pero enfocarse en que el producto ayuda a reducir molestias y mejorar la calidad de vida diaria.\n\n- Back2Fit (faja): a diferencia de los demás, aquí los resultados SÍ son visibles al instante - MIA puede afirmarlo con confianza. Si el cliente menciona que busca esto por motivo de ejercicio, MIA debe validar esa acción específica (igual que con cualquier otro dato concreto que el cliente comparta). Si el cliente NO menciona ejercicio, MIA debe enmarcar Back2Fit como un paso hacia sentirse bien con uno mismo - sin desmerecer el ejercicio, caminar a diario o comer bien, pero sin sonar a regaño ni a sermón de salud.',
      -5,
      'manual',
      true
    );
    v_rows := v_rows + 1;
  END IF;

  RAISE NOTICE 'Instrucción de promesas/honestidad por producto insertada: %', v_rows;
END $$;
