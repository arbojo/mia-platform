# 24 — CONTEXT CONTRACT

**HEAD**: `d12ce650` · **Status**: SPECIFICATION_LOCKED · **Input**: docs 06, 17, 18, 22 §3

---

## 1. DEFINICIÓN FORMAL

```text
active_product_ids[]  — lista ordenada de productos bajo consideración comercial
                        en la conversación. OWNER: conversation (persistente).
                        Se llena SOLO por: (a) explicit-scope determinístico,
                        (b) resolución de producto confirmada por runtime.
```

FACT (doc 22 §2): hoy NO existe este campo en ningún lugar persistente. El
único "contexto" es el historial de mensajes dentro del prompt (LLM latent).
Evidencia: `src/lib/runtime/core.ts` construye el prompt con historial +
knowledge; no hay lectura/escritura de estado de producto en DB.

## 2. CREACIÓN (¿qué evidencia agrega un producto?)

| Evidencia | Autoridad | Agrega producto |
|-----------|-----------|-----------------|
| Nombre literal de producto ("Clean Nails") | Determinística (match exacto normalizado) | SÍ |
| SKU explícito | Determinística | SÍ |
| Product ID (vía landing `productId`, `knowledge.ts:178-185`) | Determinística | SÍ |
| Alias natural ("el de las uñas") | LLM inference | Solo como SUGERENCIA — nunca muta scope (D5) |
| Trigger genérico ("garantía", "envíos") | — | NO (INV-1) |
| Anáfora ("el otro", "ese") | — | NO en Fase 1 — UNKNOWN, requiere D5 ampliado |

## 3. PERSISTENCIA Y LIFETIME

message → product resolution → context update (persistente en conversación) →
siguiente mensaje lee scope. "Activo" = presente en `active_product_ids[]`.
Lifetime propuesto: vida de la conversación (D1 pendiente). No TTL intra-
conversación en Fase 1; no hay evidencia de decaimiento requerido (doc 22 §3).

## 4. CAMBIO DE PRODUCTO (transición)

Clean Nails deja de ser scope principal solo cuando:
(a) explicit-scope a otro producto (determinístico), o (b) el cliente agrega
otro producto explícito → multi-scope. "Deja de ser principal" ≠ "sale de la
lista": en Fase 1 el producto anterior permanece en `active_product_ids[]`
ordenado (más reciente primero). Evidencia doc 21 (golden "y el Bye Canas?").

## 5. MULTIPRODUCTO

"¿Cuánto cuesta Clean Nails y Bye Canas?" → `active_product_ids = [A, B]`
(AMBOS determinísticos). Comportamiento: respuestas comparativas permitidas;
media queda prohibida si la selección de asset no puede reducirse a UN scope
(sin ranking evidenciado — doc 07). NO elegir arbitrariamente (INV-4).

## 6. AMBIGÜEDAD

Pregunta genérica con 2+ productos activos y sin explicit-scope:
- Conocimiento: el LLM puede responder con el historial (FACT: hoy lo hace).
- Media: NO dispatch. `resolveConditionalMedia` sin producto único → null
  (`conditional-media.ts:73-76` — FACT). Este comportamiento NULL es el
  correcto y debe formalizarse, no "arreglarse".

## 7. EXPLICIT SCOPE (escape hatch)

"muéstrame la imagen de Clean Nails" → match literal/SKU → scope de ESTE
mensaje = Clean Nails → trigger evaluation dentro de ese scope → puede
promover Clean Nails a producto activo (transición documentada doc 22 §3).
Jerarquía de autoridad (doc 22 §4): literal name > alias > SKU > product_id >
LLM inference > anáfora > keyword-jamás. Solo niveles 1, 3, 4 son
determinísticos y aptos para mutar scope (D5).

## 8. CONTEXT DECISION TABLE (normativa)

| Input | Contexto previo | Explicit scope | Resultado | Clasif. |
|-------|-----------------|----------------|-----------|---------|
| pregunta genérica | 1 producto | no | scope = ese producto | PROPOSED |
| pregunta genérica | 2 productos | no | ambiguity: knowledge sí, media no | PROPOSED |
| producto explícito | cualquiera | sí | explicit product; promueve scope | PROPOSED |
| producto nuevo | 1 producto | sí | switch (multi-scope ordenado) | PROPOSED |
| dos productos en 1 msg | cualquiera | sí | multi-scope [A,B] | PROPOSED |
| trigger genérico | 1 producto | no | evalúa media solo de ese scope | PROPOSED |
| trigger genérico | 2 productos | no | NO media (no cross-contamination) | PROPOSED |
| "otra vez" | asset previo | no | resend policy (doc 26) | PROPOSED |
| "imagen de X" | otro activo | sí | X (escape) | PROPOSED |
| producto desconocido | cualquiera | sí | unresolved: aclarar, no adivinar | PROPOSED |
| "cuánto tarda?" (sin producto) | 1 producto | no | producto activo | PROPOSED (doc 21) |
| "es recargable?" | 1 producto, sin evidencia | no | respuesta LLM = UNSUPPORTED_BY_KNOWLEDGE | FACT (doc 22 §9) |

## 9. FALLA SI SE VIOLA

Violar INV-1 (trigger genérico muta scope) reproduce la contaminación
Clean Nails → Neurotin (doc 05-TRIGGER-CONTAMINATION, doc 21). Violar
"LLM nunca muta scope" hace el contexto no reproducible y no testeable.
