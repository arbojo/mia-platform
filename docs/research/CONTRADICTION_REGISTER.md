# Contradiction Register — UBSE Model vs. MIA Runtime

**Purpose:** Documents all contradictions found between the UBSE research model (theoretical) and the current MIA runtime architecture (implemented). Each contradiction records the tension, severity, resolution strategy, and status.

**Scope:** Unlike `kb/contradicciones.md` (which documents contradictions *between research schools* — C-001 through C-019), this register documents contradictions *between the research model and the engineering reality* of building MIA.

**Date:** 2026-08-25
**Status:** Living document — updated as contradictions are resolved or new ones surface.

---

## Summary Table

| ID | Category | Contradiction | Severity | Status |
|----|----------|---------------|----------|--------|
| CR-001 | Model vs. Runtime | Continuous states vs. discrete classification | HIGH | RESOLVED |
| CR-002 | Model vs. Runtime | Unlimited context vs. limited token window | CRITICAL | RESOLVED |
| CR-003 | Model vs. Runtime | Perfect observables vs. noisy signals | HIGH | RESOLVED |
| CR-004 | Research vs. Implementation | 15 UBSE states vs. 6 intent tags | CRITICAL | RESOLVED |
| CR-005 | Research vs. Implementation | Probability distributions vs. hard classification | HIGH | RESOLVED |
| CR-006 | Research vs. Implementation | Cross-turn patterns vs. per-turn processing | CRITICAL | RESOLVED |
| CR-007 | Principle Contradiction | P-009 intention-behavior gap in closing | HIGH | RESOLVED |
| CR-008 | Principle Contradiction | P-011 promotion contamination timing | HIGH | RESOLVED |
| CR-009 | Principle Contradiction | P-013 internal urgency vs. external facilitation | MEDIUM | RESOLVED |
| CR-010 | Principle Contradiction | P-026 control/autonomy vs. guided conversation | HIGH | RESOLVED |
| CR-011 | Ethical | Sales tool vs. customer's good decision | CRITICAL | OPEN |
| CR-012 | Ethical | Closing as business goal vs. pressure creates reactance | HIGH | RESOLVED |
| CR-013 | Ethical | Evidence accumulation for manipulation potential | HIGH | DEFERRED |
| CR-014 | Technical | Evidence requires history; context windows are limited | CRITICAL | RESOLVED |
| CR-015 | Technical | State estimation needs calibration data; MIA is new | HIGH | OPEN |
| CR-016 | Technical | LLM estimation (expensive) vs. rules (cheap, less accurate) | MEDIUM | RESOLVED |
| CR-017 | Model vs. Runtime | UBSE assumes a single buyer; MIA handles multi-tenant businesses | MEDIUM | RESOLVED |
| CR-018 | Principle Contradiction | P-008 social filter degrades self-report reliability | MEDIUM | RESOLVED |
| CR-019 | Research vs. Implementation | UBSE models one conversation; MIA has conversation memory per customer | MEDIUM | OPEN |
| CR-020 | Technical | Deterministic rules needed for production; state estimation is probabilistic | MEDIUM | RESOLVED |

---

## Category 1: Model vs. Runtime Contradictions

### CR-001 — Continuous States vs. Discrete Classification

| | |
|---|---|
| **ID** | CONTRADICTION-001 |
| **Contradicts** | UBSE models states as probability distributions across 15 states (continuous); runtime needs a single state to select an action (discrete). |
| **Severity** | HIGH |
| **Evidence** | `docs/research/kb/estados.md` defines 15 states. `MIA_EVIDENCE_REASONING_RESEARCH.md:195-202` proposes a probability distribution as the internal representation. Runtime must ultimately pick one action. |
| **Resolution** | Use probability distribution as the internal state representation; apply threshold-based action selection on top. The state *estimate* is continuous; the *action* is discrete. Most-likely state with confidence > threshold drives the action. Below threshold, MIA asks a clarifying question instead of acting on uncertain state. |
| **Status** | RESOLVED |
| **References** | `MIA_EVIDENCE_REASONING_RESEARCH.md:195-202`, `docs/research/kb/estados.md:13-34` |

### CR-002 — Unlimited Context vs. Limited Token Window

