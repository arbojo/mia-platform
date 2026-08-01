-- =============================================
-- MIA - Asistente de Ventas IA
-- Clean Nails landing funnel (adaptado a MIA)
-- order_requests + analytics_sessions/events
-- =============================================

-- =============================================
-- ORDER REQUESTS
-- =============================================
CREATE TABLE public.order_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'processing', 'converted', 'cancelled')),

  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,

  street TEXT NOT NULL,
  colony TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT '',
  zip TEXT,
  "references" TEXT,

  product_id TEXT,
  product_name TEXT NOT NULL DEFAULT 'Clean Nails - Dispositivo de Luz',
  quantity INTEGER NOT NULL DEFAULT 1,
  total NUMERIC(10,2) NOT NULL DEFAULT 599.00,

  support_opt_in BOOLEAN NOT NULL DEFAULT true,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_order_requests_status ON public.order_requests (status);
CREATE INDEX idx_order_requests_phone ON public.order_requests (phone);

-- =============================================
-- ANALYTICS SESSIONS
-- =============================================
CREATE TABLE public.analytics_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,

  landing_id TEXT NOT NULL,
  landing_version TEXT NOT NULL,

  session_token TEXT NOT NULL UNIQUE,

  user_agent TEXT NOT NULL DEFAULT '',
  device_type TEXT NOT NULL DEFAULT '',
  screen_width INTEGER NOT NULL DEFAULT 0,
  screen_height INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',

  utm_source TEXT NOT NULL DEFAULT '',
  utm_medium TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  utm_content TEXT NOT NULL DEFAULT '',
  utm_term TEXT NOT NULL DEFAULT '',

  converted BOOLEAN NOT NULL DEFAULT false,
  order_request_id UUID REFERENCES public.order_requests(id) ON DELETE SET NULL
);

CREATE INDEX idx_analytics_sessions_token ON public.analytics_sessions (session_token);
CREATE INDEX idx_analytics_sessions_landing ON public.analytics_sessions (landing_id, landing_version);
CREATE INDEX idx_analytics_sessions_converted ON public.analytics_sessions (converted);
CREATE INDEX idx_analytics_sessions_created ON public.analytics_sessions (created_at);

-- =============================================
-- ANALYTICS EVENTS
-- =============================================
CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.analytics_sessions(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seconds_from_start INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_analytics_events_session ON public.analytics_events (session_id);
CREATE INDEX idx_analytics_events_name ON public.analytics_events (event_name);
CREATE INDEX idx_analytics_events_created ON public.analytics_events (created_at);
