-- =============================================
-- 027 Mia Pixel — landing telemetry (ADR-015)
--
-- Unifica la telemetría de landings en la Supabase de MIA
-- (landing_visits + landing_events) para que el Dashboard de
-- Landings lea métricas de una sola fuente.
--
-- Contrato de eventos (PIXEL_EVENT_NAMES en packages/core):
--   pageview, scroll_depth, time_to_click, whatsapp_click, cta_click,
--   form_started, form_submitted, city_selected, support_opt_in_enabled,
--   support_opt_in_disabled, step_view, step_completed, offer_view,
--   order_request_created
-- =============================================

-- -------------------------------------------------
-- LANDING VISITS
-- -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.landing_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  landing_id TEXT NOT NULL,
  landing_version TEXT NOT NULL DEFAULT 'v1',
  session_token TEXT NOT NULL,
  user_agent TEXT,
  device_type TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  language TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  is_bounce BOOLEAN NOT NULL DEFAULT FALSE,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_token, landing_id)
);

CREATE INDEX IF NOT EXISTS idx_landing_visits_business ON public.landing_visits(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_landing_visits_landing ON public.landing_visits(business_id, landing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_landing_visits_session ON public.landing_visits(session_token);

ALTER TABLE public.landing_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_owner_landing_visits_all" ON public.landing_visits
  FOR ALL
  USING (business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  ));

-- -------------------------------------------------
-- LANDING EVENTS
-- -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.landing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL REFERENCES public.landing_visits(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL CHECK (event_name IN (
    'pageview',
    'scroll_depth',
    'time_to_click',
    'whatsapp_click',
    'cta_click',
    'form_started',
    'form_submitted',
    'city_selected',
    'support_opt_in_enabled',
    'support_opt_in_disabled',
    'step_view',
    'step_completed',
    'offer_view',
    'order_request_created'
  )),
  seconds_from_start INTEGER NOT NULL DEFAULT 0,
  value JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_events_visit ON public.landing_events(visit_id);
CREATE INDEX IF NOT EXISTS idx_landing_events_business ON public.landing_events(business_id, event_name, created_at DESC);

ALTER TABLE public.landing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_owner_landing_events_all" ON public.landing_events
  FOR ALL
  USING (business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  ));

-- Service role (admin client) bypasses RLS by default; no anon/authenticated
-- policies exist on purpose. Public ingestion flows through /api/pixel/track.