| | |
|---|---|
| **ID** | CONTRADICTION-002 |
| **Contradicts** | UBSE assumes the engine can examine all prior turns and accumulated evidence without limit. Runtime has a finite context window (gpt-4o-mini token limit). Evidence accumulation requires cross-turn history. |
| **Severity** | CRITICAL |
| **Evidence** | `MIA_EVIDENCE_REASONING_RESEARCH.md:104` states "each observable updates belief about current state" — implying full history access. `src/lib/ai/client.ts` uses gpt-4o-mini with fixed context. |
| **Resolution** | Store the evidence vector and state distribution in the database (`conversation_state` table), not in the LLM context window. Each turn, load only: (1) the current state distribution summary, (2) the last N observable signals (compressed), (3) transition priors. The LLM receives a structured state summary, not the raw conversation history for evidence purposes. The existing `customer-memory.ts` pattern (confidence decay with half-life) extends naturally to evidence compression. |
| **Status** | RESOLVED |
| **References** | `MIA_EVIDENCE_REASONING_RESEARCH.md:129-153`, `src/lib/ai/customer-memory.ts` |

### CR-003 — Perfect Observables vs. Noisy Signals

| | |
|---|---|
| **ID** | CONTRADICTION-003 |
| **Contradicts** | UBSE observable dictionary (`observables.md`) describes clean signals: a "question about price" maps to `comparando` or `transaccional`. Real customer messages are noisy: sarcasm, typos, mixed signals, multi-language, slang. |
| **Severity** | HIGH |
| **Evidence** | `docs/research/kb/observables.md:6-16` defines emission weights (0.3–0.7) assuming clean signal extraction. Real WhatsApp messages (Vitanova test environment) contain abbreviations, voice-to-text errors, emojis, and mixed intent. |
| **Resolution** | (1) Observable extraction itself uses the existing LLM (which handles noise, slang, ambiguity better than keywords). (2) The emission weights are probabilistic precisely for this reason — a noisy signal contributes weakly to multiple states rather than strongly to one. (3) No single signal is decisive (P-008: `explicito` at 0.3 weight; requires corroboration). (4) Accumulation across turns smooths out individual noisy signals. |
| **Status** | RESOLVED |
| **References** | `docs/research/kb/observables.md:6-16`, `MIA_EVIDENCE_REASONING_RESEARCH.md:158-171` |

### CR-017 — Single Buyer Model vs. Multi-Tenant Business

| | |
|---|---|
| **ID** | CONTRADICTION-017 |
| **Contradicts** | UBSE models a single buyer's cognitive journey. MIA serves multiple businesses (tenants), each with different products, sales rules, and customer bases. The same state (e.g., `evaluando_riesgo`) looks different for a supplement buyer vs. a cosmetic buyer. |
| **Severity** | MEDIUM |
| **Evidence** | `AGENTS.md §5.1` defines the multi-tenant hierarchy. `AGENTS.md §12.1` requires "all configurable behavior from DB." UBSE states are domain-agnostic (phenomenological), but transition priors and action mappings may need per-business tuning. |
| **Resolution** | The UBSE states are *universal* (H-001 hypothesis: same states across categories). What varies per business is: (1) the transition prior weights (calibrated per catalog), (2) the action mappings (what "present product" means), and (3) the observable-to-state emission weights (different vocabularies per domain). The base model is universal; tuning is per-tenant. |
| **Status** | RESOLVED |
| **References** | `docs/research/kb/estados.md:49`, `AGENTS.md §5.1`, `docs/research/kb/hipotesis.md:7` |

---

## Category 2: Research vs. Implementation Contradictions

### CR-004 — 15 UBSE States vs. 6 Intent Tags

| | |
|---|---|
| **ID** | CONTRADICTION-004 |
| **Contradicts** | UBSE defines 15 cognitive states (8 pre-decision, 4 post-decision, 3 transversal). Current MIA runtime uses 6 flat intent tags (catalog, price, shipping, payment, contact, greeting) with no cognitive model. |
| **Severity** | CRITICAL |
| **Evidence** | `docs/research/kb/estados.md:13-34` (15 states). `MIA_EVIDENCE_REASONING_RESEARCH.md:34-36` ("6 tags: catalog, price, shipping, payment, contact, greeting — no state tracking"). `src/lib/runtime/intents.ts` implements keyword-based matching. |
| **Resolution** | The 6 intent tags are *not* replaced — they become a subset of observable extraction. Intent tags capture "what the customer is asking about" (topic). UBSE states capture "where the customer is in their decision journey" (cognitive state). Both coexist: topic informs observable extraction, which feeds state estimation. A "price question" from a customer in `explorando` means something different from the same question in `transaccional`. |
| **Status** | RESOLVED |
| **References** | `MIA_EVIDENCE_REASONING_RESEARCH.md:54-62`, `docs/research/kb/estados.md:13-34` |

### CR-005 — Probability Distributions vs. Hard Classification

