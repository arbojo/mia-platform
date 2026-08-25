# Council Decision Contract — MIA Evidence Reasoning Architecture

**Decision ID**: DEC-20260825-EVIDENCE-REASONING
**Date**: 2026-08-25
**Status**: DECISION_ACCEPTED
**Parent**: MIA_EVIDENCE_REASONING_RESEARCH.md
**Governance**: COUNCIL_REQUIRED (Complex cross-cutting architecture change)

---

## 1. Verification of Research Claims

### 1.1 The "70% Infrastructure" Claim — OVERSTATED

The research claims MIA already contains ~70% of the required infrastructure. **The Council's independent verification finds this claim overstated.**

| Claimed Mechanism | Exists? | Wired into Hot Path? | Reusable? | Accurate? |
|-------------------|---------|----------------------|-----------|-----------|
| `sales_events` table (14 types) | YES | YES (triggers + metrics) | YES — raw event data is evidence | YES |
| `business_memory` (observation_count, confidence) | YES | YES (prompt injection) | PARTIAL — global, not per-customer | YES |
| `confidence.ts` (exponential decay) | YES | **NO** (not called in retrieval) | YES — formula is sound | Misleading |
| `experience_memory` (conversion_probability) | YES | YES (blending) | REFERENCE — not directly reusable | **Overstated** (Wilson Score not implemented) |
| `customer_memory` (interests, objections) | YES | YES (prompt injection) | PARTIAL — needs redesign for evidence | YES |
| `outcome_history` (transition log) | YES | **NO** (written, never read for state) | YES — transition log is evidence | YES |
| `customers.status` (5-value enum) | YES | **NO** (written at outcome, not by runtime) | PARTIAL — backward compat only | YES |

**Actual reusable infrastructure: ~35-40%, not 70%.**

Key gaps:
- No evidence extraction logic exists in production
- No state computation exists
- No action selection logic beyond the prompt
- `confidence.ts` exists but is not wired into the hot path
- Wilson Score is referenced in schema comments but never implemented

### 1.2 Impact on Recommendation

The overstated claim does **not** invalidate the recommendation (Option B), but it **does** affect the effort estimate. The research estimates ~350 lines / 1-2 days. Given the actual 35-40% reuse (not 70%), a more accurate estimate is:

- **~450-550 lines** of new code
- **2-3 days** of implementation
- Still low risk, still reversible

The Council proceeds with Option B but with the corrected effort estimate.

---

## 2. Deliberation: D1 — Evidence Accumulation

**Question**: Should MIA formally distinguish OBSERVATION → EVIDENCE → ACCUMULATION → CUSTOMER STATE?

**Council Analysis**:

The current architecture has raw data in tables but no synthesis layer. The distinction between observation, evidence, and state is useful because:

1. **Observation** = what the customer said (raw message)
2. **Evidence** = what the message signals (classified by type with weight)
3. **Accumulation** = how evidence builds over time (with decay)
4. **State** = the resulting customer profile (multi-dimensional)

However, the Council finds that a **full four-layer model is unnecessarily formal** for the current need. The LLM can perform the observation→evidence→hypothesis reasoning natively. What's needed is:

- Evidence extraction (observation → evidence): **YES, implement**
- State computation (evidence → state): **YES, implement**
- Formal accumulation layer: **NOT NEEDED** — the LLM handles this via prompt context
- Formal hypothesis objects: **NOT NEEDED** — the LLM reasons about competing explanations naturally

**Decision**: **ACCEPT WITH MODIFICATION**

Implement a **three-layer model** (not four):
1. Evidence extraction (message → evidence items)
2. State computation (evidence → 5-dimensional state)
3. Prompt injection (state → LLM context)

The LLM handles the fourth layer (hypothesis reasoning) natively.

**Rationale**: The LLM is the reasoning engine. We don't need to formalize what the LLM already does well. We just need to give it better input data.

---

## 3. Deliberation: D2 — Customer State

**Question**: Should MIA maintain the proposed five dimensions (interest, trust, readiness, clarity, engagement)?

**Council Analysis**:

The five dimensions are:
- **Independently measurable**: Each has distinct evidence sources
- **Action-relevant**: Each suggests different next actions
- **Observable**: Can be inferred from customer messages
- **Non-redundant**: No dimension is a proxy for another

The Council evaluated whether these are "authoritative state," "inferred state," "temporary reasoning context," or "unnecessary complexity."

**Classification**: These are **inferred state** — computed from evidence, not directly observed. They are NOT authoritative business facts (like `customers.status`) and should NOT be stored in authoritative columns. They ARE useful reasoning context for the LLM.

