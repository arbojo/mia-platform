# Evidence Model — Formal Specification

**Status:** Design document (MVP — lightweight scoring, not full HMM).
**Date:** 2026-08-25
**Depends on:** `kb/observables.md` (signal dictionary), `kb/estados.md` (state atlas), `kb/transiciones.md` (transition priors), `kb/principios.md` (26 principles), `MIA_EVIDENCE_REASONING_RESEARCH.md` (architecture analysis).
**Replaces:** The keyword-based intent classification in `src/lib/runtime/intents.ts` and the flat memory model in `src/lib/ai/customer-memory.ts`.

---

## 1. Evidence Types

Eight observable types, inherited from `kb/observables.md` §"Tipos de evidencia (schema del extractor)".

### 1.1 Type Definitions

| # | Type | What it is | Base Weight | Notes |
|---|------|-----------|-------------|-------|
| 1 | `question` | Question from the buyer | variable | Weight determined by **object** of the question (§1.2) |
| 2 | `statement` | Declaration of problem, objective, criterion, or constraint | 0.6 | May imply `descubriendo`, `comprendiendo`, or `comparando` depending on content |
| 3 | `objection` | Doubt or objection about price, time, trust, or functionality | 0.6 | Implies `evaluando_riesgo` or `decidiendo` (blocked) |
| 4 | `emotion` | Lexical emotional vs. analytical language; intensity varies | variable | Valence determines target state (§1.3) |
| 5 | `behavior` | Message length, question density, timing patterns, re-questions | 0.4 | Structural signal, not content-based |
| 6 | `explicito` | Self-report of own state ("estoy comparando opciones") | 0.3 | **NEVER sufficient alone** — requires corroboration from another type |
| 7 | `post-purchase` | Mention of delivery, usage, result, complaint, or thanks | 0.7 | Strong signal; implies post-decision cycle states |
| 8 | `meta` | Turn count, duration, repetitions, silence, abandonment | sidecar | Sidecar type — modifies interpretation of other types, does not directly imply states |

### 1.2 Question Object Sub-Types

Questions carry variable weight depending on their **object** — what the question is about, not its phrasing.

| Object | Implies | Base Weight | Signal Examples |
|--------|---------|-------------|-----------------|
| `price` | `transaccional`, `decidiendo` | 0.5 | "¿cuánto cuesta?", "¿cuál es el precio?", "formas de pago" |
| `risk` | `evaluando_riesgo` | 0.6 | "¿qué pasa si no me gusta?", "¿hay garantía?", "¿y si falla?" |
| `comparison` | `comparando` | 0.5 | "¿en qué se diferencia de X?", "¿cuál es mejor?", mención de competidor |
| `solution` | `comprendiendo` | 0.5 | "¿cómo funciona?", "¿cómo se soluciona?", "¿qué incluye?" |

### 1.3 Emotion Valence Mapping

| Valence | Implies | Intensity Modifier |
|---------|---------|-------------------|
| Negative (frustration, anxiety, complaint) | `frustrado`, `confundido` | High intensity → `frustrado`; low → `confundido` |
| Positive (enthusiasm, resolution, satisfaction) | `abogando`, `decidiendo` | Amplifies target state weight |
| Post-purchase anxiety ("¿hice bien?") | `esperando`, `evaluando_resultados` | Dissonance signal |

### 1.4 Behavior Sub-Signals

| Signal | Structural Pattern | Implies |
|--------|-------------------|---------|
| High question density + re-questions | >2 questions per turn, rephrasing same topic | `comparando`, `evaluando_riesgo`, `confundido` |
| Vague messages, contradictions | Short, inconsistent, "no entiendo" | `confundido` |
| Silence beyond threshold | No response after MIA active turn | `desenganchado` (sidecar) |
| Deferral without specifics | "déjame pensarlo" (alone, no follow-up) | zombie outcome — weak/negative (P-008/P-009) |
| Anger directed at pressure source | "no me gusta que me presionen", irritation at influence attempt | `reticente` (Fundamental) |
| Escalating counter-argumentation | Rebuts every point, questions seller intent | `reticente` (Fundamental) |
| Counter-argumentation **decreases** after feeling heard | "exacto, eso es" → cooperation resumes | De-escalation from `reticente` |

---

## 2. Evidence Accumulation Rules

Evidence accumulates across turns. The evidence vector is a persistent structure stored in `conversation_state` (§6.2), not derived from message context alone.

### 2.1 Multi-Turn Accumulation

Evidence from turn N builds on turn N-1. The evidence vector is **append-only** within a conversation session; individual evidence items are **weighted and decayed**, never deleted.

```
evidence_vector_t = evidence_vector_{t-1} + new_observables_t
```

Each evidence item carries:
- `type`: one of the 8 types
- `signal`: the specific observable detected (e.g., `question_price`, `objection_guarantee`)
- `weight`: base weight × intensity modifier × context modifier
- `timestamp`: when observed
- `turn`: turn number when observed

### 2.2 Temporal Decay