| | |
|---|---|
| **ID** | CONTRADICTION-005 |
| **Contradicts** | UBSE uses weighted emission and transition models (probabilistic). Current MIA uses hard keyword matching with binary intent detection (deterministic). |
| **Severity** | HIGH |
| **Evidence** | `observables.md:9-16` defines emission weights (0.3–0.7). `MIA_EVIDENCE_REASONING_RESEARCH.md:174-192` proposes a full emission matrix. Current `intents.ts` returns boolean matches. |
| **Resolution** | The lightweight scoring approach (Option B from `MIA_EVIDENCE_REASONING_RESEARCH.md:274-278`) bridges this gap. Instead of full Bayesian inference (Option A — too complex for MVP), use weighted scoring: each observable adds/subtracts weight from each state's score. The distribution is implicit (the scores *are* the distribution, normalized). No need for a probabilistic framework in MVP — just arithmetic. Upgrade to proper Bayesian (Option D hybrid) when calibration data is available. |
| **Status** | RESOLVED |
| **References** | `MIA_EVIDENCE_REASONING_RESEARCH.md:274-288` |

### CR-006 — Cross-Turn Patterns vs. Per-Turn Processing

| | |
|---|---|
| **ID** | CONTRADICTION-006 |
| **Contradicts** | UBSE tracks patterns across turns: repeated questions signal `confundido` (P-022), escalation of objections signals `evaluando_riesgo`, silence after engagement signals `desenganchado`. Current MIA processes each turn independently with no memory of prior turns' cognitive trajectory. |
| **Severity** | CRITICAL |
| **Evidence** | `observables.md:13` (behavior signals: "longitud, densidad de preguntas, tiempos, re-preguntas" imply cross-turn tracking). `MIA_EVIDENCE_REASONING_RESEARCH.md:35-36` ("No state tracking: the system doesn't know if the customer is exploring, comparing, or deciding"). `transiciones.md:42-46` defines sidecar rules that require multi-turn observation (silence thresholds, growing option count). |
| **Resolution** | The evidence vector stored in `conversation_state` table accumulates across turns. Behavioral signals (repeated questions, growing option count, silence) are computed from the observable log, not from a single turn. The state distribution persists between turns as a prior — it *is* the cross-turn memory. Per `MIA_EVIDENCE_REASONING_RESEARCH.md:204-209`, transition priors from the previous turn become the prior for the next update. |
| **Status** | RESOLVED |
| **References** | `MIA_EVIDENCE_REASONING_RESEARCH.md:129-153`, `docs/research/kb/transiciones.md:42-46` |

---

## Category 3: Principle Contradictions

### CR-007 — P-009 (Intention-Behavior Gap): Customer Says "I'll Buy" But Doesn't

| | |
|---|---|
| **ID** | CONTRADICTION-007 |
| **Contradicts** | P-009 establishes that intention is a weak predictor of behavior (Sheeran 2002: r+=.53 correlational, d+=.36 experimental). The customer says "lo voy a comprar" but never follows through. MIA's runtime must decide: treat the statement as evidence of `decidiendo` or discount it? |
| **Severity** | HIGH |
| **Evidence** | `docs/research/kb/principios.md:109-117` (P-009: "brecha intención-comportamiento"). `observables.md:86-87` ("opinión declarada — débil; `explicito` entra aquí, peso 0.3 o menor"). `docs/research/kb/contradicciones.md:65-68` (C-007: "'déjame pensarlo' como avance vs. zombie outcome"). |
| **Resolution** | The system weights `explicito` at 0.3 (weak, never alone — `observables.md:14`). A declared intention "lo voy a comprar" contributes weakly to `decidiendo` but requires corroboration from behavior/question signals. The DARN-CAT scale (`observables.md:104-118`) provides the gradation: "me gustaría" (D — Desire, weak) vs. "voy a llamar a mi socio el martes" (A — Activation, strong, specific plan with actor + date). Only Activation/Taking Steps trigger `transaccional`. "Déjame pensarlo" without corroborating behavior is classified as zombie outcome (weak/negative), not `evaluando_riesgo` (C-007 resolved in `contradicciones.md:65-68`). |
| **Status** | RESOLVED |
| **References** | `docs/research/kb/principios.md:109-117`, `docs/research/kb/contradicciones.md:65-68`, `docs/research/kb/observables.md:104-118` |

### CR-008 — P-011 (Promotion Contamination): MIA Must Present Products but Not Too Early

