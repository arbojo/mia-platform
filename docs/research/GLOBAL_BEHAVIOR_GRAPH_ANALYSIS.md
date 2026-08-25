# Global Behavior Graph Analysis

**Status:** Research document — no code changes proposed.
**Date:** 2026-08-25
**Classification:** RESEARCH-ONLY — synthesis of the UBSE knowledge base into a navigable graph model.

---

## 1. What is a Behavior Graph?

The UBSE research models the buyer's cognitive journey as a **directed graph**:

- **Nodes** = cognitive states the buyer occupies (15 states, from `explorando` to `abogando`)
- **Edges** = probabilistic transitions between states, weighted by priors derived from empirical evidence
- **The graph represents ALL possible paths** a customer can take through a purchase decision
- **MIA's job** is to navigate this graph optimally — estimating the customer's current position and selecting actions that advance them along the highest-probability path toward a decision

The behavior graph is not a sales funnel. It is a **state machine** with loops, sidecar rules, multiple terminal states, and concurrent forces that push the buyer forward, hold them back, or eject them entirely.

> "Todo proceso de compra puede modelarse como una transición entre estados cognitivos." — `README.md:14`

---

## 2. The UBSE Behavior Graph

### 2.1 States as Nodes

The atlas (`kb/estados.md`) defines 15 cognitive states + 1 terminal state:

| # | State | Category | Description |
|---|-------|----------|-------------|
| 1 | `explorando` | Pre-decision | No recognized problem; scattered attention |
| 2 | `descubriendo` | Pre-decision | Problem recognized: "this happens to me and it's not okay" |
| 3 | `consecuente` | Pre-decision | Felt the cost; motivated, not just aware |
| 4 | `comprendiendo` | Pre-decision | Knows solutions exist; searching for information |
| 5 | `comparando` | Pre-decision | Evaluating alternatives against own criteria |
| 6 | `evaluando_riesgo` | Pre-decision | Reducing perceived risk (recursive — can appear anywhere) |
| 7 | `decidiendo` | Pre-decision | Commitment in progress; final doubts; narrowing options |
| 8 | `transaccional` | Pre-decision | Ready to act; just needs the path cleared |
| 9 | `esperando` | Post-decision | Anticipation; window of maximum dissonance |
| 10 | `experimentando` | Post-decision | Using the product; first results |
| 11 | `evaluando_resultados` | Post-decision | Result vs expectation; dissonance resolved or worsened |
| 12 | `abogando` | Post-decision | Satisfaction resolved → recommendation/referral |
| 13 | `confundido` | Transversal | Information overload; paralysis by excess options |
| 14 | `frustrado` | Transversal | Negative experience; recovery first, never sell |
| 15 | `reticente` | Transversal | Reactance: anger + counter-argumentation against perceived pressure source |
| 16 | `desenganchado` | Terminal | Silent abandonment; inferred by absence, not by message |

### 2.2 Edges as Transitions

The transition catalog (`kb/transiciones.md`) defines ~20 edges with evidence-backed priors:

#### Forward Transitions

| From → To | Prior | Principle | Phenomenological Note |
|---|---|---|---|
| `explorando` → `descubriendo` | 0.55 | P-001, P-007 | Problem ceases to be invisible |
| `descubriendo` → `consecuente` | 0.55 | P-013, P-024 | Problem becomes felt cost (SPIN implication; Sandler pain; GAP Cost of Inaction) |
| `descubriendo` → `comprendiendo` | 0.60 | P-001, P-007 | Accepts solutions exist; searches the landscape |
| `consecuente` → `comprendiendo` | 0.60 | P-001, P-013, P-024 | Motivated buyer seeks solutions |
| `comprendiendo` → `consecuente` | 0.40 | P-013, P-024 | Perceived loss (scarcity) or future-state attraction induces urgency |
| `comprendiendo` → `comparando` | 0.60 | P-001 | Criteria and alternatives emerge |
| `comparando` → `decidiendo` | 0.40 | P-001 | Options narrow |
| `decidiendo` → `transaccional` | 0.70 | P-001 | Strong evidence = investment (time/reputation/money, P-010), not verbal "yes" |
| `transaccional` → `esperando` | 0.85 | P-005 | Commitment closes; dissonance opens |
| `esperando` → `experimentando` | 0.75 | P-005 | Receipt/usage |
| `experimentando` → `evaluando_resultados` | 0.70 | P-005 | Result vs expectation |
| `evaluando_resultados` → `abogando` | 0.60 | P-005, P-003 | Resolved satisfaction → recommendation |