Older evidence loses weight. Each evidence type has a different half-life based on its temporal reliability:

| Type | Half-life (turns) | Rationale |
|------|-------------------|-----------|
| `question` | 3 | Questions reflect current curiosity; lose relevance as topic shifts |
| `statement` | 5 | Declarations about problems/objectives persist longer |
| `objection` | 4 | Objections are sticky but can be resolved |
| `emotion` | 2 | Emotional states are volatile; decay fast |
| `behavior` | 3 | Behavioral patterns are moderately stable within a session |
| `explicito` | 2 | Self-reports are unreliable and should decay fast (P-008) |
| `post-purchase` | 6 | Post-purchase signals are durable facts |
| `meta` | 1 | Meta signals are momentary; sidecar only |

**Decay formula:**

```
effective_weight(item) = item.weight × (0.5 ^ (turns_elapsed / half_life))
```

Where `turns_elapsed = current_turn - item.turn`.

### 2.3 Corroboration Rule

The `explicito` type (self-report) **never moves state alone** (P-006, P-008). It requires corroboration from at least one other evidence type to contribute to a state estimate change.

**Corroboration matrix:**

| `explicito` claims state | Requires corroboration from | Corroborating signal examples |
|--------------------------|----------------------------|-------------------------------|
| "estoy comparando" | `question` (comparison) or `behavior` (high question density) | Asks "¿cuál es mejor?", re-questions same products |
| "estoy decidiendo" | `question` (price/risk) or `objection` or `behavior` | Asks about payment, raises guarantee concern |
| "me interesa" | `behavior` (engagement) or `question` (solution) | Follow-up questions, detailed inquiries |
| "no me convence" | `objection` (specific) or `emotion` (negative) | Names specific risk, expresses frustration |

**Without corroboration:** `explicito` evidence is stored but does not update the state distribution. It remains in the evidence vector at weight 0.3 but contributes 0 to Bayesian update until corroborated.

### 2.4 Contradiction Rule

Conflicting evidence **reduces confidence**, never flips state directly. Contradiction is detected when:

1. Two evidence items of different types imply **mutually exclusive states** (e.g., `question_price` → `transaccional` AND `objection` → `evaluando_riesgo`)
2. Evidence from the **same type** reverses valence (e.g., positive emotion in turn N, negative emotion in turn N+2)

**Contradiction handling:**

```
When contradiction detected:
  confidence.top_state *= 0.7   // reduce confidence by 30%
  confidence.all_states *= 0.9  // slight uncertainty increase across all
  Mark contradiction event in observable_log
  DO NOT flip state — let Bayesian update handle it naturally
```

The state with the highest posterior probability still wins; but the system will not **act** on a state with reduced confidence until evidence resolves (§5).

### 2.5 Evidence Hierarchy (The Mom Test — P-008/P-009)

Reliability of evidence depends on **type**, not content. From most to least reliable:

| Rank | Evidence Category | MIA Type | Weight Multiplier |
|------|------------------|----------|-------------------|
| 1 | Past behavior (specific episode) | `behavior` (concrete) | 1.5× |
| 2 | Current process ("¿cómo lo resuelves hoy?") | `question` (solution/process) | 1.2× |
| 3 | Investment (time, reputation, money) | `post-purchase` / `behavior` (commitment) | 1.4× |
| 4 | Declared opinion | `explicito` / `statement` | 0.3× (`explicito`), 0.6× (`statement`) |

---

## 3. Emission Model (Observable → State Mapping)

Each observable signal has a probability distribution over states. This is the **emission matrix** — the core of Bayesian state estimation.

### 3.1 Signal Catalog

From `kb/observables.md` §"Catálogo de señales":

