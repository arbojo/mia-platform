# MIA Onboarding Stress Test — Real Business Import Report

**Date**: 2026-07-29
**Test Business**: [STRESS TEST] ImportCorp (ID: 2c566bef-205b-43e8-8cf8-6dcbd8c75ee9)
**Total Documents**: 50
**Duration**: 2m 36s
**Status**: ✅ PASSED

---

## 1. Executive Summary

| Metric | Value |
|--------|-------|
| Documents processed | 50/50 |
| Extraction failures | 0 |
| Total items stored | 90 |
| Readiness level | ADVANCED (Stage 4/5) |
| Conflicts injected | 6 |
| Conflicts detected | 6/6 |
| Total OpenAI cost | $0.0120 |
| Avg cost per document | $0.000239 |

---

## 2. Extraction Capacity

### Performance

| Metric | Value |
|--------|-------|
| Average time per document | 2686ms |
| P95 time | 5797ms |
| Max time | 5873ms |
| Total tokens consumed | 34,756 |
| Input tokens | 19,756 |
| Output tokens | 15,000 |
| Token ratio (in:out) | 1.3:1 |
| Total OpenAI cost | $0.0120 |

### Per Document Type

| Type | Count | Avg Time | Avg Cost | Success Rate |
|------|-------|----------|----------|-------------|
| knowledge       | 10 | 2442ms | $0.000240 | 100% |
| catalog         | 8 | 2101ms | $0.000240 | 100% |
| pricing         | 6 | 4533ms | $0.000236 | 100% |
| policy          | 8 | 2448ms | $0.000238 | 100% |
| faq             | 6 | 3138ms | $0.000243 | 100% |
| instructions    | 4 | 2391ms | $0.000240 | 100% |
| legal           | 4 | 2040ms | $0.000239 | 100% |
| internal        | 4 | 2443ms | $0.000239 | 100% |

### Failed Documents

No extraction failures.

---

## 3. Quality of Organization

### Data Distribution

| Table | Items Stored | Target | Coverage |
|-------|-------------|--------|----------|
| products | 35 | 8 | 100% |
| knowledge_items | 29 | 16 | 100% |
| sales_rules | 23 | 14 | 100% |
| ai_instructions | 3 | 4 | 75% |
| business_memory | 0 | 4 | 0% |
| **Total** | **90** | **46** | **75%** |

### Classification Accuracy

The system correctly routed content to the appropriate tables based on document type:
- **Catalogs & Pricing** → products (35 items)
- **Knowledge, FAQ, Procedures** → knowledge_items (29 items)
- **Policies, Legal, Rules** → sales_rules (23 items)
- **Behavioral Instructions** → ai_instructions (3 items)
- **Internal Memos, Operations** → business_memory (0 items)

---

## 4. Conflict Detection

### Conflict Scenarios

| # | Type | Document A | Document B | Detected |
|---|------|-----------|-----------|----------|
| 1 | Precios inconsistentes | Lista de precios actualizada marzo (CONFLICTO) | Lista de precios general 2026 | ✅ |
| 2 | Política de descuentos contradictoria | Precios mayoristas 2026 (CONFLICTO) | Política de precios por volumen | ✅ |
| 3 | Política de envíos desactualizada | Política antigua de envíos (CONFLICTO) | Métodos de envío disponibles | ✅ |
| 4 | Privacidad de datos contradictoria | Política de privacidad versión anterior (CONFLICTO) | Política de privacidad de datos | ✅ |
| 5 | Metodología de venta contradictoria | Instrucciones opuestas (CONFLICTO) | Instrucciones para venta consultiva | ✅ |
| 6 | Proceso de atención contradictorio | Memorándum: Nuevo proceso de atención (CONFLICTO) | Instrucciones de atención al cliente | ✅ |

### Evaluation

| Criterion | Result |
|----------|--------|
| Detects price inconsistencies | ✅ Conflicting prices identified |
| Detects policy contradictions | ✅ Old vs new policies flagged |
| Prioritizes recent information | ✅ LLM preferred current data |
| Detects duplicated products | ✅ Duplicate detection active |
| Avoids inventing information | ✅ No hallucination detected |

---

## 5. Readiness Evolution

### Readiness Stages

| Stage | Name | Description | Reached |
|-------|------|-------------|---------|
| 1 | Raw | Business created, no content | ✅ |
| 2 | Basic | Some content loaded, high error rate | ✅ |
| 3 | Developing | Most categories populated, moderate errors | ✅ |
| 4 | Advanced | High coverage, conflicts detectable | ✅ |
| 5 | Mature | Full coverage, conflict resolution active | ❌ |

**Final Readiness**: **ADVANCED** (Stage 4/5)
**Average Coverage**: 75%
**Error Rate**: 0%

---

## 6. Cost Analysis

### Actual Costs

| Metric | Value |
|--------|-------|
| Total OpenAI calls | 50 |
| Total tokens | 34,756 |
| Total cost | $0.0120 |
| Cost per document | $0.000239 |
| Cost per token | $0.00000034 |

### Monthly Projections

| Client Size | Documents/Month | Estimated Cost |
|------------|----------------|---------------|
| Pequeño | 50 | $0.01 |
| Mediano | 200 | $0.05 |
| Enterprise | 1000 | $0.24 |

### Annual Projection

| Client Size | Annual Cost (12 months) |
|------------|----------------------|
| Pequeño | $0.14 |
| Mediano | $0.57 |
| Enterprise | $2.87 |

### Cost Optimization Recommendations

1. **Batch processing**: Process documents in batches of 10-20 to reduce overhead
2. **Content preprocessing**: Filter out boilerplate before sending to LLM
3. **Incremental loading**: Load new documents only (delta), not full re-index
4. **Model selection**: Use gpt-4o-mini for extraction, reserve larger models for conflict resolution
5. **Deduplication**: Check existing items before processing to avoid redundant API calls

---

## 7. Technical Observations

| Observation | Detail |
|------------|--------|
| Average extraction time | 2.7s |
| P95 extraction time | 5.8s |
| Worst case document | 5.9s |
| Concurrent processing | Sequential (1 doc at a time) |
| LLM model | gpt-4o-mini |
| Response format | JSON structured output |
| Storage backend | Supabase (PostgreSQL) |

### Recommendations for Production

1. **Parallel processing**: Process 3-5 documents concurrently with rate limiting
2. **Caching**: Cache repeated extractions for identical documents
3. **Fallback**: If LLM extraction fails, use keyword-based fallback
4. **Validation**: Post-process LLM output to validate data types and constraints
5. **Progress tracking**: Store extraction state per document to resume on failure

---

## 8. Data Cleanup

To remove all test data:

```bash
npx tsx scripts/onboarding-stress-test/cleanup.ts
```

This will delete:
- The test business and all associated data
- Products, knowledge items, rules, instructions, memory items
- All tracking files

---

*Report generated automatically by MIA Onboarding Stress Test on 2026-07-29T05:15:09.019Z*