#### Loops (Legitimate Retrocessions — P-002)

| From → To | Prior | Note |
|---|---|---|
| `comparando` ⇄ `evaluando_riesgo` | 0.55 | Most common loop; risk and alternatives revisited |
| `decidiendo` → `comparando` / `evaluando_riesgo` | 0.20 | Final doubts reopen evaluation |

#### Transitions to Transversal States

| From → To | Prior | Note |
|---|---|---|
| `cualquiera` → `confundido` | 0.15 | Overload/incoherence (P-001 overload) |
| `cualquiera` → `frustrado` | 0.15 | Negative experience; recovery first |
| `cualquiera` → `reticente` | 0.15 | **Perceived pressure > threshold** (reactance: Cialdini/Brehm + Voss + MI + meta-analysis) — Fundamental state; de-escalable via P-025 / P-026 |
| `comparando`/`evaluando_riesgo` → `confundido` | sidecar | Growing alternatives without convergence (P-022, Schwartz) — overload → paralysis |

#### Exogenous Triggers (Sidecar Rules — Not Edges)

| Rule | Emits | Effect |
|---|---|---|
| Silence > threshold after active intent | `meta` evidence | Favors `desenganchado` (terminal) |
| No response to MIA question × 2 | `meta` evidence | Favors `desenganchado` (terminal) |
| Long turn + many questions without resolution | `meta` evidence | Favors `confundido` |
| Growing alternative count without closure | `meta` evidence | Favors `confundido` (P-022) |

---

## 3. ASCII Diagram of the Behavior Graph