| Signal ID | Observable Pattern | Primary State(s) | Source |
|-----------|-------------------|-------------------|--------|
| S-001 | Question about comparison / criteria / alternatives | `comparando` | P-001 |
| S-002 | Question about "how it's solved", overview | `comprendiendo` | P-007 |
| S-003 | Question about warranty / returns / timelines / risk | `evaluando_riesgo` | P-003 |
| S-004 | Question about price / payment / final steps | `transaccional`, `decidiendo` | P-001 |
| S-005 | Mention of competitor | `comparando` | P-001 |
| S-006 | "Es para regalo" / budget context | `descubriendo`, `comparando` | criteria context |
| S-007 | Declaration of problem / discomfort | `descubriendo` | P-007 |
| S-008 | "Ya tengo otra opción" | `evaluando_riesgo` | P-003 |
| S-009 | Mention of third parties / cases / statistics | `evaluando_riesgo`, `decidiendo` | P-015 (descriptive norm) |
| S-010 | Mention of credentials / expert recommendation | `evaluando_riesgo`, `decidiendo` | P-016 (conditional) |
| S-011 | Similarity signals / compliments / seller affinity | `decidiendo` | P-017 |
| S-012 | Mutual concession / favor reference | `decidiendo`, `transaccional` | P-018 (context only) |
| S-013 | "Nosotros" language / shared identity | `decidiendo`, `evaluando_riesgo` | P-019 |
| S-014 | Price references / presentation order | `comparando`, `evaluando_riesgo` | P-020 (anchoring) |
| S-015 | Scarcity by offer/deadline ("solo quedan X", "termina el viernes") | `consecuente`, `transaccional` | P-013 (loss of access) |
| S-016 | Demand signals ("600 compraron hoy", "quedan pocos") | `evaluando_riesgo`, `decidiendo`, `consecuente` | P-015 (informational cascade) |
| S-017 | Growing option enumeration / re-opening discarded options | `confundido` | P-022 (overload) |
| S-018 | "No puedo decidir", "todas parecen iguales" | `confundido` | P-022 consequence |
| S-019 | "¿Y si me equivoco?", "¿habré hecho bien?" | `decidiendo` (blocked), `confundido` | P-023 |
| S-020 | Post-decision comparison ("podría haber elegido la otra") | `evaluando_resultados`, `frustrado` | P-005 |
| S-021 | Maximizer language ("tengo que encontrar la mejor") | constrains P-021 | modulates commitment threshold |
| S-022 | Satisficer language ("esta está bien") | constrains P-021 | lower threshold |
| S-023 | "¿Cuál me recomiendas?" (request for reduction) | `confundido`, `decidiendo` | C-015 (antidote) |
| S-024 | Budget justified by pain ("esto nos cuesta X al mes") | `consecuente`, `transaccional` | Sandler gate |
| S-025 | Buyer defends the solution (argues for its value) | `consecuente`, `decidiendo` | diagnostic test |
| S-026 | Quantifies cost of inaction ("si no lo arreglamos, perdemos X") | `consecuente` | GAP: Cost of Inaction |
| S-027 | Triple gate met (relevant + urgent + unresolved) | `consecuente` | GAP gate |
| S-028 | Future desired state language ("me gustaría que quedara así") | `consecuente` | P-024 (attraction) |
| S-029 | Buyer reformulates own insight ("exacto, eso es") | `decidiendo`, `consecuente` | auto-persuasion (P-012) |
| S-030 | *Change talk*: reasons for change articulated | `decidiendo`, `consecuente` | MI (direction of tension) |
| S-031 | *Sustain talk*: reasons for status quo | `reticente`, `decidiendo` (blocked) | MI (ambivalence) |
| S-032 | Explicit ambivalence ("por un lado quiero, por otro me da miedo") | `decidiendo` | MI (dual-pole tension) |
| S-033 | Post-purchase delivery/usage mention | `esperando`, `experimentando` | P-005 |
| S-034 | Post-purchase satisfaction expression | `evaluando_resultados`, `abogando` | P-005 |
| S-035 | Post-purchase complaint | `frustrado` | P-005 |
| S-036 | Anger directed at pressure source | `reticente` | Rains 2013 (indicator 1) |
| S-037 | Escalating counter-argumentation | `reticente` | Rains 2013 (indicator 2) |
| S-038 | Resistance to pressure expressed | `reticente` | Brehm/Cialdini + meta-analysis |
| S-039 | Buyer says "no" but stays in conversation | `reticente`, `decidiendo` | NSPD (P-010: position, not exit) |
| S-040 | Counter-argumentation decreases after feeling heard | de-escalation from `reticente` | P-025/P-026 |

### 3.2 Emission Probability Table

Each cell `P(signal | state)` represents the probability that a given state produces the given observable signal. Values are calibrated from signal frequency in the knowledge base; actual weights require empirical calibration from labeled conversations.

**Legend:** `question` sub-types: `q_price`, `q_risk`, `q_compare`, `q_solution`. `objection` sub-types: `obj_price`, `obj_time`, `obj_trust`. `emotion`: `emo_neg`, `emo_pos`. `behavior`: `b_compare`, `b_confused`, `b_requestion`. `explicito`: `exp`. `post-purchase`: `pp`.

