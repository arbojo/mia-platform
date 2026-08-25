# Contradiction Register

**Status**: COMPLETE
**Date**: 2026-08-25
**Parent**: MIA_EVIDENCE_REASONING_RESEARCH.md

---

## 1. Contradictions Found During Research

### 1.1 "Sell Naturally" vs "Help the Customer Decide"

**Contradiction**: The current prompt says "Vender con naturalidad" (sell naturally), but the research proposes "Help the customer make a good decision."

**Resolution**: These are not contradictory — they are different levels of abstraction. "Sell naturally" is a战术 (tactical) instruction. "Help the customer decide" is a战略 (strategic) objective. The strategic objective subsumes the tactical one: if you help the customer make a good decision, and the product is right for them, a natural sale follows.

**Action**: Change the prompt objective to the strategic level. Remove the tactical "sell naturally" instruction.

---

### 1.2 Personality-Driven vs State-Driven Closing

**Contradiction**: The current system uses `sales_aggressiveness` (personality) to determine closing style. The research proposes state-driven closing (based on customer readiness).

**Resolution**: These can coexist. Personality determines the STYLE of closing (how aggressive), while state determines the TIMING of closing (when to attempt). A high-aggressiveness personality with state-aware timing would close more aggressively WHEN the customer is ready, but would NOT close when the customer is not ready.

**Action**: Keep personality for style, add state for timing. They are orthogonal dimensions.

---

### 1.3 LLM-Driven vs Code-Enforced Behavior

**Contradiction**: The research proposes both LLM-driven reasoning (the LLM interprets state and chooses actions) AND code-enforced guardrails (push detection, closing gates). These seem to conflict: if the LLM decides, why do we need code guardrails?

**Resolution**: The LLM handles the nuanced reasoning (what to say, how to say it). Code handles the hard constraints (don't close when readiness < 0.5, don't push on consecutive turns). This is consistent with MIA's existing architecture: the LLM generates text, code intercepts specific actions (cancellation, sale detection).

**Action**: Implement both layers. LLM for reasoning, code for guardrails.

---

### 1.4 Evidence Extraction Cost vs Benefit

**Contradiction**: LLM-based evidence extraction adds ~1 API call per message (cost + latency). Is this worth it?

**Resolution**: The existing `detectSaleOutcome()` already makes an LLM call per message (after sales trigger detection). The evidence extractor can reuse the same call or use a cheaper model (Groq). The cost is marginal compared to the benefit of state-aware behavior.

**Action**: Use the cheapest available model for evidence extraction (Groq, as existing `taskType: 'detection'` does).

---

### 1.5 Customer Memory Redundancy

**Contradiction**: The evidence model proposes storing evidence in `customers.memory.evidence.items`, but `customers.memory` already has `interests`, `objections`, `questions`, `preferences`. Isn't this redundant?

**Resolution**: The existing fields are keyword-extracted and static. The evidence model is LLM-extracted and dynamic (with time decay). They serve different purposes:
- Existing fields: Simple keyword summary for the prompt
- Evidence items: Rich, time-decayed signals for state computation

**Action**: Keep both. Existing fields for backward compatibility, evidence items for state computation.

---

### 1.6 Global Patterns as Priors vs Individual Evidence

**Contradiction**: The research says global patterns should inform expectations, not become facts. But if a pattern has 90% correlation with purchase, isn't it reasonable to treat it as strong evidence?

**Resolution**: A 90% correlation means 90% of customers who follow this pattern purchase. It does NOT mean this specific customer will purchase. The pattern is a prior, not a posterior. Individual evidence can override the prior.

**Action**: In the prompt, explicitly instruct the LLM to prioritize individual evidence over global patterns.

---

### 1.7 Multi-Dimensional State vs Simplicity

**Contradiction**: The research proposes 5 state dimensions (interest, trust, readiness, clarity, engagement). But the "complexity challenge" says to prefer the simplest model. Isn't 5 dimensions too many?

**Resolution**: 5 dimensions is the MINIMUM useful model. Each dimension is independently measurable and action-relevant. Fewer dimensions would lose important distinctions (e.g., HIGH interest + LOW trust). The complexity is in the CONCEPT, not the implementation (5 numbers is simple).

**Action**: Start with 5 dimensions. If testing shows some are redundant, reduce to 3.

---

### 1.8 Post-Response Detection vs Pre-Response Awareness

**Contradiction**: The research proposes state-aware action selection (pre-response), but the existing `processSaleClosing()` runs post-response. These seem to conflict.

**Resolution**: They are complementary. Post-response detection identifies what HAPPENED (sale events, outcomes). Pre-response state awareness identifies what the customer NEEDS (next action). Both are useful.

**Action**: Keep post-response detection for event emission. Add pre-response state for action selection.

---

## 2. Unresolved Questions

| Question | Status | Impact |
|----------|--------|--------|
| Should state be per-conversation or per-customer? | Per-customer (decided) | Medium — affects storage |
| Should the evidence extractor use LLM or keywords? | LLM (decided) | Low — existing pattern |
| How many state dimensions are optimal? | 5 (decided, with fallback to 3) | Medium — affects complexity |
| Should push detection be code or prompt? | Both (decided) | Low — complementary |
| Should global patterns be stored in business_memory or a separate table? | business_memory (decided) | Low — consistent with existing |
| How should state thresholds be configured per business? | Via business_sales_config (decided) | Low — extends existing |

---

## 3. Contradictions Not Resolved

| Contradiction | Why Not Resolved | Impact |
|--------------|-----------------|--------|
| LLM cost vs evidence richness | Depends on actual cost in production | Low — can adjust extraction frequency |
| State accuracy vs extraction speed | Depends on model choice | Low — can use different models |
| Push prevention vs conversion rate | Requires A/B testing | Medium — key metric |

---

## 4. Conclusion

All major contradictions are resolved through architectural layering:
- LLM for nuanced reasoning, code for hard constraints
- Global patterns for priors, individual evidence for facts
- Personality for style, state for timing
- Existing fields for backward compatibility, evidence items for state computation

No fundamental contradictions remain that would prevent implementation.
