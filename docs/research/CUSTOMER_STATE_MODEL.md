# Customer State Model — MIA Conversational Sales AI

**Status**: Research / Proposal
**Date**: 2026-08-25
**Author**: Engineering Team
**Scope**: Runtime customer cognitive state estimation for action selection

---

## 1. Current State (What Exists Today)

### 1.1 No Runtime Customer State Model

MIA currently has **no customer state model in runtime**. The platform operates on flat, accumulated data and post-hoc classification. There is no cross-turn state tracking, no probability distribution over mental states, and no state-driven action selection.

### 1.2 Flat Memory Lists (`customer-memory.ts`)

The existing customer memory system (`src/lib/ai/customer-memory.ts:3-13`) stores four flat string arrays on the `customers` table as a JSONB `memory` column:

```typescript
export interface CustomerMemory {
  interests: string[]     // what products the customer asked about
  objections: string[]    // price, delivery, guarantee concerns
  questions: string[]     // raw question text (last 5)
  preferences: string[]   // e.g. prefers_phone
  tags?: string[]
  status?: string | null
  city?: string | null
  lastInteraction: string | null
  summary: string         // human-readable concatenation
}
```

**Extraction is keyword-based** (`customer-memory.ts:221-238`): hardcoded Spanish keywords (`precio`, `envío`, `garantía`, `whatsapp`) trigger `objections.add('price')`, etc. There is no understanding of *where the customer is in their decision journey* — only what topics they mentioned.

### 1.3 Intent Tagging (`intents.ts`)

Each user message is classified against **6 mutually exclusive intent tags** (`src/lib/runtime/intents.ts:7-13`):

```typescript
export type IntentTag =
  | 'catalog' | 'price' | 'shipping'
  | 'payment' | 'contact' | 'greeting'
```

Detection is pure keyword matching (`intents.ts:15-66`). The tag determines which interactive buttons to show on WhatsApp (`intents.ts:100-159`). There is no relationship between intent tags and customer state — a `price` tag in turn 1 is treated identically to a `price` tag in turn 20.

### 1.4 Post-Hoc Sale Detection (`detect.ts`)

After the AI responds, `detectSaleOutcome()` (`src/lib/sales/detect.ts:72-172`) sends the last 12 messages to a separate AI call that classifies the **sale outcome** into one of 5 terminal states:

```typescript
outcome: 'pending' | 'interested' | 'not_interested' | 'sold' | 'cancelled'
```

This is **post-hoc** (runs after the response is already generated) and **outcome-focused** (did a sale happen or not?). It does not influence the AI's response in the current turn — it only records what happened.

### 1.5 Runtime Flow (`runtime.ts`)

The current message processing pipeline (`src/lib/runtime/runtime.ts:173-410`):

```
Incoming message
  → resolveCustomer()
  → resolveConversation()
  → detectIntent()                    // keyword → IntentTag
  → loadConversationContext()          // business data + customer memory → system prompt
  → executeAI()                       // generate response
  → processSaleClosing()              // post-hoc: detect sale outcome
  → resolveConditionalMedia()         // image attachment
  → buildInteractiveForIntent()       // WhatsApp buttons
```

**No step considers the customer's cognitive state.** The system prompt is identical regardless of whether the customer is exploring, deciding, or frustrated.

### 1.6 Prompt Injection (`prompts.ts`)

`buildMasterPrompt()` (`src/lib/ai/prompts.ts:187-355`) assembles the system prompt from business context, products, rules, knowledge, lessons, and customer memory. The only state-awareness is a binary `conversationOutcome` parameter (`prompts.ts:328-339`):

```typescript
conversationOutcome === 'cancelled'
  ? `## Estado de la conversación
     Esta conversación está CANCELADA. ESTÁ PROHIBIDO mencionar pedidos...`
  : `## Productos / Reglas de venta`
