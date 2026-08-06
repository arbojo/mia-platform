-- =============================================
-- 028 Mia Pixel — rename pageview -> init_visit
--
-- El evento de carga inicial de la página se emite como
-- init_visit (contract PIXEL_EVENT_NAMES en packages/core).
-- Esta migración actualiza el CHECK de landing_events sin
-- modificar 027 (inmutable una vez aplicada).
-- =============================================

ALTER TABLE public.landing_events
  DROP CONSTRAINT IF EXISTS landing_events_event_name_check;

ALTER TABLE public.landing_events
  ADD CONSTRAINT landing_events_event_name_check CHECK (event_name IN (
    'init_visit',
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
  ));
