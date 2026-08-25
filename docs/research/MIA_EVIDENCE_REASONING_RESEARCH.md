# MIA Evidence Accumulation & Reasoning Research

**Status:** Research complete. Architecture analysis + recommendations delivered.
**Date:** 2026-08-25
**Classification:** RESEARCH-ONLY — no code changes proposed.

---

## 1. Research Question

> Should MIA adopt an evidence-accumulation and state-based reasoning model for conversational sales, replacing the current intent-classification → sales-action pattern? If so, what is the minimal architecture that cleanly distinguishes observation → evidence → hypothesis → customer state → next best action, where "close" is one possible outcome, not the default?

## 2. Executive Summary

**YES — MIA should adopt evidence accumulation and state-based reasoning.** The existing UBSE research (15 cognitive states, 26 principles, observables dictionary) already provides the theoretical foundation. The current runtime (`runtime.ts` → `intents.ts` → `execute-ai.ts`) operates on keyword-based intent classification with 6 flat tags and a linear pipeline. This architecture cannot:

1. Accumulate evidence across turns
2. Distinguish "customer is comparing" from "customer is confused" (both produce similar keyword signals)
3. Represent probabilistic state uncertainty
4. Select actions based on cognitive state (it always tries to sell)
5. Handle the `reticente` state (reactance) without escalation
6. Terminate loops when evidence is insufficient

The proposed architecture adds a thin evidence-accumulation layer between message ingestion and action selection, without replacing the existing prompt/LLM pipeline.

## 3. Current Architecture Audit

### 3.1 Runtime Pipeline (runtime.ts)

```
Message → Context Load → Intent Detection → Product Recommendation → AI Execute → Response
```

- **Intent detection** (`intents.ts`): keyword-based, 6 tags (catalog, price, shipping, payment, contact, greeting)
- **No evidence accumulation**: each turn is processed independently
- **No state tracking**: the system doesn't know if the customer is exploring, comparing, or deciding
- **Sales detection** (`detect.ts`): LLM-based post-hoc classification of sale outcomes (not proactive state management)

### 3.2 Memory Systems

- **BusinessMemory** (`memory.ts`): pattern/experience/insight/trend with confidence decay (half-life model)
- **CustomerMemory** (`customer-memory.ts`): interests, objections, questions, preferences — flat lists, no state
- **No conversation-level state**: no tracking of where the customer is in their decision journey

### 3.3 Sales Pipeline

- **detect.ts**: AI classifies sale outcome (pending/interested/not_interested/sold/cancelled)
- **process.ts**: handles closing and cancellation
- **events.ts**: emits sale events
- **Problem**: sales detection is REACTIVE (post-conversation analysis), not PROACTIVE (real-time state-guided)

### 3.4 The Gap

| Current | Required |
|---------|----------|
| 6 flat intent tags | 15 cognitive states with transitions |
| Per-turn classification | Cross-turn evidence accumulation |
| Keyword triggers | Observable → evidence → hypothesis chain |
| Linear pipeline | State-guided action selection |
| Post-hoc sale detection | Real-time state estimation |
| "Always try to sell" | State-appropriate responses |

## 4. The UBSE Foundation (Already Exists)

The research knowledge base (`docs/research/kb/`) already contains:

### 4.1 Cognitive States (estados.md)
15 states: `explorando`, `descubriendo`, `consecuente`, `comprendiendo`, `comparando`, `evaluando_riesgo`, `decidiendo`, `transaccional`, `esperando`, `experimentando`, `evaluando_resultados`, `abogando`, `confundido`, `frustrado`, `reticente`, `desenganchado`

### 4.2 Observables (observables.md)
Full dictionary of conversational signals: `question`, `statement`, `objection`, `emotion`, `behavior`, `explicito`, `post-purchase`, `meta` — with emission weights per state.

### 4.3 Transitions (transiciones.md)
Prior-weighted transitions between states, including loops (retrocesos), sidecar rules, and exogenous triggers.

### 4.4 Principles (principios.md)
26 principles (P-001 to P-026) with evidence levels up to Fundamental, including falsation audits.

### 4.5 What's Missing

