# ADR-031: Política de Media por Producto Identificado (Precio + Imagen)

## Status

**Proposed** — enmienda a [ADR-014](014-conditional-knowledge-media.md) y
[ADR-016](016-product-media-context.md), y al contrato de elegibilidad de
`docs/research/context-idempotency/25-TRIGGER-SCOPE-CONTRACT.md`.

## Date

2026-09-17

## Context

El motor de media actual (ADR-014) envía una imagen **solo si** se cumple una
condición (`trigger_condition`) **dentro** de un scope de producto único
(ADR-016 + doc 25). Consecuencia observada en producción (2026-09-17, canal
Messenger):

- El cliente pide el producto por su nombre informal ("el de las uñas").
- `detectExplicitScopes` no resuelve el producto (no hay alias "uñas") →
  `scope = []` → `resolveContextMedia` retorna sin evaluar triggers
  (`src/lib/runtime/context-media.ts`, guard `scope.length === 0`).
- No se despacha imagen; el LLM **alucina** "aquí tienes la imagen".

Además, aun con scope único, la imagen solo sale si:
- el mensaje matchea un `trigger_condition` (R3-P1), o
- el mensaje expresa intención de media ("muéstrame", "foto") y el producto
  declara un asset incondicional o ≥2 assets propios (R3-P2).

El negocio (Vitanova) quiere una regla **multicanal** (web, WhatsApp,
Messenger):

> Cuando MIA identifique un producto (scope único), enviar **una sola vez por
> conversación** su imagen respectiva; si el cliente vuelve a pedir precio, se
> responde **solo con texto**.

## Decision

Se introduce una **política producto-céntrica** que convive con el contrato
condicional existente, sin eliminarlo:

1. **Identificación = scope único determinístico.**
   La política aplica cuando `scope.length === 1` y el scope proviene de una
   señal determinística (`scopeSource` `explicit` o `landing`). El scope
   heredado (`context`) **no** habilita la política (riesgo de scope obsoleto).

2. **Elegibilidad por producto, no por trigger.**
   Si el producto identificado tiene al menos un asset de media propio
   (`knowledge_items.product_id = scope[0]`, `image_url` válida), ese asset es
   elegible **aunque el mensaje no matchee ningún trigger**. El trigger deja de
   ser requisito y pasa a ser **refinamiento opcional** (si matchea, se
   prefiere el asset especializado; si no, se usa el representativo).

3. **Asset representativo determinístico.**
   Selección: `conditionMatches` (trigger/intent) si existe → si no,
   `ownerAssets` ordenados por `position ASC` (NULLS LAST) → `created_at ASC` →
   `id`. Es el mismo orden determinístico que ya usa el motor (doc 25 §5). Se
   elimina la excepción actual por la que un producto con **un solo asset
   condicionado** (caso Neurofeet) no tenía representativo (R4 / DP-1).

4. **Cadencia: una vez por conversación (idempotencia existente).**
   Se conserva el claim atómico `UNIQUE (knowledge_item_id, conversation_id)`.
   El representativo se elige de forma estable, por lo que el segundo pedido de
   precio cae en `existing_hit` → `mediaStatus = NONE` → **respuesta solo
   texto**. El reenvío explícito por petición de media del cliente
   ("muéstrame la imagen otra vez") se mantiene como está hoy.

5. **Precio en la respuesta.**
   `products.price` ya se inyecta al prompt (`formatProducts`,
   `src/lib/ai/prompts.ts`). Se añade una regla de prompt explícita: al
   identificar/presentar un producto, mencionar siempre su precio.

6. **Alcance multicanal.**
   La política vive en el runtime. `imageUrl` ya se propaga a los tres canales
   (web SSE, WhatsApp bridge, Messenger Send API); no hay cambios de transporte.

### Resolución de la aparente contradicción con A (aliases) y C (anti-alucinación)

- **A (aliases)**: **complementaria**, no contradictoria. La política necesita
  que el producto se identifique; A permite resolver referencias informales
  ("uñas", "faja") a scope explícito. Sin A, la política no dispara con
  nombres genéricos.
- **C (anti-alucinación)**: **complementaria**. La política reduce los casos
  "producto identificado sin trigger", pero cuando no hay identificación el LLM
  no debe prometer una imagen. C sigue vigente para ese resto.

## Consequences

### Positivas

- Comportamiento predecible y venta-consistente: identificar producto ⇒
  precio + imagen (una vez).
- Elimina la causa raíz de "dijo que enviaba imagen y no llegó" en el caso de
  producto identificado.
- Sin coste de AI adicional (selección determinística, sin LLM).
- Sin migración de base de datos (se reutiliza `chat_media_dispatched`).
- Los tres canales se benefician sin cambios de transporte.

### Negativas / Trade-offs

- La imagen deja de ser estrictamente "condicional": se envía ante la primera
  identificación de producto aunque el cliente no la pida. Mitigación: cadencia
  única por conversación (idempotencia) + `position` para que el negocio elija
  el representativo.
