# Evidence Model

**Status**: COMPLETE
**Date**: 2026-08-25
**Parent**: MIA_EVIDENCE_REASONING_RESEARCH.md

---

## 1. Definitions

### 1.1 Observation

A **raw signal** extracted from a single customer message or action. Observations are atomic — they represent what happened, not what it means.

```
Observation {
  id: string                    // unique identifier
  message_id: string            // source message (provenance)
  conversation_id: string       // which conversation
  customer_id: string           // which customer
  timestamp: Date               // when observed
  raw_text: string              // the original customer message
  signals: Signal[]             // extracted signals
}

Signal {
  type: string                  // what kind of signal
  value: any                    // the signal value
  confidence: number (0-1)      // how confident in this extraction
}
```

### 1.2 Signal Types

| Signal Type | Description | Example |
|-------------|-------------|---------|
| `question` | Customer asked a question | "¿Cuánto cuesta?" |
| `statement` | Customer made a statement | "Me gusta el producto" |
| `objection` | Customer raised a concern | "Es muy caro" |
| `request` | Customer wants something | "¿Me lo puedes enviar?" |
| `confirmation` | Customer agreed to something | "Sí, estoy de acuerdo" |
| `rejection` | Customer declined something | "No, gracias" |
| `emotion` | Customer expressed emotion | "¡Excelente!" |
| `silence` | Customer didn't respond (timeout) | (no message) |
| `return` | Customer came back after absence | (new conversation after gap) |
| `data_share` | Customer provided personal data | "Mi nombre es Juan" |

### 1.3 Evidence

**Evidence** is an observation classified by type with weight and provenance. Evidence is what we use to reason about the customer's state.

```
Evidence {
  id: string                    // unique identifier
  observation_id: string        // source observation (provenance)
  message_id: string            // source message (provenance)
  type: EvidenceType            // classification
  weight: number (0-1)          // signal strength
  confidence: number (0-1)      // how certain about this classification
  timestamp: Date               // when observed
  decay_rate: number            // how fast this loses relevance
  metadata: object              // additional context
}
```

### 1.4 Evidence Types

| Evidence Type | What It Measures | Weight Source |
|---------------|-----------------|---------------|
| `interest` | Customer wants to learn about/buy the product | Questions about product, positive statements |
| `trust` | Customer is comfortable with MIA/the business | Open sharing, responsiveness, no hesitation |
| `readiness` | Customer is close to making a decision | Payment questions, delivery questions, address sharing |
| `clarity` | Customer understands the product/offering | Specific vs. vague questions, fewer clarifications |
| `engagement` | Quality and depth of conversation | Response length, question quality, turn frequency |
| `hesitation` | Customer is uncertain or reluctant | Pauses, vague responses, topic changes |
| `price_sensitivity` | Customer is concerned about cost | Price questions, comparison requests, "caro" mentions |
| `urgency` | Customer needs this soon | Time-related questions, "urgente", "ya" |
| `confusion` | Customer doesn't understand | Multiple clarifications, "no entiendo", vague questions |
| `objection` | Customer raised a specific concern | Direct objections, "pero...", "sin embargo..." |

---

## 2. Evidence Properties

### 2.1 Provenance

Every evidence item MUST trace to its source:

- `observation_id` → which observation produced this evidence
- `message_id` → which customer message produced this observation
- `conversation_id` → which conversation
- `customer_id` → which customer
- `timestamp` → when observed

**Why**: Allows auditing, debugging, and understanding why MIA made a particular decision.

### 2.2 Contradiction

Multiple evidence items can coexist even if they contradict:

```
Message 1: "Me interesa el producto" → interest: 0.8
Message 2: "Pero es muy caro" → price_sensitivity: 0.7, interest: 0.5 (reduced)
```

Both evidence items exist. The state synthesis layer resolves contradictions by computing net state.

### 2.3 Time Decay

Evidence loses weight over time:

```
effective_weight = weight * (0.5 ^ (hours_elapsed / half_life))
```

| Evidence Type | Half-Life | Rationale |
|---------------|-----------|-----------|
| `interest` | 72 hours | Interest fades if not nurtured |
| `trust` | 168 hours (7 days) | Trust is more persistent |
| `readiness` | 48 hours | Readiness is time-sensitive |
| `clarity` | 336 hours (14 days) | Knowledge persists |
| `engagement` | 24 hours | Engagement is session-dependent |
| `hesitation` | 48 hours | Hesitation can be resolved |
| `price_sensitivity` | 72 hours | Price concerns are persistent |
| `urgency` | 24 hours | Urgency is time-critical |
| `confusion` | 48 hours | Confusion should be resolved quickly |
| `objection` | 96 hours | Objections need to be addressed |

### 2.4 Repeated Evidence

Same evidence type from multiple messages increases confidence:

```
if (existing_evidence.type === new_evidence.type) {
  confidence = min(1.0, existing.confidence + 0.1)
  weight = max(existing.weight, new.weight)
  timestamp = new.timestamp  // most recent wins
}
```

