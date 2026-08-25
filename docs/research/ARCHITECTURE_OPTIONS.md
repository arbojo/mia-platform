# Architecture Options: Evidence Accumulation in MIA

**Status:** Research — Decision Pending
**Date:** 2026-08-25
**Author:** Architecture & AI Engineering
**Scope:** How MIA implements real-time customer state estimation from conversational observables

---

## 1. Context

MIA's current runtime (`src/lib/runtime/runtime.ts`) processes each customer turn independently with keyword-based intent classification (6 flat tags in `src/lib/runtime/intents.ts`). The UBSE research base (`docs/research/kb/`) defines a rich 15-state cognitive model with transition priors and observable dictionaries. This document evaluates four architecture options for bridging that gap.

### Current Pipeline

```
Message → Context Load → Intent Detection (6 tags) → Product Rec → AI Execute → Response
         (runtime.ts)   (intents.ts, keywords)       (product-recommendation.ts)
```

### Required Capabilities

| Capability | Current | Required |
|------------|---------|----------|
| State tracking | None (per-turn) | Cross-turn accumulation |
| State model | 6 flat intent tags | 15 cognitive states |
| Evidence handling | Keyword triggers | Observable → evidence → hypothesis |
| Action selection | Linear pipeline | State-guided |
| Transition modeling | None | Prior-weighted from `transiciones.md` |

---

## 2. Architecture Options

---

### Option A: Full Bayesian Engine

#### Description

A complete probabilistic inference system implementing Hidden Markov Models (HMM) or Bayesian Networks over the 15 UBSE states. Each conversation turn emits observations, and the engine performs formal inference to maintain a posterior probability distribution over all states.

#### Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │           BAYESIAN ENGINE                   │
                    │                                             │
  Conversation      │  ┌──────────────┐   ┌──────────────────┐   │
  History ──────────┤  │  EMISSION    │   │  TRANSITION      │   │
                    │  │  MATRIX      │   │  MATRIX          │   │
  Current Turn ─────┤  │              │   │                  │   │
  (observables)     │  │  P(obs|state)│   │  P(state_t|      │   │
                    │  │  from KB     │   │   state_{t-1})   │   │
                    │  │              │   │  from KB         │   │
                    │  └──────┬───────┘   └────────┬─────────┘   │
                    │         │                     │             │
                    │         ▼                     ▼             │
                    │  ┌─────────────────────────────────────┐   │
                    │  │       INFERENCE ENGINE              │   │
                    │  │                                     │   │
                    │  │  Forward Algorithm /                │   │
                    │  │  Particle Filter                    │   │
                    │  │                                     │   │
                    │  │  P(state|obs_1..obs_t) =            │   │
                    │  │    η · P(obs_t|state) ·             │   │
                    │  │    Σ P(state|state_prev) ·          │   │
                    │  │      P(state_prev|obs_1..obs_{t-1}) │   │
                    │  └──────────────────┬──────────────────┘   │
                    │                     │                      │
                    │                     ▼                      │
                    │  ┌─────────────────────────────────────┐   │
                    │  │  POSTERIOR DISTRIBUTION             │   │
                    │  │                                     │   │
                    │  │  {                                }   │   │
                    │  │    explorando:    0.05              │   │   │
                    │  │    descubriendo:  0.12              │   │   │
                    │  │    consecuente:   0.45  ◄── mode    │   │   │
                    │  │    comprendiendo: 0.20              │   │   │
                    │  │    comparando:    0.08              │   │   │
                    │  │    ...                              │   │   │
                    │  │  }                                }   │   │
                    │  └──────────────────┬──────────────────┘   │
                    └─────────────────────┼──────────────────────┘
                                          │
                                          ▼
                    ┌─────────────────────────────────────────────┐
                    │        ACTION SELECTION                     │
                    │                                             │
                    │  state → strategy map → prompt modifier     │
                    │  (e.g., consecuente → emphasize pain,       │
                    │   evaluando_riesgo → address objections)    │
                    └─────────────────────────────────────────────┘
```

#### Data Flow

```
1. User message arrives (runtime.ts:processIncomingMessage)
2. Observable extractor scans message (new module: observable-extractor.ts)
   → produces typed signals: { type: 'question', object: 'precio', weight: 0.6 }
