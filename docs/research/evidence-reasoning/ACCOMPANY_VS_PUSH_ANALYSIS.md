# Accompany vs Push Analysis

**Status**: COMPLETE
**Date**: 2026-08-25
**Parent**: MIA_EVIDENCE_REASONING_RESEARCH.md

---

## 1. The Problem

MIA's current architecture creates a systematic tendency to **push toward purchase** instead of **accompanying the customer through their decision process**.

### 1.1 Why Push Happens

| Root Cause | Mechanism | Location |
|-----------|-----------|----------|
| **Objective is "sell naturally"** | The prompt says the goal is to help customers find what they need and sell naturally | `prompts.ts:260-261` |
| **Personality-driven closing** | `sales_aggressiveness` determines closing style, not customer state | `prompts.ts:311-312` |
| **No state awareness** | MIA doesn't know if the customer is ready, so it assumes they might be | No state injection |
| **No push detection** | Nothing prevents MIA from closing on every turn | No guardrails |
| **Post-response detection** | Sale detection happens AFTER the response, so MIA can't adjust based on detected events | `process.ts:253-439` |

### 1.2 Push Behavior Examples

**Example 1: Premature Close**
```
Customer: "¿Cuánto cuesta?"
MIA: "El producto cuesta $500. ¿Te lo envío a tu dirección?"
```
Problem: Customer asked about price, MIA immediately pushed for purchase.

**Example 2: Aggressive Follow-up**
```
Customer: "Todavía no sé..."
MIA: "¡No te preocupes! El producto es excelente y tenemos envío gratis. ¿Te lo aparto?"
```
Problem: Customer expressed uncertainty, MIA doubled down on closing.

**Example 3: Ignoring Objections**
```
Customer: "Es muy caro para mí"
MIA: "Entiendo, pero es una inversión que vale la pena. ¿Te gustaría que te cuente sobre las opciones de pago?"
```
Problem: Customer raised a price objection, MIA redirected to payment instead of exploring the objection.

---

## 2. What ACCOMPANY Looks Like

### 2.1 Principles

1. **Answer first, then assess**: Always answer the customer's question before deciding next action
2. **State before action**: Check customer state before choosing what to do next
3. **Evidence before assumption**: Don't assume the customer is ready — require evidence
4. **Patience over pressure**: It's better to lose a sale than to damage trust
5. **Uncertainty is okay**: Not knowing the customer's state is a valid reason to gather information

### 2.2 Accompany Behavior Examples

**Example 1: Price Question (Accompany)**
```
Customer: "¿Cuánto cuesta?"
MIA: "El producto cuesta $500."
[State assessment: interest=0.6, trust=0.5, readiness=0.3]
→ Readiness is low. Don't push for purchase.
MIA: "¿Tienes alguna pregunta sobre lo que incluye?"
```

**Example 2: Uncertainty (Accompany)**
```
Customer: "Todavía no sé..."
MIA: "Sin problema, tómate tu tiempo."
[State assessment: interest=0.5, trust=0.5, readiness=0.3]
→ Customer is uncertain. Don't push.
MIA: "¿Hay algo específico que te gustaría saber para ayudarte a decidir?"
```

**Example 3: Price Objection (Accompany)**
```
Customer: "Es muy caro para mí"
MIA: "Entiendo que el precio es una consideración importante."
[State assessment: interest=0.7, trust=0.5, readiness=0.2, price_sensitivity=0.8]
→ Customer is interested but price-sensitive. Explore, don't push.
MIA: "¿Te gustaría que te cuente sobre opciones que tenemos, o prefieres que te dé más información sobre por qué nuestros clientes consideran que vale la pena?"
```

---

## 3. Architectural Mechanisms to Prevent Push

### 3.1 Mechanism 1: State-Aware Closing Gate

```
RULE: Never attempt to close unless:
  - readiness > 0.7
  - trust > 0.6
  - interest > 0.6
  - clarity > 0.5

IF any condition is NOT met:
  → Choose a different action (explore, reassure, clarify, educate)
```

This is the **primary push prevention mechanism**. It makes closing a conditional action, not a default.

### 3.2 Mechanism 2: Action Type Annotation

Every MIA response is tagged with its intended action type:

```json
{
  "text": "El producto cuesta $500. ¿Tienes alguna pregunta sobre lo que incluye?",
  "action_type": "answer_explain",
  "evidence_used": ["price_question"],
  "state_at_response": {
    "interest": 0.6,
    "trust": 0.5,
    "readiness": 0.3
  }
}
```

This creates **auditability** — we can review whether MIA chose appropriate actions.

### 3.3 Mechanism 3: Push Detection

```
IF MIA attempts to close on 2+ consecutive turns:
  → FLAG as push behavior
  → Override: switch to explore/clarify action
  → Log for review
```

This is a **hard guardrail** that prevents systematic push behavior.

### 3.4 Mechanism 4: Evidence Threshold for Closing

```
RULE: Before closing, require minimum evidence:
  - At least 3 evidence items supporting readiness
  - At least 2 evidence items supporting trust
  - At least 1 evidence item confirming interest
  - No unresolved objections with weight > 0.5

IF evidence insufficient:
  → Gather more evidence before closing
```

### 3.5 Mechanism 5: Conversation Stage Awareness

