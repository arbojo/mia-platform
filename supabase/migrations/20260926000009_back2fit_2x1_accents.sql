-- =============================================
-- BACK2FIT: ACENTOS EN LA REGLA 2x1
-- =============================================
-- La migracion 20260926000008 escribio "minimo" sin tilde en la nota de la
-- escalera y en el texto de la sales_rule, mientras la FAQ que se escribio en
-- esa misma migracion si lleva "mínimo". El prompt es lo que MIA lee, asi que
-- la palabra llega al cliente sin tilde mientras la misma idea al lado llega
-- tuteada: la inconsistencia se nota.
--
-- Correccion puntual de dos cadenas. No se toca ningun precio: los tiers y el
-- open_tier ya son correctos y esta migracion no los vuelve a escribir, para
-- que el audit trail de precios siga siendo el de 20260926000008.
-- =============================================

DO $$
DECLARE
  v_business CONSTANT uuid := '4fb7418d-6c98-4a09-9094-4e4e4b2006a6';
  v_product  CONSTANT uuid := '17dc64f6-8e8e-4e9b-a5e7-ab7098a5e23c';
  v_rule     CONSTANT uuid := '89e10284-7f68-4998-8b3f-d7a6a21dc4fd';

  v_note  CONSTANT text :=
    'No se vende por pieza: el mínimo es 2 y cada par es 2x1 (se paga una y la segunda va de regalo). Si la cantidad es impar, la pieza que sobra se agrega con 20% de descuento sobre el precio de una.';

  v_rule_text CONSTANT text :=
    'Back2Fit: no se vende por pieza, el mínimo es 2 y cada par es 2x1. Al ofrecerlo, MIA siempre anuncia que la segunda pieza va de regalo y toma el importe exclusivamente de la escalera por cantidad. Si la cantidad es impar, la pieza que sobra se cobra con 20% de descuento. Nunca cotizar una sola pieza ni un precio que no esté en la escalera; si el cliente pide más de 10 piezas, escalar al equipo.';

  v_old_note jsonb;
  v_old_rule text;
BEGIN
  -- ---------------------------------------------------------------
  -- 1. Nota de la escalera (jsonb_set: solo la nota, no los tiers)
  -- ---------------------------------------------------------------
  SELECT jsonb_build_object('note', p.price_ladder -> 'note') INTO v_old_note
    FROM public.products p
   WHERE p.id = v_product AND p.business_id = v_business;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Back2Fit (%) not found for Vitanova', v_product;
  END IF;

  UPDATE public.products
     SET price_ladder = jsonb_set(price_ladder, '{note}', to_jsonb(v_note), true),
         updated_at = now()
   WHERE id = v_product;

  INSERT INTO public.knowledge_versions
    (business_id, entity_type, entity_id, previous_value, new_value, change_source)
  VALUES
    (v_business, 'product', v_product,
     v_old_note,
     jsonb_build_object('note', v_note),
     'manual');

  -- ---------------------------------------------------------------
  -- 2. Regla de venta
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
