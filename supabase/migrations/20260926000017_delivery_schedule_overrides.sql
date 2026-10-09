-- =============================================
-- 017 Delivery Schedule Overrides (per-city, dated)
--
-- Temporary per-city exceptions to delivery_schedules:
--   - start_date / end_date: inclusive date range when the override applies
--   - delivery_days: JS weekday ints (0=domingo ... 6=sábado) for that period
--   - delivery_window_start / delivery_window_end: optional time window
--   - note: free-text reason ("ruta extra esta semana")
-- Active overrides take precedence over the base schedule for their city/date.
-- =============================================

CREATE TABLE public.delivery_schedule_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date),
  delivery_days INTEGER[] NOT NULL DEFAULT '{}'
    CHECK (delivery_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[]),
  delivery_window_start TIME DEFAULT '09:00',
  delivery_window_end TIME DEFAULT '19:00',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, city, start_date, end_date)
);

COMMENT ON TABLE public.delivery_schedule_overrides IS
  'Dated per-city exceptions to delivery_schedules. Active overrides (start_date <= today <= end_date) replace the base calendar for that city.';

ALTER TABLE public.delivery_schedule_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_schedule_overrides_owner" ON public.delivery_schedule_overrides
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.update_delivery_override_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_delivery_override_updated
  BEFORE UPDATE ON public.delivery_schedule_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_delivery_override_timestamp();