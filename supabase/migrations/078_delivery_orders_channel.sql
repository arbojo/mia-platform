-- ==========================================
-- 078: delivery order channel attribution
-- ADDITIVE. delivery.orders.channel se copia desde sales_events.metadata->>'channel'
-- (persistido por processSaleClosing/core). NULL en pedidos históricos sin dato.
-- ==========================================

ALTER TABLE delivery.orders
  ADD COLUMN IF NOT EXISTS channel TEXT;

COMMENT ON COLUMN delivery.orders.channel IS
  'Canal de origen del pedido (whatsapp|web|widget|messenger|instagram). Copiado de sales_events.metadata->channel en el trigger. NULL para pedidos históricos sin dato.';

-- ==========================================
-- delivery.handle_sale_won() — versión 076 + channel desde metadata
-- ==========================================
CREATE OR REPLACE FUNCTION delivery.handle_sale_won()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_settings delivery.business_settings%ROWTYPE;
  v_cust_name TEXT;
  v_cust_phone TEXT;
  v_cust_address TEXT;
  v_cust_city TEXT;
  v_reference TEXT;
  v_next INTEGER;
BEGIN
  IF NEW.event_type <> 'SALE_WON' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_settings FROM delivery.business_settings
    WHERE business_id = NEW.business_id AND enabled = true;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_cust_name := NEW.metadata->'customer'->>'name';
  v_cust_phone := NEW.metadata->'customer'->>'phone';
  v_cust_address := NEW.metadata->'customer'->>'address';
  v_cust_city := NEW.metadata->'customer'->>'city';
  v_reference := NEW.metadata->'customer'->>'reference';

  IF v_cust_address IS NULL AND NEW.customer_id IS NOT NULL THEN
    SELECT name, phone, address, city
      INTO v_cust_name, v_cust_phone, v_cust_address, v_cust_city
    FROM public.customers WHERE id = NEW.customer_id;
  END IF;

  INSERT INTO delivery.order_counters (business_id, last_number)
    VALUES (NEW.business_id, 1)
  ON CONFLICT (business_id)
    DO UPDATE SET last_number = delivery.order_counters.last_number + 1
  RETURNING last_number INTO v_next;

  BEGIN
    INSERT INTO delivery.orders (
      business_id, sales_event_id, conversation_id, customer_id, product_id,
      order_number, customer_name, phone, address, city,
      amount, paid_at_sale, items, source,
      delivery_cost, channel
    ) VALUES (
      NEW.business_id, NEW.id, NEW.conversation_id, NEW.customer_id,
      COALESCE(NEW.product_id, (NEW.metadata->'items'->0->>'product_id')::uuid),
      'ORD-' || lpad(v_next::text, 6, '0'),
      COALESCE(v_cust_name, 'Cliente'),
      v_cust_phone,
      v_cust_address,
      v_cust_city,
      NEW.amount,
      COALESCE((NEW.metadata->>'paid_at_sale')::boolean, true),
      COALESCE(NEW.metadata->'items', '[]'::jsonb),
      NEW.metadata,
      COALESCE(NEW.delivery_cost, 0.00),
      NEW.metadata->>'channel'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO delivery.ingest_errors (business_id, sales_event_id, error, payload)
    VALUES (NEW.business_id, NEW.id, SQLERRM, NEW.metadata);
  END;

  RETURN NEW;
END $$;