The Council also evaluated whether any dimensions should be added or removed:

| Dimension | Keep? | Rationale |
|-----------|-------|-----------|
| interest | YES | Core signal — does the customer want this product? |
| trust | YES | Critical for accompanying vs pushing |
| readiness | YES | Directly determines closing appropriateness |
| clarity | YES | Determines if explanation is needed before offering |
| engagement | YES | Determines conversation investment level |
| price_sensitivity | NO | Better as evidence type, not state dimension |
| urgency | NO | Subsumed by readiness |

**Decision**: **ACCEPT** — 5 dimensions as proposed.

**Storage**: Store in `customers.memory` JSONB under `evidence.state`. Do NOT add new columns to the `customers` table. This maintains backward compatibility and avoids schema migration.

**Derivation**: The existing `customers.status` can be derived from the state model for backward compatibility:
- `interest > 0.7 AND readiness > 0.7` → can derive `interested`
- After sale event → `converted`
- After cancellation → `lost`

---

## 4. Deliberation: D3 — Purchase Intent

**Question**: Should "purchase intent" remain a dominant first-class signal?

**Council Analysis**:

The Council explicitly evaluates the principle: "Purchase intent must not become the objective of every conversational turn."

**Current state**: The prompt says "Vender con naturalidad" (sell naturally). The closing policy is driven by `sales_aggressiveness` (personality), not by customer state. There is no mechanism to detect that the customer is NOT ready to buy.

**Council finding**: Purchase intent is currently the **de facto dominant signal** because:
1. The prompt objective is to sell
2. The closing policy is personality-driven, not state-driven
3. There's no "wait" or "explore" action type
4. The LLM defaults to closing because that's the stated objective

**Decision**: **ACCEPT** — Purchase intent must NOT be the dominant signal.

Purchase intent is ONE of five state dimensions. It should influence behavior but not dominate it. The prompt objective should change from "sell naturally" to "help the customer make a good decision."

**Invariant**: `interest + trust + readiness` together determine closing appropriateness, not purchase intent alone.

---

## 5. Deliberation: D4 — Accompany vs Push

**Question**: Should MIA have explicit action types with CLOSE as conditional?

**Council Analysis**:

The 12 proposed action types are:
ANSWER, CLARIFY, EXPLORE, EDUCATE, REASSURE, HANDLE_OBJECTION, WAIT, FOLLOW_UP, OFFER, ADVANCE, CLOSE, ESCALATE

The Council finds:
- These are useful for **prompt guidance** (telling the LLM what action is appropriate)
- They are NOT useful as **code-level action types** (the LLM generates free-form text, not structured actions)
- CLOSE being conditional (not default) is the correct design

**Decision**: **ACCEPT WITH MODIFICATION**

The 12 action types are **prompt-level guidance**, not code-level action selection. The LLM decides what to say; the action types tell it what's appropriate given the state.

**Modification**: Add a 13th action type: `ACKNOWLEDGE` — for when the customer shares information and MIA should simply acknowledge without advancing.

**Push prevention rules** (to be added to the prompt):
- IF readiness < 0.5: DO NOT close, DO NOT ask for personal data
- IF trust < 0.4: DO NOT ask for commitment, DO share social proof
- IF clarity < 0.4: DO NOT assume understanding, DO explain first
- IF interest < 0.3: DO be brief, DO NOT push for engagement

---

## 6. Deliberation: D5 — Global Behavioral Learning

**Question**: How should aggregate conversation patterns be used?

**Council Analysis**:

The existing `experience_memory` and `business_memory` systems already aggregate patterns. The Council finds:

- **Priors**: YES — global patterns can inform expectations ("customers who ask about payment typically purchase within 2 turns")
- **Pattern suggestions**: YES — patterns can suggest candidate next actions
- **Transition likelihoods**: YES — patterns can show typical conversation trajectories
- **Individual facts**: NEVER — a global pattern must never become a fact about an individual customer

**Tenant isolation**: The existing `experience_memory.scope` system (global/industry/business) correctly isolates data. No new isolation mechanism is needed.

**Causality vs Correlation**: Patterns MUST be labeled as correlational, not causal. The prompt must instruct the LLM: "Los patrones históricos muestran correlaciones, no causalidad."

**Decision**: **ACCEPT**

Global patterns are priors, not facts. Individual evidence takes precedence. Tenant isolation via existing scope system.

---

## 7. Deliberation: D6 — Architecture Option

**Question**: Which architecture option should be selected?

**Council Analysis**:

| Option | Pros | Cons | Council Assessment |
|--------|------|------|-------------------|
| A (Full adoption) | Complete solution | ~500 lines, over-engineered | REJECTED — LLM handles reasoning natively |
| B (Simplified layer) | ~450-550 lines, low risk | Less rigorous | **SELECTED** — proportionate to problem |
| C (Experimental) | Zero risk | Delayed benefit | REJECTED — analysis without action |
| D (Reject) | No new code | Doesn't solve push problem | REJECTED — current architecture is insufficient |

**Decision**: **OPTION B** — Simplified Prompt-Enrichment Layer

**Corrected effort estimate**: ~450-550 lines, 2-3 days (not 350 lines / 1-2 days as research claimed)

**Rationale**:
1. The LLM is the reasoning engine — we give it better input, not replace it
2. 450-550 lines is proportionate for a thin reasoning layer
3. Immediately testable via A/B
4. Reversible (rollback: ~50 lines)
5. Extensible toward Option A if needed

---

## 8. Deliberation: D7 — LLM Authority

**Question**: What may the LLM do?

**Council Analysis**:

The current LLM has **unlimited authority** — it decides everything via the system prompt. There are no guardrails preventing it from:
- Closing when the customer isn't ready
- Inventing evidence
- Converting hypotheses into facts
- Overriding knowledge/catalog authority

**Decision**: **ACCEPT WITH MODIFICATION** — Define explicit LLM boundaries.

### LLM MAY:
- Extract observations from customer messages
- Propose evidence classifications with confidence scores
- Estimate hypotheses about customer state
- Recommend next actions based on state
- Generate conversational responses guided by action type
- Reason about competing explanations

### LLM MAY NOT:
- Create authoritative business facts (only DB writes create facts)
- Override Knowledge/Catalog authority (knowledge_items, products are read-only input)
- Bypass product/media eligibility (conditional-media rules are code-enforced)
- Convert hypotheses into facts (hypothesis → state, never hypothesis → truth)
- Override governance (governance decisions are code-enforced)
- Force CLOSE when state gate prevents it (prompt instruction, not code-enforced in v1)

**Modification for v1**: The CLOSE prevention is **prompt-enforced**, not code-enforced. This is acceptable for v1 because:
- The prompt is the primary behavioral mechanism
- Code-level enforcement can be added in v2 if needed
- The LLM generally follows prompt instructions when they are prominent

**Invariant**: The LLM's evidence extractions are **suggestions**, not facts. They must be stored as evidence items with confidence scores, not as authoritative state.

---

## 9. Deliberation: D8 — Evidence Provenance

**Question**: Must every inferred customer-state change be traceable?

**Council Analysis**:

Provenance is essential for:
- Debugging why MIA made a particular decision
- Auditing state changes over time
- Verifying evidence extraction accuracy
- Supporting rollback if the system makes errors

**Current state**: `sales_events` has provenance (conversation_id, customer_id, timestamp). `customer_memory` has NO provenance (keyword-extracted, no message_id).

**Decision**: **ACCEPT**

Every evidence item MUST carry:
- `message_id` — which customer message produced this evidence
- `conversation_id` — which conversation
- `customer_id` — which customer
- `timestamp` — when observed
- `extraction_method` — how it was extracted (LLM model, prompt version)

**Storage**: Evidence items in `customers.memory.evidence.items` with full provenance.

**Invariant**: No evidence item may exist without provenance. Orphaned evidence is a defect.

---

## 10. Deliberation: D9 — Uncertainty

**Question**: Must MIA preserve uncertainty?

**Council Analysis**:

The Council finds this is a **critical requirement**. If MIA cannot represent uncertainty, it will:
- Fabricate confidence when it shouldn't
- Push toward closing when it doesn't know the customer's state
- Make decisions based on insufficient evidence

**Current state**: No uncertainty representation exists. The LLM may or may not express uncertainty depending on its training and the prompt.

**Decision**: **ACCEPT**

The system MUST be able to represent: "I don't know yet."

**Implementation**: When all state dimensions are in the 0.3-0.7 range (uncertain zone), the prompt should instruct the LLM:
- Acknowledge uncertainty
- Ask exploratory questions
- Do NOT assume the customer is ready to buy
- Do NOT assume the customer is NOT interested

**Invariant**: Uncertainty is a valid state. The system must never convert uncertainty into artificial purchase intent.

---

## 11. Deliberation: D10 — Implementation Scope

**Question**: What is the authorized implementation scope?

**Council Analysis**:

The Council defines strict boundaries to prevent scope creep.

### AUTHORIZED Scope:

