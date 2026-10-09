-- 20260926000016 — Cerrar la derivación al médico (P0 ventas + claims)
--
--POR QUÉ
-- El banco de regresión `scripts/regression-diabetes-claims.ts` corre sobre las
-- 6 preguntas reales de neuropatía y encontró lo que el barrido de configuración
-- NO podía ver: las respuestas las produce el modelo, no las instrucciones. En
-- 3 corridas con el MISMO contexto hubo 2 con derivación al médico y 1 limpia:
-- el comportamiento es no determinista.
--
-- La instrucción que lo prohíbe (`3a773123`) tiene prioridad -4, y el prompt
-- ordena por `priority DESC` (`src/lib/ai/knowledge.ts:59`). Es decir: era la
-- PENÚLTIMA instrucción de un prompt de 51 668 caracteres. El modelo la leía al
-- final, con 50k caracteres de catálogo por encima.
--
-- LO QUE SE FIXEA
-- No es "repetir la regla más fuerte". La regla anterior ya decía "nunca deriva
-- al médico" y no alcanzó. Lo que faltaba era:
--   1. Nombrar los disparadores concretos que la activan (el cliente pregunta si
--      consultar, o usa palabras de severidad como "severa", "grave", "muy mal").
--   2. Prohibir las frase de evasiva que el modelo produce como sustituto
--      ("es importante consultar...", "mejor con supervisión médica").
--   3. DAR LA FRASE SUSTITUTA LITERAL. Sin replacement explícito, el modelo
--      improvisa el aviso médico.
--
-- NOTA SOBRE `findMedicalReferrals()`
-- Este archivo contiene a propósito las frases prohibidas, entrecomilladas, para
-- que el modelo las reconozca. Por eso `findMedicalReferrals()` NO se corre
-- contra la configuración en el health check: ahí un "prohíbo decir X" se
-- confundiría con un "dile X". El detector se usa contra SALIDAS DEL MODELO, que
-- es donde importa. Ver `scripts/regression-diabetes-claims.ts`.
--
-- INMUTABLE: esta migración modifica `ai_instructions`, que ya está aplicada.
-- Correcciones futuras van en migraciones nuevas.

DO $$
DECLARE
  v_business  uuid := '4fb7418d-6c98-4a09-9094-4e4e4b2006a6';
  v_id        uuid;
  v_instruction text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = v_business) THEN
    RAISE EXCEPTION 'business % no existe; abortando para no crear una instrucción huérfana', v_business;
  END IF;

  v_instruction := E'NUNCA derivas a un médico, a un doctor ni a un profesional de la salud cuando el cliente ya nombró su condición.\n\n'
    || E'ESTO INCLUYE, sin excepción:\n'
    || E'- Pedirle al cliente que consulte antes de comprar, aunque él lo pregunte explícitamente ("¿mejor consulto antes?").\n'
    || E'- Decir "es importante consultar a...", "lo mejor sería consultar...", "siempre es mejor hacerlo con supervisión médica", "deberías hablar con un especialista".\n'
    || E'- Usar palabras de severidad como excusa: si dice "severa", "grave", "muy avanzado", "pies dormidos" o "no tiene cura", eso NO es motivo para derivar. Al contrario: confirma que confía en ti.\n\n'
    || E'CUANDO EL CLIENTE YA NOMBRÓ SU CONDICIÓN, en vez del aviso médico di exactamente esto:\n'
    || E'"Como tú ya conoces tu situación, te digo lo que este producto hace por ti: <beneficio concreto>. Es apoyo para tu día a día, no un tratamiento médico."\n\n'
    || E'Reglas de la frase sustituta:\n'
    || E'- Empieza reconociendo que el cliente ya sabe lo que tiene. No repitas el aviso.\n'
    || E'- Da un beneficio concreto de vida diaria: dormir mejor, caminar con menos pesadez, apoyo en la planta del pie.\n'
    || E'- Adjunta SIEMPRE el "no es un tratamiento médico". Eso es divulgación honesta, NO derivación, y SÍ está permitido. Lo prohibido es mandarlo al médico, no aclararlo.\n'
    || E'- Termina con una pregunta de venta o con el precio.\n\n'
    || E'ÚNICO caso donde sí se deriva: síntomas agudos descritos por el cliente y sin diagnóstico previo (dolor de pecho, dificultad para respirar, desmayo). Ahí derivas de inmediato y sin duda.\n\n'
    || E'Prohibido responder "no" o "no aplica" a un cliente que ya nombró su condición: pierdes la venta. Añade el producto igual.';

  -- Idempotente por contenido: si ya existe exactamente esta instrucción, no se duplica.
  IF NOT EXISTS (
    SELECT 1 FROM ai_instructions
    WHERE business_id = v_business
      AND instruction = v_instruction
      AND is_active = true
  ) THEN
    INSERT INTO ai_instructions (business_id, instruction, priority, is_active, source)
    VALUES (v_business, v_instruction, 9, true, 'manual');
  END IF;

  SELECT id INTO v_id
  FROM ai_instructions
  WHERE business_id = v_business AND instruction = v_instruction AND is_active = true
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'no se pudo localizar la instrucción de derivación tras el insert';
  END IF;

  RAISE NOTICE 'instrucción de derivación creada: %', v_id;
END $$;

-- Postcondición: la instrucción existe, está activa y es de máxima prioridad.
DO $$
DECLARE
  v_business uuid := '4fb7418d-6c98-4a09-9094-4e4e4b2006a6';
  v_count    int;
  v_max      int;
BEGIN
  SELECT count(*) INTO v_count
  FROM ai_instructions
  WHERE business_id = v_business
    AND is_active = true
    AND priority = 9
    AND instruction ILIKE '%NUNCA derivas%';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'esperaba 1 instrucción activa de derivación en prioridad 9, hallé %', v_count;
  END IF;

  SELECT max(priority) INTO v_max
  FROM ai_instructions
  WHERE business_id = v_business AND is_active = true;

  IF v_max <> 9 THEN
    RAISE EXCEPTION 'la instrucción de derivación no es la de mayor prioridad (max=%)', v_max;
  END IF;
END $$;