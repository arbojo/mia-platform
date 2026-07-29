# ADR-009: Health Risk Evaluator

## Status

Proposed

## Date

2026-07-29

## Council

CTO, Architect, AI Engineer, Domain Expert, Product Manager, Security Engineer

---

## 1. Context

### 1.1 The Problem Behind the Problem

ADR-004 defined a **three-tier Health Communication Policy** (Prohibited/Guarded/Free) with redirect patterns and a Commercial Continuity Principle. This solved the *what* — what MIA should and shouldn't say about health.

But observed behavior from Laboratorio simulations reveals a deeper issue: even with correct policy, MIA's **reasoning order** kills conversion.

**Observed pattern:**

```
Customer question (commercial intent, health context)
  ↓
MIA detects health-related keyword
  ↓
MIA prioritizes risk assessment over question answering
  ↓
MIA leads with disclaimer/warning
  ↓
Customer reads warning as "this product is not for me"
  ↓
Conversation ends
```

Example:

> Cliente: *"Tengo diabetes, ¿puedo usar Clean Nails?"*
>
> MIA (actual): *"Es importante consultar con un profesional de la salud..."*
>
> Cliente interpreta: *"Mejor no lo compres."*

El problema no es la información. Es que la **advertencia** se convirtió en el mensaje principal cuando debería ser **contexto**.

### 1.2 Root Cause

The current architecture has a single-step response generation:

```
User Message → Context Assembly → Prompt Building → LLM → Response
```

The prompt contains both commercial rules and health policies in the same flat structure. When the LLM sees a health keyword, it weights the safety instruction higher than the commercial objective because:

1. Safety instructions are phrased as prohibitions (higher priority weighting in LLM attention)
2. The commercial continuity instruction is a suggestion, not a structure
3. There's no pre-classification step that tells the LLM *which type of response* this is

### 1.3 Current Architecture

| Component | Role | Health Awareness |
|-----------|------|-----------------|
| `src/lib/ai/knowledge.ts` | Builds context from DB | None — passes all data equally |
| `src/lib/ai/prompts.ts` | Assembles system prompt | Has safety instructions in flat list |
| `processStreaming()` | Orchestrates streaming | No pre-processing or classification |
| `src/app/api/chat/route.ts` | Receives request, calls processStreaming | No health pre-classification |

The gap: **there is no reasoning layer between understanding the question and generating the response.**

---

## 2. Proposal

### 2.1 Health Risk Evaluator — Architectural Overview

Add a new pre-processing layer that **classifies** the conversation context before prompt assembly:

```
User Message
  ↓
Context Assembly (existing)
  ↓
Health Risk Evaluator (NEW)
  ├── Classifies intent: commercial | medical | unclear
  ├── Classifies risk: none | antecedent | active | escalation
  └── Outputs: risk level + reasoning guidance
  ↓
Prompt Builder (modified)
  └── Injects health context section based on evaluator output
  ↓
LLM → Response
```

The Evaluator is **not** a replacement for the main LLM call. It is a fast, lightweight classifier that answers four questions:

1. **¿La intención del cliente es comercial o médica?**
2. **¿Existe un riesgo real o solo un antecedente?**
3. **¿La advertencia es indispensable o solamente contextual?**
4. **¿Cómo mantener la conversación abierta?**

### 2.2 Two-Level Classification

#### Level 1: Intent Classification

| Intent | Description | Example |
|--------|-------------|---------|
| `commercial` | Customer wants to buy, evaluate, or learn about a product; health context is secondary | "Tengo diabetes, ¿puedo usar Clean Nails?" |
| `medical` | Customer is describing symptoms, seeking diagnosis, or asking for medical advice | "Tengo una herida que no sana, ¿qué me recomienda?" |
| `unclear` | Cannot be determined confidently | Mixed or ambiguous query |

#### Level 2: Risk Classification