| State | q_price | q_risk | q_compare | q_solution | statement | obj_price | obj_time | obj_trust | emo_neg | emo_pos | b_compare | b_confused | exp | pp |
|-------|---------|--------|-----------|------------|-----------|-----------|----------|-----------|---------|---------|-----------|------------|-----|-----|
| `explorando` | 0.05 | 0.02 | 0.03 | 0.05 | 0.10 | 0.03 | 0.02 | 0.02 | 0.05 | 0.10 | 0.05 | 0.05 | 0.15 | 0.01 |
| `descubriendo` | 0.10 | 0.08 | 0.05 | 0.15 | 0.60 | 0.05 | 0.03 | 0.05 | 0.25 | 0.10 | 0.10 | 0.08 | 0.30 | 0.01 |
| `consecuente` | 0.15 | 0.10 | 0.08 | 0.10 | 0.50 | 0.08 | 0.05 | 0.05 | 0.35 | 0.15 | 0.10 | 0.05 | 0.35 | 0.01 |
| `comprendiendo` | 0.20 | 0.15 | 0.10 | 0.40 | 0.30 | 0.05 | 0.05 | 0.05 | 0.15 | 0.15 | 0.15 | 0.10 | 0.25 | 0.01 |
| `comparando` | 0.30 | 0.20 | 0.50 | 0.15 | 0.20 | 0.10 | 0.08 | 0.08 | 0.15 | 0.10 | 0.55 | 0.15 | 0.30 | 0.01 |
| `evaluando_riesgo` | 0.15 | 0.60 | 0.20 | 0.10 | 0.15 | 0.35 | 0.25 | 0.30 | 0.25 | 0.08 | 0.30 | 0.15 | 0.20 | 0.01 |
| `decidiendo` | 0.25 | 0.30 | 0.15 | 0.10 | 0.20 | 0.20 | 0.15 | 0.15 | 0.20 | 0.20 | 0.20 | 0.10 | 0.40 | 0.01 |
| `transaccional` | 0.50 | 0.08 | 0.05 | 0.05 | 0.15 | 0.08 | 0.05 | 0.05 | 0.10 | 0.25 | 0.05 | 0.03 | 0.60 | 0.05 |
| `confundido` | 0.15 | 0.15 | 0.25 | 0.15 | 0.10 | 0.15 | 0.10 | 0.10 | 0.35 | 0.05 | 0.40 | 0.50 | 0.15 | 0.01 |
| `frustrado` | 0.08 | 0.25 | 0.10 | 0.05 | 0.15 | 0.40 | 0.30 | 0.25 | 0.75 | 0.03 | 0.15 | 0.10 | 0.08 | 0.15 |
| `reticente` | 0.05 | 0.15 | 0.08 | 0.03 | 0.10 | 0.45 | 0.20 | 0.35 | 0.55 | 0.02 | 0.08 | 0.05 | 0.08 | 0.01 |
| `esperando` | 0.05 | 0.10 | 0.03 | 0.03 | 0.05 | 0.05 | 0.05 | 0.05 | 0.20 | 0.15 | 0.03 | 0.03 | 0.20 | 0.70 |
| `experimentando` | 0.08 | 0.05 | 0.05 | 0.05 | 0.10 | 0.05 | 0.03 | 0.03 | 0.10 | 0.25 | 0.05 | 0.05 | 0.15 | 0.75 |
| `evaluando_resultados` | 0.10 | 0.15 | 0.08 | 0.05 | 0.10 | 0.10 | 0.05 | 0.08 | 0.30 | 0.20 | 0.08 | 0.08 | 0.20 | 0.65 |
| `abogando` | 0.05 | 0.03 | 0.03 | 0.05 | 0.15 | 0.02 | 0.02 | 0.02 | 0.05 | 0.70 | 0.05 | 0.03 | 0.30 | 0.60 |
| `desenganchado` | 0.01 | 0.01 | 0.01 | 0.01 | 0.01 | 0.01 | 0.01 | 0.01 | 0.05 | 0.01 | 0.01 | 0.01 | 0.01 | 0.01 |

**Note:** `desenganchado` has near-zero emission for all active signals because it is detected by **absence** (meta signals: silence, no response). Its primary emission is via `meta` type sidecar triggers (§3.3).

### 3.3 Sidecar Emission (meta type)

The `meta` type does not emit directly to states. It modifies the interpretation of other types and triggers sidecar rules:

| Meta Signal | Effect |
|-------------|--------|
| Silence > threshold after active MIA turn | Multiplies `desenganchado` probability by 1.5× |
| No response after MIA question ×2 | Multiplies `desenganchado` probability by 2.0× |
| Turn duration > median × 3 | Increases `confundido` probability by 1.3× |
| Same question rephrased > 2 times | Increases `confundido` probability by 1.4× |
| Option count mentioned without convergence | Increases `confundido` probability by 1.3× per option |

---

## 4. Bayesian Update Rule

### 4.1 Formula

```
P(state | evidence) ∝ P(evidence | state) × P(state)
```

Where:
- **P(evidence | state)** = emission probability from the emission matrix (§3.2), combined across all active evidence items in the current turn
- **P(state)** = prior probability, derived from the transition model (§4.2)
- **Posterior** = updated belief after incorporating current turn's evidence

### 4.2 Prior Construction

The prior for turn N is derived from the posterior of turn N-1, modified by transition probabilities from `kb/transiciones.md`.

```
prior_t(state_j) = Σ_i [ posterior_{t-1}(state_i) × P(state_i → state_j) ]
```

Where `P(state_i → state_j)` is the transition probability from the transition matrix. For states not connected by a direct transition, `P = 0.01` (residual probability to prevent state death).

**Transition matrix (subset — forward transitions):**