3. Emission likelihoods computed: P(observable|state) for all 15 states
4. Transition prior applied: P(state_t|state_{t-1}) from transiciones.md
5. Forward update: posterior = normalize(emission × prior × previous_posterior)
6. State estimation: argmax or threshold on posterior distribution
7. Action selection: state → prompt strategy → inject into system prompt
8. Persist posterior to Supabase (conversation_state table)
```

#### Integration Points with Existing MIA Code

| File | Integration |
|------|-------------|
| `src/lib/runtime/runtime.ts` | Insert state estimation step between message ingestion and AI execution (after line ~227, before line ~278) |
| `src/lib/runtime/intents.ts` | Replace `detectIntent()` with observable extractor; keep intent tags as observable inputs |
| `src/lib/ai/client.ts` | No changes — engine is compute-only, no new LLM calls |
| `src/lib/ai/prompts.ts` | Accept state posterior as input; inject state-specific prompt modifiers |
| `src/lib/ai/knowledge.ts` | Add `loadConversationState()` to fetch persisted posterior from Supabase |
| New: `src/lib/ai/evidence/` | Emission matrix, transition matrix, forward algorithm, observable extractor |

#### Pros

- **Mathematically principled** — optimal inference under uncertainty given the model
- **Handles partial observability** — multiple ambiguous signals combined coherently
- **Handles uncertainty** — probabilistic output captures genuine ambiguity
- **Research-grade** — publishable, auditable, defensible methodology
- **Handles retrocesos** — backward transitions modeled naturally via transition priors
- **Handles `reticente`** — sidecar rule (pressure > threshold) modeled as exogenous trigger

#### Cons

- **Complex to implement** — requires linear algebra, probability, calibration pipeline
- **Requires calibration data** — emission matrix weights need real conversation data to tune
- **Hard to debug** — posterior is a 15-dimensional vector; debugging requires trace visualization
- **Overkill for MVP** — 4-6 weeks for an engine that may need heavy recalibration
- **Emission matrix maintenance** — new observables require manual matrix updates
- **Cold start problem** — no initial posterior; needs uniform prior or heuristic bootstrap

#### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Calibration data unavailable | HIGH | Use KB weights as initial proxy; accept suboptimal accuracy |
| Engine latency > 50ms | MEDIUM | Forward algorithm is O(S²) with S=15 states → negligible |
| Debugging opacity | HIGH | Build posterior trace visualization from day 1 |
| Model misspecification | MEDIUM | Regular posterior predictive checks; fallback to uniform |

#### Rollback Strategy

- Feature flag: `FEATURE_BAYESIAN_ENGINE=false`
- When disabled: pipeline falls through to Option B (lightweight scoring) or current intents.ts
- State estimation writes to `conversation_state` table but action selection ignores it
- No changes to existing prompt pipeline when disabled

#### Complexity

**High** — new subsystem with probabilistic inference, calibration pipeline, and trace tooling.

#### Estimated Effort

**4-6 weeks** (1 engineer)
- Week 1-2: Emission matrix + transition matrix + forward algorithm
- Week 3: Observable extractor + integration with runtime
- Week 4: Calibration pipeline + trace visualization
- Week 5-6: Testing, tuning, documentation

#### Recommendation

**NOT for MVP.** Mathematically optimal but operationally complex. The emission matrix requires real conversation data to be meaningful, and the debugging overhead is significant for a team without Bayesian ML experience. Consider after Option B proves the value of state estimation.

---

### Option B: Lightweight Scoring (RECOMMENDED for MVP)

#### Description

A simple weighted-scoring system where each observable adds or subtracts score from each of the 15 candidate states. Transition priors from `transiciones.md` act as bonus/penalty on likely successors. The state with the highest score above a confidence threshold is selected as the current customer state.

#### Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │         LIGHTWEIGHT SCORER                  │
                    │                                             │
  Conversation      │  ┌──────────────────────────────────────┐   │
  History ──────────┤  │  OBSERVABLE DETECTOR                 │   │
                    │  │  (keyword + pattern rules)           │   │
  Current Turn ─────┤  │                                      │   │
  (raw text)        │  │  input: message text                 │   │
                    │  │  output: Observable[]                 │   │
                    │  │  { type, object, weight }            │   │
                    │  └──────────────┬───────────────────────┘   │
                    │                 │                           │
                    │                 ▼                           │
                    │  ┌──────────────────────────────────────┐   │
                    │  │  SCORING FUNCTION                    │   │
                    │  │                                      │   │
                    │  │  For each state s:                   │   │
                    │  │    score[s] += Σ weight(obs) ×       │   │
                    │  │      emission_table[obs.type][s]     │   │
                    │  │                                      │   │
                    │  │  Apply transition bonus:             │   │
                    │  │    if prev_state exists:             │   │
                    │  │      for each successor of prev:     │   │
                    │  │        score[successor] += prior     │   │
                    │  │                                      │   │
                    │  │  Decay previous scores by 0.7       │   │
                    │  └──────────────┬───────────────────────┘   │
                    │                 │                           │
                    │                 ▼                           │
                    │  ┌──────────────────────────────────────┐   │
                    │  │  STATE RESOLVER                      │   │
                    │  │                                      │   │
                    │  │  top = argmax(score)                 │   │
                    │  │  confidence = score[top] / Σ|scores| │   │
                    │  │                                      │   │
                    │  │  if confidence > threshold (0.3):    │   │
                    │  │    state = top                       │   │
                    │  │  else:                               │   │
                    │  │    state = previous (hold)           │   │
                    │  └──────────────┬───────────────────────┘   │
                    └─────────────────┼───────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────────────┐
                    │        ACTION SELECTION                     │
                    │                                             │
                    │  state → prompt modifier → inject           │
                    │  (same as Option A, but state from scoring) │
                    └─────────────────────────────────────────────┘
```