| Risk | Description | Example | Response Approach |
|------|-------------|---------|-------------------|
| `none` | No health risk present | "¿Este producto es antibacterial?" | Free commercial response |
| `antecedent` | Customer mentions a condition but is asking commercially | "Tengo diabetes, ¿puedo usarlo?" | Answer first, context second |
| `active` | Customer describes active symptoms or side effects | "Me está saliendo pus en el dedo" | Acknowledge, recommend care, soft redirect |
| `escalation` | Clear medical emergency or specific medical instruction | "Mi médico me dijo que no use este tipo de productos" | Respect medical instruction, no sales push |

### 2.3 Output Structure

```typescript
interface HealthRiskEvaluation {
  intent: 'commercial' | 'medical' | 'unclear'
  risk: 'none' | 'antecedent' | 'active' | 'escalation'
  has_health_context: boolean
  guidance: string  // brief instruction for response construction
  keep_conversation_open: boolean
}
```

Example outputs:

**Input**: "Tengo diabetes, ¿puedo usar Clean Nails?"
```json
{
  "intent": "commercial",
  "risk": "antecedent",
  "has_health_context": true,
  "guidance": "Answer product question first, then add precaution as context. Keep selling.",
  "keep_conversation_open": true
}
```

**Input**: "Tengo una herida abierta en el pie"
```json
{
  "intent": "medical",
  "risk": "active",
  "has_health_context": true,
  "guidance": "Acknowledge concern, recommend medical care, soft redirect to relevant products.",
  "keep_conversation_open": true
}
```

**Input**: "Mi doctor me dijo que no use limas eléctricas"
```json
{
  "intent": "commercial",
  "risk": "escalation",
  "has_health_context": true,
  "guidance": "Respect medical instruction. Do not sell. Offer alternative information only.",
  "keep_conversation_open": false
}
```

### 2.4 Implementation: Two Approaches

#### Approach A: Lightweight Classifier (Recommended)

Use a **separate, minimal OpenAI call** with `gpt-4o-mini` (same model) using a tiny prompt:

```
Classify the following customer message for a sales assistant.
Output ONLY valid JSON with these fields:
- intent: "commercial" | "medical" | "unclear"
- risk: "none" | "antecedent" | "active" | "escalation"
- has_health_context: true | false
- guidance: brief one-sentence instruction
- keep_conversation_open: true | false

Message: {customer_message}

Product: {product_name}

JSON:
```

**Cost**: ~50-100 tokens per call. At `gpt-4o-mini` pricing ($0.15/1M input, $0.60/1M output), this is ~$0.00005 per evaluation — negligible.

**Latency**: ~200-400ms added to response time. The main LLM call takes 2-8s, so this is ~5-10% overhead.

**Why this approach**: Simple to implement, iterate, and tune. No external dependencies. Uses existing infrastructure.

#### Approach B: Rules-Based Classifier

Use keyword/pattern matching to classify without any LLM call.

**Pros**: Zero latency, zero cost, deterministic.
**Cons**: Brittle, hard to maintain, misses nuance ("tengo diabetes" vs "tengo una herida" require semantic understanding).

**Recommendation**: Start with Approach A. If latency becomes a concern, cache evaluations for identical messages within a session, or pre-compute classifications for known product-query pairs.

---

## 3. Integration Points

### 3.1 New File: `src/lib/ai/health-evaluator.ts`

```typescript
export async function evaluateHealthContext(params: {
  message: string
  productContext?: string
  conversationHistory?: { role: string; content: string }[]
}): Promise<HealthRiskEvaluation>
```

### 3.2 Modified File: `src/lib/ai/prompts.ts`

The `buildMasterPrompt` function gains an optional `healthEvaluation` parameter:

```typescript
export function buildMasterPrompt(params: {
  // ... existing params ...
  healthEvaluation?: HealthRiskEvaluation
}): string
```

When `healthEvaluation` is present, inject a section at the top of the prompt:

```
## Evaluación de Contexto de Salud

Este mensaje ha sido clasificado como:
- Intención: {intent}
- Riesgo: {risk}
- Guía: {guidance}

{guidance-specific instructions based on risk level}
```

### 3.3 Modified File: `src/lib/runtime/runtime.ts` (or equivalent streaming orchestrator)

In `processStreaming()`:

```typescript
// After context assembly, before prompt building:
const healthEval = await evaluateHealthContext({
  message: lastUserMessage,
  productContext: productNames?.join(', '),
  conversationHistory: messages,
})

// Pass to prompt builder
const prompt = buildMasterPrompt({
  ...params,
  healthEvaluation: healthEval,
})
```

### 3.4 Classification Rules by Risk Level

The prompt injection varies by risk level:

#### Risk: `none`
No injection needed. Standard commercial prompt.

#### Risk: `antecedent`
Inject after the main prompt, before "Instrucción Final":

```
## Contexto de Salud (Antecedente)

El cliente mencionó una condición de salud ({condition}) pero su intención es
comercial. Sigue estas reglas:

1. RESPUESTA PRIMERO: Responde la pregunta comercial principal antes de
   mencionar cualquier precaución.
2. CONTEXTO DESPUÉS: Si es relevante, añade la precaución como información
   complementaria, no como mensaje principal.
3. NUNCA digas: "Consulte a su médico" como respuesta principal.
4. NUNCA digas: "No puedo ayudarte" o "Mejor no lo compres".
5. SIEMPRE termina con una pregunta que continúe la conversación.
```

#### Risk: `active`
```
## Contexto de Salud (Síntomas Activos)

El cliente describió síntomas activos. Sigue estas reglas:

1. RECONOCE: Reconoce su preocupación con empatía.
2. RECOMIENDA: Sugiere consultar a un profesional de la salud si corresponde.
3. REDIRIGE: Ofrece información sobre productos como parte de un enfoque
   integral, no como tratamiento.
4. NO MINIMICES: No digas "no es nada grave" ni "no te preocupes".
5. NO VENDAS: No presiones para comprar. Ofrece información, no una solución.
```

#### Risk: `escalation`
```
## Contexto de Salud (Indicación Médica Específica)

El cliente tiene una indicación médica específica. Sigue estas reglas:

1. RESPETA: Reconoce y respeta la indicación médica.
2. NO VENDAS: No intentes vender el producto si contradice la indicación.
3. OFRECE: Si existe una alternativa que no contradiga la indicación,
   menciónala. Si no, acéptalo con empatía.
4. CIERRE SUAVE: Termina la conversación sin presión.
```

---

## 4. Relationship to ADR-004

ADR-004 defines the **Health Communication Policy** — what MIA should and shouldn't say.

ADR-009 defines the **Health Risk Evaluator** — how MIA should decide *what kind of response* to generate.

They are complementary layers:

| ADR | Layer | Role |
|-----|-------|------|
| ADR-004 | Policy | Defines 3 tiers of health statements |
| ADR-009 | Reasoning | Classifies context before response generation |
| Both | Prompt | Policy + Evaluation → assembled prompt |

**Key distinction**: ADR-004's policy lives in the prompt as instructions. ADR-009's evaluator lives in the orchestration layer as a pre-processing step. ADR-009 solves the *reasoning order* problem that ADR-004's prompt-only approach cannot fully address.

---

## 5. Impact Analysis

### 5.1 Positive Impacts

| Area | Impact |
|------|--------|
| **Conversion** | Health-context commercial questions no longer trigger defensive responses first |
| **Safety** | Risk levels ensure escalation cases still get proper medical advice |
| **Predictability** | Classifier output guides the LLM explicitly, reducing response variance |
| **Auditability** | Every health-adjacent conversation has a classification record |
| **Iterability** | Classification rules can be tuned independently of prompt content |

### 5.2 Negative Impacts