```
                            THE UBSE BEHAVIOR GRAPH
                    (15 cognitive states + 1 terminal)
                    Prior-weighted directed graph

 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                                                                                 │
 │  ENTRY                                                                         │
 │    │                                                                           │
 │    ▼                                                                           │
 │  ┌───────────┐  0.55  ┌────────────┐  0.55  ┌────────────┐  0.60  ┌──────────┐│
 │  │explorando │───────▶│ descubriendo│───────▶│ consecuente │───────▶│comprendi-││
 │  └───────────┘        └─────┬──────┘        └─────┬──────┘        │  endo    ││
 │                             │ 0.60                │ 0.60          └────┬─────┘│
 │                             │                     │                     │      │
 │                             ▼                     │◄────────────────────┘      │
 │                       ┌──────────┐                │  0.40                      │
 │                       │comprendi-│                │                            │
 │                       │  endo    │────────────────┘                            │
 │                       └────┬─────┘  0.60                                       │
 │                            │                                                   │
 │                            ▼                                                   │
 │                      ┌──────────┐  0.55  ┌────────────────┐                    │
 │                      │comparando│◀──────▶│evaluando_riesgo│                    │
 │                      └────┬─────┘        └────────────────┘                    │
 │                           │                     ▲                              │
 │                    0.40   │                     │ 0.20                         │
 │                           ▼                     │                              │
 │                     ┌──────────┐                │                              │
 │                     │decidiendo│────────────────┘                              │
 │                     └────┬─────┘  (retroceso: dudas finales)                   │
 │                          │ 0.70                                               │
 │                          ▼                                                    │
 │                    ┌──────────┐  0.85  ┌──────────┐  0.75  ┌──────────────┐   │
 │                    │transaccio-│──────▶│ esperando │──────▶│experimentando│   │
 │                    │   nal    │       └──────────┘        └──────┬───────┘   │
 │                    └──────────┘                                    │ 0.70     │
 │                                                                  ▼          │
 │                                                            ┌──────────────┐  │
 │                                                            │  evaluando_  │  │
 │                                                            │  resultados  │  │
 │                                                            └──────┬───────┘  │
 │                                                                   │ 0.60     │
 │                              ┌────────────────────────────────────┘          │
 │                              ▼                                               │
 │                         ┌──────────┐                                         │
 │                         │ abogando │ ◀── POSITIVE TERMINAL (advocacy)        │
 │                         └──────────┘                                         │
 │                                                                               │
 │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
 │                                                                               │
 │  TRANSVERSAL STATES (any-state transitions, sidecar triggers)                 │
 │                                                                               │
 │    ┌──────────┐  ◀── 0.15 from any state                                     │
 │    │confundido │  (overload, too many options, P-022)                         │
 │    └──────────┘  sidecar: comparando/evaluando_riesgo + growing alternatives  │
 │                                                                               │
 │    ┌──────────┐  ◀── 0.15 from any state                                     │
 │    │frustrado │  (negative experience — recovery first, never sell)           │
 │    └──────────┘                                                              │
 │                                                                               │
 │    ┌──────────┐  ◀── 0.15 from any state                                     │
 │    │reticente │  (perceived pressure > threshold — de-escalate, P-025/P-026) │
 │    └──────────┘  sidecar rule: pressure > threshold                           │
 │                                                                               │
 │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
 │                                                                               │
 │  TERMINAL STATE                                                               │
 │    ┌───────────────┐  ◀── sidecar: silence > threshold, no response × 2      │
 │    │ desenganchado  │  (silent abandonment — inferred by absence)             │
 │    └───────────────┘  NEGATIVE TERMINAL                                      │
 │                                                                               │
 └─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Path Analysis

### 4.1 Optimal Path (Happy Path)

The optimal path follows the forward transitions with the highest priors:

```
explorando → descubriendo → consecuente → comprendiendo → comparando → decidiendo → transaccional
    (1)           (2)           (3)           (4)           (5)          (6)           (7)