| From → To | Prior | Source |
|-----------|-------|--------|
| `explorando` → `descubriendo` | 0.55 | P-001, P-007 |
| `descubriendo` → `consecuente` | 0.55 | P-013, P-024 |
| `descubriendo` → `comprendiendo` | 0.60 | P-001, P-007 |
| `consecuente` → `comprendiendo` | 0.60 | P-001, P-013, P-024 |
| `comprendiendo` → `consecuente` | 0.40 | P-013, P-024 |
| `comprendiendo` → `comparando` | 0.60 | P-001 |
| `comparando` → `decidiendo` | 0.40 | P-001 |
| `decidiendo` → `transaccional` | 0.70 | P-001, P-010 |
| `transaccional` → `esperando` | 0.85 | P-005 |
| `esperando` → `experimentando` | 0.75 | P-005 |
| `experimentando` → `evaluando_resultados` | 0.70 | P-005 |
| `evaluando_resultados` → `abogando` | 0.60 | P-005, P-003 |

**Loop transitions:**

| From → To | Prior | Note |
|-----------|-------|------|
| `comparando` ⇄ `evaluando_riesgo` | 0.55 | Most common loop |
| `decidiendo` → `comparando` | 0.20 | Final doubts reopen evaluation |
| `decidiendo` → `evaluando_riesgo` | 0.20 | Final doubts reopen evaluation |

**Sidecar transitions (any state):**

| Trigger | Target | Prior |
|---------|--------|-------|
| Any → `confundido` | overload / incoherence | 0.15 |
| Any → `frustrado` | negative experience | 0.15 |
| Any → `reticente` | perceived pressure > threshold | 0.15 |
| `comparando`/`evaluando_riesgo` → `confundido` | options growing without convergence | sidecar |

### 4.3 Combined Update (Full Algorithm)

For each turn:

```
1. Extract observables from message
2. For each state S:
   a. Compute likelihood: P(evidence | S) = Π over active signals of emission_prob(signal, S)
   b. Compute prior: P(S) = Σ over all previous states of posterior_prev × transition_prob
   c. Compute unnormalized posterior: likelihood × prior
3. Normalize: P(S | evidence) = unnormalized(S) / Σ unnormalized(all states)
4. Apply corroboration rule: if only `explicito` supports top state, clamp confidence boost
5. Apply contradiction penalty: if conflicting signals detected, multiply confidence by 0.7
6. Store posterior as new state distribution
```

---

## 5. Confidence Thresholds

Confidence is the probability of the **most likely state** (the top posterior).

### 5.1 Threshold Definitions

| Level | Range | Meaning | Action |
|-------|-------|---------|--------|
| **High** | > 0.7 | Strong evidence for top state | Act on state with full strategy |
| **Medium** | 0.4 – 0.7 | Moderate evidence; possible ambiguity | Act on state with caution; gather more evidence |
| **Low** | < 0.4 | Insufficient evidence to commit | Ask clarifying question; do not act on any specific state |

### 5.2 Action Threshold

MIA **only acts on a state when confidence > 0.5**. Below this threshold:

- MIA uses neutral, rapport-building, or information-gathering actions
- MIA does **not** attempt to close, present products, or handle objections specifically
- MIA may ask a diagnostic question to gather more evidence

### 5.3 State-Specific Action Thresholds

Some states require higher confidence before certain actions:

| State | Standard Action Threshold | Close Attempt Threshold | Rationale |
|-------|--------------------------|------------------------|-----------|
| `transaccional` | 0.5 | 0.6 | Ready to act; remove friction |
| `decidiendo` | 0.5 | 0.7 | Facilitate, don't pressure |
| `evaluando_riesgo` | 0.5 | N/A (never close) | Address risk, never dismiss |
| `reticente` | 0.4 (detect) | N/A (never close) | De-escalate immediately |
| `frustrado` | 0.4 (detect) | N/A (never close) | Recovery first, never sell |
| `confundido` | 0.5 | N/A (never close) | Simplify, recommend default |

### 5.4 Loop Detection Thresholds

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Same state > 5 turns | dwell exceeded | Suggest decision framework or default |
| `confundido` > 3 turns | overload sustained | Reduce options, offer recommendation |
| `evaluando_riesgo` > 4 turns | risk stall | Address specific risk or escalate to human |
| `reticente` detected | any confidence > 0.4 | De-escalate, restore control, wait |
| No state transition > 6 turns | stagnation | Check engagement, ask clarifying question |
| Evidence confidence < 0.3 for > 3 turns | uncertainty sustained | Ask diagnostic question (The Mom Test style) |

---

## 6. Integration with MIA Runtime

### 6.1 Architecture: Current vs. Proposed

**Current pipeline** (`src/lib/runtime/runtime.ts`):

```
Message → Context Load → Intent Detection (intents.ts) → Product Recommendation → AI Execute → Response
```

**Proposed pipeline:**

```
Message → Context Load → Observable Extraction → Evidence Accumulation → State Estimation → Action Selection → AI Execute (with state context) → Response
```

### 6.2 Component Mapping

