-- =============================================
-- 031 MIA Delivery Hub — Schema delivery aislado
--
-- ADR-019: modulo logistico aislado (schema `delivery`)
-- conectado al ciclo de ventas por un unico puente:
-- trigger AFTER INSERT ON public.sales_events (SALE_WON).
--
-- Reglas de oro:
--   - El core MIA (public) queda purista (ADR-010). Ninguna
--     tabla operativa entra en public.
--   - Cada tabla delivery.*: ENABLE RLS + FORCE RLS +
--     REVOKE ALL FROM anon, authenticated, PUBLIC.
--   - El driver NO usa RLS: toda su operacion pasa por
--     /api/driver/* (service role + assertDriverOrderAccess).
--   - Flujo 1-way sales_events -> delivery. El trigger jamas
--     escribe de vuelta a public.
-- =============================================

CREATE SCHEMA IF NOT EXISTS delivery;

-- -------------------------------------------------
-- BUSINESS SETTINGS (habilitacion del modulo por negocio)
-- -------------------------------------------------
CREATE TABLE delivery.business_settings (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  driver_self_checkout BOOLEAN NOT NULL DEFAULT true,
  whatsapp_notify BOOLEAN NOT NULL DEFAULT false,
  wa_business_id TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  daily_goal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  driver_share_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  gps_radius_meters INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT delivery_business_settings_share CHECK (driver_share_percent >= 0 AND driver_share_percent <= 100),
  CONSTRAINT delivery_business_settings_radius CHECK (gps_radius_meters > 0)
);

-- -------------------------------------------------
-- DRIVERS (repartidores)
-- El token de acceso jamas se guarda en plaintext: scrypt + salt.
-- -------------------------------------------------
CREATE TABLE delivery.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sequential_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  vehicle TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'busy')),
  auth_token_hash TEXT,
  auth_token_salt TEXT,
  auth_token_expires_at TIMESTAMPTZ,
  token_revoked_at TIMESTAMPTZ,
  last_lat NUMERIC(9, 6),
  last_lng NUMERIC(9, 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, sequential_number),
  UNIQUE (business_id, phone)
);

CREATE INDEX idx_delivery_drivers_business ON delivery.drivers(business_id, status);

-- -------------------------------------------------
-- ROUTES (rutas del dia por repartidor)
-- Candado de cierre diario POR REPARTIDOR via trigger
-- delivery.check_previous_route_closed (BEFORE INSERT).
-- -------------------------------------------------
CREATE TABLE delivery.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES delivery.drivers(id) ON DELETE CASCADE,
  route_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, driver_id, route_date)
);

CREATE INDEX idx_delivery_routes_driver_date ON delivery.routes(business_id, driver_id, route_date DESC);
CREATE INDEX idx_delivery_routes_date ON delivery.routes(business_id, route_date);

-- -------------------------------------------------
-- ORDERS (pedidos replicados desde SALE_WON)
-- Snapshot de cliente/producto en el momento de la venta.
-- -------------------------------------------------
CREATE TABLE delivery.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sales_event_id UUID NOT NULL REFERENCES public.sales_events(id) ON DELETE RESTRICT,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  amount NUMERIC(12, 2) CHECK (amount >= 0),
  paid_at_sale BOOLEAN NOT NULL DEFAULT true,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending_assignment'
    CHECK (status IN ('pending_assignment', 'assigned', 'in_transit', 'delivered', 'incidence', 'cancelled')),
  assigned_driver_id UUID REFERENCES delivery.drivers(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  route_id UUID REFERENCES delivery.routes(id) ON DELETE SET NULL,
  source JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  UNIQUE (business_id, sales_event_id),
  UNIQUE (business_id, order_number)
);

CREATE INDEX idx_delivery_orders_business_status ON delivery.orders(business_id, status, created_at DESC);
CREATE INDEX idx_delivery_orders_driver ON delivery.orders(assigned_driver_id, status);
CREATE INDEX idx_delivery_orders_pending ON delivery.orders(business_id) WHERE status = 'pending_assignment';

-- -------------------------------------------------
-- VISITS (visitas dentro de una ruta)
-- Maquina de estados: pendiente -> en_camino -> en_ubicacion
--                  -> entregado | incidencia -> revisit
-- -------------------------------------------------
CREATE TABLE delivery.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES delivery.routes(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES delivery.orders(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES delivery.drivers(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'en_camino', 'en_ubicacion', 'entregado', 'incidencia', 'revisit')),
  incident_type TEXT
    CHECK (incident_type IN ('domicilio_incorrecto', 'no_se_encuentra', 'rechazado', 'zona_inaccesible', 'cliente_ausente', 'otro')),
  incident_notes TEXT,
  received_by_kinship TEXT
    CHECK (received_by_kinship IN ('titular', 'familiar', 'vecino', 'recibe_tercero')),
  amount_collected NUMERIC(12, 2) CHECK (amount_collected >= 0),
  payment_method TEXT,
  photo_url TEXT,
  revisit_of UUID REFERENCES delivery.visits(id) ON DELETE SET NULL,
  notified BOOLEAN NOT NULL DEFAULT false,
  calibrated_gps BOOLEAN NOT NULL DEFAULT false,
  customer_lat NUMERIC(9, 6),
  customer_lng NUMERIC(9, 6),
  last_gps_lat NUMERIC(9, 6),
  last_gps_lng NUMERIC(9, 6),
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (route_id, order_id)
);

CREATE INDEX idx_delivery_visits_route ON delivery.visits(route_id, sequence);
CREATE INDEX idx_delivery_visits_driver_status ON delivery.visits(driver_id, status);
CREATE INDEX idx_delivery_visits_revisit ON delivery.visits(business_id) WHERE status = 'incidencia' AND incident_type IS NOT NULL;

-- -------------------------------------------------
-- DRIVER EVENTS (cada accion del driver con GPS + timestamp)
-- captured_at = reloj local del dispositivo; received_at = server.
-- -------------------------------------------------
CREATE TABLE delivery.driver_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES delivery.drivers(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES delivery.visits(id) ON DELETE SET NULL,
  order_id UUID REFERENCES delivery.orders(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('voy_en_camino', 'ya_estoy_aqui', 'entrega_realizada', 'incidencia_reportada', 'revisit_programada', 'check_in', 'sync_batch')),
  lat NUMERIC(9, 6),
  lng NUMERIC(9, 6),
  captured_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_driver_events_driver_time ON delivery.driver_events(driver_id, captured_at DESC);
CREATE INDEX idx_delivery_driver_events_visit ON delivery.driver_events(visit_id);

-- -------------------------------------------------
-- DAILY CLOSURES (cierre y liquidacion diaria por repartidor)
-- -------------------------------------------------
CREATE TABLE delivery.daily_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES delivery.routes(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES delivery.drivers(id) ON DELETE RESTRICT,
  closure_date DATE NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'closed', 'adjusted')),
  total_orders INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  incidence_count INTEGER NOT NULL DEFAULT 0,
  revisit_count INTEGER NOT NULL DEFAULT 0,
  total_collected NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cash_counted NUMERIC(12, 2) NOT NULL DEFAULT 0,
  expenses JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, driver_id, closure_date),
  UNIQUE (route_id)
);

CREATE INDEX idx_delivery_closures_driver ON delivery.daily_closures(business_id, driver_id, closure_date DESC);

-- -------------------------------------------------
-- DRIVER SESSIONS (sesiones cortas del portal driver)
-- token_hash = SHA-256 del token de sesion opaco.
-- -------------------------------------------------
CREATE TABLE delivery.driver_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES delivery.drivers(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_sessions_driver ON delivery.driver_sessions(driver_id, expires_at DESC);

-- -------------------------------------------------
-- OUTBOX EVENTS (cola server-side: whatsapp, webhooks)
-- -------------------------------------------------
CREATE TABLE delivery.outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('whatsapp', 'webhook')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'dead_letter')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_delivery_outbox_status ON delivery.outbox_events(status, created_at);

-- -------------------------------------------------
-- EVIDENCE PHOTOS (fotos de evidencia de entrega)
-- Bucket PRIVATE `delivery-evidence`; aqui solo la referencia.
-- -------------------------------------------------
CREATE TABLE delivery.evidence_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL REFERENCES delivery.visits(id) ON DELETE CASCADE,
  order_id UUID REFERENCES delivery.orders(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES delivery.drivers(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lat NUMERIC(9, 6),
  lng NUMERIC(9, 6),
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_evidence_visit ON delivery.evidence_photos(visit_id);

-- -------------------------------------------------
-- ORDER COUNTERS (numeracion atornica ORD-000001)
-- -------------------------------------------------
CREATE TABLE delivery.order_counters (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- -------------------------------------------------
-- INGEST ERRORS (fallos de replicacion del trigger; jamas rompe la venta)
-- -------------------------------------------------
CREATE TABLE delivery.ingest_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sales_event_id UUID REFERENCES public.sales_events(id) ON DELETE CASCADE,
  error TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_ingest_errors_created ON delivery.ingest_errors(created_at DESC);

-- -------------------------------------------------
-- AUDIT LOG (calibracion GPS manual, rotaciones, ajustes de cierre)
-- -------------------------------------------------
CREATE TABLE delivery.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  action TEXT NOT NULL
    CHECK (action IN ('gps_reset_manual', 'token_rotate', 'closure_adjust', 'route_reassign', 'other')),
  target UUID,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_audit_business ON delivery.audit_log(business_id, created_at DESC);

-- =============================================
-- RLS: ENABLE + FORCE + REVOKE en TODAS las tablas delivery.*
-- El driver NO tiene policies: opera via API server-side.
-- =============================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'delivery'
  LOOP
    EXECUTE format('ALTER TABLE delivery.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE delivery.%I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON delivery.%I FROM anon, authenticated', tbl);
    EXECUTE format('REVOKE ALL ON delivery.%I FROM PUBLIC', tbl);
  END LOOP;
END $$;

-- Policies de lectura/escritura para el admin (business owner)
CREATE POLICY "delivery_settings_owner" ON delivery.business_settings
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "delivery_drivers_owner" ON delivery.drivers
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "delivery_orders_owner" ON delivery.orders
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "delivery_routes_owner" ON delivery.routes
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "delivery_visits_owner" ON delivery.visits
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "delivery_driver_events_owner" ON delivery.driver_events
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "delivery_closures_owner" ON delivery.daily_closures
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "delivery_sessions_owner" ON delivery.driver_sessions
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "delivery_outbox_owner" ON delivery.outbox_events
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "delivery_evidence_owner" ON delivery.evidence_photos
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "delivery_ingest_errors_owner" ON delivery.ingest_errors
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "delivery_audit_owner" ON delivery.audit_log
  FOR ALL TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

-- order_counters solo lo toca el trigger (service role); sin policy de usuario.

-- =============================================
-- TRIGGER 1: Replicacion SALE_WON -> delivery.orders
-- SECURITY DEFINER con search_path='' y objetos calificados.
-- Un fallo aqui NUNCA aborta la venta: se registra en ingest_errors.
-- =============================================

CREATE OR REPLACE FUNCTION delivery.handle_sale_won()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_settings delivery.business_settings%ROWTYPE;
  v_cust public.customers%ROWTYPE;
  v_next INTEGER;
BEGIN
  IF NEW.event_type <> 'SALE_WON' THEN
    RETURN NEW;
  END IF;

  -- (a) Negocio sin modulo habilitado -> no replica
  SELECT * INTO v_settings FROM delivery.business_settings
    WHERE business_id = NEW.business_id AND enabled = true;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- (b) Snapshot del cliente en el momento de la venta
  SELECT * INTO v_cust FROM public.customers WHERE id = NEW.customer_id;

  -- (c) Numeracion secuencial atomica por negocio
  INSERT INTO delivery.order_counters (business_id, last_number)
    VALUES (NEW.business_id, 1)
  ON CONFLICT (business_id)
    DO UPDATE SET last_number = delivery.order_counters.last_number + 1
  RETURNING last_number INTO v_next;

  -- (d) Replica (idempotente via UNIQUE(business_id, sales_event_id))
  BEGIN
    INSERT INTO delivery.orders (
      business_id, sales_event_id, conversation_id, customer_id, product_id,
      order_number, customer_name, phone, address, city, amount, paid_at_sale,
      items, source
    ) VALUES (
      NEW.business_id, NEW.id, NEW.conversation_id, NEW.customer_id, NEW.product_id,
      'ORD-' || lpad(v_next::text, 6, '0'),
      COALESCE(v_cust.name, 'Cliente'),
      v_cust.phone,
      v_cust.address,
      v_cust.city,
      NEW.amount,
      COALESCE((NEW.metadata->>'paid_at_sale')::boolean, true),
      COALESCE(NEW.metadata->'items', '[]'::jsonb),
      NEW.metadata
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO delivery.ingest_errors (business_id, sales_event_id, error, payload)
    VALUES (NEW.business_id, NEW.id, SQLERRM, NEW.metadata);
  END;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_sales_events_to_delivery
AFTER INSERT ON public.sales_events
FOR EACH ROW WHEN (NEW.event_type = 'SALE_WON')
EXECUTE FUNCTION delivery.handle_sale_won();

-- =============================================
-- TRIGGER 2: Candado de Cierre Diario POR REPARTIDOR
-- No se crea una ruta de fecha D si el driver tiene una ruta
-- previa (route_date < D) sin cerrar. Capa BD infranqueable.
-- =============================================

CREATE OR REPLACE FUNCTION delivery.check_previous_route_closed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM delivery.routes r
    WHERE r.business_id = NEW.business_id
      AND r.driver_id = NEW.driver_id
      AND r.route_date < NEW.route_date
      AND r.status <> 'closed'
  ) THEN
    RAISE EXCEPTION 'cierre_diario_pendiente';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_routes_closure_lock
BEFORE INSERT ON delivery.routes
FOR EACH ROW
EXECUTE FUNCTION delivery.check_previous_route_closed();

-- =============================================
-- Storage: bucket PRIVATE `delivery-evidence`
-- (se crea via API de Storage en el runtime de la app;
--  las policies del bucket se definen en app, no aqui).
-- =============================================