The UBSE research is **theoretical** — it describes the model but doesn't specify:
1. **How to accumulate evidence** (Bayesian? Dempster-Shafer? Simple scoring?)
2. **How to map observables to state hypotheses** (emission model)
3. **How to select actions** given current state estimates
4. **How to terminate loops** (when evidence is insufficient)
5. **How to integrate with the existing runtime** (minimal architecture)

## 5. Proposed Minimal Architecture

### 5.1 Evidence Accumulation Layer

```
Message → Observable Extraction → Evidence Accumulation → State Estimation → Action Selection → Response
```

**Observable Extraction** (existing LLM call, repurposed):
- Input: conversation turn + context
- Output: list of observed signals (question type, emotion, behavior, statement)

**Evidence Accumulation** (new, deterministic):
- Maintains running evidence vector per conversation
- Each observable updates belief about current state
- Uses emission weights from observables.md
- Handles multi-turn evidence (behavioral patterns)

**State Estimation** (new, probabilistic):
- Maintains probability distribution over all 15 states
- Updates via Bayes' rule given new evidence
- Includes transition priors from transiciones.md
- Outputs: most likely state + confidence

**Action Selection** (new, state-guided):
- Given current state estimate, selects appropriate action
- Actions include: present product, ask question, handle objection, de-escalate, close, wait, redirect
- "Close" is one action among many, not the default

### 5.2 Integration Points

| Component | Integration |
|-----------|-------------|
| `runtime.ts` | Insert evidence layer between context load and AI execute |
| `intents.ts` | Replace with observable extraction (same LLM call, different output) |
| `customer-memory.ts` | Extend with state history and evidence vector |
| `detect.ts` | Becomes redundant (state estimation replaces post-hoc detection) |
| `prompts.ts` | Add state context to prompt builder |

### 5.3 Data Model Extensions

