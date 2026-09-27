-- =============================================
-- FIX: restore Spanish accents in Vitanova knowledge
-- =============================================
-- 20260926000003 rewrote 6 ai_instructions, 3 sales_rules and 2 knowledge_items
-- with unaccented Spanish (it was authored as plain ASCII). The product
-- description/benefits and the FAQ were written correctly, so only these 11
-- rows are affected.
--
-- The damage is not cosmetic: "el hongo de la una" reads as nonsense to the
-- model, and it sits in the middle of the Clean Nails efficacy claim.
--
-- Rather than retyping 11 long blobs (transcription risk), this migration
-- applies a reviewed word/phrase map to the stored text. Word entries use
-- \m ... \M anchors so inflected forms are handled correctly:
--   - "condiciones" is NOT rewritten (it is correctly unaccented)
--   - "sesiones" is NOT rewritten
--   - "diabetes" is NOT corrupted into "díabetes"
-- Plural forms that DO need the accent ("medicos", "diagnosticos") are
-- listed explicitly.
--
-- Idempotent: every search token is unaccented, so re-running is a no-op.
-- =============================================

DO $$
DECLARE
  v_business CONSTANT uuid := '4fb7418d-6c98-4a09-9094-4e4e4b2006a6';

  v_id uuid;
  v_old text;
  v_text text;
  i int;
  r record;

  -- Phrases first: they are order-sensitive, then single words.
  v_phrases CONSTANT text[][] := ARRAY[
    ARRAY['esta disenado',              'está diseñado'],
    ARRAY['esta disenada',              'está diseñada'],
    ARRAY['que ya intento, que logro',  'qué ya intentó, qué logró'],
    ARRAY['por si mismo',               'por sí mismo'],
    ARRAY['por que -',                  'por qué -'],
    ARRAY['por que:',                   'por qué:'],
    ARRAY['asi que',                    'así que'],
    ARRAY['veces al dia',               'veces al día'],
    ARRAY['y tienes mas dudas',         'y tienes más dudas'],
    ARRAY['Mas de',                     'Más de'],
    ARRAY['son apoyo de comodidad',     'son apoyos de comodidad'],
    ARRAY['ya probo otras cosas',       'ya probó otras cosas'],
    ARRAY['resultados SI son',          'resultados SÍ son'],
    ARRAY['explicar COMO avanza',       'explicar CÓMO avanza'],
    ARRAY['la una',                     'la uña'],
    ARRAY['tu una',                     'tu uña']
  ];

  v_words CONSTANT text[][] := ARRAY[
    ARRAY['identicos',      'idénticos'],
    ARRAY['informacion',    'información'],
    ARRAY['situacion',      'situación'],
    ARRAY['especifico',     'específico'],
    ARRAY['especifica',     'específica'],
    ARRAY['emocion',        'emoción'],
    ARRAY['exito',          'éxito'],
    ARRAY['frustracion',    'frustración'],
    ARRAY['cambiaria',      'cambiaría'],
    ARRAY['recomendacion',  'recomendación'],
    ARRAY['duracion',       'duración'],
    ARRAY['condicion',      'condición'],
    ARRAY['medica',         'médica'],
    ARRAY['medico',         'médico'],
    ARRAY['medicos',        'médicos'],
    ARRAY['diagnostico',    'diagnóstico'],
    ARRAY['diagnosticos',   'diagnósticos'],
    ARRAY['neuropatia',     'neuropatía'],
    ARRAY['diabetica',      'diabética'],
    ARRAY['maximo',         'máximo'],
    ARRAY['cronicas',       'crónicas'],
    ARRAY['inflamacion',    'inflamación'],
    ARRAY['remision',       'remisión'],
    ARRAY['sintomas',       'síntomas'],
    ARRAY['limites',        'límites'],
    ARRAY['demas',          'demás'],
    ARRAY['aqui',           'aquí'],
    ARRAY['accion',         'acción'],
    ARRAY['regano',         'regaño'],
    ARRAY['sermon',         'sermón'],
    ARRAY['instantaneo',    'instantáneo'],
    ARRAY['generica',       'genérica'],
    ARRAY['tecnologia',     'tecnología'],
    ARRAY['sesion',         'sesión'],
    ARRAY['Notaras',        'Notarás'],
    ARRAY['mejoria',        'mejoría'],
    ARRAY['segun',          'según'],
    ARRAY['preocupacion',   'preocupación'],
    ARRAY['empatia',        'empatía'],
    ARRAY['tendran',        'tendrán'],
    ARRAY['Ademas',         'Además']
  ];

  v_residue CONSTANT text := 'esta disenad|de la una |la una nueva|tu una |identicos|medicos|medico[ .,]|diagnostico|neuropatia |cronicas|inflamacion|remision|sintomas|duracion|informacion|situacion|especifico |especifica |emocion|exito|frustracion|cambiaria|recomendacion|condicion[ ., ]|maximo|aqui |demas|accion |tecnologia| cada sesion|mejoria| segun |preocupacion|empatia|tendran|limites| Ademas |asi que|mas dudas|veces al dia|ya probo |resultados SI son|explicar COMO ';
