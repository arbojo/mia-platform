# Customer State Model

**Status**: COMPLETE
**Date**: 2026-08-25
**Parent**: MIA_EVIDENCE_REASONING_RESEARCH.md

---

## 1. Problem

MIA currently tracks customer state as a flat 5-value enum:

```sql
customers.status: 'new' | 'contacted' | 'interested' | 'converted' | 'lost'
```

This cannot represent:
- A customer who is interested but doesn't trust the seller
- A customer who is ready to buy but doesn't understand the product
- A customer who is engaged but has no purchase intent
- A customer who was interested but lost confidence

---

## 2. Minimal Viable State Model

After analysis, **5 dimensions** are sufficient:

### 2.1 Dimension Definitions

| Dimension | Range | Definition | Low Means | High Means |
|-----------|-------|-----------|-----------|------------|
| **interest** | 0.0 - 1.0 | How much the customer wants to learn about/buy the product | Browsing, not focused | Actively exploring, asking detailed questions |
| **trust** | 0.0 - 1.0 | How comfortable the customer is with MIA/the business | Skeptical, guarded | Open, sharing information freely |
| **readiness** | 0.0 - 1.0 | How close to making a decision | Early exploration, no commitment signals | Asking about payment, delivery, timing |
| **clarity** | 0.0 - 1.0 | How well the customer understands the product/offering | Confused, many basic questions | Specific, informed questions |
| **engagement** | 0.0 - 1.0 | Quality and depth of conversation | Short responses, slow, vague | Detailed responses, quick, specific |

### 2.2 Why These 5?

Evaluated 10 potential dimensions. Kept 5 that are:
1. **Independently measurable** — each dimension has distinct evidence sources
2. **Action-relevant** — each dimension suggests different next actions
3. **Observable** — can be inferred from customer messages
4. **Non-redundant** — no dimension is a proxy for another

**Rejected dimensions:**

| Dimension | Why Rejected |
|-----------|-------------|
| `purchase_intent` | Redundant with `readiness` + `interest` |
| `urgency` | Subsumed by `readiness` (high urgency = high readiness) |
| `price_sensitivity` | Better handled as evidence type, not state dimension |
| `objection_intensity` | Better handled as evidence type |
| `satisfaction` | Not measurable in real-time during conversation |
| `loyalty` | Requires long-term data, not conversation-level |
| `sentiment` | Too coarse — positive/negative doesn't guide action |

---

## 3. State Combinations and Actions

### 3.1 Key Combinations

| Interest | Trust | Readiness | Clarity | Engagement | Meaning | Correct Action |
|----------|-------|-----------|---------|------------|---------|----------------|
| HIGH | HIGH | HIGH | HIGH | HIGH | Ready to buy, informed, trusting | **close** — offer to complete purchase |
| HIGH | HIGH | LOW | HIGH | HIGH | Wants product, not ready yet | **offer + follow_up** — provide info, plan re-contact |
| HIGH | LOW | HIGH | HIGH | HIGH | Wants product, doesn't trust seller | **reassure** — build trust, share proof |
| HIGH | HIGH | HIGH | LOW | HIGH | Ready but doesn't understand product | **clarify** — explain clearly before closing |
| HIGH | LOW | LOW | HIGH | HIGH | Interested but untrusting and not ready | **reassure + explore** — build trust, understand barriers |
| LOW | HIGH | LOW | HIGH | LOW | Not interested, just browsing | **answer** — be helpful, don't push |
| LOW | LOW | LOW | LOW | LOW | Disengaged | **answer briefly** — don't waste resources |
| HIGH | HIGH | LOW | LOW | HIGH | Enthusiastic but confused | **educate** — clarify product before advancing |
| MEDIUM | MEDIUM | MEDIUM | MEDIUM | MEDIUM | Uncertain — need more data | **explore** — ask questions to reduce uncertainty |
| LOW | HIGH | HIGH | HIGH | LOW | Ready and informed but not interested | **investigate** — what changed? |

### 3.2 The "Push" Prevention Rules

```
IF readiness < 0.5:
  DO NOT attempt to close
  DO NOT ask for personal data (address, phone)
  DO NOT suggest "te lo envío"

IF trust < 0.4:
  DO NOT ask for commitment
  DO NOT push for purchase
  DO share social proof, reviews, guarantees

IF clarity < 0.4:
  DO NOT assume customer understands the product
  DO explain before offering
  DO ask clarifying questions

IF interest < 0.3:
  DO NOT invest in long conversation
  DO answer efficiently
  DO NOT push for engagement

IF ALL dimensions < 0.3:
  DO be brief and helpful
  DO NOT waste customer's time
  DO leave door open for return
```

### 3.3 Contradictory States

**Yes, contradictory states can and should exist.**

| Combination | Example | Interpretation |
|-------------|---------|---------------|
| HIGH interest + LOW trust | "Me gusta pero no confío" | Wants product, needs reassurance |
| HIGH readiness + LOW clarity | "¿Cómo funciona?" (after asking about payment) | Ready to buy but doesn't understand |
| HIGH engagement + LOW interest | Asks many questions but about unrelated topics | Curious but not buying |
| HIGH trust + LOW interest | Friendly but not interested | Rapport exists, need to find need |
| HIGH readiness + LOW trust | "¿Tiene garantía?" (repeatedly) | Ready but worried about risk |

**The system MUST NOT resolve contradictions by averaging.** Each dimension must be tracked independently.