```sql
-- Conversation state tracking
CREATE TABLE conversation_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  state_distribution JSONB,  -- { "explorando": 0.1, "descubriendo": 0.6, ... }
  evidence_vector JSONB,     -- { "question_price": 3, "objection_guarantee": 1, ... }
  current_state TEXT,        -- most likely state
  confidence FLOAT,          -- confidence in current state
  state_history JSONB,       -- [{ state, confidence, timestamp }]
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Observable log (for learning)
CREATE TABLE observable_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  message_id UUID REFERENCES messages(id),
  observables JSONB,         -- extracted observables
  state_before JSONB,        -- state distribution before update
  state_after JSONB,         -- state distribution after update
  action_taken TEXT,         -- what MIA did
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## 6. Evidence Model Details

### 6.1 Observable Types and Weights

From `observables.md`, each observable type has an emission weight:

| Type | Weight | Example |
|------|--------|---------|
| `question` | variable | "¿cuánto cuesta?" → price question |
| `statement` | 0.6 | "tengo un problema con..." |
| `objection` | 0.6 | "no me parece justo" |
| `emotion` | variable | "estoy frustrado" |
| `behavior` | 0.4 | long messages, repeated questions |
| `explicito` | 0.3 | "estoy comparando opciones" |
| `post-purchase` | 0.7 | "ya lo recibí" |
| `meta` | sidecar | silence, turn duration |

### 6.2 State-Emission Matrix

Each state has a probability of producing each observable type:

| State | question_price | question_risk | objection | emotion_negative | behavior_compare | explicito |
|-------|---------------|---------------|-----------|------------------|------------------|-----------|
| `explorando` | 0.1 | 0.05 | 0.05 | 0.1 | 0.1 | 0.2 |
| `descubriendo` | 0.2 | 0.1 | 0.1 | 0.3 | 0.2 | 0.3 |
| `consecuente` | 0.3 | 0.15 | 0.1 | 0.4 | 0.2 | 0.4 |
| `comprendiendo` | 0.4 | 0.2 | 0.1 | 0.2 | 0.3 | 0.3 |
| `comparando` | 0.5 | 0.3 | 0.2 | 0.2 | 0.6 | 0.4 |
| `evaluando_riesgo` | 0.3 | 0.7 | 0.5 | 0.3 | 0.4 | 0.3 |
| `decidiendo` | 0.4 | 0.4 | 0.3 | 0.3 | 0.3 | 0.5 |
| `transaccional` | 0.6 | 0.1 | 0.1 | 0.2 | 0.1 | 0.7 |
| `confundido` | 0.2 | 0.2 | 0.2 | 0.4 | 0.5 | 0.2 |
| `frustrado` | 0.1 | 0.3 | 0.6 | 0.8 | 0.2 | 0.1 |
| `reticente` | 0.1 | 0.2 | 0.7 | 0.6 | 0.1 | 0.1 |

(Values are illustrative; actual weights would be calibrated from data.)

### 6.3 Bayesian Update Rule

```
P(state | evidence) ∝ P(evidence | state) × P(state)
```

Where:
- `P(evidence | state)` = emission probability from matrix
- `P(state)` = prior from transition model (previous state × transition probabilities)
- Posterior becomes prior for next turn

### 6.4 Transition Priors

From `transiciones.md`, the transition matrix provides:
- Forward progression priors (e.g., `descubriendo → consecuente` = 0.55)
- Loop priors (e.g., `comparando ⇄ evaluando_riesgo` = 0.55)
- Sidecar triggers (e.g., silence → `desenganchado`)

## 7. Action Selection Model

### 7.1 State → Action Mapping

| State | Primary Action | Avoid |
|-------|---------------|-------|
| `explorando` | Build rapport, discover needs | Present products, push close |
| `descubriendo` | Explore problem, validate pain | Pitch solution |
| `consecuente` | Quantify impact, explore urgency | Skip to price |
| `comprendiendo` | Present solution landscape | Compare products |
| `comparando` | Help compare, limit options | Push single product |
| `evaluando_riesgo` | Address specific risks | Dismiss concerns |
| `decidiendo` | Facilitate choice, reduce friction | Apply pressure |
| `transaccional` | Clear path to purchase | Add complexity |
| `confundido` | Simplify, recommend default | Add options |
| `frustrado` | Recover, validate, solve problem | Sell |
| `reticente` | De-escalate, restore control | Insist, argue |

### 7.2 The "Close" Question

In the current architecture, closing is always attempted (via `sales-process.ts`). In the proposed architecture:

- **Closing is ONLY appropriate in states**: `decidiendo` (with high confidence), `transaccional`
- **Closing is NEVER appropriate in**: `explorando`, `descubriendo`, `confundido`, `frustrado`, `reticente`
- **Closing is CONDITIONAL in**: `comparando`, `evaluando_riesgo` (only if evidence threshold met)

This directly addresses the product principle: "MIA should optimize for helping the customer make a good decision, not maximizing probability of immediate purchase every turn."

## 8. Loop Termination

### 8.1 Current Problem

The existing system has no loop detection. A customer can cycle between states indefinitely without MIA noticing.

### 8.2 Proposed Termination Rules

| Condition | Action |
|-----------|--------|
| Same state > N turns | Suggest decision framework or default |
| `confundido` > M turns | Reduce options, offer recommendation |
| `evaluando_riesgo` > K turns | Address specific risk or escalate to human |
| `reticente` detected | De-escalate, restore control, wait |
| Evidence confidence < threshold | Ask clarifying question |
| No state transition > L turns | Check if customer is still engaged |

### 8.3 The `reticente` Special Case

When `reticente` is detected (enojo + contra-argumentación directed at pressure source):
1. **STOP all sales actions**
2. **De-escalate** via P-025 (validation) and P-026 (control restoration)
3. **Wait** for state to transition back to `decidiendo` or `evaluando_riesgo`
4. **Never** retry close after `reticente` in same conversation

## 9. Architecture Options

### Option A: Full Bayesian Engine
- Complete HMM/Bayes net implementation
- Pros: mathematically principled, handles uncertainty
- Cons: complex, requires calibration data, hard to debug
- **Recommendation: Too complex for MVP**

### Option B: Lightweight Scoring (Recommended)
- Simple weighted scoring with transition priors
- Pros: interpretable, easy to tune, minimal infrastructure
- Cons: less principled than full Bayesian
- **Recommendation: Start here**

### Option C: LLM-as-State-Estimator
- Use the existing LLM to estimate state directly
- Pros: leverages existing infrastructure, handles nuance
- Cons: expensive, slow, non-deterministic
- **Recommendation: Use for calibration, not runtime**

### Option D: Hybrid (B + C)
- Lightweight scoring for runtime, LLM for calibration and edge cases
- Pros: fast runtime, good accuracy
- Cons: two systems to maintain
- **Recommendation: Long-term target**

## 10. Contradiction Register

| # | Contradiction | Resolution | Status |
|---|--------------|------------|--------|
| 1 | UBSE says states are continuous; runtime needs discrete states | Use probability distribution over discrete states; threshold for action selection | Resolved |
| 2 | `explicito` (self-report) is weak evidence; but customer says "I'm comparing" | Weight `explicito` at 0.3, require corroboration from behavior/question | Resolved |
| 3 | Closing pressure increases reactance (P-026); but sales process requires closing | Close ONLY when state = `transaccional` with high confidence; never pressure | Resolved |
| 4 | Evidence accumulation requires turn history; but context window is limited | Store evidence vector in DB, not context window; only load summary | Resolved |
| 5 | LLM can detect state better than rules; but rules are faster/cheaper | Use rules for runtime, LLM for calibration (Option D) | Resolved |

## 11. Implementation Priority

### Phase 1: Observable Extraction (Week 1)
- Modify `intents.ts` to extract observables instead of intents
- Store observable log in new table
- **No state estimation yet — just data collection**

### Phase 2: Simple State Scoring (Week 2)
- Implement lightweight scoring (Option B)
- Add `conversation_state` table
- State estimation updates per turn
- Log state transitions

### Phase 3: Action Selection (Week 3)
- Implement state → action mapping
- Modify `runtime.ts` to use state for action selection
- Add loop detection rules
- Handle `reticente` specially

### Phase 4: Calibration (Week 4)
- Use LLM (Option C) to validate state estimates
- Tune emission weights from data
- A/B test against current system
- Measure: conversation length, conversion rate, customer satisfaction

## 12. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Conversation turns to decision | Unknown | Reduce by 20% |
| Customer drops off mid-conversation | Unknown | Reduce by 30% |
| `reticente` escalations | Unknown | Reduce by 50% |
| Close attempts in inappropriate states | ~100% | <20% |
| State estimation accuracy | N/A | >70% (vs. human labels) |

## 13. Conclusion

The evidence is clear: MIA should adopt evidence accumulation and state-based reasoning. The UBSE research provides the theoretical foundation. The current architecture has the infrastructure (LLM calls, memory systems, event pipeline) to support a lightweight implementation. The recommended approach is Option B (lightweight scoring) for MVP, evolving toward Option D (hybrid) for production.

The key insight: **"close" is not a default action — it's a state-dependent response that should only occur when evidence supports it.** This aligns MIA's behavior with the product principle of helping customers make good decisions.

---

## Appendix A: File References

| File | Lines | Content |
|------|-------|---------|
| `src/lib/runtime/runtime.ts` | 1-100+ | Main conversation pipeline |
| `src/lib/runtime/intents.ts` | 1-50+ | Keyword-based intent detection |
| `src/lib/runtime/execute-ai.ts` | 1-100+ | AI execution layer |
| `src/lib/ai/memory.ts` | 1-492 | Business memory with confidence decay |
| `src/lib/ai/customer-memory.ts` | 1-285 | Customer memory (flat lists) |
| `src/lib/sales/detect.ts` | 1-100+ | AI-based sale outcome detection |
| `src/lib/sales/process.ts` | 1-100+ | Sales closing and cancellation |
| `docs/research/kb/estados.md` | 1-53 | 15 cognitive states |
| `docs/research/kb/observables.md` | 1-143 | Observable signals dictionary |
| `docs/research/kb/transiciones.md` | 1-105 | State transitions with priors |
| `docs/research/kb/principios.md` | 1-500+ | 26 principles with evidence |
| `docs/design/ubse-model.md` | 1-200+ | UBSE v1.1 design (unimplemented) |