1. **Evidence extractor** (`src/lib/reasoning/evidence.ts`)
   - LLM-based evidence extraction from customer messages
   - Evidence type classification with weight and confidence
   - Storage in `customers.memory.evidence.items`

2. **State accumulator** (`src/lib/reasoning/state.ts`)
   - Compute 5-dimensional state from evidence
   - Time decay and momentum
   - Storage in `customers.memory.evidence.state`

3. **Prompt enricher** (`src/lib/reasoning/prompt-enricher.ts`)
   - Add state section to system prompt
   - Add action guidance based on state
   - Modify objective from "sell naturally" to "help the customer decide"

4. **Integration points**:
   - `src/lib/runtime/runtime.ts` — insert evidence extraction into message pipeline
   - `src/lib/ai/prompts.ts` — add state section to buildMasterPrompt()

5. **Tests**:
   - Unit tests for evidence extraction
   - Unit tests for state computation
   - Integration test for full pipeline

### NON-GOALS (Explicitly NOT authorized):

| Area | NOT Authorized | Reason |
|------|---------------|--------|
| CRM redesign | NO | Out of scope |
| Knowledge redesign | NO | Existing knowledge system is sufficient |
| Catalog redesign | NO | Out of scope |
| Memory redesign | NO | Extending existing memory, not replacing |
| Graph database | NO | PostgreSQL is sufficient |
| Autonomous learning system | NO | LLM handles reasoning |
| Cross-tenant analytics redesign | NO | Existing analytics are sufficient |
| Sales engine changes | NO | Only prompt changes, not sales logic |
| Schema migration | NO | Use existing JSONB extension |
| New database tables | NO | Extend existing customers.memory JSONB |
| Code-level action selection | NO | LLM decides, prompt guides |
| Formal hypothesis objects | NO | LLM reasons naturally |
| Bayesian inference | NO | Unnecessary complexity |
| Reinforcement learning | NO | Out of scope |

---

## 12. Adversarial Review

The Council challenges the proposal against 15 scenarios:

| # | Scenario | Architecture Response | Verdict |
|---|----------|----------------------|---------|
| 1 | Interested but can't afford | interest=0.9, readiness=0.2 → explore payment options | PASS |
| 2 | Many questions, no intent | engagement=0.8, readiness=0.1 → answer efficiently | PASS |
| 3 | Ready to buy, wants time | readiness=0.8, urgency=0.3 → offer + follow_up | PASS |
| 4 | High interest, low trust | interest=0.8, trust=0.2 → reassure, don't close | PASS |
| 5 | Customer changes mind | interest drops → acknowledge, don't persist | PASS |
| 6 | Contradictory signals | interest=0.7 but says "no me interesa" → clarify | PASS |
| 7 | Graph predicts purchase, evidence contradicts | Individual evidence overrides global pattern | PASS |
| 8 | Aggressive historical behavior contaminates patterns | Patterns labeled correlational, not causal | PASS |
| 9 | Global pattern leaks into individual state | Global patterns are priors, individual evidence is fact | PASS |
| 10 | One tenant influences another | Existing scope system isolates tenants | PASS |
| 11 | LLM invents evidence | Evidence extraction uses LLM but stores with provenance and confidence | PASS |
| 12 | LLM converts hypothesis into fact | Invariant: hypotheses never become facts | PASS |
| 13 | MIA asks unnecessary questions to advance | State gate prevents advancing when readiness < 0.5 | PASS |
| 14 | MIA closes despite uncertainty | Uncertainty zone (0.3-0.7) triggers explore, not close | PASS |
| 15 | Customer explicitly says "not yet" | interest drops, readiness drops → wait, don't push | PASS |

**All 15 scenarios PASS.**

---

## 13. Decision

**DECISION**: **ACCEPT Option B — Simplified Prompt-Enrichment Layer**

With the following modifications from Council deliberation:
1. Three-layer model (not four) — LLM handles hypothesis reasoning natively
2. Effort estimate corrected: ~450-550 lines, 2-3 days
3. 13th action type: ACKNOWLEDGE
4. Prompt-level action guidance (not code-level action selection)
5. Evidence provenance is mandatory
6. Uncertainty is a valid state
7. Strict scope boundaries defined

---

## 14. Rationale

The Council selects Option B because:

1. **The problem is real**: MIA pushes toward purchase because it lacks state awareness
2. **The solution is proportionate**: ~500 lines for a thin reasoning layer
3. **The LLM is the right engine**: We give it better input, not replace it
4. **The risk is low**: Reversible, testable, extensible
5. **The alternative is worse**: Option D (reject) doesn't solve the problem; Option A (full) is over-engineered; Option C (defer) delays benefit

