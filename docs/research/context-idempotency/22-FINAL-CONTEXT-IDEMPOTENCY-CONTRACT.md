# 22 — FINAL CONTEXT × IDEMPOTENCY ARCHITECTURAL CONTRACT

**Loop:** 3 — Pre-PRD / State × Context × Idempotency Decision Loop
**Source of truth:** `docs/research/context-idempotency/01–21` (Loops 1 & 2, EVIDENCE_LOCKED)
**Status:** CONTRACT_DRAFT — pending Council
**Date:** 2026-08-30
**Rule:** This document adds ZERO new code findings. It reconciles and freezes decisions derived from docs 01–21. Any statement not traceable to those docs is marked `INFERENCE` or `UNKNOWN`.

---

## 0. Executive Answer (Golden Question)

> **"¿Cómo conseguimos que MIA entienda primero de qué producto está hablando el cliente, mantenga ese contexto, no mezcle triggers de otros productos, permita cambio explícito sin fricción, y jamás vuelva a presentar innecesariamente el mismo asset al mismo comprador aunque cambie de conversación o canal?"**

Respuesta congelada (derivada de docs 16–21, clasificación FACT + INFERENCE):

1. **Context-first con escape hatch explícito** (Opción C de doc 12/18/19/20): el contexto comercial activo se determina ANTES de evaluar triggers; un trigger genérico nunca selecciona producto; solo una mención explícita de producto cambia el scope.
2. **Estado mínimo persistente**: `active_product_ids[]` (conversation-scoped), `last_media_asset` (efímero), **claims atómicos por asset** (DB, UNIQUE constraint), `delivered_at` (nuevo, semántica a decidir por Council).
3. **Idempotencia por asset**, no por keyword ni por media-event: la unidad propuesta es **customer × asset** con fallback a **conversation × asset** mientras la identidad cross-channel no esté endurecida (UNKNOWN → Council).

> **"¿Cuál es la MENOR cantidad de estado persistente?"**

Cuatro piezas (ver §2). Nada más. Todo lo demás (intent history, trigger history, product history, confidence) queda **efímero o derivado**, porque los docs 17/20 no aportaron evidencia que obligue a persistirlo.

---

## 1. FINDINGS RECONCILIATION TABLE (docs 01–21 → estado canónico)

Clasificaciones: FACT / BUG / ARCHITECTURAL_GAP / PARITY_GAP / DATA_QUALITY / INFERENCE / PROPOSED / UNKNOWN.
Fuente = documento(s) que establecen el hallazgo. `CANONICAL_STATUS` = estado tras reconciliar Loop 1 + Loop 2.

| # | FINDING | SOURCE | CLASSIFICATION | CANONICAL_STATUS |
|---|---------|--------|----------------|------------------|
| F1 | No existe `active_product_id` ni estado estructurado de producto activo; el "contexto" vive solo en el historial de mensajes → prompt LLM | 01-CONTEXT_MODEL, 02-CONTEXT_FLOW, 04-TRIGGER_CONTEXT_ANALYSIS | ARCHITECTURAL_GAP | CONFIRMED — contexto INEXISTENTE |
| F2 | `triggerMatches()` evalúa keywords globalmente contra el texto del mensaje, sin conocer producto activo | 04-TRIGGER_CONTEXT_ANALYSIS, 05-TRIGGER-MATCHING | FACT | CONFIRMED |
| F3 | `resolveConditionalMedia()` recibe producto vía cascada de `resolveRecommendedProduct()` (mención explícita → inferencia LLM → última recomendación); primera coincidencia gana | 03-PRODUCT_RESOLVER, 03-PRODUCT_IDENTITY | FACT | CONFIRMED |
| F4 | Un mensaje puede activar media de múltiples productos cuando el trigger es genérico y coincide en items de distinto `product_id` (contaminación) | 04-TRIGGER_CONTEXT_ANALYSIS, 07-MULTI_PRODUCT_ANALYSIS | BUG | CONFIRMED |

