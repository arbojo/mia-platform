-- =============================================
-- Recovery Anti-Spam (opt-out + quiet hours)
--
-- Hardening for the commercial recovery flow (10m / 2h / 6h / 23h). Four
-- re-engagement messages in 24h sit at the edge of WhatsApp's per-user
-- frequency expectations, and WhatsApp policy makes respecting opt-out
-- mandatory. This migration adds:
--
--   1. customers.recovery_opt_out_at — set when a customer explicitly asks to
--      stop being contacted ("STOP", "no me escribas", ...). Once set, the
--      recovery scan excludes the customer permanently (until cleared).
--
--   2. business_sales_config quiet-hours + daily cap — recovery attempts that
--      would land outside the recipient's local sending window are deferred to
--      the next window (or dropped if that crosses the 24h ceiling), and each
--      connection is capped at N recovery sends per day.
--
-- All public-schema. Autónomo respecto a delivery.* / inventory.*.
-- =============================================

-- -------------------------------------------------
-- CUSTOMERS: opt-out marker
-- -------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS recovery_opt_out_at TIMESTAMPTZ;

COMMENT ON COLUMN public.customers.recovery_opt_out_at IS
  'Set when the customer asks to stop being contacted (opt-out / STOP). Non-null permanently excludes the customer from commercial recovery. NULL means recovery is allowed.';

-- -------------------------------------------------
-- BUSINESS SALES CONFIG: recovery sending guardrails
-- -------------------------------------------------
ALTER TABLE public.business_sales_config
  ADD COLUMN IF NOT EXISTS recovery_sending_start_hour INTEGER NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS recovery_sending_end_hour INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS recovery_max_per_day INTEGER NOT NULL DEFAULT 20;

ALTER TABLE public.business_sales_config
  DROP CONSTRAINT IF EXISTS business_sales_config_recovery_sending_start_hour_check;
ALTER TABLE public.business_sales_config
  ADD CONSTRAINT business_sales_config_recovery_sending_start_hour_check
  CHECK (recovery_sending_start_hour >= 0 AND recovery_sending_start_hour <= 23);

ALTER TABLE public.business_sales_config
  DROP CONSTRAINT IF EXISTS business_sales_config_recovery_sending_end_hour_check;
ALTER TABLE public.business_sales_config
  ADD CONSTRAINT business_sales_config_recovery_sending_end_hour_check
  CHECK (recovery_sending_end_hour >= 1 AND recovery_sending_end_hour <= 24);

ALTER TABLE public.business_sales_config
  DROP CONSTRAINT IF EXISTS business_sales_config_recovery_max_per_day_check;
ALTER TABLE public.business_sales_config
  ADD CONSTRAINT business_sales_config_recovery_max_per_day_check
  CHECK (recovery_max_per_day > 0);

COMMENT ON COLUMN public.business_sales_config.recovery_sending_start_hour IS
  'Local hour (0-23) when recovery messages may start being sent.';
COMMENT ON COLUMN public.business_sales_config.recovery_sending_end_hour IS
  'Local hour (1-24) when recovery messages must stop being sent.';
COMMENT ON COLUMN public.business_sales_config.recovery_max_per_day IS
  'Maximum recovery messages a connection may send per day (anti-spam cap).';
