-- =============================================
-- BACK2FIT: REDONDEO A PESOS ENTEROS (PIEZA IMPAR = $399)
-- =============================================
-- 20260926000008 dejo la pieza impar a 20% off sobre $499, es decir $399.20,
-- y eso arrastraba centavos a los cuatro tramos impares: $898.20, $1397.20,
-- $1896.20 y $2395.20. Vitanova cobra en efectivo y los centavos no son
-- practicables en el mostrador, asi que la pieza impar pasa a $399.
--
-- La diferencia es de $0.20 por venta impar. El margen no se mueve: sigue
-- entre 73.8% y 78.2% con el costo real de $65.33 por unidad. Y $399 sobre
-- $499 sigue siendo 20% de descuento (20.04%), asi que la promesa comercial
-- que MIA hace no cambia.
--
-- La nota, la FAQ y la regla de venta dejan de decir "20% de descuento" y
-- pasan a decir "$399". Es un cambio de redaccion, no solo de formato: si el
-- texto sigue hablando de porcentaje, MIA tiene que calcular 499 * 0.8 y
-- decidir como redondear en cada respuesta, y ahi es donde un modelo se
-- equivoca por centimos. Un precio concreto no se recalcula nunca.
--
-- El redondeo es a la baja, a favor del cliente. La unica forma de redondear
-- hacia arriba seria elegir $400, que ademas deja de ser "20%" limpio.
-- =============================================

DO $$
DECLARE
  v_business CONSTANT uuid    := '4fb7418d-6c98-4a09-9094-4e4e4b2006a6';
  v_product  CONSTANT uuid    := '17dc64f6-8e8e-4e9b-a5e7-ab7098a5e23c';
  v_extra    CONSTANT numeric := 399;

  v_old_ladder jsonb;
  v_new_ladder jsonb;
  v_ladder     jsonb;
BEGIN
  v_new_ladder := jsonb_build_object(
    'tiers', jsonb_build_array(
      jsonb_build_object('qty',  2, 'price',  499.00),
      jsonb_build_object('qty',  3, 'price',  898.00),
      jsonb_build_object('qty',  4, 'price',  998.00),
      jsonb_build_object('qty',  5, 'price', 1397.00),
      jsonb_build_object('qty',  6, 'price', 1497.00),
      jsonb_build_object('qty',  7, 'price', 1896.00),
      jsonb_build_object('qty',  8, 'price', 1996.00),
      jsonb_build_object('qty',  9, 'price', 2395.00),
      jsonb_build_object('qty', 10, 'price', 2495.00)
    ),
    'note', 'No se vende por pieza: el mínimo es 2 y cada par es 2x1 (se paga una y la segunda va de regalo). Si la cantidad es impar, la pieza que sobra se agrega a $399.'
  );

  SELECT p.price_ladder INTO v_old_ladder
    FROM public.products p
   WHERE p.id = v_product AND p.business_id = v_business;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Back2Fit (%) not found for Vitanova', v_product;
  END IF;

  IF v_old_ladder IS DISTINCT FROM v_new_ladder THEN
    v_ladder := v_old_ladder
      || jsonb_build_object('tiers', v_new_ladder -> 'tiers')
      || jsonb_build_object('note', v_new_ladder -> 'note');

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
  END IF;

  -- FAQ y regla de venta: se sustituye la frase de porcentaje por el importe.
  -- Se usa replace() en vez de reescribir el texto entero para no arrastrar
  -- cambios ajenos ni perder redaccion que no tiene que ver con el precio.
  UPDATE public.knowledge_items
     SET answer = replace(answer,
           'esa pieza se agrega con 20% de descuento',
           'esa pieza se agrega a $' || v_extra::text),
         updated_at = now()
   WHERE business_id = v_business
     AND is_active
     AND answer LIKE '%se agrega con 20% de descuento%';

  UPDATE public.sales_rules
     SET content = replace(content,
           'la pieza que sobra se cobra con 20% de descuento',
           'la pieza que sobra se cobra a $' || v_extra::text),
         updated_at = now()
   WHERE business_id = v_business
     AND is_active
     AND content LIKE '%se cobra con 20% de descuento%';

  -- El unico tramo par que no es multiplo de $499 es el 10, y no lleva
  -- centavos; se verifica para que la migracion falle si alguien agrego un
  -- tramo con centavos en el futuro sin redondear.
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_new_ladder -> 'tiers') t
     WHERE (t ->> 'price')::numeric <> trunc((t ->> 'price')::numeric)
  ) THEN
    RAISE EXCEPTION 'Back2Fit ladder must contain whole pesos only';
  END IF;
END $$;
