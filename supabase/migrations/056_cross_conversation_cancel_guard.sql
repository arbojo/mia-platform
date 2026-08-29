-- =============================================
-- Cross-Conversation Cancelled Order Guard
-- Persists last_cancelled_order on customers to
-- prevent automatic reconstruction of cancelled
-- orders in new conversations.
-- =============================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS last_cancelled_order JSONB NULL;

COMMENT ON COLUMN public.customers.last_cancelled_order IS
  'Tracks the most recent cancelled order for cross-conversation guard. '
  'JSONB with structure: { order_id, product_id, product_name, cancelled_at, reason, event_id }. '
  'NULL when no recent cancellation exists. Expiration is runtime-only via cancellation_window_hours.';