| | |
|---|---|
| **ID** | CONTRADICTION-008 |
| **Contradicts** | P-011 states that promoting a product degrades the truthfulness of the conversation — the customer stops reporting reality and starts being polite. But MIA is a sales tool that must eventually present products. When is it safe to promote? |
| **Severity** | HIGH |
| **Evidence** | `docs/research/kb/principios.md:129-138` (P-011: "el pitch contamina la verdad del comprador"). `docs/research/kb/contradicciones.md:52-59` (C-006: "pitch temprano vs. descubrir primero"). `MIA_EVIDENCE_REASONING_RESEARCH.md:217-218` (action table: `explorando` → "avoid present products"; `descubriendo` → "avoid pitch solution"). |
| **Resolution** | State-guided promotion timing. Product presentation is appropriate only in states where the customer has already articulated their need (corroborated, not just declared): `comprendiendo`, `comparando`, `decidiendo`, `transaccional`. In `explorando`/`descubriendo`/`consecuente`, MIA extracts evidence (asks questions, validates pain) before presenting. The key test: has the customer described their problem in their own words with a concrete episode (P-008/P-009)? If yes, safe to promote. If no, contamination risk is high. |
| **Status** | RESOLVED |
| **References** | `docs/research/kb/principios.md:129-138`, `MIA_EVIDENCE_REASONING_RESEARCH.md:215-228` |

### CR-009 — P-013 (Consequence Awareness): Urgency Is Internal but MIA Needs to Facilitate It

| | |
|---|---|
| **ID** | CONTRADICTION-009 |
| **Contradicts** | P-013 (consequence awareness) describes an *internal* mental event: the buyer feels the cost of not acting. MIA cannot force this event — it can only create conditions for it. But the business goal is to move customers toward purchase, which requires urgency. Where is the line between facilitating awareness and manufacturing urgency? |
| **Severity** | MEDIUM |
| **Evidence** | `docs/research/kb/principios.md:153-162` (P-013: "la motivación emerge de percibir la consecuencia de no actuar"). `docs/research/kb/contradicciones.md:88-95` (C-010: "urgencia real vs. escasez fabricada"). `docs/research/kb/estados.md:15` (`consecuente`: "el comprador *siente* el costo"). |
| **Resolution** | MIA's role is to *evoke* the consequence, not *inject* it (MI rule: evocation, not prescription — `contradicciones.md:152-158`). Concretely: (1) In `descubriendo`, MIA asks questions that help the customer articulate the problem's impact (SPIN implication questions). (2) Scarcity/urgency signals (P-013) are only presented when the source is *verifiable* (C-010: "la fuente de la urgencia debe ser verificable"). (3) The GAP framework's Cost of Inaction is legitimate: if the customer can articulate the cost, MIA reinforces it; if they can't, fabricating it violates C-010. (4) The `consecuente` state is diagnosed by the customer's own language (change talk, quantified impact), not by MIA's assertion. |
| **Status** | RESOLVED |
| **References** | `docs/research/kb/principios.md:153-162`, `docs/research/kb/contradicciones.md:88-95`, `docs/research/kb/contradicciones.md:152-158` |

### CR-010 — P-026 (Control/Autonomy): Customer Must Feel in Control but MIA Guides the Conversation

| | |
|---|---|
| **ID** | CONTRADICTION-010 |
| **Contradicts** | P-026 (control/autonomy, Fundamental) establishes that the customer must feel they are making their own decision. But MIA's architecture is designed to *guide* conversations toward purchase — state estimation → action selection is inherently steering. How can a system that estimates state and selects actions also respect autonomy? |
| **Severity** | HIGH |
| **Evidence** | `docs/research/kb/principios.md:309-318` (P-026: "devolver control percibido reduce la reactancia"). `MIA_EVIDENCE_REASONING_RESEARCH.md:215-228` (action table: actions are selected *for* the customer). `docs/research/kb/contradicciones.md:152-158` (C-017: "empuje vs. evocación" — MI resolves in favor of evocation). |
| **Resolution** | The key distinction (from MI and Voss) is between *directing the topic* and *controlling the decision*. MIA can guide which information to present (topic control) while leaving the decision to the customer (autonomy). Concretely: (1) Action selection offers options, not commands ("¿te gustaría ver opciones similares?" vs. "mira esta"). (2) The "no" is always accepted (Voss: "no" returns control; P-026). (3) `reticente` detection triggers immediate de-escalation — MIA backs off. (4) "Close" is framed as removing friction, not applying pressure ("¿te ayudo a completar el pedido?" vs. "compra ahora"). (5) The customer's own words (change talk, P-012) drive the progression — MIA evokes, not pushes. |
| **Status** | RESOLVED |
| **References** | `docs/research/kb/principios.md:309-318`, `docs/research/kb/contradicciones.md:152-158` |

### CR-018 — P-008 (Social Filter): Self-Report Reliability Is Degraded