---

## 4. State Update Rules

### 4.1 From Evidence to State

```
For each state dimension:
  1. Collect all evidence of that type (with time decay applied)
  2. Compute weighted average: state = Σ(evidence.weight * evidence.confidence) / Σ(evidence.confidence)
  3. Clamp to [0.0, 1.0]
  4. Apply momentum: state = 0.7 * new_state + 0.3 * previous_state
     (prevents wild swings from single messages)
```

### 4.2 Momentum

The 0.7/0.3 split means:
- 70% weight on new evidence (responsive)
- 30% weight on previous state (stable)

This prevents a single "no me interesa" from dropping interest from 0.9 to 0.0 instantly. The state transitions gradually.

### 4.3 Reset Rules

| Event | Effect |
|-------|--------|
| New conversation (no previous state) | All dimensions start at 0.5 (neutral) |
| Conversation resumed after > 7 days | Apply 50% decay to all dimensions |
| Customer explicitly says "no estoy interesado" | interest drops by 0.3, other dimensions unchanged |
| Customer explicitly says "quiero comprarlo" | readiness jumps to 0.8+, interest confirmed |
| Customer shares personal data (address, phone) | trust increases by 0.2, readiness increases by 0.1 |
| MIA closes and customer accepts | All dimensions → 1.0 (sale complete) |
| MIA closes and customer declines | readiness drops by 0.3, trust drops by 0.1 |

---

## 5. Storage

### 5.1 Where State Lives

In `customers.memory` JSONB column:

```json
{
  "evidence": {
    "items": [...],           // last 50 evidence items
    "state": {
      "interest": 0.7,
      "trust": 0.5,
      "readiness": 0.3,
      "clarity": 0.8,
      "engagement": 0.6,
      "updated_at": "2026-08-25T10:30:00Z"
    }
  }
}
```

### 5.2 Why Not a Separate Table?

- No migration needed (extends existing JSONB)
- Consistent with current architecture
- State is per-customer, not per-conversation
- JSONB queries are sufficient for this use case
- Can migrate to a dedicated table later if needed

### 5.3 Query Pattern

```sql
-- Get customer state
SELECT memory->'evidence'->'state' AS customer_state
FROM customers
WHERE id = $1;

-- Update customer state
UPDATE customers
SET memory = jsonb_set(
  memory,
  '{evidence,state}',
  $2::jsonb
)
WHERE id = $1;
```

---

## 6. State Injection into Prompt

### 6.1 Format

The state is injected into the system prompt as a structured section:

```
## Estado del Cliente

Dimensiones de estado (0.0 = mínimo, 1.0 = máximo):
- Interés: 0.7 (alto)
- Confianza: 0.5 (media)
- Disposición: 0.3 (baja)
- Claridad: 0.8 (alta)
- Compromiso: 0.6 (medio-alto)

Interpretación: El cliente está interesado e informado, pero tiene confianza media y baja disposición a comprar. No está listo para cerrar.

Acción sugerida: Continuar explorando, responder preguntas, construir confianza. NO solicitar datos personales ni intentar cerrar.

Señales recientes:
- Preguntó sobre precio (interés)
- No ha preguntado sobre envío/pago (baja disposición)
- Compartió su nombre (confianza creciente)
```

### 6.2 Why This Format?

- **Structured**: The LLM can easily parse the dimensions
- **Interpretive**: Provides a human-readable interpretation
- **Action-oriented**: Suggests what to do (not what NOT to do)
- **Evidence-linked**: Shows what signals produced the state

### 6.3 Prompt Placement

The state section is placed **after the identity/objective section** and **before the products/rules section**. This ensures the LLM reads the state context before encountering sales content.

---

## 7. Relationship to Existing Systems

| Existing System | Relationship to State Model |
|----------------|---------------------------|
| `customers.status` | **Superset** — state model provides richer information. Keep `status` for backward compatibility, derive it from state. |
| `customers.memory` | **Extension** — state is stored within the existing JSONB memory structure |
| `conversation.outcome` | **Complementary** — outcome is per-conversation, state is per-customer |
| `sales_events` | **Input** — events provide evidence that updates state |
| `business_memory` | **Separate** — business-level patterns don't affect individual customer state |
| `experience_memory` | **Separate** — global patterns inform expectations, not individual state |

### 7.1 Backward Compatibility

The existing `customers.status` enum can be derived from the state model:

```
IF state.interest > 0.7 AND state.readiness > 0.7:
  status = 'converted' (after sale)
ELIF state.interest > 0.5:
  status = 'interested'
ELIF state.interest < 0.2 AND state.engagement < 0.2:
  status = 'lost'
ELSE:
  status = 'contacted'
```

This maintains compatibility while providing richer information.

---

## 8. Rejection Criteria

The state model is rejected if:

1. 5 dimensions are too many to maintain consistently
2. The LLM cannot reliably interpret the state from the prompt
3. State calculations create latency (> 50ms additional)
4. The state doesn't correlate with conversation outcomes
5. Customers behave the same regardless of state injection

### 8.1 Fallback

If the 5-dimension model is too complex, fall back to **3 dimensions**:

| Dimension | Combines |
|-----------|----------|
| `interest_readiness` | interest + readiness (both measure "wanting to buy") |
| `trust_clarity` | trust + clarity (both measure "comfort with the offer") |
| `engagement` | unchanged |

This is less nuanced but simpler to implement and test.
