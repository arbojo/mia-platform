# 25 — TRIGGER-SCOPE CONTRACT

**HEAD**: `d12ce650` · **Status**: SPECIFICATION_LOCKED · **Input**: docs 04, 05, 18, 22 §4–§5

---

## 1. PIPELINE NORMATIVO

```text
MESSAGE → IDENTITY → CONTEXT/PRODUCT SCOPE → EXPLICIT-SCOPE OVERRIDE
→ TRIGGER EVALUATION → ELIGIBILITY → ASSET SELECTION → IDEMPOTENCY
→ DISPATCH → FEEDBACK → LLM
```

Validación contra el pipeline actual: hoy el orden real es
MESSAGE → media resolution GLOBAL (`conditional-media.ts`) → prompt → LLM →
media dispatch DESPUÉS del LLM (`core.ts:86-120`). Diferencias críticas:
(a) trigger evaluation no está subordinada a scope (ARCHITECTURAL_GAP),
(b) dispatch ocurre post-LLM y el LLM no recibe feedback (FACT, doc 22 §2),
(c) no hay idempotencia por asset pre-dispatch (BUG: race `media-guard.ts:87`).

## 2. REGLA CENTRAL

> Trigger match → media send es INSUFICIENTE. La pregunta normativa es:
> **¿el trigger pertenece al producto que está en scope?**

- DEFAULT: context → intent → eligible media → trigger.
- ESCAPE: explicit product mention → explicit scope → context transition →
  trigger evaluation (determinística, niveles 1/3/4 de la jerarquía, D5).

## 3. CROSS-PRODUCT CONTAMINATION MATRIX

| # | Caso | Expected scope | Expected trigger set | Expected asset | Expected idempotency |
|---|------|----------------|---------------------|----------------|----------------------|
| 1 | Clean Nails activo; switch a Bye Canas; "¿cómo funciona?" | Bye Canas | triggers de Bye Canas | media Bye Canas o nada; NUNCA media Clean Nails | claim nuevo si asset distinto |
| 2 | "Quiero Clean Nails y Bye Canas" → "muéstrame la imagen" | [A,B] | triggers de ambos | NO dispatch (ambigüedad, sin ranking evidenciado) | — |
| 3 | "¿Y la garantía?" tras switch | producto actual | triggers del scope actual | media del scope actual | normal |
| 4 | Trigger textual de A mientras B activo | B | triggers de B filtrados | nada de A (INV-2) | — |
| 5 | Dos triggers de productos distintos en 1 msg sin explicit scope | ambiguo | — | NO dispatch (INV-4) | — |
| 6 | Producto explícito contradice contexto | explicit gana (INV-3) | triggers del explicit | media del explicit | — |
| 7 | Cliente vuelve al producto anterior ("¿me enseñas cómo funciona Clean Nails?") | Clean Nails re-activado | triggers Clean Nails | media Clean Nails | claim ya existente → NO re-envío (salvo resend explícito) |
| 8 | Cliente pide asset ya presentado ("muéstrame la imagen") | actual | — | mismo asset | idempotency_hit → acknowledge/offer resend |

Estado ACTUAL (FACT): los casos 1, 4 y 5 fallan hoy — `triggerMatches()`
(`media.ts:11-26`) evalúa globalmente contra TODOS los knowledge_items del
business sin scope; con product_id conocido filtra por producto (MEDIA_INVARIANT),
pero sin producto activo el trigger genérico puede resolver media de cualquier
producto (doc 05: contaminación demostrada; Clean Nails genérico con
product_id=NULL, doc 10-EVIDENCE_MATRIX #3).

## 4. ELIGIBILITY (orden normativo)

Un asset es elegible para dispatch solo si TODAS:
1. `is_active = true` (knowledge_items) — hoy no hay re-chequeo post-caché (UNKNOWN si aplica).
2. `product_id ∈ active scope` O (genérico Y scope único Y trigger en scope).
3. Trigger match dentro del scope (context → intent → trigger).
4. No existe claim activo para (conversation × asset) en Fase 1.
5. `isSafeMediaUrl()` OK (`media-guard.ts:58` — FACT, se conserva).

## 5. SELECCIÓN DE ASSET

- Múltiples assets mismo trigger mismo scope: usar `position` si existe
  (doc 22 §1: inconsistencia created_at vs position — REPAIR a un solo orden).
- Dos assets, mismo trigger, productos distintos: imposible por INV-2 + scope.
- Asset sin product_id (genérico): solo con scope único (doc 24 §6).
