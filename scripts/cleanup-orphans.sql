BEGIN;

-- Delete orphan Vitanova businesses (from failed seed attempts)
-- Keep only the latest: 0d40a769-7a21-4cb3-9472-bdc9638675d6

DELETE FROM learning_reports WHERE business_id IN ('7fe4f702-2e49-41bd-a1ba-26e98817eae8', '846ebec8-774d-47ad-a9d5-cc6c00a26eb3', 'c08c674f-7855-4015-87b4-847895b4fdb0');
DELETE FROM learning_velocity_snapshots WHERE business_id IN ('7fe4f702-2e49-41bd-a1ba-26e98817eae8', '846ebec8-774d-47ad-a9d5-cc6c00a26eb3', 'c08c674f-7855-4015-87b4-847895b4fdb0');
DELETE FROM business_memory WHERE business_id IN ('7fe4f702-2e49-41bd-a1ba-26e98817eae8', '846ebec8-774d-47ad-a9d5-cc6c00a26eb3', 'c08c674f-7855-4015-87b4-847895b4fdb0');
DELETE FROM mia_skills WHERE business_id IN ('7fe4f702-2e49-41bd-a1ba-26e98817eae8', '846ebec8-774d-47ad-a9d5-cc6c00a26eb3', 'c08c674f-7855-4015-87b4-847895b4fdb0');
DELETE FROM readiness_snapshots WHERE business_id IN ('7fe4f702-2e49-41bd-a1ba-26e98817eae8', '846ebec8-774d-47ad-a9d5-cc6c00a26eb3', 'c08c674f-7855-4015-87b4-847895b4fdb0');
DELETE FROM weekly_reports WHERE business_id IN ('7fe4f702-2e49-41bd-a1ba-26e98817eae8', '846ebec8-774d-47ad-a9d5-cc6c00a26eb3', 'c08c674f-7855-4015-87b4-847895b4fdb0');
DELETE FROM ai_usage WHERE business_id IN ('7fe4f702-2e49-41bd-a1ba-26e98817eae8', '846ebec8-774d-47ad-a9d5-cc6c00a26eb3', 'c08c674f-7855-4015-87b4-847895b4fdb0');
DELETE FROM lab_sessions WHERE business_id IN ('7fe4f702-2e49-41bd-a1ba-26e98817eae8', '846ebec8-774d-47ad-a9d5-cc6c00a26eb3', 'c08c674f-7855-4015-87b4-847895b4fdb0');
DELETE FROM knowledge_versions WHERE business_id IN ('7fe4f702-2e49-41bd-a1ba-26e98817eae8', '846ebec8-774d-47ad-a9d5-cc6c00a26eb3', 'c08c674f-7855-4015-87b4-847895b4fdb0');
DELETE FROM customers WHERE business_id IN ('7fe4f702-2e49-41bd-a1ba-26e98817eae8', '846ebec8-774d-47ad-a9d5-cc6c00a26eb3', 'c08c674f-7855-4015-87b4-847895b4fdb0');
DELETE FROM knowledge_items WHERE business_id IN ('7fe4f702-2e49-41bd-a1ba-26e98817eae8', '846ebec8-774d-47ad-a9d5-cc6c00a26eb3', 'c08c674f-7855-4015-87b4-847895b4fdb0');
DELETE FROM products WHERE business_id IN ('7fe4f702-2e49-41bd-a1ba-26e98817eae8', '846ebec8-774d-47ad-a9d5-cc6c00a26eb3', 'c08c674f-7855-4015-87b4-847895b4fdb0');
DELETE FROM sales_rules WHERE business_id IN ('7fe4f702-2e49-41bd-a1ba-26e98817eae8', '846ebec8-774d-47ad-a9d5-cc6c00a26eb3', 'c08c674f-7855-4015-87b4-847895b4fdb0');
DELETE FROM ai_instructions WHERE business_id IN ('7fe4f702-2e49-41bd-a1ba-26e98817eae8', '846ebec8-774d-47ad-a9d5-cc6c00a26eb3', 'c08c674f-7855-4015-87b4-847895b4fdb0');
DELETE FROM brand_identities WHERE business_id IN ('7fe4f702-2e49-41bd-a1ba-26e98817eae8', '846ebec8-774d-47ad-a9d5-cc6c00a26eb3', 'c08c674f-7855-4015-87b4-847895b4fdb0');
DELETE FROM assistants WHERE business_id IN ('7fe4f702-2e49-41bd-a1ba-26e98817eae8', '846ebec8-774d-47ad-a9d5-cc6c00a26eb3', 'c08c674f-7855-4015-87b4-847895b4fdb0');
DELETE FROM businesses WHERE id IN ('7fe4f702-2e49-41bd-a1ba-26e98817eae8', '846ebec8-774d-47ad-a9d5-cc6c00a26eb3', 'c08c674f-7855-4015-87b4-847895b4fdb0');

COMMIT;