#### Data Flow

```
1. User message arrives (runtime.ts:processIncomingMessage)
2. Observable detector scans message (new module: observable-detector.ts)
   → rules-based: matches keywords/patterns from observables.md
   → produces: Observable[] { type: 'question', object: 'precio', weight: 0.6 }
3. Scoring function updates state scores:
   - Each observable boosts/demotes candidate states per emission_table
   - Transition prior boosts likely successors of previous state
   - Previous scores decay by factor (0.7) to prevent stale accumulation
4. State resolver picks top state if confidence > threshold
5. Action selection: state → prompt strategy → inject into system prompt
6. Persist state + scores to Supabase (conversation_state table)
```

#### Emission Table (Simplified)

```typescript
// src/lib/ai/evidence/emission-table.ts
const EMISSION_TABLE: Record<ObservableType, Partial<Record<State, number>>> = {
  question: {
    comprimiendo: 0.5,
    comparando: 0.4,
    evaluando_riesgo: 0.3,
    transaccional: 0.2,
  },
  statement: {
    descubriendo: 0.6,
    comprendiendo: 0.4,
    comparando: 0.3,
  },
  objection: {
    evaluando_riesgo: 0.6,
    decidiendo: 0.4,
  },
  emotion: {
    // valence-dependent — resolved at detection time
  },
  explicito: {
    // maps to declared state, but with low weight (0.3)
  },
  behavior: {
    comprimiendo: 0.3,
    comparando: 0.3,
    confundido: 0.4,
  },
  meta: {
    desenganchado: 0.5,
    confundido: 0.3,
  },
  'post-purchase': {
    esperando: 0.5,
    experimentando: 0.4,
    evaluando_resultados: 0.3,
    abogando: 0.3,
  },
}
```

#### Transition Bonus (Simplified from `transiciones.md`)

```typescript
// src/lib/ai/evidence/transitions.ts
const TRANSITION_PRIORS: Record<State, Array<{ to: State; prior: number }>> = {
  explorando: [{ to: 'descubriendo', prior: 0.55 }],
  descubriendo: [
    { to: 'consecuente', prior: 0.55 },
    { to: 'comprendiendo', prior: 0.60 },
  ],
  consecuente: [{ to: 'comprendiendo', prior: 0.60 }],
  comprendiendo: [
    { to: 'consecuente', prior: 0.40 },
    { to: 'comparando', prior: 0.60 },
  ],
  comparando: [
    { to: 'decidiendo', prior: 0.40 },
    { to: 'evaluando_riesgo', prior: 0.55 }, // loop
  ],
  decidiendo: [
    { to: 'transaccional', prior: 0.70 },
    { to: 'comparando', prior: 0.20 }, // retroceso
  ],
  transaccional: [{ to: 'esperando', prior: 0.85 }],
  esperando: [{ to: 'experimentando', prior: 0.75 }],
  experimentando: [{ to: 'evaluando_resultados', prior: 0.70 }],
  evaluando_resultados: [{ to: 'abogando', prior: 0.60 }],
  // Sidecar triggers (any → transversal)
  _any: [
    { to: 'confundido', prior: 0.15 },
    { to: 'frustrado', prior: 0.15 },
    { to: 'reticente', prior: 0.15 },
  ],
}
```

#### Integration Points with Existing MIA Code

| File | Integration |
|------|-------------|
| `src/lib/runtime/runtime.ts` | Insert state scoring step at line ~227 (after `detectIntent`, before `loadConversationContext`). Pass state to context loader. |
| `src/lib/runtime/intents.ts` | Keep as-is for now. Observable detector runs in parallel; intent tags feed into observable detection. |
| `src/lib/ai/client.ts` | No changes. |
| `src/lib/ai/prompts.ts` | Accept `customerState` parameter; inject state-specific prompt section. |
| `src/lib/ai/knowledge.ts` | Add `loadConversationState()` and `persistConversationState()` helpers. |
| New: `src/lib/ai/evidence/observable-detector.ts` | Pattern-matching rules from observables.md |
| New: `src/lib/ai/evidence/scorer.ts` | Scoring function + state resolution |
| New: `src/lib/ai/evidence/emission-table.ts` | Weight mappings (observable → state) |
| New: `src/lib/ai/evidence/transitions.ts` | Transition priors from transiciones.md |
| New: `src/lib/ai/evidence/state-prompt.ts` | State → prompt modifier mapping |

