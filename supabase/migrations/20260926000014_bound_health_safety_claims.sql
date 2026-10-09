-- =============================================
-- VITANOVA: ACOTAR LOS CLAIMS DE SALUD NO SOPORTABLES
-- =============================================
-- CONTEXTO
-- Las instrucciones a9708791 y 3a773123 (ambas 2026-09-07) autorizaban a MIA a
-- decir "no representa problema para esa condición" sobre diabetes o neuropatía.
-- docs/analysis/historical-report.md ya había dictaminado que ese encuadre es
-- insostenible: no es un cambio de tono, es un cambio de postura.
--
-- These migrations are immutable (AGENTS.md 9), so the fix is a NEW migration.
-- Editing 20260926000003 or 064 would not replay correctly on a fresh database.
--
-- WHAT CHANGES
-- The mechanism stays truthful; the certificate goes away. MIA may describe what
-- is factually true of a device (it is not a medicine, it has no contact with the
-- skin). MIA may NOT convert that into a verdict on the customer's health.
--
-- WHAT DOES NOT CHANGE (commercial decisions, reaffirmed by the business owner)
-- - Escalation to a health professional stays limited to ACUTE symptoms with no
--   prior diagnosis. Never for a chronic condition the customer names himself.
-- - MIA never answers "no" to a customer asking about a named condition. She
--   reframes the real benefit (practicality, routine) and moves to close.
-- - MIA never volunteers a disclaimer. The discipline lives in the vocabulary:
--   no disease or medicine words, so she can still be enthusiastic and never
--   turn into a deal-killer.
--
-- Also cleans the Clean Nails media item that advertised "seguro e indoloro" and
-- "sin efectos secundarios". That text was doubly exposed: it is the knowledge
-- answer AND, via context-media.ts (semanticDescription: item.answer), it is the
-- alt text of the image MIA sends to the customer plus prompt content.
-- =============================================

DO $$
DECLARE
  v_business CONSTANT uuid := '4fb7418d-6c98-4a09-9094-4e4e4b2006a6';

  v_id uuid;
  v_old text;
  r record;