```

This is a **hard gate** (cancelled vs. not-cancelled), not a graduated state model.

### 1.7 Summary of Gaps

| Component | What It Does | What It Lacks |
|-----------|-------------|---------------|
| `customer-memory.ts` | Stores flat interest/objection lists | No state tracking, no journey position |
| `intents.ts` | Keyword-based intent tags (6 types) | No relation to cognitive state |
| `detect.ts` | Post-hoc sale outcome classification | No real-time influence on response |
| `runtime.ts` | Orchestrates message processing | No state estimation step |
| `prompts.ts` | Builds system prompt | No state-aware action selection |
| `context.ts` | Loads business + customer context | No state probability distribution |

---

## 2. Proposed State Model (from UBSE Research)

### 2.1 Source

The state model is derived from the UBSE (Unified Buyer State Estimation) research documented in:
- `docs/research/kb/estados.md` — Atlas of 15 cognitive states
- `docs/research/kb/transiciones.md` — Transition catalog with empirical priors
- `docs/research/kb/observables.md` — Conversational signals dictionary

The research synthesizes 8+ academic sources (SPIN Selling, Cialdini's Influence, Schwartz's Paradox of Choice, Sandler Sales, GAP methodology, Motivational Interviewing, Never Split the Difference, and empirical reactance meta-analyses) into a single unified model.

### 2.2 The 15 States

#### Pre-Decision States (8)

| # | State | ID | Phenomenological Definition | Confidence |
|---|-------|----|-----------------------------|------------|
| 1 | Exploring | `explorando` | No recognized problem; dispersed attention; browsing without commitment | High |
| 2 | Discovering | `descubriendo` | Recognition of the problem: "this happens to me and it's not okay" — crossing from unawareness to problem awareness | Convergent |
| 3 | Consequent | `consecuente` | Feels the *cost* of the problem, not just understands it — the cost of inaction becomes present | **Fundamental** (survived falsation audit; 4 schools converge) |
| 4 | Understanding | `comprendiendo` | Knows solutions exist; learning the landscape; information seeking | Convergent |
| 5 | Comparing | `comparando` | Evaluating alternatives against own criteria; attention becomes discriminative | Convergent |
| 6 | Risk Evaluating | `evaluando_riesgo` | Reducing perceived risk (monetary/functional/physical/social/psychological). **Recursive** — reappears at any point | Convergent |
| 7 | Deciding | `decidiendo` | Commitment in progress; final doubts; narrowing options | High |
| 8 | Transactional | `transaccional` | Ready to act; just needs the path cleared | High |

#### Post-Decision States (4)

| # | State | ID | Definition | Confidence |
|---|-------|----|------------|------------|
| 9 | Waiting | `esperando` | Post-purchase anticipation; window of maximum dissonance | High |
| 10 | Experiencing | `experimentando` | Using the product; first results | Medium |
| 11 | Evaluating Results | `evaluando_resultados` | Outcome vs. expectation; dissonance resolved or worsened | High |
| 12 | Advocating | `abogando` | Resolved satisfaction → referral/recommendation | Medium |

#### Transversal States (4)

| # | State | ID | Definition | Confidence |
|---|-------|----|------------|------------|
| 13 | Confused | `confundido` | Information overload; indecision from too many options; inconclusive search | Convergent |
| 14 | Frustrated | `frustrado` | Negative experience; the mental shift is toward withdrawal. **Recovery first; never sell** | High |
| 15 | Reticent | `reticente` | Reactance: anger + counter-argumentation directed at the source of perceived pressure on freedom to decide | **Fundamental** (survived empirical falsation — Rains 2013, Li & Shi 2025) |
| — | Disengaged | `desenganchado` | Silent abandonment; inferred by absence, not by message. Terminal. | High |

### 2.3 Key Design Properties

1. **Set of states is stable across businesses** — what varies is the *dwell time* (residence) per state, not the states themselves.
2. **States are at the phenomenon level** (what happens in the buyer's mind), not at the sales technique level.
3. **`reticente` is Fundamental** — it cannot be removed from the model without empirical loss. It is distinct from `evaluando_riesgo` (doubts) and `frustrado` (general displeasure without focus on pressure).
4. **`consecuente` is Fundamental** — confirmed by 4 converging schools (SPIN, Sandler, Cialdini, GAP) and survived GAP falsation.
5. **Post-decision states are not orphaned** — MIA transitions naturally into post-purchase care for `esperando`/`experimentando`/`evaluando_resultados`/`abogando`.

---

## 3. State Transitions

### 3.1 Forward Progression

| From | To | Prior | Evidence Source |
|------|-----|-------|----------------|
| `explorando` | `descubriendo` | 0.55 | P-001, P-007 |
| `descubriendo` | `consecuente` | 0.55 | P-013, P-024 |
| `descubriendo` | `comprendiendo` | 0.60 | P-001, P-007 |
| `consecuente` | `comprendiendo` | 0.60 | P-013, P-024 |
| `comprendiendo` | `consecuente` | 0.40 | P-013, P-024 |
| `comprendiendo` | `comparando` | 0.60 | P-001 |
| `comparando` | `decidiendo` | 0.40 | P-001 |
| `decidiendo` | `transaccional` | 0.70 | P-001 |
| `transaccional` | `esperando` | 0.85 | P-005 |
| `esperando` | `experimentando` | 0.75 | P-005 |
| `experimentando` | `evaluando_resultados` | 0.70 | P-005 |
| `evaluando_resultados` | `abogando` | 0.60 | P-005, P-003 |

### 3.2 Legitimate Loops (Backtracking)

| From | To | Prior | Note |
|------|-----|-------|------|
| `comparando` ⇄ `evaluando_riesgo` | 0.55 | Most common loop; risk and alternatives revisited |
| `decidiendo` | `comparando` / `evaluando_riesgo` | 0.20 | Final doubts reopen evaluation |

### 3.3 Transversal Triggers (Universal)

| From | To | Prior | Note |
|------|-----|-------|------|
| `cualquiera` (any) | `confundido` | 0.15 | Overload / incoherence |
| `cualquiera` | `frustrado` | 0.15 | Negative experience; recovery first |
| `cualquiera` | `reticente` | 0.15 | Perceived pressure > threshold |
| `comparando` / `evaluando_riesgo` | `confundido` | sidecar | Growing alternatives without convergence |

### 3.4 Exogenous Triggers (Sidecar Rules)

| Trigger | Emits | Effect |
|---------|-------|--------|
| Silence > threshold after active intent | `meta` evidence | Favors `desenganchado` (terminal) |
| No response to MIA question ×2 | `meta` evidence | Favors `desenganchado` |
| Long turn + many questions without conclusion | `meta` evidence | Favors `confundido` |
| Growing number of mentioned alternatives without closing | `meta` evidence | Favors `confundido` |

### 3.5 State Diagram (ASCII)

```
                              ┌──────────────────────────────────────────────────────┐
                              │              PRE-DECISION FLOW                       │
                              │                                                      │
                              │  ┌────────────┐     ┌────────────┐                  │
                              │  │ EXPLORANDO  │────▶│DESCUBRIENDO│                  │
                              │  │ (exploring) │0.55 │(discovering)│                 │
                              │  └────────────┘     └─────┬──────┘                  │
                              │                            │                         │
                              │                     0.55 ──┼── 0.60                  │
                              │                            ▼                         │
                              │  ┌────────────┐     ┌────────────┐                  │
                              │  │COMPRENDIENDO│◀───▶│CONSECUENTE │                  │
                              │  │(understanding)│0.60│(consequent)│                 │
                              │  └──────┬─────┘ 0.40└────────────┘                  │
                              │         │                                            │
                              │      0.60                                            │
                              │         ▼                                            │
                              │  ┌────────────┐     ┌────────────┐                  │
    ┌──────────────┐          │  │  COMPARANDO │◀───▶│EVALUANDO   │                  │
    │  CONFUNDIDO  │◀─sidecar─│  │(comparing)  │0.55 │  _RIESGO   │                  │
    │  (confused)  │          │  └─────┬──────┘     │(risk eval) │                  │
    └──────────────┘          │        │             └────────────┘                  │
         ▲   ▲               │      0.40                                            │
    0.15 │   │ 0.15          │        │                                             │
         │   │               │        ▼                                             │
         │   │          ┌────┴────────────┐     ┌──────────────┐                    │
         │   └──────────│   DECIDIENDO     │────▶│ TRANSACCIONAL│                    │
         │   (from any) │   (deciding)     │0.70 │(transactional│                    │
         │              └────────┬─────────┘     └──────┬──────┘                    │
         │                       │                      │                           │
         │                  0.20 │                   0.85 │                          │
         │              (loops)  │                      ▼                           │
         │                       │              ┌────────────┐                      │
         │                       │              │  ESPERANDO  │                      │
         │                       │              │  (waiting)  │                      │
         │                       │              └──────┬─────┘                      │
         │                       │                 0.75 │                            │
         │                       │                     ▼                            │
         │                       │              ┌────────────────┐                  │
         │                       │              │EXPERIMENTANDO   │                  │
         │                       │              │(experiencing)   │                  │
         │                       │              └───────┬────────┘                  │
         │                       │                 0.70 │                            │
         │                       │                     ▼                            │
         │                       │              ┌────────────────────┐              │
         │                       │              │EVALUANDO_RESULTADOS │              │
         │                       │              │ (evaluating results)│              │
         │                       │              └───────┬────────────┘              │
         │                       │                 0.60 │                            │
         │                       │                     ▼                            │
         │                       │              ┌────────────┐                      │
         │                       │              │  ABOGANDO   │                      │
         │                       │              │ (advocating)│                      │
         │                       │              └────────────┘                      │
         │                       │                                                  │
    ┌────┴───────┐    ┌─────────┴──────┐                                           │
    │ FRUSTRADO   │    │   RETICENTE     │                                           │
    │ (frustrated)│    │  (resistant)    │                                           │
    └────────────┘    └────────────────┘                                            │
         ▲                  ▲                                                       │
         │ 0.15             │ 0.15                                                  │
         │  (from any)      │  (from any: pressure > threshold)                     │
         │                  │                                                       │
         └──────────────────┘                                                       │
                              │                                                      │
                              └──────────────────────────────────────────────────────┘

    ┌─────────────────┐
    │ DESENGANCHADO    │  (terminal — inferred by silence/absence)
    │ (disengaged)     │
    └─────────────────┘
```

---

## 4. State Estimation Approach

### 4.1 Probability Distribution (Not Hard Classification)

State estimation maintains a **probability distribution over all 15 states** rather than committing to a single hard classification. This reflects the inherent ambiguity of conversational signals — a customer asking about price could be in `comprendiendo`, `comparando`, or `decidiendo`.

```typescript
interface StateDistribution {
  explorando: number
  descubriendo: number
  consecuente: number
  comprendiendo: number
  comparando: number
  evaluando_riesgo: number
  decidiendo: number
  transaccional: number
  esperando: number
  experimentando: number
  evaluando_resultados: number
  abogando: number
  confundido: number
  frustrado: number
  reticente: number
}
```

All values sum to 1.0. The distribution is updated after each conversational turn.

### 4.2 Bayesian Inference Per Turn

State estimation uses a **Bayesian update** mechanism:

```
P(state | turn) ∝ P(observations | state) × P(state | previous_state)
```

Where:

- **P(state | previous_state)** = transition prior from `transiciones.md`. For example, if the current state is `descubriendo`, the prior for `consecuente` is 0.55 and for `comprendiendo` is 0.60.
- **P(observations | state)** = emission probability derived from conversational observables (`observables.md`). For example, a question about guarantees has high emission probability for `evaluando_riesgo` and low for `explorando`.
- **Transversal triggers** add 0.15 mass to `confundido`/`frustrado`/`reticente` regardless of current state.

### 4.3 Observable Types

From `docs/research/kb/observables.md`, signals are categorized:

| Type | Weight | Examples |
|------|--------|----------|
| `question` | varies | Questions about price, shipping, guarantees |
| `statement` | 0.6 | Problem declarations, criteria, constraints |
| `objection` | 0.6 | Price doubts, trust concerns |
| `emotion` | varies | Emotional vs. analytical language |
| `behavior` | 0.4 | Message length, question density, re-questions |
| `explicito` | **0.3 (weak, never alone)** | Self-reported state |
| `post-purchase` | 0.7 | Delivery mentions, usage, complaints |
| `meta` | sidecar | Turn count, duration, silence, abandonment |

### 4.4 Confidence Metric

A **confidence score** (0–1) indicates how certain the model is about the state distribution. Confidence is derived from:

- **Number of observable signals** in the current turn (more signals → higher confidence)
- **Consistency of signals** (congruent signals → higher confidence; mixed signals → lower)
- **Recency** (turn recency boosts confidence for state transitions)

Confidence thresholds drive action selection:

| Confidence | Action Policy |
|------------|---------------|
| ≥ 0.70 | Act on most probable state (high-confidence actions available) |
| 0.40–0.69 | Use safe neutral actions; avoid aggressive moves |
| < 0.40 | Conservative mode; default to information provision |

### 4.5 Initial State

For a new conversation with no history, the initial distribution is:

```
explorando: 0.70
greeting-adjacent states: 0.30 spread across descubriendo, comprendiendo
all others: 0
```

This reflects the assumption that new conversations start with an explorer, but quickly shift based on the first message.

---

## 5. State → Action Mapping

### 5.1 Design Principle

Each cognitive state has a set of **appropriate actions** (actions that advance the conversation) and **inappropriate actions** (actions that risk regression or disengagement). The state model acts as a **guardrail layer** between intent detection and action execution.

### 5.2 Action Matrix

| State | Appropriate Actions | Inappropriate Actions | Rationale |
|-------|--------------------|-----------------------|-----------|
| `explorando` | Greet, show catalog, discover needs | Close, ask for personal data, push for decision | No problem recognized; pressure causes disengagement |
| `descubriendo` | Validate problem, ask follow-up questions, acknowledge pain | Push solutions, close, show prices | Problem just recognized; needs emotional validation first |
| `consecuente` | Quantify cost, connect to future state, introduce solutions | Dismiss urgency, show many options at once | Customer feels the pain; capitalize on motivation |
| `comprendiendo` | Educate, explain solutions, show relevant knowledge | Compare products, ask for commitment | Learning phase; provide information, not pressure |
| `comparando` | Differentiate, highlight unique value, use social proof | Overwhelm with options, hard close, ignore criteria | Evaluating alternatives; help discriminate, don't confuse |
| `evaluando_riesgo` | Address concerns, provide guarantees, reduce risk | Ignore objections, push for close, add new options | Risk-focused; reduce perceived risk, don't add it |
| `decidiendo` | Assist narrowing, resolve final doubts, gentle close | Add new alternatives, ignore commitment signals, overwhelm | In the decision zone; clear the path, don't complicate |
| `transaccional` | Facilitate purchase, collect data, confirm details | Re-open evaluation, upsell aggressively, add friction | Ready to buy; make it easy |
| `esperando` | Confirm status, manage expectations, reduce dissonance | Ignore, sell again, promise timelines you can't keep | Post-purchase anxiety window; reassure |
| `experimentando` | Check in on experience, offer support | Push for another purchase, ignore issues | First impressions forming; support > sell |
| `evaluando_resultados` | Gather feedback, resolve issues, confirm value | Dismiss complaints, upsell, ignore timeline | Outcome vs. expectation; listening > talking |
| `abogando` | Invite referral, acknowledge advocacy, deepen relationship | Ignore loyalty, treat as new customer | Advocate energy is fragile; nurture |
| `confundido` | **Simplify**, offer curated recommendation, reduce options | Add more options, present complex comparisons, close | Information overload; simplify, don't complicate |
| `frustrado` | **Recovery first**: apologize, resolve issue, offer alternatives | Sell, upsell, explain why it's not a problem, ignore | Emotional damage control; fix before selling |
| `reticente` | **De-escalate**: validate, give control back, reduce pressure | Insist, close, use urgency, employ persuasion techniques | Reactance activated; any pressure makes it worse |
| `desenganchado` | Attempt re-engagement (if within window), gather learnings | Continue normal flow, ignore absence | Terminal state; graceful handling |

### 5.3 Critical Guardrails

#### "Close" Is Only Appropriate In:

1. **`decidiendo`** with **confidence ≥ 0.70** — customer is clearly narrowing options and showing commitment signals
2. **`transaccional`** — customer is ready; clearing the path is the action

A close attempt in any other state is **prohibited** by the state model.

#### `reticente` Triggers De-escalation, Never Sales Actions

When the state model detects reticence (anger + counter-argumentation directed at perceived pressure):
- Response tone shifts to validation and reduced pressure
- No product recommendations
- No urgency language
- No closing attempts
- Option to give control: "¿Prefieres que te muestre opciones o que te deje elegir a tu ritmo?"

#### `confundido` Triggers Simplification

When confusion is detected (information overload, many alternatives without convergence):
- Limit presented options to 2–3 maximum
- Offer a curated recommendation ("¿Te parece si te recomiendo la mejor opción para tu caso?")
- Do NOT add more information — simplify

#### `frustrado` Triggers Recovery

When frustration is detected:
- Acknowledge the issue before anything else
- Apologize if appropriate
- Offer resolution path
- Never attempt to sell while frustration is active
- Only transition to normal flow after frustration signals decrease

---

## 6. Integration Points

### 6.1 New Database Table: `conversation_states`

```sql
CREATE TABLE conversation_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  assistant_id UUID NOT NULL REFERENCES assistants(id),
  business_id UUID NOT NULL REFERENCES businesses(id),

  -- Current state distribution (JSONB for flexibility)
  state_distribution JSONB NOT NULL DEFAULT '{
    "explorando": 0.70,
    "descubriendo": 0.0,
    "consecuente": 0.0,
    "comprendiendo": 0.10,
    "comparando": 0.0,
    "evaluando_riesgo": 0.0,
    "decidiendo": 0.0,
    "transaccional": 0.0,
    "esperando": 0.0,
    "experimentando": 0.0,
    "evaluando_resultados": 0.0,
    "abogando": 0.0,
    "confundido": 0.10,
    "frustrado": 0.0,
    "reticente": 0.0
  }',

  -- Top-1 state (denormalized for fast queries)
  primary_state TEXT NOT NULL DEFAULT 'explorando',

  -- Confidence in the estimation (0–1)
  confidence REAL NOT NULL DEFAULT 0.3,

  -- Turn count for this conversation
  turn_count INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Index
  CONSTRAINT conversation_states_conversation_unique UNIQUE (conversation_id)
);