---

## 15. Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Option A (Full adoption) | Over-engineered — LLM handles reasoning natively |
| Option C (Experimental) | Analysis without action — no immediate value |
| Option D (Reject) | Doesn't solve the push problem |
| Code-level action selection | LLM generates free-form text, not structured actions |
| Formal Bayesian model | Unnecessary complexity — LLM handles probabilistic reasoning |
| Graph database | PostgreSQL is sufficient for this use case |
| New database tables | Existing JSONB extension is sufficient |

---

## 16. Constraints

1. No schema migration — extend existing `customers.memory` JSONB
2. No new database tables
3. No code-level action selection (prompt-level only in v1)
4. No formal hypothesis objects
5. No Bayesian inference
6. No autonomous learning
7. No cross-tenant data sharing beyond existing scope system
8. Evidence provenance is mandatory
9. Uncertainty is a valid state

---

## 17. Invariants

| ID | Invariant | Failure Behavior |
|----|-----------|-----------------|
| INV-ER-001 | Every evidence item must carry provenance (message_id, conversation_id, customer_id, timestamp) | Block |
| INV-ER-002 | State dimensions must be computed from evidence, not assumed | Block |
| INV-ER-003 | Global patterns must never become individual customer facts | Block |
| INV-ER-004 | Uncertainty (all dimensions 0.3-0.7) must trigger exploration, not closing | Block |
| INV-ER-005 | CLOSE action requires readiness > 0.7 AND trust > 0.6 AND interest > 0.6 | Block |
| INV-ER-006 | LLM evidence extractions are suggestions, not authoritative facts | Warn |
| INV-ER-007 | customers.status derivation must maintain backward compatibility | Block |
| INV-ER-008 | Time decay must be applied to evidence items, not skipped | Block |
| INV-ER-009 | Evidence items must not exceed 50 per conversation (FIFO eviction) | Warn |
| INV-ER-010 | State momentum (0.7/0.3 split) must prevent wild swings from single messages | Block |

---

## 18. Acceptance Criteria

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Premature close rate | < 5% of close attempts when readiness < 0.5 | Manual review |
| Conversion rate | ±5% of current | A/B test |
| Customer satisfaction | > 4.0/5.0 | Post-conversation survey |
| State accuracy | > 70% agreement with human labeler | Manual labeling |
| Latency added | < 100ms per message | Performance monitoring |
| Evidence extraction consistency | > 80% agreement across runs | Repeated extraction test |
| Push detection | 0% consecutive close attempts when state gate prevents | Automated check |

---

## 19. Required Tests

| Test | Type | Purpose |
|------|------|---------|
| Evidence extraction accuracy | Unit | Verify evidence types are correctly classified |
| State computation correctness | Unit | Verify 5 dimensions compute correctly from evidence |
| Time decay behavior | Unit | Verify decay formula and half-lives |
| Momentum behavior | Unit | Verify 0.7/0.3 split prevents wild swings |
| Prompt injection | Integration | Verify state section appears in system prompt |
| Closing gate | Integration | Verify CLOSE is not suggested when readiness < 0.5 |
| Provenance traceability | Unit | Verify every evidence item has message_id |
| Uncertainty representation | Unit | Verify "I don't know" is triggered when dimensions are 0.3-0.7 |
| Backward compatibility | Integration | Verify customers.status derivation works |
| Full pipeline | E2E | Verify message → evidence → state → prompt → response |

---

## 20. Dissenting Opinions

**None recorded.** The Council reaches unanimous decision.

---

## 21. Implementation Authorization

**AUTHORIZED**: Yes, with the following conditions:

1. All 10 invariants must be enforced
2. All 10 required tests must pass
3. Effort estimate: ~450-550 lines, 2-3 days
4. Scope boundaries from D10 must be respected
5. Rollback is authorized if acceptance criteria are not met

**NOT AUTHORIZED**:
- Any changes outside the defined scope
- Schema migrations
- New database tables
- Code-level action selection
- Formal hypothesis objects
- Bayesian inference
- Autonomous learning
- Cross-tenant analytics redesign

---

## 22. Next Steps

1. Create governance task manifest for implementation
2. Freeze Subaru checkpoint with implementation plan
3. Implement Phase 1: Evidence extraction
4. Implement Phase 2: State computation
5. Implement Phase 3: Prompt enrichment
6. Run all required tests
7. A/B test in production
8. Review against acceptance criteria

---

**Decision recorded**: 2026-08-25
**Decision authority**: Engineering Council
**Status**: DECISION_ACCEPTED — Implementation Authorized
