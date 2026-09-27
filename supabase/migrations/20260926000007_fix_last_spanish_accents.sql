-- =============================================
-- FIX: Spanish accents/typos in the last Vitanova rows
-- =============================================
-- 20260926000005 and 20260926000006 fixed the rows rewritten by
-- 20260926000003 plus the ones our first residue patterns happened to catch.
-- A proper sweep with a 325-entry Spanish dictionary (word-boundary anchored)
-- over every active ai_instruction / sales_rule / knowledge_item then found the
-- remaining 14 row-fields across 12 rows.
--
-- These are ordinary data-entry typos, not the medical claim, so this migration
-- is deliberately narrow in EFFECT (only rows that change are touched) but
-- broad in GUARD (the full accumulated map + residue check, so a row that
-- still contains any known unaccented token aborts the migration).
--
-- Beyond missing accents this also repairs words that a plain accent pass
-- cannot fix, because the wrong letter is already accented or the tilde is
-- missing:
--
--   Leon        -> León           Leon        -> León
--   ofreciendole -> ofreciéndole  pondra     -> pondrá
--   envies      -> envíes         reenviala  -> reenvíala
--   reconocelo  -> reconócelo     mandenos   -> mándenos
--   explicita.. -> explícitamente espontanea.. -> espontáneamente
--
-- And three grammar repairs that are safe because each phrase is unique in
-- this dataset:
--
--   en la ciudades de        -> en las ciudades de
--   que es el programa       -> ¿Qué es el programa   (leading inverted mark)
--   clean nails              -> Clean Nails           (product name casing)
--
-- Ambiguous words are handled with phrases, never as bare word rules:
--   "mas" only via "mas de una talla" / "los mas dificiles"
--   "envio" only via "ya se envio y"  (envío vs envió)
--   "esta"  only via "producto esta dañado"  (esta vs está)
--   "que"   only via "que compresion" / "que es el programa"  (que vs qué)
--
-- Idempotent: every search token is unaccented or already misaccented, so a
-- re-run is a no-op. Residue tokens are \m ... \M anchored so "demas" cannot
-- false-positive inside "demasiado"; every token ends in a word character so
-- the trailing \M always holds.
-- =============================================

DO $$
DECLARE
  v_business CONSTANT uuid := '4fb7418d-6c98-4a09-9094-4e4e4b2006a6';

  v_id uuid;
  v_old_q text;
  v_old_a text;
  v_q text;
  v_a text;
  i int;
  r record;

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
    ARRAY['tu una',                     'tu uña'],
    ARRAY['mas de una talla',           'más de una talla'],
    ARRAY['los mas dificiles',          'los más difíciles'],
    ARRAY['ya se envio y',              'ya se envió y'],
    ARRAY['producto esta dañado',       'producto está dañado'],
    ARRAY['en la ciudades de',          'en las ciudades de'],
    ARRAY['que compresion',             'qué compresión'],
    ARRAY['que es el programa',         '¿Qué es el programa'],
    ARRAY['clean nails',                'Clean Nails'],
    ARRAY['Lagos de moreno',            'Lagos de Moreno']
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
    ARRAY['tambien',        'también'],
    ARRAY['estetica',       'estética'],
    ARRAY['ofreciendole',   'ofreciéndole'],
    ARRAY['pondra',         'pondrá'],
    ARRAY['Politica',       'Política'],
    ARRAY['imagenes',       'imágenes'],
    ARRAY['envies',         'envíes'],
    ARRAY['espontaneamente','espontáneamente'],
    ARRAY['explicitamente', 'explícitamente'],
    ARRAY['reenviala',      'reenvíala'],
    ARRAY['reconocelo',     'reconócelo'],
    ARRAY['mandenos',       'mándenos'],
    ARRAY['compresion',     'compresión'],
    ARRAY['garantia',       'garantía'],
    ARRAY['dias',           'días'],
    ARRAY['dia',            'día'],
    ARRAY['fisica',         'física'],
    ARRAY['fabrica',        'fábrica'],
    ARRAY['dificiles',      'difíciles'],
    ARRAY['danote',         'dánote'],
    ARRAY['area',           'área'],
    ARRAY['calcetin',       'calcetín'],
    ARRAY['Leon',           'León'],
    ARRAY['politica',       'política'],
    ARRAY['politicas',      'políticas'],
    ARRAY['decision',       'decisión'],
    ARRAY['decisiones',     'decisiones'],
    ARRAY['garantias',      'garantías']
  ];

  v_residue CONSTANT text := '\m(' ||
    'Se honesta|Dejame|No mas de|asi de|incomodo|se exactamente|SI puedes|' ||
    'deriválo|Guillain-Barre|esta disenad|la una|tu una|asi que|mas dudas|' ||
    'veces al dia|ya probo|resultados SI son|explicar COMO avanza|' ||
    'mas de una talla|los mas dificiles|ya se envio y|producto esta dañado|' ||
    'en la ciudades de|que compresion|que es el programa|clean nails|' ||
    'Lagos de moreno|' ||
    'identicos|informacion|situacion|sensacion|especifico|especifica|emocion|' ||
    'exito|frustracion|cambiaria|recomendacion|duracion|condicion|medica|' ||
    'medico|medicos|diagnostico|diagnosticos|neuropatia|diabetica|maximo|' ||
    'cronicas|inflamacion|remision|sintomas|limites|demas|aqui|ahi|accion|' ||
    'regano|sermon|instantaneo|generica|tecnologia|tecnicas|parrafos|detras|' ||
    'despues|Despues|extranos|extrana|extrano|incomoda|atencion|construccion|' ||
    'metafora|derivacion|valoracion|presion|sesion|Notaras|mejoria|segun|' ||
    'preocupacion|empatia|tendran|Ademas|tambien|' ||
    'estetica|ofreciendole|pondra|Politica|imagenes|envies|espontaneamente|' ||
    'explicitamente|reenviala|reconocelo|mandenos|compresion|garantia|dias|' ||
    'dia|fisica|fabrica|dificiles|danote|area|calcetin|Leon|politica|politicas|' ||
    'decision|decisiones|garantias' ||
  ')\M';
