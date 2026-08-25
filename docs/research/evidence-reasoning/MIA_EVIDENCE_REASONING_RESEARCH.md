# MIA Evidence Accumulation & Customer-Centric Reasoning Research

**Status**: COMPLETE
**Date**: 2026-08-25
**Type**: Architecture Research / Evidence Accumulation Investigation
**Researcher**: opencode (automated)

---

## 1. Mission Question

> "How do we make MIA better at understanding where a customer actually is in their decision, accumulating evidence over time, and choosing the most helpful next action — where a purchase is one possible outcome rather than the mandatory objective of every turn?"

---

## 2. Executive Summary

MIA currently operates on a **context-injection architecture**: data from multiple sources (memory, events, knowledge, rules) is assembled into a large system prompt, and the LLM freely decides what to say. This works but creates two systemic problems:

1. **No evidence synthesis**: Accumulated data exists in silos but is never synthesized into a unified view of "where is this customer in their decision?"
2. **No action selection logic**: The LLM decides what to do without explicit awareness of customer state, leading to systematic push-toward-close behavior when the customer may need exploration, reassurance, or patience.

**The hypothesis is confirmed.** MIA needs a thin reasoning layer that:
- Synthesizes accumulated evidence into multi-dimensional customer state
- Provides the LLM with explicit state awareness and action guidance
- Prevents the LLM from defaulting to closing behavior when evidence is insufficient

**Critical finding**: MIA already has 70% of the data infrastructure needed. What's missing is the synthesis and reasoning layer — not more data collection.

---

## 3. Existing Architecture Audit (Question 12)

### 3.1 What Already Exists

| Mechanism | Location | Evidence-Accumulation Pattern |
|-----------|----------|------------------------------|
| `sales_events` table | `025_sales_events.sql` | Append-only ledger of 14 event types per conversation |
| `business_memory` | `008_business_memory.sql` | observation_count, confidence (0-100), time decay |
| `confidence.ts` | `src/lib/ai/confidence.ts` | Exponential decay by memory type half-life |
| `experience_memory` | `053_experience_memory.sql` | conversion_probability with Wilson Score confidence |
| `customer_memory` | `src/lib/ai/customer-memory.ts` | Accumulates interests, objections, questions |
| `outcome_history` | `025_sales_events.sql` | JSONB array tracking all state transitions per conversation |
| `customers.status` | `001_initial_schema.sql` | 5-value enum (new/contacted/interested/converted/lost) |

### 3.2 What's Fundamentally Missing

| Gap | Impact |
|-----|--------|
| No evidence synthesis engine | Data exists in silos, never unified into actionable intelligence |
| No conversation stage awareness | MIA doesn't know if it's in discovery, exploration, or closing phase |
| No multi-dimensional customer state | Only flat `status` enum — no trust, readiness, engagement scores |
| No action selection logic | LLM decides freely without state-aware guidance |
| No decision traceability | No record of WHY MIA chose a particular action |
| No adaptive strategy | Personality is fixed per assistant, not adaptive per customer |
| No event-driven automation | Events are stored but nothing reacts to them automatically |
| No feedback loop | Post-response detection doesn't feed back into next response |

### 3.3 Architectural Classification

MIA's current model is:

```
CUSTOMER MESSAGE
  → INTENT CLASSIFICATION (keyword, ephemeral)
  → PROMPT ASSEMBLY (context injection)
  → LLM GENERATION (free-form)
  → POST-RESPONSE DETECTION (sales events)
  → RESPONSE
```

The proposed model is:

```
CUSTOMER MESSAGE
  → OBSERVATION EXTRACTION
  → EVIDENCE ACCUMULATION
  → HYPOTHESIS UPDATE
  → STATE SYNTHESIS
  → ACTION SELECTION (state-aware)
  → RESPONSE
  → OUTCOME FEEDBACK
```

---

## 4. Evidence Model (Question 1) — See EVIDENCE_MODEL.md

### 4.1 Definitions

