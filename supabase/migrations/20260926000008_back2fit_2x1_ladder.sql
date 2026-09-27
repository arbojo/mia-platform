-- =============================================
-- BACK2FIT: EL 2x1 COMO REGLA COMERCIAL REAL
-- =============================================
-- Reemplaza la escalera de Back2Fit, construida sobre una politica de descuentos
-- por volumen (1:$499, 2:$600, 3:$1,048, >3: 35%) que la empresa ya no opera.
-- La regla real es una promocion 2x1:
--
--   2 piezas ->    $499.00   (se paga una, la segunda va de regalo)
--   3 piezas ->    $898.20   (un par 2x1 + una pieza con 20% off)
--   4 piezas ->    $998.00   (dos pares 2x1)
--   5 piezas ->  $1,397.20
--   6 piezas ->  $1,497.00
--   7 piezas ->  $1,896.20
--   8 piezas ->  $1,996.00
--   9 piezas ->  $2,395.20
--  10 piezas ->  $2,495.00
--
-- Es decir: cada par aporta $499 y la pieza impar que sobre aporta $399.20
-- ($499 con 20% de descuento). Por debajo de $249.50 por pieza nunca se llega,
-- de modo que el 2x1 es siempre igual o mejor que el precio de lista: un cliente
-- que pide 4 paga $998, nunca mas.
--
-- Se enumera explicitamente hasta 10 en lugar de expresarlo como formula
-- porque `resolveLineTotal` solo resuelve cantidades que el negocio precifico:
-- por encima de 10 devuelve null y MIA escala al equipo en vez de inventar un
-- numero. La regla vive en la nota, que es lo que MIA lee y anuncia.
--
-- Se elimina `open_tier`. El 35% sobre el precio base cotizaba 4 piezas en
-- $1,297.40, mas caro que el 2x1 real de $998, y arrastraba el error de tratar
-- $499 como precio unitario cuando es el precio del par. Ademas el invariante de
-- `resolveLineTotal` rechaza `open_tier` cuando el tier mas bajo no es qty 1,
-- que es exactamente el caso de Back2Fit desde que no se vende por pieza.
--
-- El mismo error sobrevivia en el prompt: `formatProducts` renderizaba
-- "Back2Fit: $499" junto al nombre, un numero suelto que MIA podia cotizar como
-- precio de una pieza. Esa correccion vive en prompts.ts; la nota de esta
-- escalera la desactiva explicitamente en el lado de los datos.
--
-- Costo de referencia: el proveedor maneja 3 piezas por $196, es decir $65.33
-- por unidad. Con esta escalera el margen queda entre 73.8% y 78.2%, y la pieza
-- impar que MIA vende a $399.20 deja 83.7%. NO se guarda en `products.cost`:
-- 196/3 es un promedio de lote, no un costo unitario verificado, y un costo
-- aproximado es peor que ningun costo porque MIA terminaria confiando en el.
--
-- Cada cambio escribe su knowledge_versions en la misma transaccion.
-- =============================================

DO $$
DECLARE
  v_business CONSTANT uuid := '4fb7418d-6c98-4a09-9094-4e4e4b2006a6';
  v_product  CONSTANT uuid := '17dc64f6-8e8e-4e9b-a5e7-ab7098a5e23c';
  v_rule     CONSTANT uuid := '89e10284-7f68-4998-8b3f-d7a6a21dc4fd';

  v_ladder CONSTANT jsonb := '{
    "tiers": [
      {"qty": 2,  "price": 499.00},
      {"qty": 3,  "price": 898.20},
      {"qty": 4,  "price": 998.00},
      {"qty": 5,  "price": 1397.20},
      {"qty": 6,  "price": 1497.00},
      {"qty": 7,  "price": 1896.20},
      {"qty": 8,  "price": 1996.00},
      {"qty": 9,  "price": 2395.20},
      {"qty": 10, "price": 2495.00}
    ],
    "note": "No se vende por pieza: el minimo es 2 y cada par es 2x1 (se paga una y la segunda va de regalo). Si la cantidad es impar, la pieza que sobra se agrega con 20% de descuento sobre el precio de una."
  }'::jsonb;

  v_faq_q CONSTANT text := '¿Se vende por pieza?';
  v_faq_a CONSTANT text := 'No, el mínimo es 2 y cada par es 2x1: pagas una y la segunda va de regalo. Si te llevas una cantidad impar, esa pieza se agrega con 20% de descuento.';

  v_rule_text CONSTANT text :=
    'Back2Fit: no se vende por pieza, el minimo es 2 y cada par es 2x1. Al ofrecerlo, MIA siempre anuncia que la segunda pieza va de regalo y toma el importe exclusivamente de la escalera por cantidad. Si la cantidad es impar, la pieza que sobra se cobra con 20% de descuento. Nunca cotizar una sola pieza ni un precio que no esté en la escalera; si el cliente pide más de 10 piezas, escalar al equipo.';

  v_old_ladder jsonb;
  v_old_faq    jsonb;
  v_new_faq   jsonb;
  v_old_rule   text;