| | |
|---|---|
| **ID** | CONTRADICTION-018 |
| **Contradicts** | P-008 (social filter) states that customers prioritize preserving the relationship over truth-telling. `explicito` (self-report) has weight 0.3 — the weakest signal type. But in a WhatsApp chat, *all* signals are text-based self-reports. There is no tone of voice, no body language, no behavioral observation beyond text. |
| **Severity** | MEDIUM |
| **Evidence** | `docs/research/kb/principios.md:99-108` (P-008: "el elogio y el ánimo son lubricación social, no datos"). `docs/research/kb/observables.md:79-87` (hierarchy: behavior > process > investment > declaration). WhatsApp channels strip non-verbal signals. |
| **Resolution** | The hierarchy of evidence (`observables.md:79-87`) already handles this: (1) Behavioral signals in text are still behavior — repeated questions, growing specificity, concrete past episodes ("la última vez que...") are verifiable. (2) Investment signals work in text too — scheduling a follow-up, introducing a contact, sharing a budget number. (3) `explicito` remains weak (0.3) and is never sufficient alone. (4) The system accumulates evidence across turns (CR-006), so a single polite message doesn't overwhelm — consistency of signals over time is what matters. (5) Voice messages (if available) add tone information as `emotion` signals. |
| **Status** | RESOLVED |
| **References** | `docs/research/kb/principios.md:99-108`, `docs/research/kb/observables.md:79-87` |

---

## Category 4: Ethical Contradictions

### CR-011 — Sales Tool vs. Helping Customers Make Good Decisions

