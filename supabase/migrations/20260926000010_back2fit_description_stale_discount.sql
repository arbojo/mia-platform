-- =============================================
-- BACK2FIT: LA DESCRIPCION ANUNCIABA UN 20% QUE YA NO EXISTE
-- =============================================
-- La description de Back2Fit cerraba con "Llévate 2 piezas y ahorras un 20%;
-- con 3 piezas hasta un 30%." Eso era la politica de descuentos por volumen
-- que 20260926000008 sustituyo por el 2x1, y contradice la escalera de forma
-- directa: comprar 2 ya no ahorra 20%, entrega una segunda pieza sin costo.
-- MIA leeria "2 piezas y ahorras 20%" a un cliente al que la escalera le cotiza
-- $499 por dos, es decir un 50%.
--
-- Se paso inadvertida en 20260926000008 porque la busqueda de precios obsoletos
-- se hizo sobre cifras ($600, $1,048) y esta frase no tiene ninguna: solo
-- porcentajes. Un porcentaje de ahorro es una promesa tan binds como un monto,
-- asi que la busqueda de precios hacia adelante tiene que cubrirlos.
--
-- Se elimina la frase en vez de reescribirla con la regla nueva. La description
-- es texto de beneficio y se renderiza pegada a la escalera; si tambien dice
-- "2 por 1", el precio queda en tres lugares (escalera, FAQ, sales_rule) mas
-- esta cuarta fuente, y las cuatro divergen en silencio la primera vez que se
-- actualiza una y no las demas. El precio vive en la escalera; aqui viven los
-- hechos del producto.
-- =============================================

DO $$
DECLARE
  v_business CONSTANT uuid := '4fb7418d-6c98-4a09-9094-4e4e4b2006a6';
  v_product  CONSTANT uuid := '17dc64f6-8e8e-4e9b-a5e7-ab7098a5e23c';

  v_description CONSTANT text :=
    'Faja moldeadora masculina Back2Fit con soporte lumbar y material muy durable. Se usa discreta bajo la ropa y ayuda a bajar hasta una talla al instante. Ideal para una ocasión especial o si vas al gym.';

  v_old_description text;
BEGIN
  SELECT p.description INTO v_old_description
    FROM public.products p
   WHERE p.id = v_product AND p.business_id = v_business;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Back2Fit (%) not found for Vitanova', v_product;
  END IF;

  -- Si la description ya no trae la promesa de ahorro, no se toca nada: la
  -- migracion es idempotente y no ensucia el audit trail con versiones que
  -- no cambian el contenido.
  IF v_old_description IS DISTINCT FROM v_description THEN
    UPDATE public.products
       SET description = v_description, updated_at = now()
     WHERE id = v_product;

    INSERT INTO public.knowledge_versions
      (business_id, entity_type, entity_id, previous_value, new_value, change_source)
    VALUES
      (v_business, 'product', v_product,
       jsonb_build_object('description', v_old_description),
       jsonb_build_object('description', v_description),
       'manual');
  END IF;
END $$;