-- RLS: scoped to business
ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view states for their businesses"
  ON conversation_states FOR SELECT
  USING (business_id IN (SELECT get_user_business_ids()));

-- Indexes
CREATE INDEX idx_conversation_states_customer ON conversation_states(customer_id);
CREATE INDEX idx_conversation_states_business ON conversation_states(business_id);
CREATE INDEX idx_conversation_states_primary ON conversation_states(primary_state);
```

**Note:** `conversation_states` is one row per conversation, updated in place. State history is preserved in `conversation_state_history` (optional audit table).

### 6.2 New Module: `src/lib/ai/state-estimation.ts`

Core functions:

```typescript
// Types
interface StateDistribution {
  explorando: number; descubriendo: number; consecuente: number;
  comprendiendo: number; comparando: number; evaluando_riesgo: number;
  decidiendo: number; transaccional: number; esperando: number;
  experimentando: number; evaluando_resultados: number; abogando: number;
  confundido: number; frustrado: number; reticente: number;
}

interface StateEstimation {
  distribution: StateDistribution
  primaryState: keyof StateDistribution
  confidence: number
  turnCount: number
}

interface StateActionPolicy {
  state: keyof StateDistribution
  appropriateActions: string[]
  inappropriateActions: string[]
  guardrails: string[]
}