BEGIN
  -- ---------------------------------------------------------------
  -- 1. AI INSTRUCTIONS
  -- ---------------------------------------------------------------
  FOR r IN
    SELECT id::uuid FROM (VALUES
      ('d63f87aa-d3d1-4592-834e-9ecef9b44b12'),
      ('a9708791-c499-4476-a03a-46f6b8f6649d'),
      ('49e99970-c5ff-49bb-86c1-42eb5bd84baa'),
      ('3a773123-cbf2-483a-b223-b84e2db839fd'),
      ('09cfe5f3-1755-44bd-9305-2dbb0969bfd7'),
      ('492bfe5f-1c41-4e97-af08-bc7bf1b51c25')
    ) AS t(id)
  LOOP
    SELECT i.id, i.instruction INTO v_id, v_old
    FROM public.ai_instructions i
    WHERE i.id = r.id AND i.business_id = v_business;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'ai_instruction % not found for Vitanova', r.id;
    END IF;

    v_text := v_old;

    FOR i IN 1..array_length(v_phrases, 1) LOOP
      v_text := replace(v_text, v_phrases[i][1], v_phrases[i][2]);
    END LOOP;

    FOR i IN 1..array_length(v_words, 1) LOOP
      v_text := regexp_replace(v_text, '\m' || v_words[i][1] || '\M', v_words[i][2], 'g');
    END LOOP;

    IF v_text ~ v_residue THEN
      RAISE EXCEPTION 'unaccented residue remains in ai_instruction %', r.id;
    END IF;

    IF v_text = v_old THEN
      RAISE NOTICE 'ai_instruction % already accented, skipped', r.id;
      CONTINUE;
    END IF;

    UPDATE public.ai_instructions SET instruction = v_text WHERE id = v_id;

    INSERT INTO public.knowledge_versions
      (business_id, entity_type, entity_id, previous_value, new_value, change_source)
    VALUES (
      v_business, 'ai_instruction', v_id,
      jsonb_build_object('instruction', v_old),
      jsonb_build_object('instruction', v_text),
      'manual'
    );
  END LOOP;

  -- ---------------------------------------------------------------
  -- 2. SALES RULES
  -- ---------------------------------------------------------------
  FOR r IN
    SELECT id::uuid FROM (VALUES
      ('258f6b44-eaed-48ea-9c6e-e304996a5546'),
      ('89e10284-7f68-4998-8b3f-d7a6a21dc4fd'),
      ('8376af3e-d6d2-49f8-8f2f-ce6e4b730f85')
    ) AS t(id)
  LOOP
    SELECT s.id, s.content INTO v_id, v_old
    FROM public.sales_rules s
    WHERE s.id = r.id AND s.business_id = v_business;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'sales_rule % not found for Vitanova', r.id;
    END IF;

    v_text := v_old;

    FOR i IN 1..array_length(v_phrases, 1) LOOP
      v_text := replace(v_text, v_phrases[i][1], v_phrases[i][2]);
    END LOOP;

    FOR i IN 1..array_length(v_words, 1) LOOP
      v_text := regexp_replace(v_text, '\m' || v_words[i][1] || '\M', v_words[i][2], 'g');
    END LOOP;

    IF v_text ~ v_residue THEN
      RAISE EXCEPTION 'unaccented residue remains in sales_rule %', r.id;
    END IF;

    IF v_text = v_old THEN
      RAISE NOTICE 'sales_rule % already accented, skipped', r.id;
      CONTINUE;
    END IF;

    UPDATE public.sales_rules SET content = v_text, updated_at = now() WHERE id = v_id;

    INSERT INTO public.knowledge_versions
      (business_id, entity_type, entity_id, previous_value, new_value, change_source)
    VALUES (
      v_business, 'sales_rule', v_id,
      jsonb_build_object('content', v_old),
      jsonb_build_object('content', v_text),
      'manual'
    );
  END LOOP;

  -- ---------------------------------------------------------------
  -- 3. KNOWLEDGE ITEMS
  -- ---------------------------------------------------------------
  FOR r IN
    SELECT id::uuid FROM (VALUES
      ('ab79f5e9-f90b-45a4-9c74-ab858be72cd5'),
      ('fa4ba178-ffb3-4c50-93d5-e7e3d21da486')
    ) AS t(id)
  LOOP
    SELECT k.id, k.answer INTO v_id, v_old
    FROM public.knowledge_items k
    WHERE k.id = r.id AND k.business_id = v_business;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'knowledge_item % not found for Vitanova', r.id;
    END IF;

    v_text := v_old;

    FOR i IN 1..array_length(v_phrases, 1) LOOP
      v_text := replace(v_text, v_phrases[i][1], v_phrases[i][2]);
    END LOOP;

    FOR i IN 1..array_length(v_words, 1) LOOP
      v_text := regexp_replace(v_text, '\m' || v_words[i][1] || '\M', v_words[i][2], 'g');
    END LOOP;

    IF v_text ~ v_residue THEN
      RAISE EXCEPTION 'unaccented residue remains in knowledge_item %', r.id;
    END IF;

    IF v_text = v_old THEN
      RAISE NOTICE 'knowledge_item % already accented, skipped', r.id;
      CONTINUE;
    END IF;

    UPDATE public.knowledge_items SET answer = v_text, updated_at = now() WHERE id = v_id;

    INSERT INTO public.knowledge_versions
      (business_id, entity_type, entity_id, previous_value, new_value, change_source)
    VALUES (
      v_business, 'knowledge_item', v_id,
      jsonb_build_object('answer', v_old),
      jsonb_build_object('answer', v_text),
      'manual'
    );
  END LOOP;
END $$;