BEGIN
  -- ---------------------------------------------------------------
  -- 1. Escalera 2x1
  -- ---------------------------------------------------------------
  SELECT p.price_ladder INTO v_old_ladder
    FROM public.products p
   WHERE p.id = v_product AND p.business_id = v_business;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Back2Fit (%) not found for Vitanova', v_product;
  END IF;

  UPDATE public.products
     SET price_ladder = v_ladder, updated_at = now()
   WHERE id = v_product;

  INSERT INTO public.knowledge_versions
    (business_id, entity_type, entity_id, previous_value, new_value, change_source)
  VALUES
    (v_business, 'product', v_product,
     jsonb_build_object('price_ladder', v_old_ladder),
     jsonb_build_object('price_ladder', v_ladder),
     'manual');

  -- ---------------------------------------------------------------
  -- 2. FAQ: la pregunta que mas probable hace quebrar la cotizacion
  --
  -- Se antepone, no se agrega al final, porque `formatProducts` solo renderiza
  -- las tres primeras entradas de faq. Si la nueva quedara al final, MIA no la
  -- veria y seguiria cotizando una pieza suelta.
  -- ---------------------------------------------------------------
  SELECT
    jsonb_build_array(jsonb_build_object('q', v_faq_q, 'a', v_faq_a))
    || COALESCE(
         (
           SELECT jsonb_agg(entry)
             FROM jsonb_array_elements(COALESCE(p.faq, '[]'::jsonb)) AS entry
            WHERE entry ->> 'q' IS DISTINCT FROM v_faq_q
         ),
         '[]'::jsonb
       )
  INTO v_new_faq
    FROM public.products p
   WHERE p.id = v_product AND p.business_id = v_business;

  UPDATE public.products
     SET faq = v_new_faq, updated_at = now()
   WHERE id = v_product;

  INSERT INTO public.knowledge_versions
    (business_id, entity_type, entity_id, previous_value, new_value, change_source)
  VALUES
    (v_business, 'product', v_product,
     jsonb_build_object('faq', v_old_faq),
     jsonb_build_object('faq', v_new_faq),
     'manual');

  -- ---------------------------------------------------------------
  -- 3. Regla de venta: comportamiento de anuncio, sin duplicar importes
  --
  -- Los numeros viven solo en la escalera. Repetirlos aqui crea una segunda
  -- fuente de verdad que diverge en silencio la primera vez que se actualiza
  -- una y no la otra.
  -- ---------------------------------------------------------------
  SELECT s.content INTO v_old_rule
    FROM public.sales_rules s
   WHERE s.id = v_rule AND s.business_id = v_business;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sales_rule % not found for Vitanova', v_rule;
  END IF;

  UPDATE public.sales_rules
     SET content = v_rule_text, updated_at = now()
   WHERE id = v_rule;

  INSERT INTO public.knowledge_versions
    (business_id, entity_type, entity_id, previous_value, new_value, change_source)
  VALUES
    (v_business, 'sales_rule', v_rule,
     jsonb_build_object('content', v_old_rule),
     jsonb_build_object('content', v_rule_text),
     'manual');
END $$;
