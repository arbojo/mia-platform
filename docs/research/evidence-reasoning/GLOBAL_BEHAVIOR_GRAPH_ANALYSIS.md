# Global Behavior Graph Analysis

**Status**: COMPLETE
**Date**: 2026-08-25
**Parent**: MIA_EVIDENCE_REASONING_RESEARCH.md

---

## 1. What MIA Already Has

MIA has the **data** for a behavioral graph:

| Data Source | What It Contains | Location |
|------------|-----------------|----------|
| `sales_events` | Append-only ledger of 14 event types per conversation | `025_sales_events.sql` |
| `analytics.customer_insights` | Per-customer: conversations, won/lost/cancelled, total_value | `047_analytics_schema.sql` |
| `analytics.sales_daily` | Daily business-level aggregation | `047_analytics_schema.sql` |
| `analytics.product_performance` | Per-product conversion rates | `047_analytics_schema.sql` |
| `experience_memory` | Objection-response patterns with conversion probability | `053_experience_memory.sql` |
| `business_memory` | Aggregated patterns with confidence and observation count | `008_business_memory.sql` |

### 1.1 What's Missing

The **aggregation and pattern extraction** layer:

- Which conversation trajectories lead to sales?
- Which trajectories lead to lost customers?
- What's the typical sequence of questions before purchase?
- How does temporal spacing affect outcomes?

---

## 2. Approach: LLM-Based Pattern Extraction

### 2.1 Why Not Graph Databases?

| Approach | Why Not |
|----------|---------|
| Graph databases (Neo4j) | Overkill — MIA uses PostgreSQL, no need for another DB |
| Markov chains | Too rigid — conversations are not state machines |
| Bayesian networks | Too complex — the LLM handles probabilistic reasoning |
| Embeddings | Useful for similarity, not for trajectory patterns |

### 2.2 Why LLM-Based Extraction?

1. **Consistent with existing architecture** — MIA already uses LLMs for pattern extraction (`analyzeConversationPatterns()` in `memory.ts`)
2. **Handles unstructured data** — conversations are natural language, not structured events
3. **Flexible** — can identify patterns that rigid models miss
4. **Interpretable** — patterns are described in natural language, not abstract graph edges

### 2.3 Implementation

Use the existing `analyzeConversationPatterns()` pattern:

```
1. Query completed conversations from sales_events
2. Extract trajectory sequences (event types in order)
3. Send to LLM for pattern identification
4. Store patterns in business_memory with category 'conversation_trajectory'
5. Inject relevant trajectories into prompt as "historical context"
```

---

## 3. Trajectory Patterns

### 3.1 What Is a Trajectory?

A trajectory is the sequence of event types in a conversation:

```
price_question → shipping_question → payment_question → objection → purchase
```

Or:

```
price_question → ingredient_question → experience_question → delay → purchase_days_later
```

### 3.2 Pattern Storage

Patterns are stored in `business_memory`:

```json
{
  "memory_type": "pattern",
  "category": "conversation_trajectory",
  "content": "Secuencia típica de compra: pregunta precio → pregunta envío → pregunta pago → objeción → cierre",
  "evidence": {
    "trajectory": ["price_question", "shipping_question", "payment_question", "objection", "purchase"],
    "frequency": 45,
    "conversion_rate": 0.73,
    "avg_turns_to_close": 6.2
  },
  "confidence": 78,
  "observation_count": 45
}
```

### 3.3 Pattern Injection into Prompt

Patterns are injected as historical context:

```
## Patrones de Conversación Históricos

Secuencia típica de compra para este negocio:
1. Pregunta sobre precio (turno 1-2)
2. Pregunta sobre envío (turno 2-3)
3. Pregunta sobre pago (turno 3-4)
4. Posible objeción (turno 4-5)
5. Cierre (turno 5-7)

Conversación actual: Turno 3, Customer preguntó sobre precio y envío.
Observación: Sigue el patrón típico. Próxima pregunta probable: pago.
```

---

## 4. Causality vs Correlation

### 4.1 The Problem

"Customers who ask about payment often purchase" ≠ "Asking about payment causes purchase"

### 4.2 How to Prevent Causal Confusion

1. **Label patterns as correlational**: In `business_memory`, tag with `correlation_not_causation: true`
2. **Never use patterns as instructions**: Patterns inform expectations, not actions
3. **Evidence-first reasoning**: For each customer, reason from THEIR evidence, not from global patterns
4. **Prompt instruction**: "Los patrones históricos muestran correlaciones, no causalidad. Reasona desde la evidencia individual del cliente."

---

## 5. Boundary: Global vs Individual

| Level | What It Provides | Scope | Can Use as Fact? |
|-------|-----------------|-------|-----------------|
| Global patterns | "Customers who ask about payment typically purchase within 2 turns" | Platform-wide, anonymized | NO — only as prior |
| Industry patterns | "Skincare customers often ask about ingredients before purchasing" | Industry-level | NO — only as prior |
| Business patterns | "Vitanova customers in Monterrey prefer WhatsApp for follow-up" | Per-business | NO — only as prior |
| Customer evidence | "This customer asked 3 price questions and hasn't shared their address" | Per-customer | YES — this is individual evidence |

### 5.1 The Golden Rule

> **Global patterns inform expectations. Individual evidence determines state.**

The system must never reason:
> "Customers like this usually buy, therefore this customer wants to buy."

Instead:
> "Historical data suggests this pattern is associated with X; current evidence supports/contradicts that hypothesis."

---

## 6. Implementation Scope

| Component | Lines (est.) | Priority |
|-----------|-------------|----------|
| Trajectory extraction (LLM-based) | ~80 | P2 |
| Pattern storage in business_memory | ~30 | P2 |
| Pattern injection into prompt | ~40 | P2 |
| Correlation labeling | ~20 | P1 |
| **Total** | **~170** | **P2** |

This is a **Phase 2** feature — implement after the core evidence/state layer is working.

---

## 7. Tenant Isolation

### 7.1 What Can Be Shared

| Data | Can Share? | Reason |
|------|-----------|--------|
| Objection patterns | YES (anonymized) | No PII, useful across businesses |
| Conversion rates by objection type | YES (anonymized) | Statistical, no individual data |
| Typical question sequences | YES (anonymized) | Behavioral patterns, no identity |

### 7.2 What Cannot Be Shared

| Data | Cannot Share? | Reason |
|------|--------------|--------|
| Customer messages | NO | PII, private conversation content |
| Customer state scores | NO | Individual-level, business-private |
| Business-specific strategies | NO | Competitive advantage |

### 7.3 Implementation

The existing `experience_memory` scope system handles this:
- `scope: 'global'` = platform-wide (anonymized)
- `scope: 'industry'` = industry-level (anonymized)
- `scope: 'business'` = business-specific

**No new isolation mechanism needed.**

---

## 8. Rejection Criteria

The global behavior graph is rejected if:

1. Trajectory patterns don't correlate with outcomes
2. LLM-based extraction is too slow or inconsistent
3. Patterns create bias (push behavior based on historical aggression)
4. The overhead of maintaining patterns exceeds the benefit
5. Individual evidence is sufficient without global context