| Current Component | Proposed Replacement | Notes |
|-------------------|---------------------|-------|
| `src/lib/runtime/intents.ts` (keyword detection) | Observable extraction (same LLM call, different output) | The LLM already parses the message; add observable extraction to the same call |
| `src/lib/ai/customer-memory.ts` (flat lists) | Extended with state history and evidence vector | CustomerMemory gains `currentState`, `confidence`, `evidenceVector` fields |
| `src/lib/sales/detect.ts` (post-hoc detection) | Becomes redundant | State estimation replaces post-hoc classification |
| `src/lib/ai/prompts.ts` (prompt builder) | Add state context to prompt | Include current state + confidence in system prompt |

### 6.3 Data Model Extensions

```sql
-- Conversation-level state tracking
CREATE TABLE conversation_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,

  -- State estimation
  state_distribution JSONB NOT NULL DEFAULT '{}',
  -- e.g. { "comparando": 0.42, "evaluando_riesgo": 0.35, "decidiendo": 0.12, ... }
  current_state TEXT NOT NULL DEFAULT 'explorando',
  confidence FLOAT NOT NULL DEFAULT 0.0,

  -- Evidence vector (append-only, decayed at read time)
  evidence_vector JSONB NOT NULL DEFAULT '[]',
  -- e.g. [{ "type": "question", "signal": "q_price", "weight": 0.5, "turn": 3, "ts": "..." }, ...]

  -- State history (for analytics and calibration)
  state_history JSONB NOT NULL DEFAULT '[]',
  -- e.g. [{ "state": "descubriendo", "confidence": 0.65, "turn": 2, "ts": "..." }, ...]

  -- Turn metadata
  turn_count INT NOT NULL DEFAULT 0,
  last_turn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_conversation_state UNIQUE (conversation_id)
);

-- Observable extraction log (for learning and calibration)
CREATE TABLE observable_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,

  -- What was extracted
  observables JSONB NOT NULL DEFAULT '[]',
  -- e.g. [{ "type": "question", "signal": "q_risk", "raw_text": "¿y la garantía?", "weight": 0.6 }]

  -- State before and after this turn's update
  state_before JSONB,
  state_after JSONB,

  -- What MIA did (for A/B testing and calibration)
  action_taken TEXT,
  action_confidence FLOAT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast conversation state lookup
CREATE INDEX idx_conversation_state_conversation ON conversation_state(conversation_id);
CREATE INDEX idx_observable_log_conversation ON observable_log(conversation_id, created_at);
```

### 6.4 Customer Memory Extension

The current `CustomerMemory` interface (`src/lib/ai/customer-memory.ts:3-13`) is extended:

```typescript
// Current interface (flat lists — no state)
interface CustomerMemory {
  interests: string[]
  objections: string[]
  questions: string[]
  preferences: string[]
  tags?: string[]
  status?: string | null
  city?: string | null
  lastInteraction: string | null
  summary: string
}

// Extended interface (adds state tracking)
interface CustomerMemory {
  interests: string[]
  objections: string[]
  questions: string[]
  preferences: string[]
  tags?: string[]
  status?: string | null
  city?: string | null
  lastInteraction: string | null
  summary: string

  // NEW: state tracking
  currentState?: string                // most likely state name
  confidence?: number                  // confidence in currentState
  stateHistory?: StateSnapshot[]       // last N state transitions
  turnCount?: number                   // total turns in current session
}

interface StateSnapshot {
  state: string
  confidence: number
  turn: number
  timestamp: string
}
```

### 6.5 Prompt Integration

The prompt builder (`src/lib/ai/prompts.ts`) adds a state context block:

```
## Estado cognitivo del comprador
- Estado actual: {current_state}
- Confianza: {confidence_level} ({confidence}%)
- Turnos en esta sesión: {turn_count}
- Última transición: {previous_state} → {current_state} (turno {transition_turn})

### Acciones recomendadas para este estado
{actions_for_state}

### Acciones a evitar para este estado
{avoid_for_state}
```

### 6.6 Observable Extraction (replaces intent detection)

The current `detectIntent()` in `src/lib/runtime/intents.ts:77-88` performs keyword matching against 6 flat tags. The replacement performs structured observable extraction:

```
// Current: flat keyword match → single IntentTag
detectIntent("¿cuánto cuesta?") → "price"

// Proposed: structured observable extraction → list of observables
extractObservables("¿cuánto cuesta?") → [
  { type: "question", signal: "q_price", object: "price", weight: 0.5 }
]

extractObservables("¿qué pasa si no me gusta la garantía?") → [
  { type: "question", signal: "q_risk", object: "risk", weight: 0.6 },
  { type: "objection", signal: "obj_trust", weight: 0.6 }
]

extractObservables("estoy comparando con otra opción más barata") → [
  { type: "explicito", signal: "exp", claimed_state: "comparando", weight: 0.3 },
  { type: "question", signal: "q_compare", object: "comparison", weight: 0.5 },
  { type: "statement", signal: "s008", weight: 0.6 }
]
```

---

## 7. Evidence Accumulation Algorithm (Pseudocode)