| F5 | MEDIA_INVARIANT: con producto conocido se filtra por `product_id`; el invariant existe pero su corrección depende de que la resolución de producto sea correcta | 04-TRIGGER_CONTEXT_ANALYSIS | FACT (parcial) | CONFIRMED — invariant correcto, entrada no confiable |
| F6 | Dedup existente: `chat_media_dispatched` UNIQUE (knowledge_item_id, conversation_id) + `conversations.media_sent_products[]` | 05-IDEMPOTENCY_ANALYSIS, 06-DEDUP-MECHANISMS | FACT | CONFIRMED — scope SOLO conversación |
| F7 | Dedup NO es cross-conversation, NO es cross-channel, NO es customer-level | 05-IDEMPOTENCY_ANALYSIS, 07-MULTI_PRODUCT_ANALYSIS | ARCHITECTURAL_GAP | CONFIRMED |
| F8 | `addConversationMediaSentProduct()` es read-then-write no atómico → lost update bajo concurrencia | 10-RACE-CONDITIONS, 06-DEDUP-MECHANISMS | BUG | CONFIRMED |
| F9 | `chat_media_dispatched` registra INTENCIÓN de dispatch (claim), NO delivery; no existe `delivered_at` ni receipt del proveedor persistido | 05-IDEMPOTENCY_ANALYSIS, 20-ADVERSARIAL-FINAL-REPORT | ARCHITECTURAL_GAP | CONFIRMED — attempted/claimed ≠ delivered |
| F10 | Identidad: WhatsApp resuelve por teléfono, WebChat por external_id/sesión; sin unificación cross-channel → la misma persona puede ser 2 customers | 07-IDENTITY-RESOLUTION, 09-CHANNEL_PARITY | ARCHITECTURAL_GAP | CONFIRMED — bloquea dedup customer-level |
| F11 | No existe `active_intent` persistido; el intent es transitorio (detección por mensaje para matching) | 02-CONTEXT_MODEL, 05-TRIGGER-MATCHING | ARCHITECTURAL_GAP | CONFIRMED |
| F12 | Lab/Core/WebChat comparten core, pero presentación, dedup y contexto difieren en bordes (Lab sin product cards, WebChat sin fallback de media) | 09-CHANNEL_PARITY (L1 y L2) | PARITY_GAP | CONFIRMED |
| F13 | Paráfrasis semántica ("qué dicen los clientes?") no matchea trigger literal "testimonios" → texto correcto, media faltante, depende del LLM | 05-TRIGGER-MATCHING, 21-GOLDEN-CONVERSATIONS | ARCHITECTURAL_GAP | CONFIRMED |
| F14 | Context transitions (A→B→A) dependen exclusivamente del razonamiento latente del LLM sobre el historial; no hay transición formal de estado | 06-CONTEXT_TRANSITIONS, 21-GOLDEN-CONVERSATIONS | ARCHITECTURAL_GAP | CONFIRMED |
| F15 | Modelo reducido de estado propuesto por Loop 2: `active_product_ids[]`, `last_media_asset`, claims atómicos por asset, `delivered_at` | 17-STATE-MODEL-VALIDATION, 20-ADVERSARIAL-FINAL-REPORT | PROPOSED | FROZEN como base del contrato (§2) |
| F16 | Opción C (context-first + explicit-scope escape hatch) es la única de las 3 opciones que sobrevivió la matriz adversarial sin casos de contaminación no cubiertos | 12-ARCHITECTURAL_OPTIONS, 18-CONTEXT-FIRST-DECISION-TABLE, 19-ARCHITECTURE-VERDICT, 20-ADVERSARIAL-FINAL-REPORT | PROPOSED→VERDICT | FROZEN (§12) |
| F17 | "es recargable" en la Golden Conversation: sin evidencia en knowledge base del negocio | 21-GOLDEN-CONVERSATIONS, 08-GOLDEN_CONVERSATION (image-core) | UNKNOWN (no BUG) | UNSUPPORTED_BY_KNOWLEDGE / UNKNOWN |
| F18 | Resend requests (`isResendRequest`) permiten re-envío explícito y son el único bypass legítimo del dedup | 05-TRIGGER-MATCHING, 05-IDEMPOTENCY_ANALYSIS | FACT | CONFIRMED — escape de idempotencia |

**Contradicción registrada y resuelta** (doc 16): Loop 1 describía el dedup como conversation-scoped (F6) mientras Loop 2 propuso customer-scoped (F15). Resolución: **no son contradictorios sino niveles distintos** — el actual es conversation-scoped (hecho), el propuesto es customer×asset (diseño). La elección final es UNKNOWN/Council porque F10 (identidad fragmentada) hace que customer-level sea inseguro hoy. Ver §6.

## 2. FINAL STATE MODEL (congelado)

Fuente: doc 17 (STATE-MODEL-VALIDATION) + doc 20. Principio: **no se agrega ningún campo sin evidencia que lo obligue.**

### 2.1 CUSTOMER STATE (persistente)

| FIELD | OWNER | PURPOSE | LIFETIME | SOURCE | MUTATION RULE | READERS | WRITERS | FAILURE MODE |
|-------|-------|---------|----------|--------|---------------|---------|---------|--------------|
| customer identity (id + linkage) | DB `customers` | Unificar comprador | Permanente | resolveCustomer (phone/external_id) | Solo por resolución de identidad; nunca por inferencia de media | Runtime, adapters, dedup customer-level (futuro) | Identity resolver | Fragmentación (F10) → dedup customer-level inseguro hasta endurecer |
| per-asset presented ledger | DB (claims, nuevo scope) | No re-presentar asset | Permanente (o TTL por Council) | Media dispatch pipeline | Solo insert atómico con UNIQUE | Media resolution | Media dispatch | Si no es atómico → duplicados (F8) |