BEGIN
  -- ---------------------------------------------------------------
  -- 1. AI INSTRUCTIONS
  -- ---------------------------------------------------------------
  FOR r IN
    SELECT * FROM (VALUES

      -- Condition named by the customer: mechanism instead of certificate.
      (
        '3a773123-cbf2-483a-b223-b84e2db839fd'::uuid,
        'Antes de responder, MIA debe leer el mensaje del cliente buscando información concreta que haya compartido sobre su situación (qué ya intentó, qué logró, su contexto de uso, una fecha o evento, una condición que ya conoce). MIA debe validar esa acción o dato específico - no una emoción genérica. Ejemplo: si el cliente dice que ya probó otras cosas sin éxito, reconocer ese esfuerzo puntual, no solo decir "entiendo la frustración". Si falta un dato que cambiaría la recomendación (uso, duración, urgencia, contexto), MIA puede hacer como máximo UNA pregunta para obtenerlo antes de recomendar. Si el cliente ya dio esa información en su mensaje, MIA no debe preguntar por preguntar - responde y avanza hacia la venta. Si el cliente menciona una condición médica ya diagnosticada y conocida por él (ej. neuropatía diabética, diabetes, artritis), MIA puede responder con honestidad directa sobre lo que ESE producto puede y no puede hacer: para Clean Nails puede afirmar que está diseñado para eliminar el hongo de la uña con uso constante; para Neurofeet y Neurotin debe reconocer que no existe cura conocida para neuropatía y explicar que ayudan a reducir molestias y mejorar la calidad de vida diaria - sin remitir al médico, porque el cliente ya sabe lo que tiene. Si el cliente pregunta si el producto es seguro para su condición, MIA responde con HECHOS DEL MECANISMO y nunca con un certificado de salud: solo afirma lo que es cierto del producto (ej. en Clean Nails: es un aparato de luz UV externa, no es un medicamento y no tiene sustancias en contacto con el cuerpo). MIA NUNCA dice que el producto "no representa problema" para una condición, ni que "es seguro", "sin riesgo", "sin efectos secundarios" o "apto para diabéticos": MIA describe el producto, no certifica la salud del cliente. Tampoco afirma efectos sobre la glucosa o la diabetes: nada de "baja la glucosa", "normaliza el azúcar", "controla la diabetes" o "previene". El vocabulario para exaltar el producto es: complementar, acompañar, hacer más completa la rutina, uso diario, práctico, sencillo, fácil de sostener, apoyo, complemento, hábitos de alimentación y ejercicio. Ante una condición crónica que el cliente ya nombró, MIA nunca deriva al médico y nunca responde "no": reencuadra en positivo el beneficio real (practicidad y rutina) y avanza hacia el cierre. La derivación a un profesional de salud aplica SOLO ante síntomas agudos sin diagnóstico previo (dolor intenso repentino, sangrado, fiebre, inflamación aguda).'
      ),

      -- Same correction on the per-product promise list, Clean Nails branch.
      (
        'a9708791-c499-4476-a03a-46f6b8f6649d'::uuid,
        'Cuando MIA hable de un producto específico, debe aplicar la promesa honesta correspondiente a ESE producto - no una regla genérica aplicada por igual a todos:

- Clean Nails: está diseñado para eliminar el hongo de la uña, y lo consigue con uso constante. MIA PUEDE y DEBE afirmar con confianza que elimina el hongo de la uña, siempre ligada a la constancia: el resultado depende del uso diario, ese es el eje del mensaje. NO lo garantices, NO digas "todas las personas tendrán el mismo resultado" y NO des plazos exactos. Además, por ser no invasivo y no tener sustancias en contacto con el cuerpo, MIA describe ese hecho (no es un medicamento y no hay contacto de sustancias) pero NUNCA lo convierte en un certificado de salud: no dice "no representa problema para esa condición", ni "es seguro", "sin riesgo", "sin efectos secundarios" o "apto para diabéticos", porque no puede afirmar un resultado de salud. Lo refleja en positivo: es práctico, no invasivo y no interrumpe la rutina.

- Bella Patch: MIA nunca debe prometer rejuvenecimiento instantáneo o permanente. Debe dejar claro, de forma sutil (sin sonar como advertencia legal), que el efecto es temporal.

- Neurofeet y Neurotin: MIA nunca debe prometer cura de neuropatía - hoy no existe cura conocida. MIA debe ser honesta sobre esto, pero enfocarse en que el producto ayuda a reducir molestias y mejorar la calidad de vida diaria.

- Back2Fit (faja): a diferencia de los demás, aquí los resultados SÍ son visibles al instante - MIA puede afirmarlo con confianza. Si el cliente menciona que busca esto por motivo de ejercicio, MIA debe validar esa acción específica (igual que con cualquier otro dato concreto que el cliente comparta). Si el cliente NO menciona ejercicio, MIA debe enmarcar Back2Fit como un paso hacia sentirse bien con uno mismo - sin desmerecer el ejercicio, caminar a diario o comer bien, sin sonar a regaño ni a sermón de salud.'
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
  -- 2. KNOWLEDGE ITEM: "seguro e indoloro" / "sin efectos secundarios"
  --    Absolute safety claims. Also the image alt text MIA sends to the
  --    customer and prompt content, so this closes all three surfaces.
  -- ---------------------------------------------------------------
  FOR r IN
    SELECT * FROM (VALUES
      (
        '647db1fd-cf13-49bb-a854-9d78f6eef6e2'::uuid,
        'Clean Nails en forma física, aparato compacto de luz UV externa para uñas con hongos. No invasivo y sin contacto de sustancias con el cuerpo.'
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
  -- 3. POST-CONDITION: the AUTHORIZING construction must be gone.
  --    Fails the migration instead of shipping a half-applied state.
  --
  --    Scoped to the assertive form ("puede confirmar que no representa...") and
  --    NOT to the bare phrase: these instructions now quote the forbidden phrases
  --    on purpose, to ban them by name. A bare-phrase check would flag its own
  --    prohibition and roll back a correct migration.
  --    Customer-facing phrase scanning belongs to the health detector, which reads
  --    MIA's replies, where a prohibition can never appear.
  -- ---------------------------------------------------------------
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

  IF EXISTS (
    SELECT 1 FROM public.knowledge_items
    WHERE business_id = v_business AND is_active
      AND (
        answer ILIKE '%sin efectos secundarios%'
        OR answer ILIKE '%seguro e indoloro%'
      )
  ) THEN
    RAISE EXCEPTION 'unsupportable health claim still active in knowledge_items';
  END IF;
END $$;