```

**Minimum turns:** 7 (one per state)

**Path probability (forward edges only):**

```
0.55 × 0.55 × 0.60 × 0.60 × 0.40 × 0.70 = 0.0309 ≈ 3.1%
```

**Interpretation:** A perfectly linear, no-loop, no-diversion path through all forward states occurs in approximately 3% of conversations. This is expected — real conversations involve retrocessions, loops, and transversal diversions. The graph's structure (P-002: iterative decision, not funnel) makes the linear path the exception, not the rule.

### 4.2 Common Loops

#### Loop 1: comparando ⇄ evaluando_riesgo (Risk Assessment Loop)

```
comparando ⇄ evaluando_riesgo  (prior: 0.55)
```

**Why this is the most common loop:** P-003 (multicomponent risk) is recursive — it can appear at any point. When a buyer evaluates alternatives, risk evaluation activates naturally. Each comparison triggers risk questions; each risk resolution brings them back to comparison.

**Dwell time:** High. This loop consumes the most turns in complex purchases. The buyer oscillates between "which option is best" and "what could go wrong."

**Loop termination:**
- Forward: risk sufficiently reduced → `comparando` → `decidiendo` (0.40)
- Danger: too many options without convergence → `confundido` (sidecar)
- Recovery: `evaluando_riesgo` → `decidiendo` via P-015 (social proof) or P-016 (authority) reducing functional risk

#### Loop 2: decidiendo → comparando / evaluando_riesgo (Last-Mile Doubt)

```
decidiendo → comparando/evaluando_riesgo  (prior: 0.20)
```

**Why this happens:** P-023 (regret aversion) blocks `decidiendo → transaccional`. The buyer, on the verge of commitment, reopens evaluation due to fear of choosing wrong.

**Frequency:** ~20% of buyers in `decidiendo` will loop back. This is normal (P-002: retrocessions are normal, not failures).

**Loop termination:**
- Forward: sufficient investment signals (P-010) push through to `transaccional`
- Danger: becomes `confundido` if loop repeats without convergence
- Recovery: P-026 (autonomy) — "you're in control, there's no wrong choice"

### 4.3 Danger Zones

#### Zone 1: confundido (Paralysis by Overload)

**Trigger:** `comparando`/`evaluando_riesgo` + growing alternatives without convergence (sidecar, P-022)

**Signals:**
- Enumeration of options growing without narrowing
- "I can't decide," "they all seem the same"
- Re-opening previously discarded options
- Long turns with many questions, no conclusion

**Risk:** Customer may exit to `desenganchado` (silence = abandonment) or loop indefinitely without purchase.

**MIA intervention:**
- **Reduce options** (C-014): curate, don't expand. Offer a default.
- "Given what you've told me, X is the best fit — here's why."
- Do NOT add more options. The antidote to overload is restriction, not expansion.

**Forces at play:**
- P-022 (overload) is the blocker — negative valence, increases with option count
- P-021 (maximizer vs satisficer) modulates susceptibility
- P-023 (regret aversion) compounds the paralysis

#### Zone 2: reticente (Reactance)

**Trigger:** `cualquiera` → `reticente` when perceived pressure > threshold (sidecar rule)

**Signals:**
- Anger + counter-argumentation directed at the source of pressure
- Push-back against recommendations
- "I'll decide on my own," "stop pushing"

**Critical distinction from other states:**
- vs `evaluando_riesgo`: doubts are about the product; reactance is about the interaction
- vs `frustrado`: frustration is general negative experience; reactance targets the pressure source specifically

**MIA intervention:**
- **STOP selling.** The winning move is de-escalation, not escalation.
- P-025 (validation): "I understand, this is your decision and I respect that."
- P-026 (autonomy): restore control. "What would you like to do next?"
- Rolling with resistance (MI): never argue against the resistance.

**Forces at play:**
- P-025 (validation/empathy) de-escalates — Alta confidence
- P-026 (control/autonomy) restores — Fundamental confidence
- **Never use P-013 (urgency) or P-015 (social proof) on `reticente`** — they increase pressure

#### Zone 3: frustrado (Negative Experience)

**Trigger:** `cualquiera` → `frustrado` via negative experience (sidecar)

**Signals:**
- Complaints, negative emotion, dissatisfaction
- "This doesn't work," "I'm not happy with..."
- Cancellation intent

**MIA intervention:**
- **Recovery first. Never sell.**
- Acknowledge the issue, validate the frustration
- Offer resolution before any forward movement
- The customer must exit `frustrado` before any sales path is viable

### 4.4 Terminal Paths

#### Terminal: desenganchado (Silence/Abandonment)

**Trigger:** Sidecar rules — silence > threshold, no response to MIA questions × 2

**Inference method:** Detected by absence, not by message. The customer simply stops responding.

**Leading paths into desenganchado:**
```
cualquiera → desenganchado (via silence sidecar)
confundido → desenganchado (paralysis → giving up)
frustrado → desenganchado (bad experience → leaving)
reticente → desenganchado (pressure → escape)
```

**Prevention:** MIA must detect early signals of withdrawal (shorter responses, longer delays, topic changes) and intervene before the sidecar threshold triggers.

---

## 5. MIA's Position in the Graph

### 5.1 Current MIA: Blind Navigation

The current runtime (`runtime.ts` → `intents.ts` → `execute-ai.ts`) operates without graph awareness:

| Capability | Current State | Required |
|---|---|---|
| Customer position in graph | Unknown | Estimated per turn |
| Action selection | Always tries to sell | State-appropriate |
| Evidence accumulation | None (per-turn independent) | Cross-turn |
| Loop detection | None | Detect stuck patterns |
| Reactance handling | No special handling | P-025/P-026 de-escalation |
| Divergence detection | None | Detect `confundido`/`frustrado` early |

**The fundamental problem:** MIA doesn't know where the customer is in the graph, so it tries to advance along the optimal path every turn. This is equivalent to navigating a city without a map — occasionally you arrive, but usually you drive in circles.

### 5.2 Proposed MIA: Graph-Aware Navigation

The proposed architecture adds a thin evidence-accumulation layer:

```
Message Ingestion → Observable Extraction → Evidence Accumulation
       → State Estimation (probability distribution over states)
       → Action Selection (state-appropriate response)
       → Response Generation