#### Pros

- **Interpretable** — every score update can be traced to specific observables
- **Easy to tune** — adjust weights in emission table, see immediate effects
- **Minimal infrastructure** — pure TypeScript, no external dependencies
- **Fast** — O(15 × observables) per turn, < 1ms latency
- **Debuggable** — log score changes per turn, visualize score history
- **Incremental** — can start with 5 states, expand to 15 as confidence grows
- **No LLM cost** — pure compute, zero token spend

#### Cons

- **Less principled than Bayesian** — scoring doesn't propagate uncertainty formally
- **Manual weight tuning** — emission weights set by expert judgment, not data
- **No principled uncertainty** — confidence threshold is a heuristic, not a posterior
- **Score drift** — without decay, scores accumulate and never reset
- **Simplification** — some observables have complex context-dependent meaning

#### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Weights poorly calibrated | MEDIUM | Start conservative (low weights); tune with laboratorio data |
| Score drift over long conversations | LOW | Decay factor (0.7) on all scores each turn; conversation reset |
| False state transitions | LOW | Confidence threshold (0.3) prevents flip-flopping |
| New observables not modeled | LOW | Emission table is extensible; add rows as needed |

#### Rollback Strategy

- Feature flag: `FEATURE_STATE_SCORING=false`
- When disabled: falls back to current `detectIntent()` in intents.ts
- State scoring writes to `conversation_state` table but is not read by prompts
- Zero risk to existing functionality when disabled

#### Complexity

**Low** — straightforward TypeScript implementation with clear data structures.

#### Estimated Effort

**1-2 weeks** (1 engineer)
- Day 1-2: Observable detector (pattern rules from observables.md)
- Day 3-4: Emission table + transition priors + scoring function
- Day 5-6: State resolution + confidence threshold
- Day 7-8: Integration with runtime.ts + prompt injection
- Day 9-10: Testing, tuning with laboratorio simulations

#### Recommendation

**START HERE.** This is the MVP. It proves whether state estimation adds value with minimal risk and cost. The emission table can be calibrated using existing laboratorio simulations. If it works, it becomes the runtime engine in Option D. If it doesn't, the investment is small and learnings feed into Option A.

---

### Option C: LLM-as-State-Estimator

#### Description

Use the existing GPT-4o-mini infrastructure to estimate customer state directly. Each conversation turn, a structured prompt includes the conversation history, all 15 state definitions, and the observable dictionary. The LLM returns a state distribution with confidence scores.

#### Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │         LLM STATE ESTIMATOR                 │
                    │                                             │
  Conversation      │  ┌──────────────────────────────────────┐   │
  History ──────────┤  │  PROMPT ASSEMBLER                    │   │
                    │  │                                      │   │
  Current Turn ─────┤  │  system = state definitions (15)     │   │
                    │  │  + observable dictionary             │   │
                    │  │  + conversation history              │   │
                    │  │  + "Estimate the customer's current  │   │
                    │  │     cognitive state"                 │   │
                    │  └──────────────┬───────────────────────┘   │
                    │                 │                           │
                    │                 ▼                           │
                    │  ┌──────────────────────────────────────┐   │
                    │  │         OpenAI API                   │   │
                    │  │  model: gpt-4o-mini                  │   │
                    │  │  response_format: json_schema        │   │
                    │  └──────────────┬───────────────────────┘   │
                    │                 │                           │
                    │                 ▼                           │
                    │  ┌──────────────────────────────────────┐   │
                    │  │  STRUCTURED RESPONSE                │   │
                    │  │                                      │   │
                    │  │  {                                  }   │   │
                    │  │    state: "consecuente"             │   │   │
                    │  │    confidence: 0.82                 │   │   │
                    │  │    distribution: {                  }   │   │
                    │  │      consecuente: 0.82              │   │   │
                    │  │      descubriendo: 0.10             │   │   │
                    │  │      comprendiendo: 0.05            │   │   │
                    │  │      ...                            │   │   │
                    │  │    }                              }   │   │
                    │  │    evidence: [                      │   │   │
                    │  │      "buyer mentioned concrete cost",│   │   │
                    │  │      "buyer asked about solution"   │   │   │
                    │  │    ]                                │   │   │
                    │  │  }                                }   │   │
                    │  └──────────────┬───────────────────────┘   │
                    └─────────────────┼───────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────────────┐
                    │        ACTION SELECTION                     │
                    │  (same as Options A/B)                      │
                    └─────────────────────────────────────────────┘
```

#### Data Flow

```
1. User message arrives
2. Prompt assembler builds estimation prompt:
   - System: "You are a customer state estimator. Given the conversation..."
   - Includes: all 15 state definitions from estados.md
   - Includes: observable dictionary from observables.md
   - Includes: conversation history (last 20 messages)
   - Includes: previous state estimate (for continuity)