BEGIN
  -- ---------------------------------------------------------------
  -- 1. AI INSTRUCTIONS
  -- ---------------------------------------------------------------
  FOR r IN
    SELECT id::uuid FROM (VALUES
      ('01361dc6-a108-4e93-b539-a1125fa507af'),
      ('892eb467-2563-40d5-99d5-4c59c0ed20c3'),
      ('57a4367d-3811-4836-90f8-2e9161bbb318')
    ) AS t(id)
  LOOP
    SELECT i.id, i.instruction INTO v_id, v_old_q
    FROM public.ai_instructions i
    WHERE i.id = r.id AND i.business_id = v_business;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'ai_instruction % not found for Vitanova', r.id;
    END IF;

    v_q := v_old_q;

    FOR i IN 1..array_length(v_phrases, 1) LOOP
      v_q := replace(v_q, v_phrases[i][1], v_phrases[i][2]);
    END LOOP;

    FOR i IN 1..array_length(v_words, 1) LOOP
      v_q := regexp_replace(v_q, '\m' || v_words[i][1] || '\M', v_words[i][2], 'g');
    END LOOP;

    IF v_q ~ v_residue THEN
      RAISE EXCEPTION 'unaccented residue remains in ai_instruction %', r.id;
    END IF;

    IF v_q = v_old_q THEN
      RAISE NOTICE 'ai_instruction % already accented, skipped', r.id;
      CONTINUE;
    END IF;

    UPDATE public.ai_instructions SET instruction = v_q WHERE id = v_id;

    INSERT INTO public.knowledge_versions
      (business_id, entity_type, entity_id, previous_value, new_value, change_source)
    VALUES (
      v_business, 'ai_instruction', v_id,
      jsonb_build_object('instruction', v_old_q),
      jsonb_build_object('instruction', v_q),
      'manual'
    );
  END LOOP;

  -- ---------------------------------------------------------------
  -- 2. KNOWLEDGE ITEMS (question and answer)
  -- ---------------------------------------------------------------
  FOR r IN
    SELECT id::uuid FROM (VALUES
      ('8d157d85-c3b1-4162-b1f2-89fef9b67d51'),
      ('4aa4d577-a5b5-4071-9bd9-a1d150fe381f'),
      ('dfb91200-ca96-4dc0-9741-91cebd0081d9'),
      ('02809070-07c1-473f-b853-6f061bf4b10c'),
      ('76726901-76ec-4edc-8cbf-a63dcd89d837'),
      ('5ae3c170-47f7-4d66-9a73-7c81ecce9842'),
      ('647db1fd-cf13-49bb-a854-9d78f6eef6e2'),
      ('5328e2df-4574-405e-9927-5ba007e4df53'),
      ('8a0c9886-a378-421c-95f4-da71df9850ef')
    ) AS t(id)
  LOOP
    SELECT k.id, k.question, k.answer INTO v_id, v_old_q, v_old_a
    FROM public.knowledge_items k
    WHERE k.id = r.id AND k.business_id = v_business;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'knowledge_item % not found for Vitanova', r.id;
    END IF;

    v_q := v_old_q;
    v_a := v_old_a;

    FOR i IN 1..array_length(v_phrases, 1) LOOP
      v_q := replace(v_q, v_phrases[i][1], v_phrases[i][2]);
      v_a := replace(v_a, v_phrases[i][1], v_phrases[i][2]);
    END LOOP;

    FOR i IN 1..array_length(v_words, 1) LOOP
      v_q := regexp_replace(v_q, '\m' || v_words[i][1] || '\M', v_words[i][2], 'g');
      v_a := regexp_replace(v_a, '\m' || v_words[i][1] || '\M', v_words[i][2], 'g');
    END LOOP;

    IF v_q ~ v_residue THEN
      RAISE EXCEPTION 'unaccented residue remains in knowledge_item % question', r.id;
    END IF;

    IF v_a ~ v_residue THEN
      RAISE EXCEPTION 'unaccented residue remains in knowledge_item % answer', r.id;
    END IF;

    IF v_q = v_old_q AND v_a = v_old_a THEN
      RAISE NOTICE 'knowledge_item % already accented, skipped', r.id;
      CONTINUE;
    END IF;

    UPDATE public.knowledge_items
    SET question = v_q, answer = v_a, updated_at = now()
    WHERE id = v_id;

    INSERT INTO public.knowledge_versions
      (business_id, entity_type, entity_id, previous_value, new_value, change_source)
    VALUES (
      v_business, 'knowledge_item', v_id,
      jsonb_strip_nulls(jsonb_build_object('question', v_old_q, 'answer', v_old_a)),
      jsonb_strip_nulls(jsonb_build_object('question', v_q, 'answer', v_a)),
      'manual'
    );
  END LOOP;
END $$;