```
Stages:
  1. DISCOVERY: Customer is exploring. Action: answer, explore, educate.
  2. EVALUATION: Customer is comparing/considering. Action: clarify, reassure, handle_objection.
  3. DECISION: Customer is ready to decide. Action: offer, advance, close.
  4. POST-SALE: Sale completed. Action: confirm, thank, follow_up.
  5. RECOVERY: Customer declined or disengaged. Action: wait, follow_up.

RULE: Don't jump stages. Progress naturally based on evidence.
```

---

## 4. Prompt Changes

### 4.1 Current Objective (Problematic)

```
Objetivo: Ayudar a los clientes a encontrar lo que necesitan de forma natural.
Vender con naturalidad, sin presionar artificialmente.
```

Problem: "Vender con naturalidad" implies selling is always the goal.

### 4.2 Proposed Objective

```
Objetivo: Ayudar al cliente a tomar una buena decisión.
Una compra puede ser el resultado del acompañamiento adecuado,
pero NO es el objetivo obligatorio de cada turno.

Tu trabajo es:
1. Entender lo que el cliente necesita
2. Proporcionar información útil
3. Construir confianza
4. Guiar toward la mejor decisión PARA EL CLIENTE
5. Cerrar SOLO cuando el cliente está listo

El cierre es UNA posible acción, NO la acción por defecto.
```

### 4.3 State-Aware Instructions

Add to the prompt:

```
## Guía de Acción por Estado

Basado en el estado del cliente, elige tu acción:

Si DISPONIBILIDAD < 0.5:
  → NO intentes cerrar
  → NO pidas datos personales
  → Responde preguntas y explora necesidades

Si CONFIANZA < 0.4:
  → NO pidas compromiso
  → Comparte pruebas sociales, garantías
  → Construye rapport

Si CLARIDAD < 0.4:
  → NO asumas que el cliente entiende
  → Explica antes de ofrecer
  → Haz preguntas clarificadoras

Si INTERÉS < 0.3:
  → Sé breve y eficiente
  → NO inviertas en conversación larga
  → Deja la puerta abierta

Si TODAS las dimensiones < 0.3:
  → Sé breve y servicial
  → NO malgastes el tiempo del cliente
```

---

## 5. Measuring Push vs Accompany

### 5.1 Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| **Close attempt rate** | % of turns where MIA attempts to close | < 20% |
| **Premature close rate** | Close attempts when readiness < 0.5 | < 5% |
| **Push detection rate** | Consecutive close attempts detected | 0% |
| **Accompany score** | % of turns where action matches state | > 80% |
| **Customer satisfaction** | Post-conversation survey | > 4.0/5.0 |
| **Conversion rate** | % of conversations that result in sale | Maintain or improve |

### 5.2 A/B Testing

Compare:
- **Control**: Current prompt-based behavior
- **Treatment**: State-aware action selection with push prevention

Measure:
- Conversion rate (should maintain or improve)
- Average conversation length (should decrease — less wasted turns)
- Customer satisfaction (should improve)
- Close attempt rate (should decrease)

---

## 6. Edge Cases

### 6.1 Customer Asks to Buy Directly

```
Customer: "Quiero comprarlo. ¿Cómo hago?"
→ State: readiness=0.9 (from direct statement)
→ Action: close (customer explicitly requested)
```

**Override**: If the customer explicitly asks to buy, close immediately regardless of other state dimensions.

### 6.2 Customer Is Impatient

```
Customer: "Dale, mándamelo ya"
→ State: readiness=0.8, urgency=0.9
→ Action: close (customer signals urgency)
```

**Override**: High urgency can override low trust/clarity if the customer is explicit.

### 6.3 Repeat Customer

```
Customer: (returning, previous purchase)
→ State: trust=0.8 (from history), interest=read from new conversation
→ Action: greet + assess new interest
```

**Override**: Previous trust carries over, but interest/readiness are fresh.

### 6.4 B2B vs B2C

Different businesses may have different "normal" closing rates:
- B2C fashion: Higher close attempt rate is normal
- B2B services: Lower close attempt rate, longer cycles
- High-value items: Much lower close attempt rate

**Solution**: The state thresholds should be configurable per business (via `business_sales_config`).

---

## 7. Implementation Priority

| Mechanism | Priority | Effort | Impact |
|-----------|----------|--------|--------|
| State-aware closing gate | P0 | Low | High — prevents premature closes |
| Prompt objective change | P0 | Low | High — changes default behavior |
| State injection into prompt | P0 | Medium | High — gives LLM state awareness |
| Action type annotation | P1 | Low | Medium — creates auditability |
| Push detection | P1 | Low | Medium — hard guardrail |
| Evidence threshold | P2 | Medium | Medium — prevents closing on insufficient evidence |
| Conversation stage tracking | P2 | Medium | Low — nice to have, not critical |

---

## 8. Conclusion

The "Accompany vs Push" problem is **solvable with existing architecture**. The key changes are:

1. **Change the objective** from "sell naturally" to "help the customer make a good decision"
2. **Inject customer state** into the prompt so the LLM knows where the customer is
3. **Add state-aware action guidance** so the LLM knows what action is appropriate
4. **Add hard guardrails** (closing gate, push detection) to prevent systematic push behavior

This is not a new system — it's a refinement of the existing prompt-based approach with better input data.