```

**Key insight: MIA should sometimes SLOW DOWN.**

When the customer is in `comparando`, MIA should NOT push to `decidiendo`. Pushing creates `reticente` (reactance). Instead, MIA should:

| Customer State | MIA Should | Why |
|---|---|---|
| `explorando` | Explore with them, no pitch | P-011: promotion contaminates early |
| `descubriendo` | Ask, don't tell | P-007: buyer must recognize the problem |
| `consecuente` | Validate the cost, amplify motivation | P-013: felt cost is the engine |
| `comprendiendo` | Provide information, let them search | P-001: information search phase |
| `comparando` | Curate options, don't add more | P-022: overload is the enemy |
| `evaluando_riesgo` | Address specific risk type | P-003: 5 risk types, match the one raised |
| `decidiendo` | Create investment signals, not pressure | P-010: commitment = real investment |
| `transaccional` | Clear the path, remove friction | Just make it easy |
| `confundido` | Reduce options, offer default | C-014: curate, don't expand |
| `reticente` | De-escalate, restore autonomy | P-025/P-026: never push harder |
| `frustrado` | Recover, never sell | Recovery first |

### 5.3 The Slowness Principle

**Counter-intuitive truth:** advancing faster in the graph is not always optimal. The transition priors reveal that some transitions have low probabilities precisely because the buyer isn't ready:

- `comparando` → `decidiendo` at 0.40 — 60% of the time, the buyer isn't ready
- Pushing a buyer in `comparando` directly to `decidiendo` creates `reticente` (0.15 from any state)
- The loop `comparando ⇄ evaluando_riesgo` exists because **risk evaluation is necessary**, not a problem to solve

**MIA's optimal strategy is to estimate the customer's state and select actions that maximize the probability of the correct forward transition**, not to force any particular transition.

---

## 6. Global Optimization

### 6.1 Not Every Conversation Should End in a Sale

The graph has **two positive terminal states** and **one negative terminal state**:

| Terminal State | Meaning | Is it a success? |
|---|---|---|
| `transaccional` → `esperando` → `abogando` | Purchase + advocacy | Yes — ideal outcome |
| `evaluando_resultados` → `abogando` | Post-purchase advocacy | Yes — customer became advocate |
| `desenganchado` | Silent abandonment | No — but learnable |
| `frustrado` → recovery | Issue resolved, customer retained | Partial — recovery is a win |

**Some conversations should end in `abogando` (advocacy) without a purchase in the current session.** A customer who doesn't buy today but refers a friend has created more lifetime value than a one-time buyer.

**Some conversations should end in `evaluando_resultados` (post-purchase follow-up).** MIA's responsibility doesn't end at the sale. The post-decision cycle (states 9-12) is where advocacy is built or lost.

### 6.2 The Graph Includes Post-Decision States

The UBSE model explicitly includes the post-decision cycle:

```
transaccional → esperando → experimentando → evaluando_resultados → abogando
                                                           ↓
                                                      frustrado
