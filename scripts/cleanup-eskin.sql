-- Cleanup Eskin Boots demo data
-- Migration: cleanup-2026-07-28
-- Safely delete all demo business data
--
-- Execute: npx supabase db query --linked -f scripts/cleanup-eskin.sql

BEGIN;

-- Verify target business
SELECT 'Deleting business: a0000000-0000-0000-0000-000000000001' as info;

-- Count before
SELECT 'BEFORE' as phase, count(*) as cnt FROM ai_usage WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'BEFORE', count(*) FROM learning_events WHERE assistant_id IN (SELECT id FROM assistants WHERE business_id = 'a0000000-0000-0000-0000-000000000001')
UNION ALL SELECT 'BEFORE', count(*) FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE assistant_id IN (SELECT id FROM assistants WHERE business_id = 'a0000000-0000-0000-0000-000000000001'))
UNION ALL SELECT 'BEFORE', count(*) FROM lab_sessions WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'BEFORE', count(*) FROM assistant_channels WHERE assistant_id IN (SELECT id FROM assistants WHERE business_id = 'a0000000-0000-0000-0000-000000000001')
UNION ALL SELECT 'BEFORE', count(*) FROM assistant_memories WHERE assistant_id IN (SELECT id FROM assistants WHERE business_id = 'a0000000-0000-0000-0000-000000000001')
UNION ALL SELECT 'BEFORE', count(*) FROM conversations WHERE assistant_id IN (SELECT id FROM assistants WHERE business_id = 'a0000000-0000-0000-0000-000000000001')
UNION ALL SELECT 'BEFORE', count(*) FROM knowledge_versions WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'BEFORE', count(*) FROM customers WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'BEFORE', count(*) FROM knowledge_items WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'BEFORE', count(*) FROM products WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'BEFORE', count(*) FROM sales_rules WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'BEFORE', count(*) FROM ai_instructions WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'BEFORE', count(*) FROM brand_identities WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'BEFORE', count(*) FROM assistants WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'BEFORE', count(*) FROM businesses WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- 1. ai_usage
DELETE FROM ai_usage WHERE business_id = 'a0000000-0000-0000-0000-000000000001';

-- 2. learning_events (FK to assistants, knowledge_items, messages)
DELETE FROM learning_events WHERE assistant_id IN (SELECT id FROM assistants WHERE business_id = 'a0000000-0000-0000-0000-000000000001');

-- 3. messages (FK to conversations)
DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE assistant_id IN (SELECT id FROM assistants WHERE business_id = 'a0000000-0000-0000-0000-000000000001'));

-- 4. lab_sessions (FK to assistants, conversations)
DELETE FROM lab_sessions WHERE business_id = 'a0000000-0000-0000-0000-000000000001';

-- 5. assistant_channels (FK to assistants)
DELETE FROM assistant_channels WHERE assistant_id IN (SELECT id FROM assistants WHERE business_id = 'a0000000-0000-0000-0000-000000000001');

-- 6. assistant_memories
DELETE FROM assistant_memories WHERE assistant_id IN (SELECT id FROM assistants WHERE business_id = 'a0000000-0000-0000-0000-000000000001');

-- 7. conversations (FK to assistants)
DELETE FROM conversations WHERE assistant_id IN (SELECT id FROM assistants WHERE business_id = 'a0000000-0000-0000-0000-000000000001');

-- 8. knowledge_versions (FK to business_id)
DELETE FROM knowledge_versions WHERE business_id = 'a0000000-0000-0000-0000-000000000001';

-- 9. customers (FK to businesses)
DELETE FROM customers WHERE business_id = 'a0000000-0000-0000-0000-000000000001';

-- 10. knowledge_items (FK to businesses)
DELETE FROM knowledge_items WHERE business_id = 'a0000000-0000-0000-0000-000000000001';

-- 11. products (FK to businesses)
DELETE FROM products WHERE business_id = 'a0000000-0000-0000-0000-000000000001';

-- 12. sales_rules (FK to businesses)
DELETE FROM sales_rules WHERE business_id = 'a0000000-0000-0000-0000-000000000001';

-- 13. ai_instructions (FK to businesses)
DELETE FROM ai_instructions WHERE business_id = 'a0000000-0000-0000-0000-000000000001';

-- 14. brand_identities (FK to businesses)
DELETE FROM brand_identities WHERE business_id = 'a0000000-0000-0000-0000-000000000001';

-- 15. assistants (FK to businesses)
DELETE FROM assistants WHERE business_id = 'a0000000-0000-0000-0000-000000000001';

-- 16. businesses (root)
DELETE FROM businesses WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- Count after
SELECT 'AFTER' as phase, count(*) as cnt FROM ai_usage WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'AFTER', count(*) FROM learning_events WHERE assistant_id IN (SELECT id FROM assistants WHERE business_id = 'a0000000-0000-0000-0000-000000000001')
UNION ALL SELECT 'AFTER', count(*) FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE assistant_id IN (SELECT id FROM assistants WHERE business_id = 'a0000000-0000-0000-0000-000000000001'))
UNION ALL SELECT 'AFTER', count(*) FROM lab_sessions WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'AFTER', count(*) FROM assistant_channels WHERE assistant_id IN (SELECT id FROM assistants WHERE business_id = 'a0000000-0000-0000-0000-000000000001')
UNION ALL SELECT 'AFTER', count(*) FROM assistant_memories WHERE assistant_id IN (SELECT id FROM assistants WHERE business_id = 'a0000000-0000-0000-0000-000000000001')
UNION ALL SELECT 'AFTER', count(*) FROM conversations WHERE assistant_id IN (SELECT id FROM assistants WHERE business_id = 'a0000000-0000-0000-0000-000000000001')
UNION ALL SELECT 'AFTER', count(*) FROM knowledge_versions WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'AFTER', count(*) FROM customers WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'AFTER', count(*) FROM knowledge_items WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'AFTER', count(*) FROM products WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'AFTER', count(*) FROM sales_rules WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'AFTER', count(*) FROM ai_instructions WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'AFTER', count(*) FROM brand_identities WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'AFTER', count(*) FROM assistants WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'AFTER', count(*) FROM businesses WHERE id = 'a0000000-0000-0000-0000-000000000001';

COMMIT;
