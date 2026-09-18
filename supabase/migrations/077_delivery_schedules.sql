-- =============================================
-- 077 Delivery Schedules (per-city)
--
-- Deterministic per-city delivery calendar:
--   - delivery_days: JS weekday ints (0=domingo ... 6=sábado)
--   - delivery_window_start / delivery_window_end: time window announced
--     when an order is confirmed
--   - Business rule: NO same-day delivery. Orders ship on the NEXT
--     scheduled day of the city.
-- This migration is fully autonomous in the public schema.
-- Zero references to delivery.* or inventory.* schemas.
-- =============================================

CREATE TABLE public.delivery_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  delivery_days INTEGER[] NOT NULL DEFAULT '{}'
    CHECK (delivery_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[]),
  delivery_window_start TIME NOT NULL DEFAULT '09:00',
  delivery_window_end TIME NOT NULL DEFAULT '19:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, city)
);

COMMENT ON TABLE public.delivery_schedules IS
  'Per-city delivery calendar. Orders are delivered on the NEXT scheduled day (never same-day); delivery_window_* is the time window to announce at confirmation.';

ALTER TABLE public.delivery_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_schedules_owner" ON public.delivery_schedules
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_delivery_schedule_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_delivery_schedule_updated
  BEFORE UPDATE ON public.delivery_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_delivery_schedule_timestamp();