3. OpenAI API call (gpt-4o-mini, structured output)
4. Parse JSON response: state, confidence, distribution, evidence
5. Persist to Supabase (conversation_state table)
6. Action selection: state → prompt modifier → inject
```

#### Cost Model

```typescript
// Based on src/lib/ai/client.ts TOKEN_COSTS
// gpt-4o-mini: input $0.15/1M, output $0.60/1M

// Prompt size estimate:
// - State definitions: ~3,000 tokens
// - Observable dictionary: ~2,000 tokens
// - Conversation history (20 msgs): ~2,000 tokens
// - Instructions: ~500 tokens
// Total input: ~7,500 tokens per estimation call

// Output: ~300 tokens (JSON response)

// Cost per estimation:
// input:  7,500 × $0.15/1M = $0.001125
// output:   300 × $0.60/1M = $0.000180
// Total per turn: ~$0.0013

// Monthly cost at 10K conversations × 10 turns avg:
// 100,000 estimation calls × $0.0013 = $130/month
```

#### Integration Points with Existing MIA Code

| File | Integration |
|------|-------------|
| `src/lib/runtime/runtime.ts` | Insert estimation call at line ~227 (after detectIntent, before loadConversationContext). Awaits LLM response before proceeding. |
| `src/lib/ai/client.ts` | Reuse `getOpenAIClient()` and `MODEL`. Add estimation-specific system prompt. |
| `src/lib/ai/prompts.ts` | Accept state estimation result; inject into main prompt. |
| `src/lib/ai/knowledge.ts` | Add `estimateCustomerState()` function calling OpenAI. |
| New: `src/lib/ai/evidence/state-estimator.ts` | Prompt assembly + response parsing |
| New: `src/lib/ai/evidence/state-definitions.ts` | 15 states as structured JSON for prompt |

#### Pros

- **Leverages existing infrastructure** — already have OpenAI client, model, tracking
- **Handles nuance** — LLM understands context, sarcasm, implicit signals better than rules
- **No manual tuning** — the LLM "learns" the state model from the definitions
- **Rich output** — can return reasoning, evidence chain, confidence
- **Self-documenting** — prompt contains all definitions; auditable
- **Fast to implement** — 1 week; mostly prompt engineering

#### Cons

- **Expensive** — $130/month per 10K conversations at 10 turns avg
- **Slow** — adds 200-500ms latency per turn (LLM inference time)
- **Non-deterministic** — same input can produce different state estimates
- **Hard to debug** — can't inspect "why" without prompt inspection
- **Token budget** — estimation prompt adds ~7.5K tokens per turn to already-heavy prompts
- **Rate limits** — OpenAI rate limits apply; 100K calls/month may hit tiers
- **Hallucination risk** — LLM may invent observables that don't exist
- **Prompt injection** — adversarial customer messages could manipulate state estimation

#### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cost exceeds budget | HIGH | Cap estimation calls; fallback to scoring when budget exceeded |
| Latency impact on UX | HIGH | Run estimation asynchronously; use cached state for response |
| Non-determinism | MEDIUM | Set temperature=0; use structured output; accept variance |
| Prompt injection | HIGH | Sanitize user messages in estimation prompt; use system role |
| Hallucinated observables | MEDIUM | Validate output observables against dictionary |

#### Rollback Strategy

- Feature flag: `FEATURE_LLM_STATE_ESTIMATION=false`
- When disabled: falls back to Option B scoring or current intents.ts
- Estimation call is independent; removing it doesn't affect response generation
- Cached state in Supabase remains valid; just stops updating

#### Complexity

**Low-Medium** — prompt engineering + structured output parsing.

#### Estimated Effort

**1 week** (1 engineer)
- Day 1-2: State definitions as JSON + prompt assembly
- Day 3-4: Structured output parsing + validation
- Day 5: Integration with runtime + cost tracking
- Day 6-7: Testing with laboratorio + edge cases

#### Recommendation

**Use for CALIBRATION only.** The LLM is excellent at understanding conversational nuance but too expensive and slow for runtime. Use it to:
1. **Calibrate Option B's emission table** — run both in parallel, compare outputs
2. **Label training data** — batch-process conversations to build state estimation dataset
3. **Handle edge cases** — when Option B's confidence < threshold, escalate to LLM

---

### Option D: Hybrid (B + C) — LONG-TERM TARGET

#### Description

Combines Option B (lightweight scoring for runtime) with Option C (LLM for calibration and edge cases). The scoring engine handles 95% of turns at near-zero cost. The LLM runs weekly batch calibrations to validate and tune the scoring weights. When scoring confidence drops below a threshold, the LLM handles that specific turn.

#### Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │              HYBRID ENGINE                   │
                    │                                             │
  ┌─────────────────┤  ┌──────────────────────────────────────┐   │
  │                 │  │         RUNTIME PATH (95%)           │   │
  │  User Message   │  │                                      │   │
  │  ───────────────┤  │  Observable Detector → Scorer →      │   │
  │                 │  │  State Resolver → Action Selection    │   │
  │                 │  │                                      │   │
  │                 │  │  confidence > 0.3?                    │   │
  │                 │  │  ├─ YES → use scored state            │   │
  │                 │  │  └─ NO  → escalate to LLM ───────────┤──┐
  │                 │  └──────────────────────────────────────┘  │ │
  │                 │                                            │ │
  │                 │  ┌──────────────────────────────────────┐  │ │
  │                 │  │         LLM ESCALATION PATH (5%)     │  │ │
  │                 │  │                                      │  │ │
  │                 │  │  Confidence < threshold               │  │ │
  │                 │  │  → LLM state estimation               │  │ │
  │                 │  │  → use LLM state + feed back to       │  │ │
  │                 │  │    scorer for calibration             │  │ │
  │                 │  └──────────────────┬───────────────────┘  │ │
  │                 │                     │                      │ │
  │                 │                     ▼                      │ │
  │                 │  ┌──────────────────────────────────────┐  │ │
  │                 │  │         CALIBRATION PATH (batch)     │  │ │
  │                 │  │                                      │  │ │
  │  Weekly cron    │  │  1. Score all conversations with B   │  │ │
  │  ───────────────┤  │  2. Re-score with LLM (ground truth) │  │ │
  │                 │  │  3. Compare: where do they disagree?  │  │ │
  │                 │  │  4. Update emission_table weights     │  │ │
  │                 │  │  5. Log calibration report            │  │ │
  │                 │  └──────────────────────────────────────┘  │ │
  └─────────────────┘                                            │ │
                                                                  │ │
                    ┌─────────────────────────────────────────────┘ │
                    │                                               │
                    └───────────────────────────────────────────────┘
```

