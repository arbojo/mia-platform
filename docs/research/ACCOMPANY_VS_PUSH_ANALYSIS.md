# Accompany vs Push: Strategic Analysis for MIA Conversational Sales

**Status:** Research document — informs UBSE v2 implementation and prompt architecture.
**Date:** 2026-08-25
**Classification:** RESEARCH-ONLY — no code changes proposed.
**References:** UBSE v1.1 (`docs/design/ubse-model.md`), KB principles (`docs/research/kb/principios.md`), KB states (`docs/research/kb/estados.md`), KB observables (`docs/research/kb/observables.md`), KB transitions (`docs/research/kb/transiciones.md`), KB contradictions (`docs/research/kb/contradicciones.md`), Evidence Reasoning Research (`docs/research/MIA_EVIDENCE_REASONING_RESEARCH.md`), Sales Pipeline (`src/lib/sales/process.ts`, `src/lib/sales/detect.ts`).

---

## 1. The Core Tension

Every sales system faces a fundamental strategic choice: **push toward close** or **accompany the customer**.

### Traditional Sales: Push

The default assumption in sales automation — and in MIA's current pipeline — is that every turn should maximize the probability of immediate purchase. The system detects a trigger keyword (`hasSalesTrigger` in `src/lib/sales/detect.ts:47`), classifies the outcome, and emits closing events. The pipeline is reactive: it waits for the customer to signal readiness, then attempts to close. There is no mechanism to:

- Distinguish "customer is comparing options" from "customer is confused" from "customer feels pressured"
- Accumulate evidence across turns to build a state estimate
- Select an appropriate response based on where the customer actually is in their decision journey
- De-escalate when the customer is resistant

The result: **every conversation is optimized for the same endpoint — close — regardless of the customer's cognitive state.**

### Consultative Sales: Accompany

The alternative — supported by every major sales research tradition from SPIN Selling to Motivational Interviewing — is that the seller's role is to **help the customer make a good decision**. This means:

- Matching the response to where the customer is (not where the seller wants them to be)
- Building rapport and discovering needs before presenting solutions
- Letting the customer articulate value in their own words (P-012: auto-persuasion)
- De-escalating resistance instead of pushing through it
- Accepting that "not now" is a valid outcome, and the right one for that moment

### MIA's Product Principle

This analysis is grounded in MIA's core product principle:

> **MIA should optimize for helping the customer make a good decision, not maximizing probability of immediate purchase every turn.**

This is not merely an ethical preference. It is a **performance hypothesis**: that accompanying the customer produces better long-term outcomes — higher satisfaction, lower cancellation rates, more advocacy — than pushing toward close. The UBSE research provides the theoretical foundation and the empirical evidence to test this hypothesis.

---

## 2. Evidence from UBSE Research

The UBSE knowledge base contains 26 principles (P-001 through P-026), 15 cognitive states, a full observable dictionary, and a transition matrix with falsation-audited evidence. Six principles directly address why pushing fails and accompanying works.

### 2.1 P-009: Brecha intención-comportamiento (Intention-Behavior Gap)

**Confidence: Fundamental**

People predict their own future behavior poorly. Hypothetical responses are cheap, confident, and inaccurate. Past behavior is the best evidence of future behavior.