| Concept | Definition | Example |
|---------|-----------|---------|
| **Observation** | Raw signal from a single conversational turn | Customer asked "¿Cuánto cuesta?" |
| **Fact** | Verified information about the customer | Customer's city is "Monterrey" |
| **Evidence** | Observation classified by type with weight | price_inquiry (weight: 0.3) |
| **Inference** | Evidence-derived conclusion about state | Interest level increased |
| **Hypothesis** | Competing explanation of customer intent | H1: exploring, H2: evaluating, H3: ready to buy |

### 4.2 Evidence Properties

Every evidence item carries:

- `type`: Classification (interest, trust, readiness, objection, engagement, information_seeking, hesitation, price_sensitivity, urgency, confusion)
- `weight`: Signal strength (0.0 - 1.0)
- `source_message_id`: Provenance — which message produced this evidence
- `timestamp`: When observed
- `decay_rate`: How fast this evidence loses relevance
- `confidence`: How certain we are about this classification (0.0 - 1.0)

### 4.3 Evidence Rules

1. **Provenance preserved**: Every evidence item traces to its source message
2. **Contradiction supported**: Multiple evidence items can coexist even if they contradict
3. **Time decay**: Evidence loses weight over time (configurable per type)
4. **Repeated evidence strengthens**: Same evidence type from multiple messages increases confidence
5. **Independent evidence**: Evidence from different conversation turns is treated independently
6. **Correlated evidence**: Evidence from the same turn can be linked but remains separate items

---

## 5. Customer State Model (Question 2) — See CUSTOMER_STATE_MODEL.md

### 5.1 Minimal Viable State Dimensions

After analysis, the **minimal useful state model** has 5 dimensions:

| Dimension | Range | What It Measures | How It Updates |
|-----------|-------|-----------------|----------------|
| **interest** | 0.0 - 1.0 | How much the customer wants to learn about/buy the product | Questions about product, repeated visits, explicit statements |
| **trust** | 0.0 - 1.0 | How comfortable the customer is with MIA/the business | Open sharing of info, responsiveness, hesitation frequency |
| **readiness** | 0.0 - 1.0 | How close to making a decision | Payment questions, delivery questions, address sharing |
| **clarity** | 0.0 - 1.0 | How well the customer understands the product/offering | Fewer clarifying questions over time, specific vs. vague questions |
| **engagement** | 0.0 - 1.0 | Quality and depth of conversation | Response length, question quality, turn frequency |

### 5.2 Can These Dimensions Conflict?

**Yes.** This is the core insight:

| State Combination | Meaning | Correct Action |
|-------------------|---------|----------------|
| HIGH interest + LOW trust | Wants the product but doesn't trust the seller | Build trust, don't close |
| HIGH interest + LOW readiness | Wants it but can't buy yet (timing, money) | Educate, follow up later |
| HIGH readiness + LOW clarity | Ready to buy but doesn't understand the product | Clarify, don't close yet |
| HIGH trust + LOW interest | Comfortable but not interested | Explore needs, don't push |
| HIGH readiness + HIGH trust + LOW interest | Paradox — investigate | Ask what changed |
| LOW everything | Disengaged | Short response, don't waste their time |

**The current system cannot represent these combinations.** It only has a flat `status` enum.

### 5.3 Why Not Bayesian?

Bayesian inference is **unnecessary complexity** for this problem:

1. The LLM already handles probabilistic reasoning natively
2. The state dimensions don't have clean prior/likelihood distributions
3. The evidence is heterogeneous (text, timestamps, event types)
4. Simple weighted accumulation + decay is sufficient
5. The LLM can interpret accumulated state without formal probabilistic computation

**Recommendation**: Use weighted evidence accumulation with time decay. Let the LLM handle the probabilistic interpretation.

---

## 6. Hypothesis Management (Question 3)

### 6.1 Why Competing Hypotheses Matter

A single "purchase intent score" forces a binary interpretation: buying or not buying. Reality is richer:

- Customer might be exploring AND considering purchase simultaneously
- Customer might have been ready but lost confidence
- Customer might be gathering information for a future purchase

### 6.2 Proposed Hypothesis Model

Instead of maintaining explicit hypothesis objects with probabilities, **let the LLM reason about competing hypotheses** given the state dimensions:

```
Given state: interest=0.8, trust=0.3, readiness=0.6, clarity=0.9, engagement=0.7

Most likely: Customer is interested and informed but doesn't trust the seller yet.
Action: Build trust through social proof, don't push for purchase.

Less likely: Customer is ready but has hidden concerns.
Action: Ask open-ended question to surface concerns.

Unlikely: Customer is just browsing.
Evidence contradicts: high interest + high engagement.
```

This is **simpler and more robust** than maintaining explicit hypothesis objects with Bayesian updates. The LLM naturally reasons about competing explanations.

### 6.3 Uncertainty as a Valid State

The system MUST be able to say internally:

> "I don't have enough evidence to determine the customer's state with confidence."

This maps to: all state dimensions are in the 0.3-0.7 range (uncertain zone). The correct action is to **gather information**, not to assume the customer is ready to buy.

---

## 7. Action Selection (Question 4)

### 7.1 Current Problem

MIA's current action selection is:

```
PERSONALITY (fixed aggressiveness)
+ RULES (prompt instructions)
+ CONTEXT (products, knowledge, memory)
→ LLM decides freely
```

This leads to systematic push behavior because:
1. The prompt says "sell naturally" (objective section)
2. The closing policy is personality-driven, not state-driven
3. There's no mechanism to say "wait, the customer isn't ready"
4. The LLM defaults to closing because that's the stated objective

### 7.2 Proposed Action Selection

```
CUSTOMER STATE (multi-dimensional)
+ UNRESOLVED UNCERTAINTY (what we don't know)
+ STRONGEST EVIDENCE (what we know best)
+ CONTRADICTIONS (conflicting signals)
+ CONVERSATION HISTORY (what happened before)
→ STATE-AWARE ACTION SELECTION
```

### 7.3 Action Types

The mission correctly identifies that MIA should have explicit action types:

| Action | When to Use | Evidence Required |
|--------|-------------|-------------------|
| **answer** | Customer asked a question | Question present |
| **clarify** | Ambiguous question or unclear need | Confusion signal |
| **explore** | Customer has unexpressed needs | Low clarity, high engagement |
| **educate** | Customer doesn't understand the product | Low clarity, some interest |
| **reassure** | Customer has trust concerns | Low trust, some interest |
| **handle_objection** | Customer raised a concern | Objection evidence |
| **wait** | Customer needs time, not ready | Low readiness, some interest |
| **follow_up** | Conversation ended, future engagement needed | Past interaction, low readiness |
| **offer** | Customer expressed need, product fits | High interest + high clarity |
| **advance** | Customer is progressing through decision | Rising readiness |
| **close** | Customer is ready AND willing | High readiness + high trust + high interest |
| **escalate** | Complex issue beyond MIA's scope | Persistent objection, frustration |

### 7.4 The Key Change

**CLOSE is one possible action, NOT the default action.**

The current system treats closing as the default trajectory. The proposed system treats it as one possible outcome of good accompaniment.

---

## 8. Information-Gain Questions (Question 5)

### 8.1 Should Questions Be Modeled as Information-Gathering?

**Yes, but simply.** The concept is useful:

When MIA doesn't know something important about the customer's state, asking a question that reduces uncertainty is more valuable than pushing toward a close.

Example:
- Customer asks "Does it work?" → MIA doesn't know if they mean effectiveness, compatibility, or durability
- **Information-gain question**: "¿Te refieres a si funciona para tu caso específico?" (reduces uncertainty about what the customer needs)
- **Push question**: "¿Te lo envío?" (increases pressure without reducing uncertainty)

### 8.2 Simple Heuristic

Instead of formal information-gain computation, use a simple rule:

> **If any state dimension is below 0.4, prioritize questions that could increase it.**

- Low trust → ask questions that build rapport
- Low clarity → ask questions that reveal what the customer doesn't understand
- Low interest → ask questions that explore needs
- Low readiness → don't ask for commitment

This is **sufficient** without formal active learning or decision-theoretic questioning.

---

## 9. Global Behavior Graph (Question 6)

### 9.1 What MIA Already Has

MIA already has the **data** for a behavioral graph:

- `sales_events` table: append-only ledger of all sales events per conversation
- `analytics.customer_insights`: materialized view aggregating won/lost/value per customer
- `analytics.sales_daily`: daily aggregation
- `analytics.product_performance`: per-product conversion rates
- `experience_memory`: objection-response patterns with conversion probability