- Cambia R4/DP-1: un producto con un único asset condicionado ahora sí tiene
  representativo. Afecta a Neurofeet; debe reflejarse en tests.
- El negocio debe curar el orden (`position`) de sus assets para controlar qué
  imagen se envía como representativa.

## Implementation Plan (no ejecutar sin `go` explícito — regla #22)

### Fase 1 — Política en el motor de media

- `src/lib/runtime/context-media.ts`
  - En `resolveScopedIdempotency`: cuando `uniqueScope !== null`,
    `explicitScope ∈ {literal, sku, landing}` y `ownerAssets.length >= 1`:
    - `principalCandidates`: usar `ownerAssets[0]` como representativo si no hay
      incondicionales (quitar la condición `>= 2`).
    - `principals`: dejar de exigir `detectMediaIntent` para el representativo
      (o introducir un flag `productIdentified` explícito). Mantener la
      prioridad `conditionMatches` → `principals`.
  - No tocar el guard de scope vacío/múltiple, ni el resend, ni la recuperación
    de `failed`, ni `isSafeMediaUrl`.
  - Añadir a la decisión el motivo `reason: 'product identified representative'`
    para trazabilidad.

### Fase 2 — Precio en prompt

- `src/lib/ai/prompts.ts`: regla explícita "al presentar/identificar un
  producto, menciona su precio" (respetando `ai.noPrice` cuando no exista).

### Fase 3 — Alias seguros (A)

- `src/lib/runtime/product-aliases.ts`: añadir aliases **multi-palabra o no
  ambiguos** por producto (evitar `uña`/`uñas` por colisión con el artículo
  "una/unas" tras `normalizeText`):
  - `clean nails`: `['hongos de las unas', 'hongos en las unas']` (frases).
  - `neurotin`: `['calcetin']`, `neurofeet`: `['calceta de compresion', 'media de compresion']`,
    `bye canas`: `['canas']`, `bella patch`: `['bella patch']`.
  - Revisar colisión de cada término único antes de registrarlo.

### Fase 4 — Anti-alucinación (C)

- Revisar el feedback truthful (`withMediaResolutionFeedback`,
  `28-LLM-RUNTIME-FEEDBACK-CONTRACT.md`) y la regla negativa en `prompts.ts`:
  el modelo no debe afirmar el envío de una imagen cuando `mediaStatus` es
  `NONE`/`MEDIA_UNAVAILABLE_FOR_PRODUCT`/`MEDIA_REQUEST_NOT_RECOGNIZED`.

### Tests

- Unit `tests/runtime/context-media.test.ts`:
  - producto identificado + asset condicionado sin match de trigger → despacha
    representativo (`DISPATCHED`, `claim: created`).
  - segundo pedido de precio → `existing_hit`, `NONE`, sin adjunto.
  - producto con un único asset condicionado → representativo (cambio R4/DP-1).
  - scope `context` → **no** dispara la política.
  - scope múltiple/vacío → sin cambios.
- Unit `tests/runtime/product-aliases.test.ts`: aliases nuevos y no-colisión.
- E2E multicanal (si el entorno lo permite): web, WhatsApp, Messenger.

## Alternatives Considered

| Alternativa | Razón de rechazo |
|-------------|------------------|
| **Solo A (aliases)** | No cubre productos identificados sin match de trigger; el síntoma persiste en otros casos |
| **Solo C (prompt)** | Evita la mentira pero no envía la imagen; no cumple la regla de negocio |
| **Siempre enviar en cada respuesta** | Intrusivo; viola "una vez por conversación" (ADR-014 §5) |
| **Que el LLM decida el envío** | Coste, latencia y no determinismo para la cadencia única |
| **Columna `aliases` en `products` (Fase 2 multi-tenant)** | Correcta a futuro, pero mayor alcance; se mantiene como evolución posterior |

## Open Questions

- ¿El representativo debe ser siempre el de menor `position`, o el negocio debe
  poder marcar explícitamente "imagen principal"? (Fase 2: flag `is_primary`.)
- ¿Debe la política aplicar también a `scopeSource = 'context'` (producto activo
  heredado) o mantenerse conservadora como aquí? Decisión tomada: **no**.

## References

- `src/lib/runtime/context-media.ts` — motor de media (elegibilidad + claim)
- `src/lib/runtime/context-scope.ts` — `resolveScopeContext`, `detectExplicitScopes`
- `src/lib/runtime/product-aliases.ts` — aliases determinísticos (A)
- `src/lib/runtime/product-recommendation.ts` — `buildProductReference` (precio + imagen representativa)
- `src/lib/ai/prompts.ts` — `formatProducts`, `withMediaResolutionFeedback`
- `docs/adr/014-conditional-knowledge-media.md`
- `docs/adr/016-product-media-context.md`
- `docs/research/context-idempotency/25-TRIGGER-SCOPE-CONTRACT.md`
- `docs/research/context-idempotency/28-LLM-RUNTIME-FEEDBACK-CONTRACT.md`