> Sheeran (2002, meta-analysis of 422 studies): intention→behavior r+=.53 correlational; Webb & Sheeran (2006): changing intentions changes behavior only d+=.36 experimentally; the *inclined abstainers* (intend, don't act) are the majority of the gap.

**Implication for MIA:** When MIA pushes a customer toward commitment, the customer's verbal agreement ("sure, I'll think about it", "sounds good, let's reconnect") is **not real commitment**. It is a social courtesy — P-008 (filtro social). Pushing generates false signals, not real commitment. The system that treats verbal agreement as progress is systematically misinformed.

**Evidence in observables:** "déjame pensarlo" without date, criteria, or follow-up commitment is a zombie outcome (C-007). "avísame cuando esté" contains zero commitment (DARN-CAT: Desire level, not even Commitment).

### 2.2 P-011: Contaminación por promoción (Promotion Contaminates Truth)

**Confidence: Alta**

When the seller describes their product, the buyer stops reporting their reality and starts performing approval. The quality of evidence degrades immediately.

> The Mom Test (Fitzpatrick, 2013): "谈论你的想法会污染真相" — speaking about your idea contaminates the other person's honesty.

**Implication for MIA:** Pitching too early — in `explorando`, `descubriendo`, or early `comprendiendo` — destroys MIA's ability to gather accurate evidence about the customer's state. The customer starts saying "that sounds great" instead of describing their actual problem. The system becomes blind to the very information it needs to make good decisions.

**Evidence in observables:** After MIA describes a product, the buyer shifts from sharing episodic problems to praising the solution. The observable `statement` (problem description) drops; `explicito` (self-report) rises but becomes unreliable (P-008).

### 2.3 P-012: Auto-persuasión (Self-Persuasion)

**Confidence: Convergente**

When the buyer articulates the value of the solution in their own words, commitment is greater than when the seller declares the value. "Seeking information persuades more than giving it."

> SPIN (Rackham, 1988): need-payoff questions; Cialdini (Influence): coherence — saying → believing → acting; The Mom Test: the value the buyer enunciates weighs more.

**Implication for MIA:** The most powerful moment in a sale is when the customer says "esto me ahorraría X al mes" or "con esto por fin podríamos..." in their own words. This is auto-persuasion (P-012) and change talk (MI). **MIA cannot generate this moment by pushing.** It can only create the conditions for it by asking questions, exploring the problem, and letting the customer arrive at their own conclusion.

**Evidence in observables:** The customer calculates benefit in their own words; shifts from "interesante" to "nos ahorraría X"; articulates the value without being prompted. This is observable `change talk` on the DARN-CAT scale (R → N → A → T levels).

### 2.4 P-013: Conciencia de la consecuencia (Consequence Awareness)

**Confidence: Fundamental**

The buyer moves from *knowing* the problem to *feeling* its cost. Motivation emerges from perceiving the consequence of inaction; it is the mental event that converts intellectual agreement into urgency.

> SPIN: implication questions (highest correlation with success in complex sales; "conscious vs. motivated"); GAP: Cost of Inaction ("if you can't articulate the cost of inaction, you don't have a sale"); Sandler: Pain Funnel and budget gate.

**Implication for MIA:** Urgency must be **internal, not induced**. The customer must arrive at "this is costing me X per month" on their own — not be told "this offer ends Friday." Fabricated urgency (C-010) works briefly and collapses when detected, triggering `reticente`. Real urgency (P-013) is durable because the customer owns it.

**Evidence in observables:** The customer quantifies the cost of inaction ("si no lo arreglamos, perdemos X al mes"); connects cause with consequence; expresses urgency that is clearly their own, not prompted. The triple gate (relevante + urgente + no resuelto) is the diagnostic.

### 2.5 P-025: Validación / empatía táctica (Validation / Tactical Empathy)

**Confidence: Alta**

Being understood reduces defensiveness and de-escalates resistance without requiring agreement. Validation deactivates defense; it is a distinct mechanism from sympathy (P-017).

> Voss (NSPD): tactical empathy, labeling, accusation audit; Rogers/Miller & Rollnick (MI): acceptance/empathy as precondition for change; Aviron et al. (psychotherapy meta-analysis, N=1,208): the reflective/non-directive posture improves outcomes for high-reactance patients, d=.79.

**Implication for MIA:** When the customer shows resistance — pushback, hesitation, "no me presiones" — the winning move is validation, not argument. Saying "entiendo tu preocupación, es importante que te sientas cómodo" (P-025) works better than countering with benefits. De-escalation is a prerequisite for any further progress.

**Evidence in observables:** The buyer says "exacto, eso es"; counter-argumentation decreases in intensity; cooperation resumes. The conversation shifts from `reticente` back to the prior state.

### 2.6 P-026: Percepción de control / autonomía (Perceived Control / Autonomy)

**Confidence: Fundamental**

Returning perceived control reduces reactance (Brehm) and increases decision appropriation. The buyer defends better what they decided themselves than what was imposed on them.

> Voss: "no" returns control; calibrated questions give the illusion of control; Brehm (reactance: restricted freedom generates opposition); Miller & Rollnick (autonomy support: the client owns the decision; change is durable only if voluntary); Steindl et al. (2015): freedom restoration, choice provision, and autonomy-supportive language reduce reactance; Aviron et al.: non-directive management improves outcomes in high reactance, d=.79.

**Implication for MIA:** Pushing removes control from the customer. The customer perceives the system as trying to make them do something, and their reactance activates (→ `reticente`). Accompanying returns control: "¿qué te parece si...?", "¿hay algo que te frene?", "¿cuál de estas opciones se acerca más a lo que necesitas?". The customer feels they are choosing, not being chosen for.

**Evidence in observables:** The buyer reformulates the conclusion in their own words ("that's right"); takes control of the next step; responds better to options than impositions.

### 2.7 The `reticente` State: Fundamental Evidence

**Confidence: Fundamental (survived 5 rounds of falsation)**

`reticente` is the state where pushing catastrophically fails. It is triggered by a universal sidecar rule: **perceived pressure > threshold → `reticente`**. The state is characterized by anger + counter-argumentation directed at the source of perceived pressure (operationalized in Rains 2013, λ=0.62 for anger, λ=0.52 for negative cognition).

> Brehm/Cialdini (reactance theory); Voss (NSPD); Miller & Rollnick (MI — "rolling with resistance"); meta-analyses: Rains 2013 (K=20, N=4,942), Li & Shi 2025 (33 studies, 146 effects), Steindl et al. (50-year review).

**The fundamental insight:** On `reticente`, the winning move is **never** to push harder. It is to de-escalate (P-025: validation) and return control (P-026: autonomy support). Pushing on `reticente` creates a **reactance spiral**: pressure → reactance → more pressure → more reactance → customer disengages or cancels.

**Implication for MIA:** The current pipeline has no `reticente` detection. If a customer says "no me gusta que me presionen" or shows escalating counter-argumentation, the system has no mechanism to de-escalate. It continues its linear flow, potentially triggering `frustrado` or `desenganchado`.

---

## 3. When to Push (Legitimate)

"Push" is not inherently wrong. It is **state-dependent**. There are specific conditions where facilitating commitment is the correct response — not because the seller wants to close, but because the customer is ready and the path should be cleared.

### 3.1 State = `transaccional` with High Confidence

**When:** The customer has resolved all risk, articulated value in their own words, and is ready to act. They need the path cleared, not more information.

**What to do:** Remove friction. Provide clear next steps. Confirm details. Do not add complexity, options, or new questions.

**Evidence requirements:**
- State confidence > 0.7 (high confidence in `transaccional`)
- Observable: price/pago/pasos finales questions (question type → `transaccional`, weight 0.7)
- Observable: explicit commitment language at DARN-CAT level A or T (Activation/Taking Steps)
- Observable: logistics signals (dirección, envío, entrega)

**Example:**
```
Customer: "Sí, quiero el plan anual. ¿Cómo lo pago?"
MIA: "Perfecto, te envío el link de pago. ¿Quieres que te lo mande ahora?"
```
→ The customer is ready. MIA clears the path. No additional selling needed.

### 3.2 State = `decidiendo` with High Confidence + Evidence of Investment (P-010)

**When:** The customer is in final deliberation and shows real investment — not verbal agreement, but actual commitment behavior (DARN-CAT A or T level).

**What to do:** Facilitate the commitment. Reduce the last frictions. Do not apply pressure; **support the customer's own momentum**.

**Evidence requirements:**
- State confidence > 0.7 in `decidiendo`
- Observable: investment signals — scheduled follow-up with date, introduction to third party, deposit, order commitment with specific actor + date
- Observable: "ya hablé con..." (past behavior — strongest evidence, P-010)
- Observable: the customer defends the solution in their own words (P-012/P-024)

**Example:**
```
Customer: "Ya hablé con mi socio y le parece bien. ¿Cuándo empezamos?"
MIA: "Genial. El primer paso es [X]. ¿Te parece que arranquemos esta semana?"
```
→ The customer has invested (talked to partner, expressed readiness). MIA facilitates.

### 3.3 Loop Termination: Customer Stuck in `confundido` > N Turns

**When:** The customer has been in `confundido` for too many turns — oscillating between options, expressing inability to decide, re-asking the same questions.

**What to do:** Reduce options. Recommend a default. Simplify the decision surface.

**Evidence requirements:**
- State = `confundido` for > N consecutive turns (N configurable, suggested: 3-4)
- Observable: enumeration of growing options, re-opening discarded options (P-022: choice overload)
- Observable: "no puedo decidir", "todas parecen iguales"
- Observable: "¿cuál me recomiendas?" (request for curation — C-015)

**Example:**
```
Customer: "No sé cuál elegir, hay muchas opciones..."
MIA: "Entiendo, puede ser confuso. Basándome en lo que me contaste, el [Plan X] sería el mejor para tu caso porque [razón específica]. ¿Te parece si arrancamos con ese?"
```
→ MIA reduces the decision surface, offers a default with justification. This is Schwartz's antidoto (C-014): limiting options compensates for choice overload.

**Critical boundary:** This is NOT the same as pushing. The recommendation is grounded in what the customer has already told MIA about their needs. It is curation, not pressure.

### 3.4 Time Pressure: Legitimate Urgency (P-013, Verified Scarcity, C-010)

**When:** There is genuine, verifiable time pressure — not fabricated scarcity.

**What to do:** Communicate the real constraint clearly. Do not fabricate urgency.

**Evidence requirements:**
- The urgency must be **verifiable** (C-010: falsation boundary)
- The scarcity must be **non-substitutable** (Barton 2022: scarcity of a category with substitutes fails, δ=0.161)
- Source must be truth: "esta promo termina el viernes" (verifiable) vs. "¡última oportunidad!" (fabricated)

**Example:**
```
MIA: "La promo que te mencioné tiene precio especial hasta el viernes. Después vuelve al precio normal. ¿Quieres que te lo reserve?"
```
→ Real deadline, verifiable, communicated once, not repeated as pressure.

**Anti-pattern:**
```
MIA: "¡No te lo pierdas! ¡Última oportunidad! ¡Quedan solo 2!"
```
→ Fabricated urgency. If detected as false, triggers `reticente` (C-010).

---

## 4. When to Accompany (Default)

Accompanying is the **default strategy** for all states except the specific push conditions above. The response must match the customer's current cognitive state.

### 4.1 State = `explorando`

**Customer state:** No recognized problem. Attention is diffuse. Browsing or chatting without commitment.

**MIA strategy:** Build rapport. Discover latent needs. **Do not sell.**

**What to do:**
- Engage in light conversation
- Ask open-ended questions about their situation
- Surf for latent problems (P-007: the problem is not yet conscious)
- Be helpful, not transactional

**What NOT to do:**
- Present products
- Mention prices
- Push toward any commitment
- Pitch benefits (P-011: this contaminates truth)

**Observable signals:** Casual greetings, general questions, no problem statements, browsing behavior.

### 4.2 State = `descubriendo`

**Customer state:** Recognizes the problem. "This happens to me and it's not good." Has crossed from unconsciousness to problem awareness.

**MIA strategy:** Explore the problem. Validate the pain. **Do not pitch the solution yet.**

**What to do:**
- Ask about specific instances ("¿cuándo fue la última vez que...?")
- Validate the problem ("suena frustrante")
- Deepen understanding of the problem's scope
- Explore the customer's current workaround

**What NOT to do:**
- Present products (P-011: premature)
- Jump to solution before the problem is fully articulated
- Say "tenemos la solución para eso" before the customer has finished describing

**Observable signals:** Problem declarations, episodic memories, frustration with current situation, "esto me pasa".

### 4.3 State = `consecuente`

**Customer state:** Conscious of the consequence. Feels the cost. "This is costing me X." The motivational event has occurred (P-013).

**MIA strategy:** Quantify impact. Explore urgency. Let the customer articulate the cost.

**What to do:**
- Ask about cost of inaction ("¿cuánto te está costando no resolver esto?")
- Explore urgency ("¿cuán urgente es para ti?")
- Validate the motivation ("tiene sentido que quieras resolverlo")
- Let the customer defend the solution in their own words (P-012)

**What NOT to do:**
- Skip to price presentation
- Present solution before urgency is established
- Fabricate urgency (the customer already has real urgency)

**Observable signals:** Cost quantification, "esto nos cuesta X al mes", urgency expressions, the customer defends the solution (change talk at N level on DARN-CAT).

### 4.4 State = `comprendiendo`

**Customer state:** Knows solutions exist. Learning the landscape. "How does this get solved?"

**MIA strategy:** Present the solution landscape. Teach. Be the Challenger (C-004).

**What to do:**
- Explain available approaches (not just MIA's products)
- Educate about the category
- Structure information clearly
- Let the customer ask follow-up questions

**What NOT to do:**
- Compare specific products yet (premature)
- Push toward a specific option
- Present too many options (P-022: risk of `confundido`)

**Observable signals:** Questions about solutions, "¿cómo se resuelve?", requests for explanation, learning behavior.

### 4.5 State = `comparando`

**Customer state:** Evaluating alternatives against their own criteria. Attention becomes discriminating.

**MIA strategy:** Help compare. Limit options. Structure the evaluation.

**What to do:**
- Compare based on the customer's stated criteria
- Present pros/cons honestly
- Limit the number of options presented (C-014: Schwartz's antidote)
- Use social proof appropriately (P-015: descriptive norm — what similar customers chose)

**What NOT to do:**
- Push a single product without the customer's criteria
- Expand options beyond what's needed
- Dismiss the comparison ("just go with ours")

**Observable signals:** Comparison questions, "¿cuál es mejor para X?", mention of competitors, criteria articulation.

### 4.6 State = `evaluando_riesgo`

**Customer state:** Reducing perceived risk (monetary, functional, physical, social, psychological). This state is **recursive** — it can appear at any point.

**MIA strategy:** Address specific risks. Provide guarantees, cases, authority, risk-reversal.

**What to do:**
- Ask what specifically concerns them
- Address the specific risk type (monetary → pricing flexibility; functional → performance evidence; social → testimonials; psychological → guarantees)
- Provide verifiable evidence (not just claims)
- Use calibrated questions (Voss: "¿cómo se supone que haga eso?")

**What NOT to do:**
- Dismiss concerns ("no te preocupes, funciona bien")
- Apply pressure when risk is unresolved
- Move to close before risk is addressed

**Observable signals:** Risk-related questions, "¿y si no funciona?", "¿tienen garantía?", "ya tengo otra opción" (competitor mention = risk evaluation), objection language.

### 4.7 State = `confundido`

**Customer state:** Information overload. Indecision. Searching without conclusion.

**MIA strategy:** Simplify. Reorient. One thing at a time.

**What to do:**
- Reduce the decision surface to 1-2 options
- Recommend a default (with justification based on their stated needs)
- Ask "what matters most to you?" to re-anchor
- Slow down the pace

**What NOT to do:**
- Add more options
- Present complex comparisons
- Push toward any specific option without grounding
- Escalate urgency (this is the wrong state for it)

**Observable signals:** Repetitive questions, "no puedo decidir", re-opening discarded options, contradictions, "no entiendo".

### 4.8 State = `reticente`

**Customer state:** Reactance — anger + counter-argumentation directed at the source of perceived pressure. **This is the most dangerous state for pushing.**

**MIA strategy:** De-escalate first. Restore control. **Never sell on `reticente`.**

**What to do:**
- Validate the feeling ("entiendo que no te gusta la presión, es importante")
- Return control ("¿qué te gustaría hacer?", "¿quieres que dejemos esto aquí?")
- Reduce pressure immediately
- Wait for de-escalation before any further action

**What NOT to do:**
- Argue
- Apply more pressure
- Continue the sales flow
- Offer discounts as rescue (the problem is pressure, not price)
- Say "pero es que..." or "solo te estoy informando"

**Observable signals:** "no me presiones", escalating counter-argumentation, anger directed at MIA's approach, irritability with influence attempts, explicit request for autonomy.

**Recovery path:** `reticente` → P-025 (validation) → P-026 (control restoration) → return to previous state. The conversation can resume normally once de-escalation succeeds.

---

## 5. The MIA Decision Framework

The strategic decision — push vs. accompany — should follow a deterministic framework embedded in MIA's prompt architecture. The framework is hierarchical: some conditions override others.

```
┌─────────────────────────────────────────────────────────────────┐
│                    MIA STRATEGIC DECISION                        │
│                                                                 │
│  IF state = reticente OR state = frustrado:                     │
│     → DE-ESCALATE (recovery first, never sell)                  │
│     → P-025 (validation) + P-026 (control)                     │
│     → Stop. Wait for de-escalation.                             │
│                                                                 │
│  ELIF state = confundido AND dwell > threshold:                 │
│     → SIMPLIFY (reduce options, recommend default)              │
│     → One clear path, not multiple options                      │
│                                                                 │
│  ELIF state.confidence > 0.7 AND                               │
│       state IN [transaccional]:                                │
│     → FACILITATE (clear path to commitment)                     │
│     → Remove friction, provide next steps                       │
│                                                                 │
│  ELIF state.confidence > 0.7 AND                               │
│       state = decidiendo AND                                   │
│       evidence_of_investment(P-010):                           │
│     → FACILITATE (support the customer's momentum)             │
│     → Do not apply pressure; support their own pace            │
│                                                                 │
│  ELSE:                                                         │
│     → ACCOMPANY (match response to current state)              │
│     → See Section 4 for state-specific behaviors               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.1 Decision Variables

| Variable | Source | Notes |
|----------|--------|-------|
| `state` | UBSE state estimation (Bayesian belief update) | Most likely state from probability distribution |
| `state.confidence` | Posterior probability of dominant state + entropy | High confidence = low entropy; ambiguous = high entropy |
| `dwell` | Turns spent in current state | Loop detection (Section 8) |
| `evidence_of_investment` | Observable extraction (DARN-CAT A/T level) | Real commitment, not verbal agreement |
| `pressure_level` | Accumulated MIA-initiated closing attempts | If high → bias toward de-escalation |

### 5.2 Priority Rules

1. **De-escalation overrides everything.** If `reticente` or `frustrado`, stop selling immediately. No exceptions.
2. **Simplification overrides facilitation.** If `confundido` for too long, reduce options before attempting to facilitate.
3. **Facilitation requires high confidence.** Do not facilitate commitment unless confidence > 0.7 AND the customer has shown investment behavior.
4. **Accompany is the default.** If none of the above conditions are met, match the response to the current state.

---

## 6. Measuring Success

### 6.1 The Wrong Question

> "Did we close?"

This is the metric of a push system. It measures the system's ability to extract commitment, not the customer's ability to make a good decision. A system optimized for "did we close?" will:

- Push when it shouldn't (triggering `reticente`)
- Ignore the customer's actual state
- Generate false commitment signals (P-009)
- Produce post-decision dissonance (P-005) and cancellations
- Destroy long-term value for short-term conversion

### 6.2 The Right Question

> "Did the customer make a good decision?"

This is the metric of an accompany system. It measures whether MIA helped the customer understand their problem, evaluate their options, resolve their risks, and commit — or not — on their own terms.

### 6.3 Metrics

| Category | Metric | What it Measures |
|----------|--------|-----------------|
| **Conversation Quality** | Average turns per decision journey | Efficiency of the accompany process |
| **Conversation Quality** | Evidence density per turn | Quality of information exchange |
| **Conversation Quality** | State progression rate | % of conversations advancing ≥1 state |
| **Customer Satisfaction** | Post-conversation rating | Customer's experience of the process |
| **Customer Satisfaction** | Would-recommend score | NPS proxy for advocacy |
| **Long-Term Value** | Retention rate (30/60/90 days) | Durability of the decision |
| **Long-Term Value** | Referral rate | Advocacy (P-005: resolved dissonance → `abogando`) |
| **Decision Quality** | Cancellation rate | Post-decision regret (P-005 unresolved) |
| **Decision Quality** | Return rate | Decision mismatch |

### 6.4 Anti-Metrics

These metrics indicate the system is pushing when it shouldn't:

| Anti-Metric | What It Means | Root Cause |
|-------------|--------------|------------|
| `reticente` escalation count | Customer felt pressured | Push on wrong state |
| Loop count (same state > N turns) | Customer stuck, system not adapting | Accompany failed or absent |
| Forced close → cancellation | Commitment was false (P-009) | Push generated false signal |
| "déjame pensarlo" → no return | Zombie outcome, no real engagement | Push before readiness |
| Discount offer acceptance → cancellation | Price was not the real issue | Push on wrong objection |

---

## 7. Implementation in MIA

### 7.1 Architecture Integration

The decision framework maps directly to MIA's proposed evidence-accumulation architecture (see `MIA_EVIDENCE_REASONING_RESEARCH.md` §5):

```
Message Ingestion
    ↓
Observable Extraction (LLM call — same as current, different output)
    ↓
Evidence Accumulation (deterministic — Bayesian update per turn)
    ↓
State Estimation (most likely state + confidence)
    ↓
┌─────────────────────────────────────────┐
│ STRATEGIC DECISION (Section 5 framework)│
│ IF reticente/frustrado → DE-ESCALATE    │
│ ELIF confundido+dwelling → SIMPLIFY     │
│ ELIF transaccional+high_conf → FACILITATE│
│ ELIF decidiendo+invested → FACILITATE   │
│ ELSE → ACCOMPANY                        │
└─────────────────────────────────────────┘
    ↓
Action Selection (state-appropriate response)
    ↓
Prompt Construction (includes state context)
    ↓
Response Generation
```

### 7.2 State Context in Prompts

The prompt builder (`src/lib/ai/prompts.ts`) must include state context. The system prompt should contain:

```
The customer is in state: [state].
Your role is: [strategy].
Current confidence: [confidence].
Dwell in current state: [N] turns.

[If state = reticente]: 
DO NOT sell. The customer feels pressured. Validate their feeling. 
Return control. Example: "Entiendo, no quiero presionarte. ¿Qué te gustaría hacer?"

[If state = explorando]:
DO NOT present products. Build rapport. Ask about their situation.
Example: "¿En qué te puedo ayudar?"

[If state = transaccional AND confidence > 0.7]:
The customer is ready. Clear the path. Provide next steps.
Example: "Perfecto, el siguiente paso es [X]. ¿Te parece si arrancamos?"

[If state = confundido AND dwell > 3]:
The customer is overwhelmed. Simplify. Recommend one option.
Example: "Basándome en lo que me contaste, te recomendaría [X]. ¿Qué te parece?"
```

### 7.3 `reticente` Detection and Strategy Change

The most critical implementation point is `reticente` detection. The current system has no mechanism for this. The detection must be **real-time** (per turn), not post-hoc.

**Detection signals:**
- Explicit resistance language: "no me presiones", "no me gusta que me presionen"
- Escalating counter-argumentation (observable: negative cognition intensity increasing)
- Anger directed at MIA's approach (observable: irritability with influence attempts)
- Sustain talk increasing (MI: reasons for status quo growing)

**Strategy change on detection:**
1. **Immediate:** Stop all sales-oriented actions
2. **De-escalate:** Validate with P-025 ("entiendo tu preocupación")
3. **Return control:** P-026 ("¿qué te gustaría hacer?")
4. **Wait:** Do not re-initiate selling until de-escalation is confirmed
5. **Resume:** Return to the state the customer was in BEFORE `reticente` was triggered

### 7.4 Integration with Existing Sales Pipeline

The existing pipeline (`src/lib/sales/process.ts`, `src/lib/sales/detect.ts`) operates post-hoc: it classifies sale outcomes after the conversation. The strategic framework changes this to **proactive state-guided behavior**:

| Current (Reactive) | Proposed (Proactive) |
|---------------------|----------------------|
| `hasSalesTrigger` keyword detection | Observable extraction per turn |
| `detectSaleOutcome` post-hoc classification | Real-time state estimation |
| Linear pipeline: detect → process → close | State-guided: estimate → decide strategy → act |
| Always attempts to close | Close only when appropriate |
| No `reticente` handling | Immediate de-escalation |

The existing `detect.ts` AI-based outcome classification (lines 72-172) can be repurposed or augmented with the observable extraction model. The `hasSalesTrigger` keyword detection (lines 47-70) should be supplemented with state-aware logic that considers context, not just keywords.

---

## 8. Loop Termination

### 8.1 The Problem

Without loop detection, a customer can cycle between states indefinitely — comparing → evaluating risk → comparing → evaluating risk — without MIA noticing or acting. The customer is stuck; MIA keeps responding as if progress is being made.

### 8.2 Termination Rules

| Condition | Trigger | Action |
|-----------|---------|--------|
| `confundido` > N turns (suggested: 3-4) | Same state, high entropy | Recommend default, reduce options (Section 3.3) |
| `comparando` > M turns (suggested: 4-5) | Oscillation between options | Summarize trade-offs, ask for decision criteria |
| `evaluando_riesgo` > K turns (suggested: 3) | Recurring same risk | Address the risk directly, ask what would resolve it |
| Any state, no state change > L turns (suggested: 5-6) | Stagnation | De-escalate: "Parece que hay algo que te frena. ¿Qué es?" |
| Pressure level high + no progress | MIA initiated > P closing attempts | Stop all sales actions, switch to accompany |

### 8.3 The Right Intervention

Loop termination is **not** pushing. It is a form of **accompanying that recognizes stagnation**. The intervention should:

1. Acknowledge the situation honestly ("parece que estamos girando en círculos")
2. Simplify the decision surface
3. Offer a clear recommendation grounded in what the customer has told MIA
4. Give the customer an exit if they want one ("¿prefieres que dejemos esto aquí por ahora?")

---

## 9. Summary: The Accompany-First Architecture

| Dimension | Push Architecture | Accompany Architecture (MIA) |
|-----------|-------------------|------------------------------|
| **Goal** | Maximize conversion probability | Help customer make good decision |
| **Default action** | Present → sell → close | Listen → understand → match |
| **State awareness** | None (flat pipeline) | 15 cognitive states with transitions |
| **Evidence** | Per-turn keyword triggers | Cross-turn Bayesian accumulation |
| **Closing** | Always attempted | Only when state-appropriate |
| **`reticente` handling** | None (continues pushing) | Immediate de-escalation |
| **Success metric** | "Did we close?" | "Did the customer decide well?" |
| **Long-term outcome** | Cancellations, low satisfaction | Retention, advocacy, referrals |

The evidence is clear: accompanying the customer is not just more ethical — it is more effective. Pushing generates false signals (P-009), contaminates truth (P-011), triggers reactance (`reticente`), and produces decisions that collapse post-purchase (P-005). Accompanying produces self-generated value (P-012), internal motivation (P-013), durable decisions, and customer advocacy (P-005 → `abogando`).

MIA's competitive advantage is not that it sells faster. It is that it helps customers decide better — and that, over time, produces a more sustainable and profitable sales operation.

---

## Appendix A: State-Strategy Quick Reference

| State | Strategy | Key Actions | Avoid |
|-------|----------|-------------|-------|
| `explorando` | ACCOMPANY | Build rapport, discover needs | Present products, push close |
| `descubriendo` | ACCOMPANY | Explore problem, validate pain | Pitch solution |
| `consecuente` | ACCOMPANY | Quantify impact, explore urgency | Skip to price |
| `comprendiendo` | ACCOMPANY | Present solution landscape | Compare products prematurely |
| `comparando` | ACCOMPANY | Help compare, limit options | Push single product |
| `evaluando_riesgo` | ACCOMPANY | Address specific risks | Dismiss concerns |
| `decidiendo` | ACCOMPANY/FACILITATE | Facilitate choice (if invested) | Apply pressure |
| `transaccional` | FACILITATE | Clear path to purchase | Add complexity |
| `confundido` | SIMPLIFY | Reduce options, recommend default | Add options |
| `frustrado` | DE-ESCALATE | Recover, validate, solve | Sell |
| `reticente` | DE-ESCALATE | Restore control, validate | Insist, argue, sell |

## Appendix B: Principle References

| Principle | Confidence | Key Insight for Accompany vs Push |
|-----------|------------|-----------------------------------|
| P-009 Brecha intención-comportamiento | Fundamental | Push creates false commitment signals |
| P-011 Contaminación por promoción | Alta | Premature pitching destroys evidence quality |
| P-012 Auto-persuasión | Convergente | Self-generated value > seller-declared value |
| P-013 Conciencia de consecuencia | Fundamental | Internal urgency > induced urgency |
| P-025 Validación/empatía | Alta | De-escalation works better than pressure |
| P-026 Percepción de control | Fundamental | Autonomy support > persuasion pressure |
| `reticente` state | Fundamental | Pressure → reactance → resistance (universal) |