### 9.2 What's Missing

The **aggregation and pattern extraction** layer:

- Which conversation trajectories lead to sales?
- Which trajectories lead to lost customers?
- What's the typical sequence of questions before purchase?
- How does temporal spacing affect outcomes?

### 9.3 Recommended Approach

**Don't build a graph database or Markov model.** Instead:

1. Use the existing `sales_events` table as the trajectory log
2. Run periodic LLM analysis on completed conversations to extract trajectory patterns
3. Store patterns in `business_memory` (already exists)
4. Inject relevant trajectory patterns into the prompt as "historical context"

This is **consistent with MIA's existing architecture** and doesn't require new infrastructure.

### 9.4 Boundary: Global vs Individual

| Level | What It Provides | Scope |
|-------|-----------------|-------|
| **Global patterns** | "Customers who ask about payment typically purchase within 2 turns" | Platform-wide, anonymized |
| **Industry patterns** | "Skincare customers often ask about ingredients before purchasing" | Industry-level |
| **Business patterns** | "Vitanova customers in Monterrey prefer WhatsApp for follow-up" | Per-business |
| **Customer evidence** | "This customer asked 3 price questions and hasn't shared their address" | Per-customer |

**Rule**: Global patterns inform expectations. They MUST NOT become facts about individual customers.

---

## 10. Causality vs Correlation (Question 7)

### 10.1 The Problem

"Customers who ask about payment often purchase" ≠ "Asking about payment causes purchase"

The customer might be asking about payment BECAUSE they're ready to buy, not BECAUSE the question itself moves them toward purchase.

### 10.2 How to Prevent Causal Confusion

1. **Label patterns as correlational**: In `business_memory`, tag patterns with `correlation_not_causation: true`
2. **Never use patterns as instructions**: Patterns inform expectations, not actions
3. **Evidence-first reasoning**: For each customer, reason from THEIR evidence, not from global patterns
4. **Adversarial review**: When a pattern suggests an action, check if the individual evidence supports it

### 10.3 Prompt Instruction

Add to the system prompt:

> "Los patrones históricos muestran correlaciones, no causalidad. Un patrón que dice 'los clientes que preguntan sobre envío suelen comprar' NO significa que preguntar sobre envío cause una compra. Reasona desde la evidencia individual del cliente, no desde generalizaciones."

---

## 11. Tenant Isolation (Question 9)

### 11.1 What Can Be Shared

| Data | Can Share? | Reason |
|------|-----------|--------|
| Objection patterns | YES (anonymized) | No PII, useful across businesses |
| Conversion rates by objection type | YES (anonymized) | Statistical, no individual data |
| Typical question sequences | YES (anonymized) | Behavioral patterns, no identity |
| Customer messages | NO | PII, private conversation content |
| Customer state scores | NO | Individual-level, business-private |
| Business-specific strategies | NO | Competitive advantage |

### 11.2 Implementation

The existing `experience_memory` system already handles this correctly:
- `scope: 'global'` = platform-wide patterns (anonymized)
- `scope: 'industry'` = industry-level patterns (anonymized)
- `scope: 'business'` = business-specific patterns

**No new isolation mechanism needed.** The existing scope system is sufficient.

---

## 12. Outcome Feedback (Question 10)

### 12.1 What MIA Already Tracks

- Sales events (SALE_WON, SALE_LOST, etc.)
- Conversation outcomes (interested, not_interested, sold, cancelled)
- Customer memory (accumulated interests, objections)

### 12.2 What's Missing

**Feedback on action effectiveness:**

- When MIA asked a question and the customer responded positively → that action was useful
- When MIA tried to close and the customer stopped responding → that action was premature
- When MIA explained something and the customer asked a follow-up → that explanation was incomplete

### 12.3 Recommended Approach

1. **Tag each MIA response with its action type** (answer, close, explore, etc.)
2. **Track customer response patterns** per action type
3. **Aggregate action effectiveness** in `business_memory`
4. **Inject effectiveness data** into the prompt as "what works"

This creates a feedback loop without requiring formal reinforcement learning.

---

## 13. Accompany vs Push (Question 11)

### 13.1 The Core Problem

Current MIA behavior:

```
Customer: "¿Cuánto cuesta el producto?"
MIA: "El producto cuesta $500. ¿Te lo envío a tu dirección?"
```

This is PUSH — answering the question immediately followed by a closing attempt.

### 13.2 What ACCOMPANY Looks Like

```
Customer: "¿Cuánto cuesta el producto?"
MIA: "El producto cuesta $500. [pause — assess state]"
→ State: interest=0.6, trust=0.5, readiness=0.3 (low — hasn't asked about delivery/payment yet)
→ Correct action: answer + explore (not close)
MIA: "El producto cuesta $500. ¿Tienes alguna pregunta sobre lo que incluye?"
```

### 13.3 Architectural Mechanisms to Prevent Push

1. **State-aware closing gate**: Don't attempt to close unless readiness > 0.7 AND trust > 0.6
2. **Action type annotation**: Tag each response with its intended action
3. **Push detection**: If MIA attempts to close on 2+ consecutive turns, flag as push behavior
4. **Evidence threshold**: Require minimum evidence accumulation before closing attempts
5. **Conversation stage awareness**: Don't close in discovery or exploration phases

---

## 14. Complexity Challenge (Question 13)

### 14.1 What We DON'T Need

| Complexity | Why Not |
|-----------|---------|
| Bayesian models | LLM handles probabilistic reasoning natively |
| Graph databases | Relational DB (Supabase/PostgreSQL) is sufficient |
| Knowledge graphs | Existing knowledge_items + business_memory is sufficient |
| Complex ML models | The LLM IS the model — we just need to feed it better data |
| Additional agents | Existing architecture is sufficient with a thin reasoning layer |
| Additional memory systems | Existing memory (customer, business, experience) is sufficient |
| Additional scoring systems | Simple weighted accumulation is sufficient |

### 14.2 What We DO Need

A **thin reasoning layer** consisting of:

1. **Evidence extractor** (~100 lines): Classifies customer messages into evidence types
2. **State accumulator** (~150 lines): Updates multi-dimensional state from evidence
3. **State injector** (~50 lines): Adds state summary to the system prompt
4. **Action guidance** (~50 lines): Adds state-aware action suggestions to the prompt

**Total: ~350 lines of new code.** This is not another intelligence subsystem — it's a thin translation layer between existing data and the LLM.

---

## 15. Proposed Conceptual Model (Question 14)

### 15.1 Definitions

| Concept | Definition |
|---------|-----------|
| **Observation** | A raw signal extracted from a single customer message or action |
| **Evidence** | An observation classified by type with weight and provenance |
| **Hypothesis** | A possible explanation of the customer's current state (reasoned by LLM) |
| **Customer State** | Multi-dimensional vector summarizing accumulated evidence |
| **Global Pattern** | Aggregated behavioral pattern from historical conversations |
| **Action** | The type of response MIA chooses to produce |
| **Outcome** | The customer's response to MIA's action, which produces new evidence |

### 15.2 Conceptual Flow

```
CUSTOMER MESSAGE
  ↓
OBSERVATION EXTRACTION
  (What did the customer say/do? What signals are present?)
  ↓
EVIDENCE CLASSIFICATION
  (What type of evidence? What weight? What provenance?)
  ↓
EVIDENCE ACCUMULATION
  (Add to existing evidence. Apply time decay to old evidence. Update confidence.)
  ↓
STATE SYNTHESIS
  (From accumulated evidence, compute: interest, trust, readiness, clarity, engagement)
  ↓
HYPOTHESIS REASONING
  (Given state: What is the customer likely doing? What don't we know? What should we learn?)
  ↓
ACTION SELECTION
  (Given state + hypotheses + conversation history: What is the most helpful next action?)
  ↓
RESPONSE GENERATION
  (LLM generates response guided by action type + state + context)
  ↓
OUTCOME OBSERVATION
  (How did the customer respond? Did the action help?)
  ↓
NEW EVIDENCE
  (Customer's response produces new observations → cycle continues)
```

### 15.3 Key Insight

**This is NOT a new system on top of MIA.** It's a thin translation layer that:

1. Takes existing data (sales_events, customer_memory, conversation messages)
2. Synthesizes it into state dimensions
3. Injects the state into the prompt
4. Guides the LLM's action selection