// Core functions
async function getConversationState(conversationId: string): Promise<StateEstimation>
async function updateStateEstimation(
  conversationId: string,
  messages: Array<{ role: string; content: string }>,
  previousState: StateEstimation
): Promise<StateEstimation>

function extractObservables(
  messages: Array<{ role: string; content: string }>
): ObservableSignal[]

function getActionPolicy(
  state: StateEstimation
): StateActionPolicy

function formatStateForPrompt(
  state: StateEstimation
): string  // injectable into system prompt
```

**Key design decisions:**
- State estimation is **deterministic** for observables extraction (keyword/regex based, matching `observables.md` categories) and **probabilistic** for the update step.
- The Bayesian update uses pre-computed transition matrices from `transiciones.md`.
- Observable extraction mirrors the same pattern as `intents.ts` (keyword matching) but with the richer signal vocabulary from `observables.md`.
- AI is used only for ambiguous signals (e.g., emotion valence), not for the core state update — keeping latency low.

### 6.3 Modified Runtime: `src/lib/runtime/runtime.ts`

Add state estimation step in `processIncomingMessage()`:

```
Incoming message
  → resolveCustomer()
  → resolveConversation()
  → detectIntent()
  → [NEW] getConversationState(conversationId)       // load current state
  → [NEW] extractObservables(messages)               // signals from new message
  → [NEW] updateStateEstimation(...)                 // Bayesian update
  → loadConversationContext()                        // business data
  → [NEW] getActionPolicy(state)                     // guardrails for this state
  → executeAI(statePrompt + actionPolicy)            // generate state-aware response
  → [NEW] persistStateEstimation(conversationId)     // save updated state
  → processSaleClosing()
  → resolveConditionalMedia()
  → buildInteractiveForIntent()