| Area | Impact |
|------|--------|
| **Latency** | +200-400ms per health-classified message (Approach A) |
| **Token cost** | ~50-100 additional tokens per evaluation (Approach A) |
| **Code footprint** | New file + modifications to prompts.ts and runtime orchestrator |
| **Cold start edge cases** | Classifier may misclassify unusual queries; requires monitoring |

### 5.3 Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Classifier false negative (classifies risk as none when it's active) | Low | Conservative default: if uncertain, classify as `antecedent` |
| Classifier adds latency for non-health messages | Medium | Skip evaluator entirely if no health keywords detected (pre-filter) |
| Prompt injection grows too large | Low | Evaluation section is ~5-15 lines, conditional on `has_health_context` |

### 5.4 Monitoring

Add tracking for:

1. **Classification distribution** — % of messages per intent/risk level
2. **Misclassification rate** — via learning events (customer corrections)
3. **Latency overhead** — evaluator time vs total response time
4. **Conversion impact** — compare conversation completion rates with/without evaluator

---

## 6. Open Questions

1. **Should the evaluator run on EVERY message or only when health keywords are detected?**
   - Recommendation: pre-filter with a lightweight keyword check to skip 90%+ of messages

2. **Should the evaluator consider conversation history or just the latest message?**
   - Recommendation: start with single-message, add history context if misclassification rate >5%

3. **Should the evaluator output be cached for identical messages within a session?**
   - Recommendation: yes, use a simple LRU cache keyed by `sessionId + lastMessage`

4. **How do we handle multi-turn where context evolves (antecedent → active)?**
   - Recommendation: re-evaluate on every turn; the evaluator is lightweight enough

---

## 7. Implementation Plan

### Phase 1: Evaluator Core
1. Create `src/lib/ai/health-evaluator.ts` with classifier function
2. Implement Approach A (lightweight OpenAI call)
3. Implement pre-filter (skip if no health keywords)
4. Add HealthRiskEvaluation type

### Phase 2: Integration
1. Modify `processStreaming()` to call evaluator before prompt building
2. Add `healthEvaluation` parameter to `buildMasterPrompt()`
3. Add health context injection sections for each risk level
4. Wire through the chat API route

### Phase 3: Testing
1. Test with Laboratorio simulation scenarios (diabetes, herida, indicación médica)
2. Verify commercial intent messages maintain conversion flow
3. Verify active risk messages still escalate appropriately
4. Measure latency impact

### Phase 4: Observability
1. Add classification logging
2. Track misclassification via learning events
3. Monitor conversion rates

---

## 8. Council Notes

- **CTO**: The evaluator approach is the correct architectural separation. A single prompt cannot solve the ordering problem because LLMs weight safety instructions higher by nature. Adding a pre-classification layer gives us control over response structure without fighting the model's safety bias.

- **AI Engineer**: The 50-100 token evaluator call is negligible. The real cost is in the prompt injection for health-classified messages (~100-200 tokens). Total impact: ~$0.0002 per health-adjacent message. At 10,000 such messages/month: ~$2.00.

- **Domain Expert**: The two-level classification (intent + risk) maps correctly to real sales behavior. A good salesperson does this instinctively — "is this customer asking to buy or asking for help?" The evaluator codifies this instinct.

- **Product Manager**: This directly addresses the observed conversion problem. The pre-filter ensures zero impact on non-health messages. The recommendation to start simple (single-message, Approach A) and iterate is correct.

- **Security Engineer**: The evaluator does not weaken safety. Escalation-level risks still trigger appropriate medical guidance. The evaluator changes the *order* of information, not the *presence* of safety guardrails.

---

## 9. Next Steps

1. Review and approve ADR-009
2. Implement Phase 1 (Evaluator Core) — `health-evaluator.ts`
3. Test with ADR-004's adversarial test scenarios
4. Implement Phase 2 (Integration) — wire into runtime
5. Validate with real Vitanova wellness product queries in Laboratorio