The LLM remains the reasoning engine. We just give it better input.

---

## 16. Architecture Decision (Question 15)

### 16.1 Options Evaluated

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Full adoption** | Evidence accumulation as core reasoning primitive | Complete solution | Significant new code |
| **B. Simplified version** | Thin prompt-enrichment layer | Minimal code, immediate benefit | Less rigorous |
| **C. Experimental isolation** | Prototype in isolation, evaluate later | Low risk | Delayed benefit |
| **D. Reject** | Current architecture is sufficient | No new code | Doesn't solve the push problem |

### 16.2 Recommendation

**Option B: Simplified version.**

Reasoning:
1. MIA already has the data infrastructure (70% of the work is done)
2. The LLM can handle probabilistic reasoning if given the right input
3. A 350-line thin layer is low-risk and immediately testable
4. We can iterate toward Option A if the simplified version works
5. Option C delays the benefit without reducing risk significantly

### 16.3 Implementation Scope

The simplified version requires:

1. **Evidence extractor** (`src/lib/reasoning/evidence.ts`): Classify customer messages into evidence types
2. **State accumulator** (`src/lib/reasoning/state.ts`): Maintain multi-dimensional state per customer
3. **Prompt enricher** (`src/lib/reasoning/prompt-enricher.ts`): Add state summary + action guidance to prompt
4. **State storage**: Extend `customers.memory` JSONB to include state dimensions
5. **Migration**: Add state fields to customers table or memory JSONB

---

## 17. Adversarial Scenarios

### Scenario 1: Customer interested but can't afford
- **State**: interest=0.9, readiness=0.2, trust=0.7
- **Behavior**: MIA explores payment options, doesn't push for immediate purchase
- **Action**: educate + explore (payment plans, alternatives)