```

### 6.4 Modified Prompts: `src/lib/ai/prompts.ts`

Add new parameters to `buildMasterPrompt()`:

```typescript
export interface StateAwarePromptConfig {
  // ... existing params ...
  stateEstimation?: StateEstimation      // NEW: current state distribution
  actionPolicy?: StateActionPolicy       // NEW: guardrails for this state
}

// In buildMasterPrompt(), add section:
if (stateEstimation && actionPolicy) {
  prompt += `
## Estado del Cliente
El cliente se encuentra en estado: **${stateEstimation.primaryState}**
Confianza: ${Math.round(stateEstimation.confidence * 100)}%
Distribución: ${formatDistribution(stateEstimation.distribution)}

### Acciones apropiadas para este estado
${actionPolicy.appropriateActions.map(a => `- ${a}`).join('\n')}

### Acciones INAPROPIADAS para este estado (NO hacer)
${actionPolicy.inappropriateActions.map(a => `- ❌ ${a}`).join('\n')}

### Guardrails
${actionPolicy.guardrails.map(g => `- ⚠️ ${g}`).join('\n')}
`
}
```

### 6.5 Modified Context: `src/lib/conversation/context.ts`

Load state estimation alongside customer memory:

```typescript
// In loadConversationContext():
let stateEstimation: StateEstimation | undefined
if (customerId && conversationId) {
  stateEstimation = await getConversationState(conversationId)
}