```

**MIA's responsibility extends beyond the sale.** P-005 (post-purchase dissonance) means the buyer is most vulnerable between `transaccional` and `evaluando_resultados`. This is where:
- Buyers seek confirmation they made the right choice
- Dissonance either resolves (→ `abogando`) or worsens (→ `frustrado`)
- Advocacy is built through follow-up and validation

### 6.3 Loop Termination Strategy

When the customer is stuck in a loop, MIA must detect it and intervene:

| Loop | Detection | Intervention |
|---|---|---|
| `comparando` ⇄ `evaluando_riesgo` (3+ cycles) | Same states repeating | Curate options (reduce to 2-3), address specific risk type |
| `decidiendo` → `comparando` (2+ retrocessions) | Buyer narrows then reopens | P-026: "You're in control. What would make you feel confident?" |
| Any state → `confundido` (dwelling) | Overload signals persisting | C-014: "Based on what you've shared, here's my recommendation" |
| Any state → `reticente` (no de-escalation) | Pressure signals continuing | P-025: Validate, then create distance. "No pressure at all." |

**Loop detection formula (simplified):**
```
if same_state_count(state, window=3) >= 3:
    trigger_intervention(state)
elif transition_repetition(transition, window=5) >= 2:
    trigger_intervention(state)
```

### 6.4 Transition Forces: The Concurrent Model

The transition from `decidiendo → transaccional` is not driven by a single force. Per `transiciones.md`, it is a **function of concurrent forces** (C-008):

| Force | Principle | Valence | Effect |
|---|---|---|---|
| Commitment/coherence | P-010/P-012 | + | Buyer acts to be consistent with prior commitments |
| Social proof | P-015 | + | Others have done it → reduces social risk |
| Authority | P-016 | + | Expert recommendation reduces functional risk |
| Liking/affinity | P-017 | + | Rapport biases preference |
| Unity/identity | P-019 | + | "People like me" → in-group favoritism |
| Loss/scarcity | P-013 | + | Fear of losing access/opportunity |
| Future-state attraction | P-024 | + | Pull toward desired outcome |
| Overload | P-022 | - | Too many options blocks commitment |
| Regret aversion | P-023 | - | Fear of choosing wrong blocks commitment |

**The matrix is not a single prior per edge; it is a weighted sum of concurrent forces.** MIA must estimate which forces are active and which are blocking, then select actions that activate the right forces for the customer's current state.

---

## 7. Graph Properties

### 7.1 Acyclic Core

The **forward path** (`explorando → descubriendo → consecuente → comprendiendo → comparando → decidiendo → transaccional`) is **mostly acyclic**. This is the backbone of the graph — the primary directed flow from entry to transaction.

```
explorando → descubriendo → consecuente → comprendiendo → comparando → decidiendo → transaccional
                                                        ↺                    ↺
                                              (consecuente loop)    (evaluando_riesgo loop)
