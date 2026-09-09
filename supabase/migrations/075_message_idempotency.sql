-- =============================================
-- MESSAGE IDEMPOTENCY: Unique constraint on incoming messages
-- Prevents duplicate processing on bridge reconnection/redeploy
-- =============================================

-- STEP 0: INSPECTION QUERY (run manually BEFORE step 1)
-- -------------------------------------------------------
-- This SELECT shows what duplicates exist and would be removed.
-- Review output, confirm it's safe, then proceed to STEP 1.
--
-- SELECT 
--     business_id,
--     channel,
--     external_id,
--     COUNT(*) as duplicate_count,
--     MIN(created_at) as earliest,
--     MAX(created_at) as latest,
--     COUNT(DISTINCT customer_id) as distinct_customers,
--     array_agg(id ORDER BY created_at DESC) as all_ids
-- FROM public.channel_messages
-- WHERE external_id IS NOT NULL
--   AND direction = 'incoming'
-- GROUP BY business_id, channel, external_id
-- HAVING COUNT(*) > 1
-- ORDER BY duplicate_count DESC;

-- STEP 1: DELETE DUPLICATES (keep latest per business/channel/external_id)
-- -----------------------------------------------------------------------
-- Run ONLY after reviewing STEP 0 output and confirming.
-- Deletes older duplicate rows, keeping the most recent one per key.
--
-- WITH duplicates AS (
--   SELECT id,
--          ROW_NUMBER() OVER (
--            PARTITION BY business_id, channel, external_id
--            ORDER BY created_at DESC
--          ) AS rn
--   FROM public.channel_messages
--   WHERE external_id IS NOT NULL
--     AND direction = 'incoming'
-- )
-- DELETE FROM public.channel_messages
-- WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- STEP 2: CREATE PARTIAL UNIQUE INDEX (idempotency guarantee)
-- -----------------------------------------------------------
-- Enforces uniqueness at DB level for incoming messages with external_id.
-- Composite key prevents cross-business/cross-channel collisions.
-- Partial: only incoming, only when external_id is present.
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_messages_idempotency
ON public.channel_messages (business_id, channel, external_id)
WHERE external_id IS NOT NULL AND direction = 'incoming';