// Pass to buildMasterPrompt:
const systemPrompt = buildMasterPrompt({
  // ... existing params ...
  stateEstimation,
  actionPolicy: stateEstimation ? getActionPolicy(stateEstimation) : undefined,
})
```

### 6.6 Module Map

```
src/lib/ai/
  ├── state-estimation.ts       NEW  — core state estimation logic
  ├── state-observables.ts      NEW  — observable extraction from messages
  ├── state-transitions.ts      NEW  — transition matrix and Bayesian update
  ├── state-actions.ts          NEW  — state → action policy mapping
  ├── customer-memory.ts        MODIFIED — add state to memory schema
  ├── prompts.ts                MODIFIED — accept state params
  └── knowledge.ts              UNCHANGED

src/lib/runtime/
  ├── runtime.ts                MODIFIED — add state estimation step
  └── intents.ts                UNCHANGED (complements, not replaces state)

src/lib/conversation/
  └── context.ts                MODIFIED — load and inject state

supabase/migrations/
  └── XXX_conversation_states.sql  NEW — schema migration
```

---

## 7. Relationship to Existing Components

### 7.1 State Model vs. Intent Tags

Intent tags and cognitive states are **complementary, not competing**:

| Dimension | Intent Tags | Cognitive States |
|-----------|-------------|------------------|
| Granularity | Per-message | Per-conversation |
| Purpose | Route to correct content/buttons | Guard action appropriateness |
| Determinism | Deterministic (keyword) | Probabilistic (Bayesian) |
| Turn count | Single turn | Cross-turn trajectory |

A message with `intent: price` could arrive from a customer in `comprendiendo` (learning about pricing) or `transaccional` (ready to pay). The state model tells MIA *which kind of price response is appropriate*.

### 7.2 State Model vs. Sale Detection (`detect.ts`)

Post-hoc sale detection continues to operate as a **separate post-response classification**. The state model operates **before response generation** as a guardrail. They are complementary:

- **State model**: "Based on the journey so far, what kind of response is appropriate?"
- **Sale detection**: "Based on this exchange, did a sale outcome occur?"

Post-decision states (`esperando`, `experimentando`, `evaluando_resultados`, `abogando`) extend the sale lifecycle beyond the current `sold`/`cancelled` binary.

### 7.3 State Model vs. Customer Memory (`customer-memory.ts`)

Customer memory is **accumulated facts** (interests, objections, preferences). State estimation is **real-time cognitive positioning**. The memory schema should be extended to include:

```typescript
// Add to CustomerMemory interface
lastState?: keyof StateDistribution
stateHistory?: Array<{
  state: keyof StateDistribution
  confidence: number
  at: string
}>
```

### 7.4 State Model vs. Sales Rules

Sales rules (`sales_rules` table) encode **business-level policies** (e.g., "always ask for phone number"). The state model encodes **customer-level guardrails** (e.g., "don't ask for phone number when the customer is frustrated"). State guardrails override business rules when they conflict — a frustrated customer should not be pushed for data capture.

---

## 8. Risk Assessment

### 8.1 Complexity Risk

The state model adds a new estimation layer. Mitigations:
- Observable extraction is deterministic (keyword/regex), not AI-dependent
- Bayesian update is pre-computed matrix multiplication, not LLM inference
- State estimation runs once per turn, not per message in history
- Graceful degradation: if estimation fails, fallback to current behavior (no state guardrails)

### 8.2 Latency Risk

State estimation adds one database read + one matrix multiplication per turn. Estimated overhead: < 5ms (state is cached per conversation like context). No additional AI calls for the core state update.

### 8.3 Cost Risk

No additional OpenAI calls for state estimation. Observable extraction and Bayesian update are deterministic computations. The only potential AI cost is emotion valence classification for ambiguous signals (optional, can be deferred).

### 8.4 Accuracy Risk

Bayesian estimation with pre-computed transition priors is well-understood. The risk is in observable extraction accuracy. Mitigations:
- Start with high-confidence signals (questions, explicit commitments)
- Use `explicito` signals at 0.3 weight (never alone)
- Confidence metric gates action selection — low confidence → conservative actions
- Manual override possible via dashboard

---

## 9. Implementation Phases

### Phase 1: Foundation (1–2 sprints)
- [ ] Database migration: `conversation_states` table
- [ ] `state-transitions.ts`: transition matrix from `transiciones.md`
- [ ] `state-observables.ts`: observable extraction (question types, behavioral signals)
- [ ] `state-estimation.ts`: Bayesian update core

### Phase 2: Integration (1–2 sprints)
- [ ] Modify `runtime.ts`: add state estimation step
- [ ] Modify `prompts.ts`: accept and render state context
- [ ] Modify `context.ts`: load and inject state
- [ ] State → action policy mapping

### Phase 3: Refinement (ongoing)
- [ ] Tune emission probabilities from production data
- [ ] Add post-decision state transitions (SALE_WON → `esperando`)
- [ ] Dashboard UI for state visualization
- [ ] State-based analytics and conversion metrics

---

## 10. References

| File | Purpose |
|------|---------|
| `docs/research/kb/estados.md` | 15 cognitive states with evidence sources |
| `docs/research/kb/transiciones.md` | Transition priors and empirical evidence |
| `docs/research/kb/observables.md` | Conversational signal dictionary |
| `src/lib/ai/customer-memory.ts` | Current flat memory implementation |
| `src/lib/runtime/intents.ts` | Current intent classification (6 tags) |
| `src/lib/sales/detect.ts` | Post-hoc sale outcome classification |
| `src/lib/runtime/runtime.ts` | Message processing pipeline |
| `src/lib/ai/prompts.ts` | System prompt builder |
| `src/lib/conversation/context.ts` | Context loading and caching |
| `src/lib/sales/process.ts` | Sale closing pipeline |
| `docs/audits/customer-memory-analysis.md` | Previous memory system audit |