```

The forward transitions have the highest priors (0.55-0.85) and represent the primary momentum of the buying process. However, the two "backward" transitions (`comprendiendo → consecuente` at 0.40 and `decidiendo → comparando` at 0.20) introduce cycles in the forward backbone.

### 7.2 Cyclic Regions

Two cyclic regions exist within the graph:

**Region 1: Risk-Comparison Cycle**
```
comparando ⇄ evaluando_riesgo  (bidirectional, prior 0.55)
```
This is the most active cyclic region. Risk evaluation and alternative comparison are deeply intertwined — each triggers the other. This cycle is **normal and expected** (P-002: iterative decision).

**Region 2: Decision Reopening**
```
decidiendo → comparando / evaluando_riesgo  (prior 0.20)
```
A unidirectional cycle where final doubts reopen earlier evaluation. Less frequent but significant — represents the buyer's regret aversion (P-023) and ambivalence (H-019).

### 7.3 Sink States (Terminal)

| Sink State | Type | Entry Mechanism |
|---|---|---|
| `desenganchado` | Negative terminal | Sidecar: silence > threshold, no response × 2 |
| `abogando` | Positive terminal | `evaluando_resultados → abogando` (0.60) |

`desenganchado` is the only true sink — once entered, there is no outgoing edge. `abogando` is a positive terminal but implies ongoing relationship (the advocate may re-enter the graph for future purchases).

### 7.4 Source State

| Source State | Role |
|---|---|
| `explorando` | Entry point for all new conversations |

Every conversation begins in `explorando` (no recognized problem, scattered attention). The transition from `explorando → descubriendo` (0.55) is the critical first step — the buyer must recognize a problem before any forward momentum is possible.

### 7.5 Graph Connectivity

The graph is **strongly connected** when considering the transversal states (`confundido`, `frustrado`, `reticente`) which can be entered from any state. This means:

- From any state, a customer can reach any other state (potentially through transversal diversions)
- The only truly unreachable states from `desenganchado` are all others (terminal sink)
- `abogando` can re-enter the graph (advocate may start a new journey for referrals)

---

## 8. Implications for MIA Architecture

### 8.1 State Estimation Requirements

MIA needs a **state estimator** that:

1. Takes observable signals from the current turn (questions, statements, objections, emotions, behaviors)
2. Considers evidence accumulated across turns (not just the current message)
3. Produces a **probability distribution over states**, not a single state assignment
4. Updates the distribution each turn (Bayesian updating)

**Output format:**
```json
{
  "state_distribution": {
    "comparando": 0.45,
    "evaluando_riesgo": 0.30,
    "decidiendo": 0.10,
    "confundido": 0.10,
    "desenganchado": 0.05
  },
  "confidence": 0.72,
  "last_transition": "comparando → evaluando_riesgo",
  "turns_in_region": 4,
  "loop_detected": false
}
```

### 8.2 Action Selection Requirements

Given the state distribution, MIA must select an action that:

1. **Maximizes forward progress** when confidence is high and no danger zones are detected
2. **Slows down** when the customer is in a cyclic region and needs more time
3. **De-escalates** when `reticente` is detected (never push harder)
4. **Reduces options** when `confundido` is detected (curate, don't expand)
5. **Recovers** when `frustrado` is detected (never sell)
6. **Detects and terminates loops** when the customer is stuck

### 8.3 Evidence Accumulation Model

Evidence must be accumulated across turns using a **half-life decay model** (consistent with existing `BusinessMemory` architecture):

- Recent evidence weighs more than old evidence
- Strong signals (investment, P-010) persist longer than weak signals (verbal agreement, P-008)
- Contradictory evidence reduces confidence but doesn't reset state

---

## 9. Summary: The Graph as MIA's Navigation System

| Property | Value |
|---|---|
| Total states | 15 cognitive + 1 terminal = 16 nodes |
| Forward edges | 12 |
| Bidirectional edges | 1 (comparando ⇄ evaluando_riesgo) |
| Loop edges | 1 (decidiendo → comparando/evaluando_riesgo) |
| Any-state edges | 3 (→ confundido, → frustrado, → reticente) |
| Sidecar triggers | 4 (silence, no response, long turn, growing alternatives) |
| Source state | `explorando` |
| Positive terminal | `abogando` |
| Negative terminal | `desenganchado` |
| Optimal path length | 7 turns minimum |
| Optimal path probability | ~3.1% (linear, no loops) |
| Most common loop | `comparando ⇄ evaluando_riesgo` (0.55) |
| Most dangerous state | `reticente` (Fundamental confidence, requires de-escalation) |

The behavior graph is MIA's map. Without it, MIA is guessing. With it, MIA can estimate where the customer is, predict where they're going, and select the action that gets them there — or knows when to slow down, de-escalate, or recover.

---

## References

| Document | Path | Content |
|---|---|---|
| Atlas de Estados Cognitivos | `kb/estados.md` | 15 state definitions with evidence traces |
| Catálogo de Transiciones | `kb/transiciones.md` | Prior-weighted transitions, loops, sidecar rules |
| Base de Principios Universales | `kb/principios.md` | 26 principles (P-001 to P-026) with confidence levels |
| Diccionario de Observables | `kb/observables.md` | Conversational signals mapped to states |
| Clasificación Ontológica | `kb/ontologia.md` | P.9/P.10 classification of all principles |
| Evidence & Reasoning Research | `MIA_EVIDENCE_REASONING_RESEARCH.md` | Architecture analysis + recommendations |
| UBSE Research Charter | `README.md` | Mission, protocol, knowledge base structure |