```
function accumulateEvidence(conversationState, newMessage):
    // STEP 1: Extract observables from the new message
    observables = extractObservables(newMessage)

    // STEP 2: Build evidence items
    newEvidence = []
    for each observable in observables:
        item = {
            type: observable.type,
            signal: observable.signal,
            weight: observable.weight * getEvidenceMultiplier(observable.type),
            turn: conversationState.turnCount + 1,
            timestamp: now()
        }
        newEvidence.append(item)

    // STEP 3: Append to evidence vector (append-only)
    evidenceVector = conversationState.evidenceVector + newEvidence

    // STEP 4: Compute effective weights (with decay)
    for each item in evidenceVector:
        turnsElapsed = currentTurn - item.turn
        halfLife = getHalfLife(item.type)
        item.effectiveWeight = item.weight * (0.5 ^ (turnsElapsed / halfLife))

    // STEP 5: Compute transition prior from previous state distribution
    prior = {}
    prevDist = conversationState.stateDistribution
    for each prevState in prevDist:
        for each nextState in TRANSITION_MATRIX[prevState]:
            prior[nextState] = (prior[nextState] || 0) + prevDist[prevState] * TRANSITION_MATRIX[prevState][nextState]

    // Ensure all states have a minimum prior (prevent state death)
    for each state in ALL_STATES:
        if prior[state] is undefined or prior[state] < 0.01:
            prior[state] = 0.01

    // Normalize prior
    priorSum = sum(prior.values())
    for each state in prior:
        prior[state] = prior[state] / priorSum

    // STEP 6: Compute likelihood for each state given active evidence
    // (only use evidence from last 3 turns for likelihood — older evidence
    //  already contributed via prior chain)
    activeEvidence = evidenceVector.filter(item => currentTurn - item.turn <= 3)

    likelihood = {}
    for each state in ALL_STATES:
        likelihood[state] = 1.0
        for each item in activeEvidence:
            emissionProb = EMISSION_MATRIX[state][item.signal]
            if emissionProb is undefined:
                emissionProb = 0.01  // floor to prevent zero likelihood
            // Weight the emission by effective evidence weight
            likelihood[state] *= (emissionProb ^ item.effectiveWeight)

    // STEP 7: Bayesian update
    posterior = {}
    for each state in ALL_STATES:
        posterior[state] = likelihood[state] * prior[state]

    // Normalize
    posteriorSum = sum(posterior.values())
    for each state in posterior:
        posterior[state] = posterior[state] / posteriorSum

    // STEP 8: Apply corroboration rule
    // Check if top state is only supported by explicito
    topState = argmax(posterior)
    explicitoOnly = isSupportedOnlyBy(topState, evidenceVector, "explicito")
    if explicitoOnly:
        // Clamp: don't let explicito-only boost exceed 0.4 confidence
        if posterior[topState] > 0.4:
            posterior[topState] = 0.4
            // Redistribute excess to other states proportionally
            redistributeExcess(posterior)

    // STEP 9: Apply contradiction penalty
    if hasContradiction(activeEvidence):
        for each state in posterior:
            posterior[state] *= 0.95  // slight uncertainty increase
        // Extra penalty on top state
        posterior[topState] *= 0.7
        // Re-normalize
        normalize(posterior)

    // STEP 10: Detect sidecar triggers (meta signals)
    if hasSidecarTrigger(conversationState, newMessage):
        applySidecarEffects(posterior, conversationState, newMessage)

    // STEP 11: Update state
    conversationState.stateDistribution = posterior
    conversationState.currentState = argmax(posterior)
    conversationState.confidence = max(posterior.values())
    conversationState.evidenceVector = evidenceVector
    conversationState.turnCount += 1

    // Record state history
    conversationState.stateHistory.append({
        state: conversationState.currentState,
        confidence: conversationState.confidence,
        turn: conversationState.turnCount,
        timestamp: now()
    })

    return conversationState


function getEvidenceMultiplier(type):
    multipliers = {
        "question": 1.0,
        "statement": 1.0,
        "objection": 1.0,
        "emotion": 0.8,      // emotional signals are noisier
        "behavior": 0.9,
        "explicito": 0.3,    // weak per P-008
        "post-purchase": 1.2,
        "meta": 0.5          // sidecar, not direct
    }
    return multipliers[type] or 1.0


function getHalfLife(type):
    halfLives = {
        "question": 3,
        "statement": 5,
        "objection": 4,
        "emotion": 2,
        "behavior": 3,
        "explicito": 2,
        "post-purchase": 6,
        "meta": 1
    }
    return halfLives[type] or 3


function getActionsForState(state, confidence):
    actions = {
        "explorando": {
            primary: "Build rapport, discover needs",
            avoid: ["Present products", "Push close", "Ask about budget"],
            threshold: 0.5
        },
        "descubriendo": {
            primary: "Explore problem, validate pain with past episodes",
            avoid: ["Pitch solution", "Present products", "Skip to price"],
            threshold: 0.5
        },
        "consecuente": {
            primary: "Quantify impact, explore urgency, reinforce gap",
            avoid: ["Skip to price", "Dismiss urgency"],
            threshold: 0.5
        },
        "comprendiendo": {
            primary: "Present solution landscape, educate",
            avoid: ["Compare products prematurely", "Push single product"],
            threshold: 0.5
        },
        "comparando": {
            primary: "Help compare, limit options, offer default",
            avoid: ["Push single product", "Add more options", "Close"],
            threshold: 0.5
        },
        "evaluando_riesgo": {
            primary: "Address specific risk with evidence",
            avoid: ["Dismiss concerns", "Close", "Change topic"],
            threshold: 0.5
        },
        "decidiendo": {
            primary: "Facilitate choice, reduce friction, restore control",
            avoid: ["Apply pressure", "Add complexity", "Re-open options"],
            threshold: 0.5
        },
        "transaccional": {
            primary: "Clear path to purchase, remove friction",
            avoid: ["Add complexity", "Upsell", "Re-open evaluation"],
            threshold: 0.5
        },
        "confundido": {
            primary: "Simplify, recommend default, reduce options",
            avoid: ["Add options", "Ask open-ended questions"],
            threshold: 0.5
        },
        "frustrado": {
            primary: "Recover, validate, solve problem — NEVER sell",
            avoid: ["Sell", "Defend product", "Dismiss complaint"],
            threshold: 0.4
        },
        "reticente": {
            primary: "De-escalate (P-025), restore control (P-026), wait",
            avoid: ["Insist", "Argue", "Close", "Apply any pressure"],
            threshold: 0.4
        },
        "desenganchado": {
            primary: "Attempt re-engagement once, then archive",
            avoid: ["Persist", "Send multiple messages"],
            threshold: 0.5
        }
    }
    return actions[state] or { primary: "Gather information", avoid: [], threshold: 0.5 }
```