#### Data Flow — Runtime Path

```
1. User message arrives
2. Observable detector extracts signals (Option B)
3. Scorer updates state scores (Option B)
4. State resolver picks top state
5. IF confidence > 0.3:
   → Use scored state
   → Persist to Supabase
   → Action selection
6. IF confidence <= 0.3:
   → Call LLM estimator (Option C) with current turn + history
   → Use LLM state
   → Persist LLM state to Supabase
   → Log { scored_state, llm_state, confidence } for calibration
   → Action selection
```

#### Data Flow — Calibration Path (Weekly Batch)

```
1. Cron job triggers (weekly)
2. Query all conversations from past 7 days
3. For each conversation:
   a. Replay observable detection + scoring (Option B)
   b. For each turn, run LLM estimation (Option C)
   c. Compare: does B agree with C?
4. Aggregate disagreements:
   - Which observables does B miss that C catches?
   - Which states does B confuse?
   - Where is B's confidence low?
5. Update emission_table weights:
   - Increase weights where B underestimates
   - Decrease weights where B overestimates
6. Generate calibration report:
   - Agreement rate: B vs C
   - Weight changes applied
   - Confidence distribution
7. Store report in Supabase (calibration_reports table)
```

#### Integration Points with Existing MIA Code

| File | Integration |
|------|-------------|
| `src/lib/runtime/runtime.ts` | Insert hybrid estimation at line ~227. Feature flag controls which path. |
| `src/lib/ai/client.ts` | Reuse for LLM escalation calls. Track separately via `request_type: 'state_estimation'`. |
| `src/lib/ai/prompts.ts` | Accept state from either scorer or LLM; inject into prompt. |
| `src/lib/ai/knowledge.ts` | Add `loadConversationState()`, `persistConversationState()`, `estimateCustomerState()` |
| New: `src/lib/ai/evidence/scorer.ts` | Option B scoring engine |
| New: `src/lib/ai/evidence/state-estimator.ts` | Option C LLM estimator |
| New: `src/lib/ai/evidence/calibration.ts` | Weekly batch calibration logic |
| New: `src/lib/ai/evidence/observable-detector.ts` | Shared observable extraction |
| New: `src/app/api/cron/calibration/route.ts` | Weekly calibration cron endpoint |

#### Pros

- **Fast runtime** — 95% of turns handled by scorer (< 1ms, zero cost)
- **Good accuracy** — LLM catches what scorer misses
- **Self-improving** — weekly calibration tunes weights automatically
- **Handles edge cases** — low-confidence turns escalated gracefully
- **Cost-effective** — only 5% of turns hit LLM estimation (~$6.50/month per 10K conversations)
- **Calibrated** — scoring weights improve over time from real data

#### Cons

- **Two systems to maintain** — scorer + LLM estimator
- **More complexity** — calibration pipeline, escalation logic, weight updates
- **Calibration lag** — weights updated weekly; fast-moving patterns may lag
- **LLM cost non-zero** — escalation + calibration adds ~$6.50/month per 10K conversations
- **Maintenance burden** — calibration reports need human review

#### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Calibration pipeline breaks | MEDIUM | Scorer continues with stale weights; alert on failure |
| Escalation rate too high (>20%) | MEDIUM | Tune threshold; improve emission table |
| LLM estimation disagrees with scorer persistently | LOW | Calibration catches and corrects |
| Weight updates degrade performance | LOW | A/B test changes; rollback calibration if accuracy drops |

#### Rollback Strategy

- Feature flag: `FEATURE_HYBRID_STATE=false`
- When disabled: falls back to Option B standalone or current intents.ts
- Scorer and LLM estimator are independent modules; either can run alone
- Calibration data persists; restarting hybrid preserves calibration history

#### Complexity

**Medium** — combines two systems with a calibration layer.

#### Estimated Effort

**3-4 weeks** (1 engineer)
- Week 1: Option B implementation (scorer + observable detector)
- Week 2: Option C integration (LLM estimator for escalation)
- Week 3: Escalation logic + confidence threshold tuning
- Week 4: Calibration pipeline + cron job + reporting

#### Recommendation

**EVOLVE TO THIS.** Start with Option B (Week 1-2), validate it adds value, then layer on LLM calibration and escalation. This is the long-term architecture that balances cost, accuracy, and maintainability.

---

## 3. Comparison Matrix

| Dimension | Option A (Bayesian) | Option B (Scoring) | Option C (LLM) | Option D (Hybrid) |
|-----------|--------------------|--------------------|----------------|-------------------|
| **Accuracy** | Optimal (given model) | Good (manual tuning) | Good (nuance) | Very Good |
| **Latency** | < 1ms | < 1ms | 200-500ms | < 1ms (95%) |
| **Cost/turn** | $0 | $0 | ~$0.0013 | ~$0.00007 avg |
| **Monthly cost (10K×10)** | $0 | $0 | ~$130 | ~$6.50 |
| **Implementation** | 4-6 weeks | 1-2 weeks | 1 week | 3-4 weeks |
| **Debuggability** | Hard (trace needed) | Easy (log scores) | Medium (prompt inspect) | Medium |
| **Maintainability** | Low (matrix updates) | High (weight table) | Medium (prompt tuning) | Medium |
| **MVP suitability** | No | **Yes** | No | No (target) |
| **Dependencies** | None | None | OpenAI API | OpenAI API + scorer |
| **Fallback** | Option B | Current intents.ts | Option B | Option B |

---

## 4. Recommended Phased Approach

### Phase 1: Option B — Week 1-2

```
Week 1:
├── observable-detector.ts     (pattern rules from observables.md)
├── emission-table.ts          (weight mappings)
├── transitions.ts             (priors from transiciones.md)
└── scorer.ts                  (scoring function + state resolution)

Week 2:
├── state-prompt.ts            (state → prompt modifier)
├── runtime.ts integration     (insert scoring step)
├── conversation_state table   (Supabase persistence)
└── laboratorio testing        (simulate conversations, validate states)
```

**Exit criteria:**
- Scoring engine runs on every conversation turn
- State estimates are plausible for laboratorio test cases
- No regression in existing functionality
- Feature flag allows disabling

### Phase 2: Option D (B → D) — Month 2+

```
Week 3-4:
├── state-estimator.ts         (LLM escalation path)
├── escalation logic           (confidence threshold → LLM)
└── cost tracking              (track escalation calls)

Week 5-6:
├── calibration.ts             (batch comparison: B vs C)
├── cron endpoint              (weekly calibration job)
├── weight update logic        (apply calibration corrections)
└── calibration report         (dashboard view)
```

**Exit criteria:**
- Escalation rate < 10% of turns
- Calibration improves scoring accuracy over 4+ weeks
- LLM cost < $10/month per 10K conversations

### Decision Criteria: When to Upgrade from B to D

| Trigger | Action |
|---------|--------|
| Scoring accuracy > 80% on laboratorio | Ready for production with B |
| Scoring accuracy plateaus despite tuning | Start LLM calibration (D) |
| Escalation needed for specific states (e.g., `reticente`) | Add LLM escalation for those states |
| Customer feedback indicates state misestimation | Run calibration batch to diagnose |
| Monthly conversations exceed 50K | D's cost savings justify the complexity |

---

## 5. Cost Analysis

### Token Costs for Option C

| Metric | Value |
|--------|-------|
| Model | gpt-4o-mini |
| Input tokens per estimation | ~7,500 |
| Output tokens per estimation | ~300 |
| Input cost | $0.15/1M tokens |
| Output cost | $0.60/1M tokens |
| Cost per estimation | ~$0.0013 |
| Estimations per conversation (10 turns) | 10 |
| Cost per conversation | ~$0.013 |
| Monthly (10K conversations) | ~$130 |
| Monthly (50K conversations) | ~$650 |
| Monthly (100K conversations) | ~$1,300 |