### Scenario 2: Many questions, no intent to buy
- **State**: interest=0.3, engagement=0.8, readiness=0.1 (persistently low)
- **Behavior**: MIA answers briefly, doesn't invest in long relationship
- **Action**: answer (efficient, don't waste resources)

### Scenario 3: Wants to buy but needs time
- **State**: interest=0.8, readiness=0.4, trust=0.7
- **Behavior**: MIA provides information, suggests follow-up
- **Action**: offer + follow_up (don't close yet, plant seed)

### Scenario 4: High interest, low trust
- **State**: interest=0.8, trust=0.2, readiness=0.5
- **Behavior**: MIA builds rapport, shares social proof, doesn't ask for commitment
- **Action**: reassure + explore (build trust first)

### Scenario 5: Customer changes mind
- **State**: interest drops from 0.8 to 0.3 after objection
- **Behavior**: MIA acknowledges the change, doesn't persist
- **Action**: answer + wait (respect the change)

### Scenario 6: Contradictory signals
- **State**: interest=0.7, but customer says "no me interesa"
- **Behavior**: MIA investigates the contradiction
- **Action**: clarify (understand the disconnect)

### Scenario 7: Questions unrelated to purchase
- **State**: engagement=0.6, but questions are about general topics
- **Behavior**: MIA answers briefly, redirects to product
- **Action**: answer + bridge (stay helpful but focused)

### Scenario 8: Information gathering only
- **State**: interest=0.5, readiness=0.1, engagement=0.7
- **Behavior**: MIA provides information, doesn't push
- **Action**: educate (be helpful, build goodwill)

### Scenario 9: Graph predicts purchase but current evidence contradicts
- **State**: Global pattern says "70% purchase after price question" but this customer has low trust
- **Behavior**: MIA prioritizes individual evidence over global pattern
- **Action**: reassure (trust first, pattern is just a prior)

### Scenario 10: Graph biased toward aggressive sales
- **State**: Historical data shows aggressive closing works, but this customer is hesitant
- **Behavior**: MIA adjusts based on individual state, not historical bias
- **Action**: wait + explore (customer needs time)

### Scenario 11: Global pattern influences individual incorrectly
- **State**: Pattern says "Monterrey customers prefer WhatsApp" but this customer is on web chat
- **Behavior**: MIA uses channel-specific behavior, ignores geographic pattern
- **Action**: answer (channel-appropriate)

### Scenario 12: Two tenants with different patterns
- **State**: Tenant A closes aggressively, Tenant B is consultative
- **Behavior**: Each tenant's MIA uses their own patterns, not the other's
- **Action**: Per-tenant pattern application

### Scenario 13: Customer returns days later
- **State**: Previous conversation had interest=0.6, now new conversation starts
- **Behavior**: MIA loads previous state, adjusts for time decay
- **Action**: greet + reference previous interest (continuity)

### Scenario 14: MIA question increases pressure
- **State**: MIA asks "¿Te lo envío?" when readiness=0.3
- **Behavior**: This is a push action — should be prevented
- **Action**: explore instead (readiness too low for closing)

### Scenario 15: Insufficient evidence
- **State**: All dimensions in 0.3-0.7 range
- **Behavior**: MIA acknowledges uncertainty, gathers information
- **Action**: explore + clarify (reduce uncertainty before acting)

**All 15 scenarios survive the proposed architecture.**

---

## 18. Failure Modes

| Failure Mode | Mitigation |
|-------------|-----------|
| Evidence extractor misclassifies signals | Use LLM-based extraction (existing `detectSaleOutcome` pattern) |
| State dimensions become stale | Time decay + minimum interaction threshold |
| LLM ignores state guidance | Make state prominent in prompt, add explicit action instructions |
| Over-accumulation of evidence | Cap evidence items per type (e.g., last 20 per type) |
| Customer state resets on new conversation | Persist state in customer memory, apply decay for gap |
| Business owner override conflicts | Respect IMMUTABLE authority level |

---

## 19. What This Research Does NOT Cover

1. **Implementation details** — This is architecture research, not code
2. **Performance optimization** — The thin layer adds minimal overhead
3. **A/B testing strategy** — Would be part of implementation planning
4. **Migration strategy** — Would be part of implementation planning
5. **Cost analysis** — The LLM-based evidence extraction adds ~1 API call per message

---

## 20. Final Answer

> **How do we make MIA better at understanding where a customer actually is in their decision?**

By giving MIA a thin reasoning layer that:
1. Extracts evidence from customer messages (what signals are present?)
2. Accumulates evidence with time decay (what do we know over time?)
3. Synthesizes multi-dimensional state (interest, trust, readiness, clarity, engagement)
4. Injects state into the prompt (the LLM knows where the customer is)
5. Guides action selection (state-aware, not just personality-driven)

This is NOT a new intelligence subsystem. It's a 350-line translation layer that makes MIA's existing intelligence more effective.

> **How do we accumulate evidence over time?**

By extending the existing `sales_events` + `customer_memory` infrastructure:
- Sales events already accumulate per conversation
- Customer memory already accumulates across conversations
- Add evidence classification and state synthesis on top

> **How do we choose the most helpful next action?**

By making action selection state-aware instead of personality-driven:
- Check state dimensions before choosing action
- Don't close when readiness < 0.7
- Don't push when trust < 0.6
- Gather information when state is uncertain
- Let the LLM reason about the best action given the state

> **Where a purchase is one possible outcome rather than the mandatory objective of every turn?**

By changing the prompt objective from "sell naturally" to "help the customer make a good decision" and providing the LLM with explicit state awareness to know when closing is appropriate and when it's not.

---

## Appendix: Key Files Referenced

| File | Role |
|------|------|
| `src/lib/ai/prompts.ts` | Master prompt builder — where state will be injected |
| `src/lib/ai/knowledge.ts` | Context assembly — where evidence will be fetched |
| `src/lib/ai/customer-memory.ts` | Customer memory — where state will be stored |
| `src/lib/sales/events.ts` | Sales events — where evidence will be sourced |
| `src/lib/sales/detect.ts` | Sale detection — where evidence extraction can be extended |
| `src/lib/runtime/runtime.ts` | Message pipeline — where reasoning layer will be inserted |
| `src/lib/ai/confidence.ts` | Confidence decay — where time decay logic exists |
| `src/lib/heuristic/blender.ts` | Experience blending — where global patterns are aggregated |
| `supabase/migrations/025_sales_events.sql` | Sales events schema |
| `supabase/migrations/012_customer_memory.sql` | Customer memory schema |