| | |
|---|---|
| **ID** | CONTRADICTION-011 |
| **Contradicts** | MIA is a sales platform — its business purpose is to help businesses sell. But the research (especially MI, P-026, P-012) says the best sales outcome comes from helping the customer make *their own* good decision. What happens when the best decision for the customer is *not* to buy? |
| **Severity** | CRITICAL |
| **Evidence** | `AGENTS.md §6.1` (MIA's domain: "Conversational Sales Intelligence"). `MIA_EVIDENCE_REASONING_RESEARCH.md:237` ("MIA should optimize for helping the customer make a good decision, not maximizing probability of immediate purchase every turn"). `docs/research/kb/principios.md:309-318` (P-026: customer must feel in control). |
| **Resolution** | This is a design decision, not a bug. MIA's long-term value depends on trust — a customer who buys and regrets generates dissonance (P-005), negative WOM, and churn. A customer who decides *not* to buy but trusts MIA returns and refers others (→ `abogando` via satisfaction, even without purchase). Concretely: (1) When evidence indicates the customer is in the wrong product/category, MIA redirects or says so. (2) The `frustrado` path prioritizes recovery over sales. (3) Post-decision states (`esperando` → `evaluando_resultados` → `abogando`) are part of MIA's success metrics, not just conversion rate. (4) The business owner (tenant) sees analytics on *all* outcomes, including "not the right fit" — this is valuable sales intelligence. **This contradiction remains partially OPEN** because the exact implementation of "recommend against purchase" needs product-level design decisions. |
| **Status** | OPEN |
| **References** | `MIA_EVIDENCE_REASONING_RESEARCH.md:237`, `AGENTS.md §6.1`, `docs/research/kb/principios.md:309-318` |

### CR-012 — Closing as Business Goal vs. Pressure Creates Reactance

| | |
|---|---|
| **ID** | CONTRADICTION-012 |
| **Contradicts** | The business expects MIA to close sales. But P-026 (Fundamental) and C-005 establish that pressure creates reactance (`reticente`), which is the worst outcome — the customer disengages entirely. Closing and pressuring appear to be the same action from different angles. |
| **Severity** | HIGH |
| **Evidence** | `docs/research/kb/contradicciones.md:41-49` (C-005: "cierre agresivo vs. decisión informada"). `docs/research/kb/principios.md:309-318` (P-026: "técnicas de cierre que presionan → reactancia"). `MIA_EVIDENCE_REASONING_RESEARCH.md:259-263` (`reticente` handling: "STOP all sales actions"). |
| **Resolution** | Close ≠ pressure. The contradiction resolves by separating: (1) *Closing as removing friction* — in `transaccional` state, the customer wants to buy; MIA's job is to make the path easy (provide payment options, confirm details, answer last-minute questions). This is helpful, not pressuring. (2) *Closing as applying pressure* — attempting to force a decision when the customer isn't ready (`evaluando_riesgo`, `decidiendo`, or earlier). This is prohibited. (3) The evidence-based gate: `transaccional` entry requires strong evidence (investment signals from DARN-CAT escalons A/T, not just declarations). (4) The `reticente` circuit breaker: any sign of reactance → immediate de-escalation, no retry in same conversation. |
| **Status** | RESOLVED |
| **References** | `docs/research/kb/contradicciones.md:41-49`, `docs/research/kb/principios.md:309-318`, `MIA_EVIDENCE_REASONING_RESEARCH.md:259-263` |

### CR-013 — Evidence Accumulation Could Be Used for Manipulation

| | |
|---|---|
| **ID** | CONTRADICTION-013 |
| **Contradicts** | Evidence accumulation builds a rich model of the customer's cognitive state, weaknesses, and pressure points. This same model could theoretically be used to *exploit* rather than *help* — finding the customer's vulnerability and pressing it. The UBSE research itself documents manipulation risks (C-010: fabricated scarcity, C-009: leading questions). |
| **Severity** | HIGH |
| **Evidence** | `docs/research/kb/contradicciones.md:79-87` (C-009: "escalar urgencia sin evidencia real es manipulación"). `docs/research/kb/contradicciones.md:88-95` (C-010: "la veracidad es condición de toda heurística de influencia"). `docs/research/kb/observables.md:89-91` ("compromiso inducido por técnicas NO cuenta como señal"). |
| **Resolution** | This is **deferred to the ethical governance layer**, not resolved by the evidence model itself. Concretely: (1) The evidence model only *estimates* state — it doesn't *act*. The action selection layer (Phase 3) is where ethical constraints are enforced. (2) Hard constraints: never sell in `frustrado`; never fabricate scarcity (C-010); `reticente` triggers de-escalation. These are architectural rules, not tunable parameters. (3) The observable log (table) provides auditability — every state estimation and action is recorded and reviewable. (4) Long-term: the business owner (tenant) should have visibility into how MIA handles sensitive states. **Full ethical review is deferred to production governance.** |
| **Status** | DEFERRED |
| **References** | `docs/research/kb/contradicciones.md:79-95`, `MIA_EVIDENCE_REASONING_RESEARCH.md:143-153` |

---

## Category 5: Technical Contradictions

### CR-014 — Evidence Requires History but Context Windows Are Limited

| | |
|---|---|
| **ID** | CONTRADICTION-014 |
| **Contradicts** | Evidence accumulation requires access to the full conversation history (for behavioral patterns, repeated signals, sidecar rules like silence detection). LLM context windows are finite and expensive. Storing all messages in context is not feasible for production. |
| **Severity** | CRITICAL |
| **Evidence** | `MIA_EVIDENCE_REASONING_RESEARCH.md:129-153` (proposes `conversation_state` and `observable_log` tables). `src/lib/ai/client.ts` (gpt-4o-mini with fixed token costs). `transiciones.md:42-46` (sidecar rules require multi-turn observation). |
| **Resolution** | Dual storage strategy: (1) **Raw messages** stay in the existing `messages` table (for audit, replay, training). (2) **Evidence vector** (compressed, accumulated) lives in `conversation_state` — a fixed-size JSONB structure that grows by type count, not message count. (3) **Observable log** records each turn's extraction (for calibration/learning) but is NOT loaded into context. (4) **State summary** (current distribution + last 3 key signals + confidence) is what gets injected into the LLM prompt. The context window sees: "Customer state: 65% `evaluando_riesgo`, 20% `comparando`. Key signals: asked about warranty (turn 3), compared with Competitor X (turn 5), repeated price question (turn 7)." This is ~200 tokens vs. full history. |
| **Status** | RESOLVED |
| **References** | `MIA_EVIDENCE_REASONING_RESEARCH.md:129-153`, `MIA_EVIDENCE_REASONING_RESEARCH.md:194-209` |

### CR-015 — State Estimation Needs Calibration Data but MIA Is New

| | |
|---|---|
| **ID** | CONTRADICTION-015 |
| **Contradicts** | The emission matrix (`MIA_EVIDENCE_REASONING_RESEARCH.md:174-192`) contains illustrative weights ("Values are illustrative; actual weights would be calibrated from data"). But MIA has no production conversation data yet — Vitanova is the first client and the system hasn't been deployed with evidence accumulation. |
| **Severity** | HIGH |
| **Evidence** | `MIA_EVIDENCE_REASONING_RESEARCH.md:191` ("Values are illustrative; actual weights would be calibrated from data"). `MIA_EVIDENCE_REASONING_RESEARCH.md:319-323` (Phase 4: "Use LLM to validate state estimates; tune emission weights from data"). |
| **Resolution** | Three-phase calibration strategy: (1) **MVP (Phase 1-2):** Use the research-derived weights as starting estimates. The observable-to-state mappings in `observables.md` already encode directional weights (e.g., "question about guarantee → `evaluando_riesgo`"). Use the LLM for extraction (which handles nuance) and simple scoring for accumulation. (2) **Phase 4 calibration:** Use the LLM as a second opinion — run state estimation in parallel (lightweight scoring) and log LLM's state estimate. When they disagree, flag for human review. Over time, the disagreements tune the weights. (3) **Long-term:** Accumulate `observable_log` data → compute actual emission probabilities from observed correlations → replace illustrative weights with empirical ones. The system is designed to be bootstrapped from research and refined from data. |
| **Status** | OPEN |
| **References** | `MIA_EVIDENCE_REASONING_RESEARCH.md:174-192`, `MIA_EVIDENCE_REASONING_RESEARCH.md:319-323` |

### CR-016 — LLM Estimation (Expensive) vs. Rules (Cheap, Less Accurate)

| | |
|---|---|
| **ID** | CONTRADICTION-016 |
| **Contradicts** | The LLM can estimate state with nuance (handle sarcasm, mixed signals, context-dependent meaning). But every LLM call costs tokens and adds latency. Rules-based scoring is instant and free but can't handle ambiguity. |
| **Severity** | MEDIUM |
| **Evidence** | `MIA_EVIDENCE_REASONING_RESEARCH.md:270-288` (Options A-D comparison). `src/lib/ai/client.ts` (token cost tracking). |
| **Resolution** | The hybrid architecture (Option D) resolves this: (1) **Runtime (every turn):** Lightweight scoring (rules/arithmetic) — zero marginal cost, <10ms. Uses the emission matrix and transition priors. Handles 90% of cases. (2) **Observable extraction (existing LLM call):** The LLM already processes each turn for response generation. Repurpose this call to also extract observables — no additional cost. (3) **Calibration (periodic):** LLM runs full state estimation on logged conversations to validate/retune the lightweight model. This is a batch process, not per-turn. (4) **Edge cases:** When lightweight scoring confidence is below threshold, the next LLM call includes a state-estimation prompt. This is rare (only when uncertain) and piggybacks on the existing call. |
| **Status** | RESOLVED |
| **References** | `MIA_EVIDENCE_REASONING_RESEARCH.md:270-288` |

### CR-019 — UBSE Models One Conversation; MIA Has Conversation Memory per Customer

| | |
|---|---|
| **ID** | CONTRADICTION-019 |
| **Contradicts** | UBSE models a single conversation as a complete decision journey. MIA maintains customer memory across conversations (`customer-memory.ts`). A customer may have multiple conversations over days/weeks. State resets between conversations? Or carries over? |
| **Severity** | MEDIUM |
| **Evidence** | `docs/research/kb/estados.md:49` ("el conjunto de estados debe permanecer estable al cambiar de catálogo; lo que varía es la residencia/dwell por estado"). `src/lib/ai/customer-memory.ts` (interests, objections, questions — flat lists, no state). `MIA_EVIDENCE_REASONING_RESEARCH.md:43-44` ("No conversation-level state"). |
| **Resolution** | State carries over between conversations, with decay. Concretely: (1) At conversation start, initialize from the customer's last known state (stored in `customer-memory.ts` or `conversation_state`). (2) Apply decay: if >24h since last conversation, multiply state distribution by a decay factor (states lose confidence, uniform prior creeps in). The customer may have moved backward (P-002: retrocesos normales). (3) The first few messages of a new conversation are high-value for recalibration — the customer's opening signals quickly update the prior. (4) Cross-conversation patterns (e.g., customer always asks about price first, then goes silent) become customer-memory insights, not conversation-state entries. |
| **Status** | OPEN |
| **References** | `src/lib/ai/customer-memory.ts`, `MIA_EVIDENCE_REASONING_RESEARCH.md:43-44` |

### CR-020 — Deterministic Rules Needed for Production; State Estimation Is Probabilistic

| | |
|---|---|
| **ID** | CONTRADICTION-020 |
| **Contradicts** | Production systems need deterministic behavior for debugging, reproducibility, and SLAs. Probabilistic state estimation introduces non-determinism: the same input could lead to different actions depending on accumulated history and floating-point precision. |
| **Severity** | MEDIUM |
| **Evidence** | `AGENTS.md §8` ("Never introduce regressions"). General engineering practice for production systems. |
| **Resolution** | The state estimation *itself* can be deterministic given the same input history — Bayesian updates are deterministic given the same sequence of observations and priors. The non-determinism comes from the LLM (observable extraction). Mitigations: (1) Observable extraction uses temperature=0 (deterministic) in production. (2) The scoring engine is pure arithmetic — fully deterministic. (3) The observable log provides full auditability: given the same log, the same state sequence is reproducible. (4) State thresholds (e.g., "transact when confidence > 0.7 and state = `transaccional`") are hard rules that prevent probabilistic drift from causing bad actions. |
| **Status** | RESOLVED |
| **References** | `src/lib/ai/client.ts` (model configuration), `MIA_EVIDENCE_REASONING_RESEARCH.md:129-153` |

---

## Unresolved Contradictions (Require Human Input)

The following contradictions are marked OPEN or DEFERRED and require product, ethical, or architectural decisions by the team:

| ID | Contradiction | What Needs to Be Decided |
|----|---------------|--------------------------|
| **CR-011** | Sales tool vs. customer's good decision | How should MIA handle the case where the best decision for the customer is *not* to buy? Should it say "this product isn't right for you"? What does the business owner see in analytics? This is a **product decision**, not a technical one. |
| **CR-013** | Evidence accumulation for manipulation | What ethical guardrails should the action selection layer enforce? Who defines "manipulation" for each tenant's context? This requires a **governance framework** before production deployment. |
| **CR-015** | No calibration data yet | The emission weights are illustrative. How quickly should the system self-correct? Should we use Vitanova's training conversations as initial calibration data? This is a **data strategy decision**. |
| **CR-019** | Cross-conversation state persistence | How much state decay between conversations? What's the default state for a new customer who has never interacted? Should business owners be able to reset a customer's state? This is a **memory design decision**. |

---

## Recommendations for Handling Contradictions in Implementation

### 1. Treat Resolved Contradictions as Architectural Constraints

Every RESOLVED contradiction encodes a hard constraint on the evidence accumulation system. Violating any of them will reintroduce the original problem. These constraints are:

- **CR-002**: Evidence vectors live in the database, not the context window.
- **CR-006**: State distribution persists between turns as a prior.
- **CR-007**: `explicito` at 0.3, never alone; DARN-CAT scale for commitment strength.
- **CR-008**: Product presentation only when customer has articulated need with corroborated evidence.
- **CR-012**: Close = remove friction in `transaccional`; never pressure.
- **CR-014**: LLM prompt receives a ~200-token state summary, not full history.
- **CR-016**: Runtime scoring is arithmetic (free); LLM is for extraction (existing call) and calibration (batch).

### 2. Phase Contradictions Into the Implementation Roadmap

| Phase | Contradictions Addressed |
|-------|--------------------------|
| **Phase 1** (Observable Extraction) | CR-003, CR-004 — Extract signals from noisy text; replace intent tags with observables |
| **Phase 2** (State Scoring) | CR-001, CR-005, CR-006, CR-014, CR-020 — Accumulate evidence, maintain state distribution, store in DB |
| **Phase 3** (Action Selection) | CR-008, CR-009, CR-010, CR-012 — State-guided actions, close only in `transaccional`, respect autonomy |
| **Phase 4** (Calibration) | CR-015, CR-016 — Tune weights from data, hybrid LLM+rules |
| **Pre-Production** | CR-011, CR-013 — Ethical review, governance framework, "recommend not to buy" behavior |

### 3. Track OPEN Contradictions in Sprint Reviews

Every sprint review should check:
- Has any OPEN contradiction been resolved by new evidence or implementation decisions?
- Has any RESOLVED contradiction been violated by a code change?
- Are there new contradictions from production data or user feedback?

### 4. Document New Contradictions Immediately

When a contradiction surfaces during implementation (e.g., "the scoring engine produces different results than expected because..."), add it to this register with the same schema. Use IDs starting from CR-021.

### 5. The Core Principle

> **The UBSE model is the theory. The MIA runtime is the engineering. Contradictions between them are not bugs — they are the design space. Resolving them well is the product.**

---

## Appendix: Relationship to `kb/contradicciones.md`

| Register | Scope | Content |
|----------|-------|---------|
| `kb/contradicciones.md` (C-001 to C-019) | Research-level: contradictions **between schools of thought** | AIDA vs. EKB, SPIN vs. Challenger, Cialdini vs. Schwartz, etc. Resolutions inform the UBSE model. |
| This register (CR-001 to CR-020) | Engineering-level: contradictions **between the research model and the implementation** | Continuous vs. discrete, unlimited vs. limited context, 15 states vs. 6 tags, etc. Resolutions inform the MIA architecture. |

The two registers are complementary: school-vs-school contradictions (C-series) determine *what the model says*; model-vs-runtime contradictions (CR-series) determine *how the system implements it*.