### Compute Costs for Option B

| Metric | Value |
|--------|-------|
| Scoring computation | O(15 × observables) per turn |
| Observable detection | O(pattern_rules) per turn |
| Latency per turn | < 1ms |
| Monthly compute cost | $0 (runs in existing runtime) |
| Infrastructure | None (pure TypeScript) |
| Monthly (10K conversations) | $0 |
| Monthly (50K conversations) | $0 |
| Monthly (100K conversations) | $0 |

### Hybrid (Option D) Cost

| Metric | Value |
|--------|-------|
| Runtime scoring (95% turns) | $0 |
| LLM escalation (5% turns) | ~$6.50/month per 10K |
| Weekly calibration (LLM batch) | ~$1-2/month per 10K |
| **Total monthly (10K conversations)** | **~$8** |
| **Total monthly (50K conversations)** | **~$40** |
| **Total monthly (100K conversations)** | **~$80** |

### Break-Even: Option B vs Option C

| Monthly conversations | Option B cost | Option C cost | Savings with B |
|-----------------------|---------------|---------------|----------------|
| 1,000 | $0 | $13 | $13 |
| 10,000 | $0 | $130 | $130 |
| 50,000 | $0 | $650 | $650 |
| 100,000 | $0 | $1,300 | $1,300 |

**Option B is strictly cheaper at all scales.** Option C only wins on accuracy for nuanced state detection, which Option D addresses via targeted escalation.

---

## 6. Schema Additions

All options require a `conversation_state` table in Supabase:

```sql
-- New table: conversation_state
CREATE TABLE conversation_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  state TEXT NOT NULL,                          -- current estimated state
  confidence REAL NOT NULL DEFAULT 0,           -- confidence score (0-1)
  scores JSONB NOT NULL DEFAULT '{}',           -- { state: score } for all 15
  evidence JSONB NOT NULL DEFAULT '[]',         -- observables that contributed
  source TEXT NOT NULL DEFAULT 'scoring',       -- 'scoring' | 'llm' | 'calibration'
  previous_state TEXT,                          -- state before this update
  turn_number INTEGER NOT NULL DEFAULT 1,       -- which turn in conversation
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT conversation_state_conversation_id_turn UNIQUE (conversation_id, turn_number)
);

-- Index for fast lookups
CREATE INDEX idx_conversation_state_conversation ON conversation_state(conversation_id, turn_number DESC);

-- RLS: same as conversations table
ALTER TABLE conversation_state ENABLE ROW LEVEL SECURITY;
```

---

## 7. File Structure (Proposed)

```
src/lib/ai/evidence/
├── observable-detector.ts     # Pattern-based observable extraction
├── emission-table.ts          # Observable → state weight mappings
├── transitions.ts             # State transition priors
├── scorer.ts                  # Lightweight scoring function (Option B)
├── state-estimator.ts         # LLM-based estimation (Option C)
├── state-prompt.ts            # State → prompt modifier mapping
├── calibration.ts             # Batch calibration logic (Option D)
├── types.ts                   # Observable, StateScores, StateEstimation types
└── states.ts                  # 15 states as typed constants
```

---

## 8. References

| File | Relevance |
|------|-----------|
| `src/lib/runtime/runtime.ts` | Main runtime pipeline — insertion point for state estimation |
| `src/lib/runtime/intents.ts` | Current intent detection — parallel to observable detection |
| `src/lib/ai/client.ts` | OpenAI singleton, MODEL, TOKEN_COSTS — reused by Option C |
| `src/lib/ai/prompts.ts` | Prompt builder — accepts state modifier from all options |
| `src/lib/ai/knowledge.ts` | Context builder — adds state loading/persistence |
| `docs/research/kb/estados.md` | 15 cognitive states — the state model |
| `docs/research/kb/observables.md` | Observable dictionary — emission signals |
| `docs/research/kb/transiciones.md` | Transition priors — scoring bonus/penalty |
| `docs/research/MIA_EVIDENCE_REASONING_RESEARCH.md` | Full research context — why evidence accumulation matters |

---

## 9. Decision Record

| Option | Recommendation | When |
|--------|---------------|------|
| **A: Bayesian Engine** | NOT for MVP | After Option B proves value, if accuracy plateaus |
| **B: Lightweight Scoring** | **START HERE** | Week 1-2 |
| **C: LLM Estimator** | CALIBRATION ONLY | As needed for weight tuning |
| **D: Hybrid (B+C)** | **EVOLVE TO THIS** | Month 2+, after B validates |

**Next step:** Implement Option B — `observable-detector.ts` + `scorer.ts` + `emission-table.ts` + `transitions.ts` + `runtime.ts` integration.
