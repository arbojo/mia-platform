-- =============================================
-- FIX: restore Spanish accents in the remaining Vitanova rows
-- =============================================
-- 20260926000005 fixed the 11 rows rewritten by 20260926000003. A full scan of
-- every active ai_instruction / sales_rule / knowledge_item then found 6 more
-- rows (plus knowledge_item 15a108bf) that had been stored unaccented all
-- along, and one real typo introduced by our own 00003 rewrite:
--
--   d63f87aa  "Se honesta sobre los limites"  ->  "Sé honesta ..."
--
-- Which also broke seed/production parity: scripts/seed-vitanova.ts was written
-- with the correct "Sé honesta", so production was the wrong side.
--
-- The extra map entries beyond 00005 target genuine misspellings that a plain
-- accent pass cannot fix, because the source letter is already accented with
-- the WRONG vowel or the word is missing its tilde:
--
--   deriválo  -> derívalo   (accent on the wrong syllable)
--   extrana   -> extraña    (feminine, lost the tilde)
--   incomoda  -> incómoda   (feminine, lost the accent)
--   extrano   -> extraño     (singular, lost the tilde)
--   presion   -> presión
--   deriválo / Dejame / No mas de / SI puedes decir  (tuteo + tildes)
--
-- Idempotent: every search token is unaccented or already misaccented, so a
-- re-run is a no-op.
--
-- Note on the residue guard: tokens are \m ... \M anchored, so "demas" no
-- longer false-positives inside "demasiado" (it did in the JS dry-run).
-- Every token below ends in a word character, which is required for the
-- trailing \M anchor to hold.
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
    ARRAY['Se honesta sobre',           'Sé honesta sobre'],
    ARRAY['Dejame ayudarte',             'Déjame ayudarte'],
    ARRAY['No mas de',                  'No más de'],
    ARRAY['asi de raro',                'así de raro'],
    ARRAY['incomodo/a',                 'incómodo/a'],
    ARRAY['se exactamente',             'sé exactamente'],
    ARRAY['SI puedes decir',            'SÍ puedes decir'],
    ARRAY['deriválo',                   'derívalo'],
    ARRAY['Guillain-Barre',             'Guillain-Barré'],
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
    ARRAY['sensacion',      'sensación'],
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
    ARRAY['ahi',            'ahí'],
    ARRAY['accion',         'acción'],
    ARRAY['regano',         'regaño'],
    ARRAY['sermon',         'sermón'],
    ARRAY['instantaneo',    'instantáneo'],
    ARRAY['generica',       'genérica'],
    ARRAY['tecnologia',     'tecnología'],
    ARRAY['tecnicas',       'técnicas'],
    ARRAY['parrafos',       'párrafos'],
    ARRAY['detras',         'detrás'],
    ARRAY['despues',        'después'],
    ARRAY['Despues',        'Después'],
    ARRAY['extranos',       'extraños'],
    ARRAY['extrana',        'extraña'],
    ARRAY['extrano',        'extraño'],
    ARRAY['incomoda',       'incómoda'],
    ARRAY['atencion',       'atención'],
    ARRAY['construccion',   'construcción'],
    ARRAY['metafora',       'metáfora'],
    ARRAY['derivacion',     'derivación'],
    ARRAY['valoracion',     'valoración'],
    ARRAY['presion',        'presión'],
    ARRAY['sesion',         'sesión'],
    ARRAY['Notaras',        'Notarás'],
    ARRAY['mejoria',        'mejoría'],
    ARRAY['segun',          'según'],
    ARRAY['preocupacion',   'preocupación'],
    ARRAY['empatia',        'empatía'],
    ARRAY['tendran',        'tendrán'],
    ARRAY['Ademas',         'Además'],
    ARRAY['tambien',        'también']
  ];

  -- Word-boundary anchored: substring matching would flag "demas" inside
  -- "demasiado", "ahi" inside "bahi", etc. Every token ends in a word char so
  -- the trailing \M always holds.
  v_residue CONSTANT text := '\m(' ||
    'Se honesta|Dejame|No mas de|asi de|incomodo|se exactamente|SI puedes|' ||
    'deriválo|Guillain-Barre|esta disenad|la una|tu una|asi que|mas dudas|' ||
    'veces al dia|ya probo|resultados SI son|explicar COMO avanza|' ||
    'identicos|informacion|situacion|sensacion|especifico|especifica|emocion|' ||
    'exito|frustracion|cambiaria|recomendacion|duracion|condicion|medica|' ||
    'medico|medicos|diagnostico|diagnosticos|neuropatia|diabetica|maximo|' ||
    'cronicas|inflamacion|remision|sintomas|limites|demas|aqui|ahi|accion|' ||
    'regano|sermon|instantaneo|generica|tecnologia|tecnicas|parrafos|detras|' ||
    'despues|Despues|extranos|extrana|extrano|incomoda|atencion|construccion|' ||
    'metafora|derivacion|valoracion|presion|sesion|Notaras|mejoria|segun|' ||
    'preocupacion|empatia|tendran|Ademas|tambien' ||
  ')\M';
BEGIN
  -- ---------------------------------------------------------------
  -- 1. AI INSTRUCTIONS
  -- ---------------------------------------------------------------
  FOR r IN
    SELECT id::uuid FROM (VALUES
      ('d63f87aa-d3d1-4592-834e-9ecef9b44b12'),
      ('072fdda6-f0e0-43bd-82c0-4fa22c8b71dc'),
      ('c794ccf7-7be0-4ea0-8eea-850b9f6601d0'),
      ('53bd0fcc-a79b-47ec-9c21-5d9f571aa7e1'),
      ('860f15a3-bb6e-44d7-b8b2-79299f36c3dd'),
      ('39fe1cf4-1fd7-49db-a219-23ca4f4b76e1')
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
  -- 2. KNOWLEDGE ITEMS
  -- ---------------------------------------------------------------
  FOR r IN
    SELECT id::uuid FROM (VALUES
      ('15a108bf-0273-47f7-8535-df809c51a57d')
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