### 2.2 CONVERSATION STATE (persistente)

| FIELD | OWNER | PURPOSE | LIFETIME | SOURCE | MUTATION RULE | READERS | WRITERS | FAILURE MODE |
|-------|-------|---------|----------|--------|---------------|---------|---------|--------------|
| `active_product_ids[]` | conversations (nuevo, o tabla de estado) | Scope de evaluación de triggers y de media | Vida de la conversación (TTL: Council) | Mención explícita de producto (única autoridad de mutación) | Append/remove SOLO por explicit-scope o transición formal | Trigger evaluation, media resolution, prompts | Core pipeline post-understanding | Si se muta por trigger genérico → contaminación (F4) |
| claims de dispatch (existing `chat_media_dispatched`) | DB | Idempotencia intra-conversación | Vida de la conversación | Media dispatch | Insert atómico por asset | Media resolution | Media dispatch | Duplicado si falla atomicidad (F8) |

### 2.3 MEDIA STATE

| FIELD | OWNER | PURPOSE | LIFETIME | SOURCE | MUTATION RULE | READERS | WRITERS | FAILURE MODE |
|-------|-------|---------|----------|--------|---------------|---------|---------|--------------|
| asset (knowledge_item) metadata | `knowledge_items` | Contenido + scope de producto | Permanente | UI/imports | CRUD existente | Resolución, prompts | UI/API | Trigger sentence en vez de keywords (F- image-core #6) degrada matching |
| claim/dispatch/delivery status | claims + `delivered_at` (nuevo) | Distinguir attempted vs delivered | Permanente | Pipeline + provider receipt | claim: insert atómico; delivered: solo confirmación de provider | Idempotencia, observabilidad, retry | Dispatch + webhook de estado | Sin delivered_at → no se distingue intento de recepción (F9) |

### 2.4 MESSAGE STATE

Sin campos nuevos. El historial de mensajes existe y alimenta al LLM (F1). **No se persiste intent ni trigger por mensaje**: la evidencia (docs 02, 05, 17) no lo obliga; el intent se resuelve por mensaje de forma transitoria (F11).

### 2.5 CHANNEL STATE

Sin campos nuevos. El canal ya viaja en el WireMessage y en la conexión. La dedup cross-channel se resuelve con identidad + ledger customer-level (§8), no con estado por canal. Evidencia: docs 09, 17.

### 2.6 Efímero (NO persistir)

- `last_media_asset` — contexto inmediato de la última resolución; se deriva de la conversación; doc 17 lo mantiene efímero.
- `active_intent` — por mensaje (F11).
- confidence / provenance del producto activo — puede calcularse en el momento de la mutación de `active_product_ids[]` (procedencia registrada opcionalmente como metadato de la transición, §3) pero no es estado consultable requerido por ningún caso de uso con evidencia.

---

## 3. CONTEXT TRANSITION CONTRACT (congelado)

Autoridad de transición (doc 06 + 18): **solo la mención explícita de producto cambia el set activo.** Los triggers genéricos son evaluados DENTRO del contexto, jamás lo mutan.

| TRANSICIÓN | TRIGGER | AUTHORITY | EVIDENCE | EXPECTED STATE |
|------------|---------|-----------|----------|----------------|
| NO_CONTEXT → PRODUCT_IDENTIFIED | Mención explícita ("quiero info del Clean Nails") o selección de catálogo | Explicit-scope resolver | 03-PRODUCT_RESOLVER, 06-CONTEXT_TRANSITIONS, 18 | `active_product_ids=[A]` |
| A → A | Pregunta genérica ("¿tiene garantía?") dentro del contexto | Ninguna (sin mutación) | 21-GOLDEN-CONVERSATIONS | `[A]` sin cambios |
| A → B | Mención explícita de B ("ahora dime del Neurotin", "y el Neurotin?", "mejor el de uñas") | Explicit-scope resolver | 06, 18, 21 | `[B]` (reemplazo) o `[A,B]` según regla de coexistencia (§5, INV-5) |
| A → A+B | Cliente considera ambos explícitamente ("quiero saber del Clean Nails y del Neurotin") | Explicit-scope resolver con multi-detección | 07-MULTI_PRODUCT_ANALYSIS | `[A,B]` |
| A+B → A | Mención explícita de A o pregunta claramente scoped a A | Explicit-scope resolver | 06, 18 | `[A]` (B permanece discutido pero no activo) |
| A → NO_CONTEXT | Caducidad (TTL) o límite de conversación | Decay policy (Council) | 06-CONTEXT_TRANSITIONS, 20 | `[]` |

Casos ancla con evidencia:

- **"Clean Nails"** → transición autorizada (nombre literal de producto; resolver lo matchea, F3).
- **"el otro" / "ese"** → referencia anafórica ambigua: NO autoridad de transición por sí sola; se resuelve contra el contexto activo (si hay exactamente 1 producto activo, el referente es inequívoco; con 2+, ambigüedad → INV-4). Evidence: 06, 20 (casos H, I).
- **"también quiero Neurotin"** → mención explícita → coexistencia `[A,B]` (INV-5). Evidence: 07, 18.
- **"muéstrame la de Clean Nails"** → explicit-scope en el MISMO mensaje que el trigger → el scope se aplica primero y el trigger se evalúa dentro de Clean Nails. Evidence: 18-CONTEXT-FIRST-DECISION-TABLE.

## 4. TRIGGER CONTRACT (congelado)

Fuente: docs 04-TRIGGER_CONTEXT_ANALYSIS, 05-TRIGGER-MATCHING, 18.

**Regla DEFAULT (evaluación dentro de contexto):**

```
context (active_product_ids) → intent (por mensaje, transitorio)
  → media elegible SOLO de los productos activos
  → trigger matching (keywords, plural-tolerant, intent-tags)
  → candidatos → claim atómico → dispatch → delivery
```

**Regla ESCAPE (explicit scope):**

```
explicit product mention en el mensaje
  → actualiza active_product_ids ANTES de evaluar triggers
  → trigger evaluation corre dentro del nuevo scope
```

### 4.1 ¿Qué constituye "explicit scope"? (jerarquía de confianza, doc 18/20)

| NIVEL | FORMA | ¿ES EXPLICIT SCOPE? | EVIDENCE |
|-------|-------|---------------------|----------|
| 1 | Nombre literal de producto (match exacto/normalizado contra catálogo) | SÍ — autoridad máxima | 03-PRODUCT_RESOLVER |
| 2 | Alias verificado del negocio (gestionado, no inferido) | SÍ | 18 — distinción alias vs LLM |
| 3 | SKU | SÍ — identidad de catálogo | 03-PRODUCT_IDENTITY |
| 4 | product_id directo (UI/landing) | SÍ — identidad canónica | landing context |
| 5 | Inferencia LLM sobre el mensaje | NO para transición autónoma; solo PROPOSA (aceptar solo si hay exactamente 1 activo; con 0 o 2+ → no seleccionar arbitrariamente) | 18, 20 |
| 6 | Referencia anafórica ("el otro", "ese") | NO es scope explícito; es resolución de contexto (§3) | 06, 20 |
| 7 | Trigger keyword ("testimonios", "precio") | JAMÁS es scope | F2, F4 |

**Regla de ambigüedad (INV-4)**: si el mensaje referencia más de un producto posible sin jerarquía 1–4, el sistema NO elige arbitrariamente: no muta contexto; behavior seguro = preguntar o responder sin media (doc 20, casos multi-producto).

---

## 5. PRODUCT ISOLATION CONTRACT (congelado — 5 invariantes)

Fuente: docs 07-MULTI_PRODUCT_ANALYSIS, 16-CONTRADICTION_REGISTER, 18, 19.

| INV | ENUNCIADO | DEMOSTRACIÓN CON EVIDENCIA |
|-----|-----------|---------------------------|
| INV-1 | Un trigger genérico no puede cambiar el producto activo. | Hoy el matching global lo permite (F2, F4: BUG). Bajo el contrato, la única autoridad de mutación es explicit-scope (§3). El contradiction loop (doc 16, casos 1–10) no encontró caso donde un trigger genérico deba cambiar contexto. |
| INV-2 | Un asset product-scoped solo puede resolverse dentro de su scope. | MEDIA_INVARIANT actual ya filtra por `product_id` cuando el producto es conocido (F5); el gap era la entrada (producto correcto). Con contexto-first la entrada es confiable. Docs image-core 04 + 18. |
| INV-3 | Una referencia explícita puede cambiar el scope. | Único bypass autorizado; jerarquía §4.1 niveles 1–4. Evidence: 18-CONTEXT-FIRST-DECISION-TABLE. |
| INV-4 | Ambigüedad no selecciona arbitrariamente un producto. | Doc 20: mensaje multi-producto/ambiguo → resolver actual toma first-match (F3, BUG de hecho); contrato exige no-selección + pregunta. Evidence: 07, 20. |
| INV-5 | Dos productos explícitos pueden coexistir (`active_product_ids` es un set). | Doc 07: escenario real multi-producto requiere coexistencia; el modelo de un solo `active_product_id` falló el caso 5 del contradiction loop; doc 17 validó el set. |

**Prueba de aislamiento (Clean Nails vs Neurotin, docs 07 + 21):** con contexto `[Clean Nails]`, un mensaje "testimonios" solo puede resolver assets con `product_id=CleanNails` (INV-2) — aunque Neurotin tenga un asset con trigger "testimonios" idéntico. El matching contra el asset de Neurotin queda bloqueado por scope, no por suerte de keywords.

## 6. IDEMPOTENCY CONTRACT (congelado con 1 UNKNOWN)

Fuente: docs 05-IDEMPOTENCY_ANALYSIS, 06-DEDUP-MECHANISMS, 17, 19, 20.

### 6.1 Semántica de la cadena attempt→delivery

| ESTADO | DEFINICIÓN | ¿EXISTE HOY? | EVIDENCE |
|--------|------------|--------------|----------|
| ATTEMPTED | El pipeline decidió intentar enviar | Implícito en ejecución | 05 |
| CLAIMED | Insert atómico reservó el asset para este scope | Parcial: UNIQUE de `chat_media_dispatched` es atómico; `media_sent_products[]` NO (F8) | 05, 06, 10 |
| DISPATCHED | El adapter entregó al proveedor (Baileys/API) | Solo en memoria/logs, no consultable | 05, 20 |
| DELIVERED | Confirmación del proveedor de recepción | NO existe (`delivered_at` inexistente, F9) | 05, 20 |
| PRESENTED | Cliente vio el asset (web) o lo recibió (wa) | NO modelado | 20 |

**Regla congelada:** claim ≠ dispatch ≠ delivery. La idempotencia anti-re-presentación se ancla en CLAIM (estado más fuerte verificable sin receipt); `delivered_at` se agrega para observabilidad y reintentos (semántica exacta → Council, §13).

### 6.2 Unidad idempotente

| UNIDAD | PRO | CONTRA | VEREDICTO |
|--------|-----|--------|-----------|
| conversation + asset | Ya existe (F6), cero migración de concepto | No sobrevive nueva conversación ni canal (F7) — falla casos D, E, F | INSUFICIENTE (estado actual) |
| customer + asset | Sobrevive conversaciones y canales; semántica comercial correcta | Requiere identidad endurecida (F10); hoy fragmenta → ledger duplicado | OBJETIVO — condicionado a Council/identity |
| customer + product + asset | Permite re-presentar al cambiar de producto | Sin evidencia de caso de uso que lo exija | RECHAZADO por mínimo estado |
| customer + product + intent + asset | Máxima granularidad | Cero evidencia; descartado en doc 17 | RECHAZADO |
| channel + asset | Dedup por canal | Semántica incorrecta: el mismo asset llegaría por el otro canal | RECHAZADO |

**Congelado:** unidad objetivo = **customer × asset**, con **fallback de seguridad = conversation × asset** (existente) hasta que la identidad esté endurecida. El bypass legítimo único es el resend explícito (`isResendRequest`, F18) y la regla "muéstramelo otra vez" (§10).

---

## 7. RETRY MATRIX (congelada)

Fuente: docs 10-RACE-CONDITIONS, 05-IDEMPOTENCY_ANALYSIS, 09-CHANNEL_PARITY, 20.

| Scenario | ¿Duplicate esperado? | Required state |
|----------|----------------------|----------------|
| Same message retry (mismo webhook) | NO | Claim atómico por asset (UNIQUE) — el insert idempotente absorbe el retry |
| Same webhook retry (provider re-entrega) | NO | Idempotencia a nivel de evento de webhook (event/message id) — HOY: UNKNOWN si el webhook deduplica |
| Same conversation, trigger repetido | NO (mismo asset) | `chat_media_dispatched` UNIQUE (F6) — ya cubierto |
| New conversation, mismo customer | NO (objetivo) / SÍ hoy (gap) | Ledger customer × asset (F7) — requiere §8 |
| WhatsApp → WebChat | NO (objetivo) / SÍ hoy | Identity linkage + customer × asset (F10) |
| WebChat → WhatsApp | NO (objetivo) / SÍ hoy | Ídem |
| Simultaneous requests (2 webhooks concurrentes, mismo asset) | NO | Claim atómico (UNIQUE constraint gana, perdedor obtiene 0 filas) — reemplaza el read-then-write de F8 |
| Failed dispatch (claim hecho, envío falla) | Retry SÍ debe re-enviar | `delivered_at` NULL permite reintento; claim solo bloquea si delivered |
| Successful dispatch | NO | Claim + delivered_at set |
| Unknown delivery status | NO re-presentar automáticamente | Política conservadora: claim bloquea; resend explícito como bypass (F18) |

Nota de evidencia: la columna "Required state" del webhook-retry (event id) no está verificado en docs 01–21 → **UNKNOWN-W1** (ver §15).

## 8. CUSTOMER IDENTITY CONTRACT

Fuente: docs 07-IDENTITY-RESOLUTION, 09-CHANNEL_PARITY, 20.

### 8.1 ¿Cuándo dos conversaciones pertenecen al mismo customer?

| VÍNCULO | CERTEZA | ¿PERMITE UNIR? | EVIDENCE |
|---------|---------|----------------|----------|
| Mismo `customer_id` | Certeza (mismo registro) | SÍ | identity resolver |
| Mismo teléfono (WhatsApp) | Certeza alta | SÍ dentro del mismo canal | resolveCustomer (phone) |
| Mismo `external_id` (WebChat) | Certeza alta dentro de la sesión | SÍ en WebChat | resolveCustomer |
| Teléfono ↔ external_id | SIN vínculo actual | NO hoy | F10 — fragmentación cross-channel |
| Nombre / comportamiento similar | Inferencia débil | NO (prohibido unir por inferencia) | 20 (identity attack) |

### 8.2 Reglas congeladas

1. La unión de identidades solo procede por evidencia fuerte (misma FK o mismo identificador de canal).
2. NO se une por nombre, comportamiento, o similitud de mensaje (identity inference prohibida — doc 20).
3. Mientras no exista linkage cross-channel, la unidad idempotente operativa es conversation × asset (fallback, §6.2) y el customer × asset queda bloqueado.
4. Multi-business identity: **no resuelto** — permanece UNKNOWN (ningún doc de Loops 1–2 aporta evidencia de clientes cross-business) → Council.

---

## 9. KNOWLEDGE VS CONTEXT — Golden Conversation validada

Fuente: doc 21 + doc 08 (image-core). Conversación Clean Nails: todas las preguntas anafóricas ("¿tiene garantía?", "¿y envíos a León?") se resuelven hoy porque el LLM ve el historial completo (F1) — el contexto existe en el prompt, no en estado estructurado (F14).

| CLAIM del cliente | CONTEXT SOURCE | KNOWLEDGE SOURCE | LLM CLAIM | EVIDENCE STATUS |
|-------------------|----------------|------------------|-----------|-----------------|
| "en cuánto tiempo se ve mejora" | Historial (LLM) | KB del producto si existe | Correcto si KB lo cubre | OK si KB; si no: UNSUPPORTED_BY_KNOWLEDGE |
| "cómo se usa" | Historial (LLM) | KB (`benefits`/`description` del producto o knowledge item) | Ídem | OK si KB |
| "garantía" | Historial (LLM) | KB / sales_rules | Ídem | OK si KB |
| "envíos a León" | Historial (LLM) | KB (business_info) | Ídem | OK si KB |
| "es recargable" | Historial (LLM) | **No verificado en KB** | Riesgo de alucinación | **UNSUPPORTED_BY_KNOWLEDGE / UNKNOWN** (F17) — NO clasificar como BUG de MIA sin verificar la KB del negocio |

Regla congelada: separar SIEMPRE (a) error de contexto (mezcló productos), (b) error de conocimiento (afirmó sin KB), (c) dato desconocido (ni KB ni evidencia). Solo (a) es bug arquitectónico de este contrato.

---

## 10. CLIENT EFFORT CONTRACT (congelado)

Fuente: docs 08-CUSTOMER_SIMPLICITY, 13-PRD_INPUT, 21.

| FLOW | Cliente repite producto? | ¿Arquitectura que lo permite? |
|------|--------------------------|-------------------------------|
| A (contexto persistente): "info del Clean Nails" → "cuánto tarda?" → "garantía?" | NO | Context-first con `active_product_ids[]` + triggers evaluados dentro del scope |
| B (hoy, si el contexto falla): repetir "del Clean Nails..." en cada mensaje | SÍ | Solo funciona por el historial que el LLM ve — frágil (F14) y sin garantía para media (F4) |

Reglas congeladas:

1. El cliente NO debe repetir el nombre del producto mientras el contexto esté activo (§3, A→A sin mutación).
2. El cambio explícito ("y el Neurotin?") debe costar UNA mención (INV-3).
3. El cliente jamás debe necesitar conocer triggers/keywords internos: la paráfrasis se maneja con intención (media correcta) o degradación elegante (respuesta sin media, nunca media equivocada) — doc 20 §semántica.
4. El re-envío explícito ("muéstramelo otra vez") siempre está permitido (bypass F18).

---

## 11. FAILURE CONTRACT (congelado)

Fuente: docs 10-FAILURE_MODES, 16, 20.

| FAILURE | SAFE BEHAVIOR | UNSAFE BEHAVIOR (prohibido) | REQUIRED EVIDENCE |
|---------|---------------|------------------------------|-------------------|
| NO CONTEXT | Responder sin media; el LLM puede preguntar de qué producto | Enviar media genérica sin scope | F1, F4 |
| AMBIGUOUS PRODUCT | No seleccionar; preguntar / responder sin media | First-match arbitrario (hoy: F3) | INV-4, doc 20 |
| MULTIPLE PRODUCTS | Coexistencia `[A,B]`; media por producto explícito | Mezclar assets de A y B en un trigger genérico | INV-5, doc 07 |
| NO MEDIA (producto activo sin asset) | Respuesta textual correcta, sin media | Texto que afirme "te envío la imagen" sin envío (claim/execution invariant roto hoy — image-core #8) | image-core evidence matrix #8 |
| TRIGGER COLLISION | Scope decide; si scope vacío → no media | Ambos assets | INV-1/2 |
| IDENTITY FRAGMENTATION | Fallback conversation × asset | Falso dedup customer-level con identidad fragmentada | F10, §8 |
| FAILED DISPATCH | Reintento permitido (delivered_at NULL); informar al usuario si reintentos agotados | Marcar como enviado sin confirmación | §6.1, §7 |
| UNKNOWN DELIVERY | No re-presentar automáticamente | Asumir delivered | §7 |
| DUPLICATE WEBHOOK | Claim atómico absorbe | Doble dispatch | §7, F8 |
| CONCURRENT REQUEST | UNIQUE constraint decide ganador; perdedor sigue sin media | Read-then-write (hoy: F8 lost update) | F8, doc 10 |

## 12. MINIMUM ARCHITECTURE (pipeline congelado)

```
CUSTOMER
   ↓                                [CURRENT] webhooks + /api/chat (docs 01, 09)
CONTEXT                            [MISSING como estado estructurado]
   ↓                                REPAIR → active_product_ids[] (conversation-scoped, §2)
PRODUCT SCOPE                      [PARTIAL — cascada resolveRecommendedProduct, first-match]
   ↓                                REPAIR → explicit-scope authority (INV-3) + ambigüedad→no-match (INV-4)
INTENT                             [MISSING — solo LLM latente (F14)]
   ↓                                REPAIR → señal de intención mínima para elegibilidad de media
MEDIA ELIGIBILITY                  [PARTIAL — MEDIA_INVARIANT existe, entrada no confiable (F5)]
   ↓                                REPAIR → evaluación de triggers DENTRO del scope (KEEP triggerMatches)
MEDIA CLAIM                        [PARTIAL — chat_media_dispatched por conversación; F8 lost-update]
   ↓                                REPLACE → claim atómico por asset (UNIQUE, DB decide ganador)
DISPATCH                           [CURRENT — adapters baileys/web]
   ↓                                KEEP
DELIVERY                           [MISSING — no existe delivered_at ni receipt]
                                    REPAIR → delivered_at + semántica (§6.1, Council D3)
```

Acciones por componente:

| Componente | Acción | Justificación |
|---|---|---|
| `triggerMatches()` / normalización / plural | **KEEP** | Lógica correcta para matching dentro de un scope (docs 05-TRIGGER-MATCHING) |
| Evaluación global trigger→producto (vía cascada first-match) | **DEPRECATE** | Fuente de contaminación F3/F4; el trigger nunca debe seleccionar producto |
| `resolveRecommendedProduct` cascada | **REPAIR** → solo como *fallback informativo*, nunca autoridad de scope | Doc 03, doc 20 |
| `conversations.media_sent_products[]` (read-then-write) | **REPLACE** → tabla de claims atómicos | F8 race condition, doc 10 |
| `chat_media_dispatched` UNIQUE (item, conversation) | **REPAIR** → misma tabla ampliada a claim por asset + delivered_at | F6, §6 |
| Structured context (`active_product_ids[]`) | **MISSING** → nuevo | F1, docs 02/17 |
| Intent estructurado | **MISSING** → señal mínima (no modelo completo) | F14, doc 20 |
| `delivered_at` / provider receipt | **MISSING** → nuevo | §6.1, doc 05 |
| Observabilidad de decisiones de media | **MISSING** → logging de decisión (no telemetría completa aún) | doc 20 §observabilidad |
| products.image_url fallback path | **DEPRECATE** | evidencia image-core #17 (doc 11) |

## 13. COUNCIL DECISION QUESTIONS (aisladas — solo lo que requiere humano)

Las decisiones ya demostradas por evidencia NO se preguntan. Estas seis requieren decisión explícita porque la evidencia es insuficiente o la semántica es comercial, no técnica:

| # | DECISIÓN | OPCIONES | ESTADO DE EVIDENCIA | RECOMENDACIÓN TÉCNICA |
|---|----------|----------|---------------------|------------------------|
| D1 | **TTL del contexto** (`active_product_ids[]`) | (a) vida de la conversación; (b) decaimiento por inactividad (¿cuánto?); (c) hasta cambio explícito | UNKNOWN — ningún doc aporta valor de TTL con evidencia; solo se demostró que el contexto indefinido puede activar triggers viejos (F4) | (a) para Phase 1 (mínimo riesgo); revisar con datos reales |
| D2 | **TTL de idempotencia** (¿un comprador puede volver a recibir el mismo asset?) | (a) nunca; (b) sí tras N días/semántica comercial; (c) solo con re-pedido explícito | UNKNOWN — semántica comercial, no técnica (doc 05, doc 21) | (a) default; bypass explícito "muéstramelo otra vez" (F18) |
| D3 | **Semántica de `delivered_at`** | (a) 2xx del send API; (b) receipt del provider (webhook); (c) ambos con estados separados | UNKNOWN — dependerá del proveedor (Baileys vs API); intentar destruir CLAIM=DELIVERY (doc 05 §attempted) | (c) claim ≠ dispatched ≠ delivered; delivered solo con receipt |
| D4 | **Identity hardening** cross-channel | (a) phone como clave canónica; (b) identity table con merges; (c) no hacer nada aún | UNKNOWN — docs 07/09 demuestran fragmentación pero no definen estrategia de unión | (a) mínimo; (b) solo si datos lo justifican |
| D5 | **Autoridad de extracción de explicit-scope** | literal name / alias / SKU / product_id / inferencia LLM | FACT: literal name es confiable; alias/SKU: UNKNOWN; inferencia LLM: NO confiable como autoridad (doc 20 §provenance) | literal name + SKU exacto; LLM solo sugerencia, nunca muta scope |
| D6 | **Unidad idempotente final** | customer × asset vs conversation × asset (vs compuestas) | FACT: conversation × asset es demostrable hoy; customer × asset requiere D4 resuelta | conversation × asset en Phase 1; migrar a customer × asset tras D4 |

## 14. IMPLEMENTATION BOUNDARY

### CAN IMPLEMENT (tras aprobación del Council)

**Phase 1 — core contract (sin dependencia de D3/D4):**
1. `active_product_ids[]` en conversaciones + mutación solo por explicit-scope (INV-1/3/4/5).
2. Evaluación de triggers dentro del scope; sin scope → sin media (§4 DEFAULT; §11 NO CONTEXT).
3. Tabla de claims atómicos por asset (reemplaza read-then-write de `media_sent_products[]`) — corrige F8.
4. Feedback al LLM del resultado de media (cerrar gap image-core #9 — no-claim-sin-ejecución).
5. Fallback conversation × asset como unidad idempotente (D6).
6. Logging de decisión de media (por qué sí / por qué no).

**Phase 2 — requiere decisiones D3/D4:**
7. `delivered_at` + ingesta de receipts del provider.
8. Identity hardening cross-channel (phone canónico).
9. Migración de unidad idempotente a customer × asset.
10. Señal de intención mínima estructurada.

**Future — NO construir todavía:**
- Comprensión semántica de triggers (image-core #7) — requiere LLM en el pipeline de media; alto riesgo sin observabilidad de Phase 1.
- Identidad multi-business — UNKNOWN, sin evidencia.
- TTLs automáticos — hasta D1/D2.
- Cualquier historial de intención/trigger/producto persistido — sin evidencia que lo obligue (§2).

### MUST NOT IMPLEMENT YET
- Cualquier cambio a prompts para "parchar" contexto (el LLM no debe ser la autoridad de scope — doc 20).
- Dedup customer-level antes de D4 (produciría falso dedup — §11 IDENTITY FRAGMENTATION).
- Estados extra (confidence, intent history, product history) sin evidencia (§2).

## 15. TERMINATION CHECKLIST (Loop 3)

- [x] 01–21 reconciliados (§1)
- [x] Contradicciones sin resolver: solo las marcadas UNKNOWN explícitas (§1, §13)
- [x] Final state model congelado (§2)
- [x] Context transition contract congelado (§3)
- [x] Trigger contract congelado (§4)
- [x] Product isolation invariants congelados (INV-1..INV-5, §5)
- [x] Idempotency unit: conversation × asset demostrable / customer × asset condicionada a D4 (§6, D6)
- [x] Delivery semantics: claim ≠ dispatched ≠ delivered; semántica final → D3 (§6.1, §7)
- [x] Identity boundary identificado (§8)
- [x] Clean Nails golden conversation validada; knowledge-vs-LLM separados (§9, F17)
- [x] Client-effort principle formalizado (§10)
- [x] Failure behavior definido (§11)
- [x] Council questions aisladas: exactamente 6 (§13)
- [x] Implementation boundary definido (§14)
- [x] Documento 22 creado
- [x] Sin código modificado / sin migrations / sin prompts / sin implementación / sin commits

---

**FIN DEL CONTRATO.** Entregable directo al COUNCIL. Próximo paso autorizado: evaluación del Council sobre D1–D6 y aprobación de Phase 1 (§14).