---

## 8. Calibration and Evolution

### 8.1 Initial Calibration

The emission matrix (§3.2) values are **informed estimates** from the knowledge base signal catalog. They require empirical calibration:

1. **Phase 1 — Data Collection:** Deploy observable extraction without state estimation. Log all extracted observables.
2. **Phase 2 — Human Labeling:** Label a corpus of conversations with ground-truth states.
3. **Phase 3 — MLE Calibration:** Fit emission weights via maximum likelihood estimation on labeled data.
4. **Phase 4 — Validation:** Compare system state estimates against human labels; target >70% agreement.

### 8.2 Adaptive Learning

After calibration, the emission matrix can be updated incrementally:

```
new_weight = α × observed_frequency + (1 - α) × current_weight
```

Where `α = 0.1` (slow adaptation to prevent oscillation).

### 8.3 What Cannot Be Learned

The following are **fixed by design** (from research, not data):

- The 15+1 states (from `kb/estados.md`)
- The transition topology (from `kb/transiciones.md`)
- The `explicito` corroboration rule (from P-008, P-006)
- The `reticente` special handling (from P-025, P-026, Fundamental)
- The evidence hierarchy (from The Mom Test, P-008/P-009)

---

## Appendix A: File References

| File | Role in Evidence Model |
|------|----------------------|
| `src/lib/runtime/intents.ts` | Current keyword detection — **replaced** by observable extraction (§6.6) |
| `src/lib/ai/customer-memory.ts` | Current flat memory — **extended** with state fields (§6.4) |
| `docs/research/kb/observables.md` | Signal dictionary — **source of truth** for observable types and signals (§1, §3.1) |
| `docs/research/kb/estados.md` | State atlas — **defines** the 15+1 states the model estimates |
| `docs/research/kb/transiciones.md` | Transition priors — **defines** the prior construction (§4.2) |
| `docs/research/kb/principios.md` | 26 principles — **defines** confidence levels, evidence hierarchy, and special rules |
| `docs/research/MIA_EVIDENCE_REASONING_RESEARCH.md` | Architecture analysis — **recommended** Option B (lightweight scoring) for MVP |

## Appendix B: Contradiction Register

| # | Contradiction | Resolution | Status |
|---|--------------|------------|--------|
| 1 | States are continuous (UBSE); runtime needs discrete states | Use probability distribution over discrete states; threshold for action selection | Resolved |
| 2 | `explicito` is weak evidence; customer says "I'm comparing" | Weight 0.3, require corroboration (§2.3) | Resolved |
| 3 | Closing pressure increases reactance (P-026); sales process requires closing | Close ONLY when state = `transaccional` with confidence > 0.6; never pressure | Resolved |
| 4 | Evidence accumulation requires turn history; context window is limited | Store evidence vector in DB (§6.3), not context window; only load summary | Resolved |
| 5 | LLM can detect state better than rules; rules are faster/cheaper | Use LLM for observable extraction; use deterministic rules for state estimation (§7) | Resolved |
| 6 | Emission weights are uncalibrated; real data may differ significantly | Deploy in 4 phases: collect → label → fit → validate (§8.1) | Acknowledged |
