# Architecture Options

**Status**: COMPLETE
**Date**: 2026-08-25
**Parent**: MIA_EVIDENCE_REASONING_RESEARCH.md

---

## 1. Options Evaluated

### Option A: Full Evidence Accumulation as Core Primitive

**Description**: Implement a complete evidence accumulation system with formal evidence objects, state computation, hypothesis management, and action selection.

**Components**:
- Evidence extractor (LLM-based, every message)
- Evidence accumulator (weighted, time-decayed)
- State synthesizer (5 dimensions)
- Hypothesis manager (competing hypotheses)
- Action selector (state-aware, with guardrails)
- Outcome feedback loop

**Pros**:
- Complete solution to the push problem
- Rich reasoning capabilities
- Full auditability
- Supports future ML enhancements

**Cons**:
- ~500 lines of new code
- New data structures in memory
- More complex to debug
- May be over-engineered for current needs

**Estimated effort**: 2-3 days
**Risk**: Medium (new subsystem, even if thin)

---

### Option B: Simplified Prompt-Enrichment Layer (RECOMMENDED)

**Description**: Add a thin layer that extracts evidence from customer messages, computes state dimensions, and injects the state into the system prompt with action guidance.

**Components**:
- Evidence extractor (LLM-based, every message)
- State accumulator (simple weighted average + momentum)
- Prompt enricher (adds state section to system prompt)
- Push prevention rules (in prompt, not code)

**Pros**:
- ~350 lines of new code
- Consistent with existing architecture (LLM-driven)
- Immediately testable
- Low risk — can be reverted easily
- Uses existing storage (customers.memory JSONB)

**Cons**:
- Less rigorous than Option A
- No formal hypothesis management
- Action selection is still LLM-driven (not code-enforced)
- Push prevention relies on prompt instructions, not hard guardrails

**Estimated effort**: 1-2 days
**Risk**: Low (thin layer on existing architecture)

---

### Option C: Experimental Isolation

**Description**: Build the evidence model in a separate experimental module. Run it alongside the existing system but don't use its output for real conversations. Evaluate results before integrating.

**Components**:
- Evidence extractor (runs in parallel, output stored separately)
- State accumulator (computes state, stores in separate table)
- Analysis dashboard (visualize state over time)
- No prompt changes (existing behavior unchanged)

**Pros**:
- Zero risk to production behavior
- Can evaluate the model before committing
- Rich analysis capabilities

**Cons**:
- Delayed benefit — production behavior unchanged
- Requires separate infrastructure
- May never integrate (analysis paralysis)
- Doubles the evidence extraction cost

**Estimated effort**: 2-3 days
**Risk**: Very low (but also very low immediate value)

---

### Option D: Reject the Model

**Description**: The current architecture is sufficient. The LLM can handle conversational sales with better prompt engineering alone.

**Changes**:
- Refine the system prompt (clearer instructions, better examples)
- Add more specific closing rules
- Improve customer memory extraction

**Pros**:
- No new code
- Immediate implementation
- Low risk

**Cons**:
- Doesn't solve the fundamental problem (no state awareness)
- Prompt-only solutions are fragile
- Cannot prevent systematic push behavior
- No auditability of action selection

**Estimated effort**: 0.5 days
**Risk**: Low (but unlikely to solve the problem)

---

## 2. Comparison Matrix

| Criterion | Option A | Option B | Option C | Option D |
|-----------|----------|----------|----------|----------|
| Solves push problem | Yes (fully) | Yes (mostly) | No (delayed) | No |
| Implementation effort | High (2-3d) | Medium (1-2d) | High (2-3d) | Low (0.5d) |
| Risk | Medium | Low | Very Low | Low |
| Auditability | High | Medium | High | Low |
| Testability | Medium | High | High | Low |
| Future extensibility | High | Medium | High | Low |
| Consistency with existing arch | Medium | High | Low | High |
| Immediate value | Medium | High | Low | Low |

---

## 3. Recommendation

**Option B: Simplified Prompt-Enrichment Layer**

### Rationale

1. **MIA already has 70% of the infrastructure** — sales events, customer memory, confidence decay, experience memory. Option B builds on this.

2. **The LLM is the reasoning engine** — we don't need to replace it with code. We just need to give it better input.

3. **350 lines is low risk** — this is not a new subsystem, it's a thin translation layer.

4. **Immediately testable** — we can A/B test the prompt changes with real conversations.

5. **Reversible** — if it doesn't work, we can remove the state injection and restore the previous behavior.

6. **Extensible** — if Option B works, we can evolve toward Option A by adding formal hypothesis management and code-level guardrails.

### Why Not Option A?

Option A is the "complete" solution, but:
- It's over-engineered for the current problem
- The LLM can handle probabilistic reasoning natively
- We don't need formal hypothesis objects — the LLM reasons about competing explanations naturally
- Code-level guardrails (push detection) can be added later as a refinement

### Why Not Option C?

Option C delays the benefit without reducing risk:
- The evidence extraction cost is the same whether we use the output or not
- Analysis without action is wasteful
- We can evaluate Option B in production (with A/B testing) without a separate experimental phase

### Why Not Option D?

Option D doesn't solve the problem:
- Prompt-only solutions are fragile and hard to audit
- We can't prevent push behavior without state awareness
- The current architecture already has the best prompt engineering we can do — the problem is structural, not instructional

---

## 4. Implementation Plan (Option B)

### Phase 1: Evidence Extraction (Day 1)

1. Define evidence types and extraction prompt
2. Implement `extractEvidence()` in `src/lib/reasoning/evidence.ts`
3. Integrate into `processIncomingMessage()` pipeline
4. Store evidence in `customers.memory.evidence.items`

### Phase 2: State Computation (Day 1-2)

1. Implement `computeState()` in `src/lib/reasoning/state.ts`
2. Implement time decay and momentum
3. Store state in `customers.memory.evidence.state`
4. Add state derivation for `customers.status` backward compatibility

### Phase 3: Prompt Enrichment (Day 2)

1. Implement `enrichPromptWithState()` in `src/lib/reasoning/prompt-enricher.ts`
2. Add state section to `buildMasterPrompt()`
3. Add action guidance based on state
4. Modify objective from "sell naturally" to "help the customer decide"

### Phase 4: Testing (Day 2-3)

1. Unit tests for evidence extraction
2. Unit tests for state computation
3. Integration test: full message pipeline with state
4. A/B test: compare conversion rates with/without state injection

### Phase 5: Guardrails (Day 3, optional)

1. Add push detection (consecutive close attempts)
2. Add action type annotation
3. Add evidence threshold for closing
4. Add configurable state thresholds per business

---

## 5. Success Criteria

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Push behavior reduced | < 5% premature closes | Manual review of close attempts |
| Conversion rate maintained | ±5% of current | A/B test |
| Customer satisfaction improved | > 4.0/5.0 | Post-conversation survey |
| State accuracy | > 70% agreement with human labeler | Manual labeling sample |
| Latency added | < 100ms per message | Performance monitoring |

---

## 6. Rollback Plan

If Option B doesn't work:

1. Remove state injection from `buildMasterPrompt()`
2. Remove evidence extraction from `processIncomingMessage()`
3. Restore original prompt objective
4. Keep evidence data in `customers.memory` for future use

Total rollback: ~50 lines of code changes. Fully reversible.
