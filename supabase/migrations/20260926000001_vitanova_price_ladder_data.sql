-- =============================================
-- VITANOVA: PRICE LADDERS AS STRUCTURED DATA
-- =============================================
-- Populates public.products.price_ladder (added in 20260926000000) with the
-- quantity pricing that previously only existed as prose in the commercial
-- policy document, and fixes Clean Nails' base price ($599 -> $550).
--
-- Source of truth: "Política Comercial Oficial de Vitanova". Every ladder below
-- is transcribed from that document; no price is invented here.
--
--   Clean Nails  1:$550  2:$880  3:$1188   >3: 35% off base
--   Back2Fit     1:$499  2:$600  3:$1048   >3: 35% off base
--   Neurofeet    3:$449  5:$599            fixed promo, no further discount
--   Neurotin     3:$449  5:$599            same as Neurofeet
--   Bye Canas    1:$499  2:$798  3:$1048   >3: 35% off base
--   Bella Patch  no quantity discount -> price_ladder stays NULL
--
-- Also rewrites the three ACTIVE knowledge items that still quote the old
-- Clean Nails price. The $599 anchor "≈ one clinic session" is no longer
-- merely stale but factually wrong: $550 is now cheaper than a session, so
-- the claim had to be inverted rather than just re-numbered.
--
-- Every change writes a knowledge_versions row in the same transaction, so the
-- audit trail is atomic with the mutation it describes.
-- =============================================

DO $$
DECLARE
  v_business CONSTANT uuid := '4fb7418d-6c98-4a09-9094-4e4e4b2006a6';

  v_product_id  uuid;
  v_old_price   numeric;
  v_old_ladder  jsonb;
  v_knowledge_id uuid;
  v_old_answer  text;

  r_product record;
  r_knowledge record;
BEGIN
  -- ---------------------------------------------------------------
  -- 1. Product base price + quantity ladder
  -- ---------------------------------------------------------------
  FOR r_product IN
    SELECT * FROM (VALUES
      (
        '96c33f39-0cf0-4b1b-994b-181acbef7c57'::uuid,
        'Clean Nails',
        550::numeric,
        '{"tiers":[{"qty":1,"price":550},{"qty":2,"price":880},{"qty":3,"price":1188}],"open_tier":{"min_qty":4,"discount_pct":35}}'::jsonb
      ),
      (
        '17dc64f6-8e8e-4e9b-a5e7-ab7098a5e23c'::uuid,
        'Back2Fit',
        499::numeric,
        '{"tiers":[{"qty":1,"price":499},{"qty":2,"price":600},{"qty":3,"price":1048}],"open_tier":{"min_qty":4,"discount_pct":35}}'::jsonb
      ),
      (
        'c1c4c574-9109-44c3-9fae-07e5446d97b0'::uuid,
        'Neurofeet',
        449::numeric,
        '{"tiers":[{"qty":3,"price":449},{"qty":5,"price":599}],"note":"No aplicar descuentos adicionales."}'::jsonb
      ),
      (
        'f747817e-ace6-4498-b21b-eddd5e8ef7e5'::uuid,
        'Neurotin',
        449::numeric,
        '{"tiers":[{"qty":3,"price":449},{"qty":5,"price":599}],"note":"No aplicar descuentos adicionales."}'::jsonb
      ),
      (
        'c8e98106-2602-4789-8772-6a98b9552230'::uuid,
        'Bye Canas',
        499::numeric,
        '{"tiers":[{"qty":1,"price":499},{"qty":2,"price":798},{"qty":3,"price":1048}],"open_tier":{"min_qty":4,"discount_pct":35}}'::jsonb
      )
    ) AS t(id, name, new_price, new_ladder)
  LOOP
    SELECT p.id, p.price, p.price_ladder
      INTO v_product_id, v_old_price, v_old_ladder
    FROM public.products p
    WHERE p.id = r_product.id
      AND p.business_id = v_business;

    IF v_product_id IS NULL THEN
      RAISE WARNING 'product % (%) not found for Vitanova; skipping',
        r_product.name, r_product.id;
      CONTINUE;
    END IF;

    UPDATE public.products
    SET price = r_product.new_price,
        price_ladder = r_product.new_ladder,
        updated_at = now()
    WHERE id = v_product_id;

    INSERT INTO public.knowledge_versions (
      business_id, entity_type, entity_id,
      previous_value, new_value, change_source
    )
    VALUES (
      v_business, 'product', v_product_id,
      jsonb_build_object('price', v_old_price, 'price_ladder', v_old_ladder),
      jsonb_build_object('price', r_product.new_price, 'price_ladder', r_product.new_ladder),
      'manual'
    );
  END LOOP;

  -- ---------------------------------------------------------------
  -- 2. Active knowledge items still quoting the old $599
  -- ---------------------------------------------------------------
  FOR r_knowledge IN
    SELECT * FROM (VALUES
      (
        'f9238912-974f-4d7d-a3a2-793e491ffb8e'::uuid,
        'Recalibrar el ancla por uso (P-020): Clean Nails $550 cuesta menos que una sola sesión de clínica y te da todas las sesiones en casa; Bye Canas $499 ≈ meses de uso; Bella Patch ≈$16.6 por puesta frente a un procedimiento estético.'
      ),
      (
        '7c93d502-627f-40f0-8bd8-c6b4e1657f13'::uuid,
        'Vitanova es una marca de bienestar y cuidado en casa: productos de $449 a $550 con efecto real verificable, envío gratis y pago contra entrega.'
      ),
      (
        '23dfa2a3-8f1a-42c0-a724-360ed6cedd8a'::uuid,
        E'costo de clean nails es de $550\nen México varía según el tipo de clínica y la tecnología usada. Una sesión podológica clínica o con láser oscila entre $900 y $3,500 MXN\npuedes poner en contraste el costo entre ambas opciones realzando que con clean nails es un pago único de $550, y sus sesiones lasllevarías en la comodidad de tu casa'
      )
    ) AS t(id, new_answer)
  LOOP
    SELECT k.id, k.answer
      INTO v_knowledge_id, v_old_answer
    FROM public.knowledge_items k
    WHERE k.id = r_knowledge.id
      AND k.business_id = v_business;

    IF v_knowledge_id IS NULL THEN
      RAISE WARNING 'knowledge item % not found for Vitanova; skipping', r_knowledge.id;
      CONTINUE;
    END IF;

    UPDATE public.knowledge_items
    SET answer = r_knowledge.new_answer,
        updated_at = now()
    WHERE id = v_knowledge_id;

    INSERT INTO public.knowledge_versions (
      business_id, entity_type, entity_id,
      previous_value, new_value, change_source
    )
    VALUES (
      v_business, 'knowledge_item', v_knowledge_id,
      jsonb_build_object('answer', v_old_answer),
      jsonb_build_object('answer', r_knowledge.new_answer),
      'manual'
    );
  END LOOP;
END $$;