### 2.5 Independent vs Correlated

- **Independent**: Evidence from different messages is treated independently
- **Correlated**: Evidence from the same message can be linked but remains separate items

Example:
```
Message: "¿Cuánto cuesta y cuánto tarda en llegar?"
→ price_inquiry (independent)
→ delivery_inquiry (independent)
→ Both from same message (correlated — same turn)
```

---

## 3. Evidence Extraction

### 3.1 Extraction Method

Use LLM-based extraction (consistent with existing `detectSaleOutcome` pattern):

```
Input: Last N messages from conversation
Output: Array of Evidence items with type, weight, confidence
```

### 3.2 Extraction Prompt

```
Given the last {n} messages in a sales conversation, extract evidence signals.

For each signal, classify:
- type: interest | trust | readiness | clarity | engagement | hesitation | price_sensitivity | urgency | confusion | objection
- weight: 0.0-1.0 (how strong is this signal?)
- confidence: 0.0-1.0 (how certain are you about this classification?)

Rules:
- Base classification ONLY on what the customer said/did
- Do not infer intent beyond what's stated
- Multiple signals can come from one message
- Contradictory signals are allowed
- Preserve the exact message text as evidence

Return JSON array of evidence items.
```

### 3.3 Extraction Frequency

- **Every customer message**: Extract evidence from the latest message
- **Every 5 messages**: Re-extract from the last 5 messages (batch consistency check)
- **On conversation resume**: Extract from the gap period (what changed?)

### 3.4 Existing Mechanism Integration

The existing `hasSalesTrigger()` and `detectSaleOutcome()` already extract some evidence:

- `hasSalesTrigger()`: Keyword-based purchase intent detection
- `detectSaleOutcome()`: LLM-based outcome classification

The new evidence extractor would run **in parallel** with these, producing richer signal data:

```
Message arrives
  ↓
[Existing] detectIntent() → IntentTag (keyword)
[Existing] hasSalesTrigger() → boolean (keyword)
[NEW] extractEvidence() → Evidence[] (LLM-based)
  ↓
All three feed into the reasoning layer
```

---

## 4. Evidence Accumulation

### 4.1 Accumulation Rules

```
For each new evidence item:
  1. Check if similar evidence exists (same type, same conversation)
  2. If exists: update (boost confidence, keep max weight, update timestamp)
  3. If new: add to evidence list
  4. Apply time decay to ALL existing evidence
  5. Remove evidence below threshold (weight < 0.1)
  6. Cap evidence list (max 50 items per conversation)
```

### 4.2 Storage

Evidence is stored in the existing `customers.memory` JSONB column:

```json
{
  "interests": [...],           // existing
  "objections": [...],          // existing
  "questions": [...],           // existing
  "preferences": [...],         // existing
  "summary": "...",             // existing
  "lastInteraction": "...",     // existing
  "evidence": {                 // NEW
    "items": [...],             // last 50 evidence items
    "state": {                  // synthesized state
      "interest": 0.7,
      "trust": 0.5,
      "readiness": 0.3,
      "clarity": 0.8,
      "engagement": 0.6
    },
    "last_extracted_at": "..."
  }
}
```

### 4.3 Why JSONB?

- No schema migration needed (extends existing `customers.memory`)
- Consistent with current architecture
- Easy to query and update
- PostgreSQL JSONB operators are sufficient for this use case

---

## 5. Evidence vs Existing Mechanisms

| Existing Mechanism | What It Does | Overlaps With Evidence Model? |
|-------------------|-------------|------------------------------|
| `detectIntent()` | Keyword-based intent classification (ephemeral) | Partial — intents map to evidence types |
| `hasSalesTrigger()` | Keyword-based purchase intent detection | Partial — maps to `readiness` evidence |
| `detectSaleOutcome()` | LLM-based outcome classification (post-hoc) | Complementary — provides outcome evidence |
| `customer_memory` | Keyword-extracted interests/objections | Overlaps — evidence model is richer replacement |
| `business_memory` | Aggregated patterns with confidence | Separate — global vs individual |
| `sales_events` | Append-only event ledger | Complementary — events are a type of evidence |
| `outcome_history` | State transition log | Complementary — transitions are evidence of state change |

---

## 6. Rejection Criteria

The evidence model is rejected if:

1. LLM-based extraction is too slow (< 200ms required)
2. Evidence classification is inconsistent across runs
3. Time decay creates instability in state calculations
4. The model adds complexity without measurable improvement in conversation quality
5. The existing keyword-based approach is sufficient (testable via A/B)

---

## 7. Implementation Scope

| Component | Lines (est.) | Complexity |
|-----------|-------------|-----------|
| Evidence type definitions | ~50 | Low |
| Evidence extractor (LLM-based) | ~100 | Medium |
| Evidence accumulator | ~80 | Low |
| State synthesizer | ~60 | Low |
| Prompt enricher | ~40 | Low |
| Storage extension | ~30 | Low |
| **Total** | **~360** | **Low-Medium** |

This is a thin layer, not a new subsystem.
