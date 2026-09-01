# PRD — PARIDAD DE COMPORTAMIENTO EN CANALES (PRD MAESTRO DE MIA)

> **Documento maestro de objetivo arquitectónico.** Este PRD es parte de la memoria permanente del proyecto.
> Su propósito es preservar: el problema, el objetivo, los invariantes, la evidencia recopilada y el camino de decisión.
> No es una especificación implementable de arquitectura; los contratos definitivos requieren decisión del Concilio
> y quedan marcados como `REQUIERE DECISIÓN DEL CONCILIO`.

---

## 1. OBJETIVO ARQUITECTÓNICO

> **MIA Lab / Dashboard es la fuente de verdad de la configuración de comportamiento de MIA, y esa configuración
> se ejecuta de manera consistente en todos los canales soportados.**

El negocio configura y visualiza en MIA Lab / Dashboard:

- **Qué debe saber** MIA (Knowledge).
- **Qué puede hacer** (Behavior / Policy).
- **Qué debe hacer bajo determinadas condiciones** (Behavior / Policy condicional).
- **Qué medios puede utilizar** (Media).

El usuario debe poder confiar en la cadena:

```
Configuración aprobada en MIA Lab  →  Comportamiento real de MIA
```

independientemente del canal de entrada:

- Simulator
- WebChat (widget)
- WhatsApp
- Messenger
- Instagram
- cualquier canal futuro

**El canal NO redefine las reglas de negocio.** El canal solo transporta/renderiza la decisión canónica.

---

## 2. CONCEPTO CLAVE: LOS CUATRO PILARES + LA DECISIÓN CANÓNICA

El PRD establece como **conceptos separados** (no son intercambiables):

| Concepto | Definición | Ejemplo |
|----------|------------|---------|
| **Knowledge** | Qué sabe MIA y qué información puede utilizar. Free-form. | FAQ, tips, objeciones, procesos. |
| **Behavior / Policy** | Qué puede hacer MIA, cuándo, cuántas veces, bajo qué condiciones y qué evitar. | “Si el cliente quiere cancelar → ofrecer descuento una sola vez.” |
| **State** | Qué ocurrió previamente con el cliente/conversación. | descuento ya ofrecido; descuento rechazado; venta cancelada; producto anterior; nueva oportunidad comercial. |
| **Media** | Qué imagen/video/asset corresponde a una intención/producto/contexto. | imagen de Clean Nails para la intención de precio. |
| **Canonical Decision** | Decisión semántica común producida por Core antes de entrar al canal. Cada canal la transporta/renderiza. | producto elegido + media elegida + intención resuelta + respuesta. |

> **Canonical Decision** es un **posible** contrato arquitectónico.
> `REQUIERE DECISIÓN DEL CONCILIO` — NO está implementado ni debe implementarse sin aprobación.

---

## 3. PRINCIPIO DE PARIDAD (INVARIANTE)

> **Misma entrada + misma configuración + mismo estado → misma decisión de negocio, independientemente del canal.**

El canal **puede** cambiar:
- transporte
- formato
- capacidades de UI (botones, listas, quick replies)

El canal **NO puede** cambiar:
- la regla de negocio
- la decisión de producto/media
- la aplicación del estado

---

## 4. HALLAZGO CRÍTICO DE COMPORTAMIENTO (PROBLEMA ARQUITECTÓNICO DEMOSTRADO)

Comportamiento configurado en Dashboard (intención del negocio):

> “Si el cliente quiere cancelar, ofrecer descuento una sola vez.”

Estado real verificado con evidencia de código (`src/lib/sales/process.ts:179-257`):

1. Primer intento de cancelación → escribe sentinel `DISCOUNT_OFFERED_SENTINEL = '0001-01-01T00:00:01Z'`
   en `conversations.sales_cancelled_at` (`process.ts:34`).
2. Mensaje de “10% de descuento” es **string hardcodeado** (`process.ts:195-196`).
3. Segundo intento → procede cancelación real (`process.ts:258-298`).

**Problema:** la regla “descuento una sola vez” está repartida entre:
- `src/lib/sales/process.ts` (hardcoded 10% + sentinel)
- `src/lib/i18n/dictionaries/es.ts:345-356` (rejectionPivotRule, closingMaxAttempts, closingDeclineStop, closingTopicShift)
- `src/lib/reasoning/state.ts:20-34,147-165` (CLOSE_GATE / PUSH_PREVENTION)
- bloques condicionales del prompt `src/lib/ai/prompts.ts:346-441`
- `src/lib/sales/cancel.ts:30-78` (encargos tipados desde `business_sales_config`)

**Consecuencia (CONTRACT GAP):**
> Lo que el Dashboard dice que MIA debe hacer no necesariamente es lo que todos los canales ejecutan,
> porque parte de la decisión vive fuera de la configuración visible del Dashboard.

Otros comportamientos demostrados como no-configurables desde Dashboard (hardcodeados):
- “No insistir después del rechazo” → dict + estado + prompt.
- “Posteriormente pregunta por otro producto → nueva oportunidad” → prompts.ts + `customers.last_cancelled_order` (056) + `purgeCancelledOrderFromMemory` (`customer-memory.ts:194-245`).

**Incluir institucionalmente:**
> MIA NO es un chatbot. Es una plataforma multi-dominio donde el comportamiento se configura en MIA Lab
> y se ejecuta igual en todos los canales. (Ver AGENTS.md §1.)

---

## 5. EVIDENCIA RECOPILADA (NO SOLUCIONES)

### 5.1 Estado de la superficie de configuración (Dashboard / MIA Lab)

| Superficie | Qué configura | Persistencia | Ruta |
|------------|---------------|--------------|------|
| RulesManager | `sales_rules` (6 categorías: zones/payment/schedule/promotions/restrictions/escalation) | directa browser client (`RulesManager.tsx:77-108`, sin API route) | `src/components/dashboard/RulesManager.tsx`; `src/app/dashboard/assistants/[id]/rules/page.tsx` |
| KnowledgeCenter | `knowledge_items` (categorías business_info/faq/objection/process/tip) | API + `knowledge_versions` | `src/components/knowledge/KnowledgeCenter.tsx`; `api/knowledge/items/route.ts:160`; `api/knowledge/items/[id]/route.ts:135,199` |
| InstructionsManager | `ai_instructions` | API | `src/components/knowledge/InstructionsManager.tsx`; `api/knowledge/instructions/route.ts:80`; `...[id]/route.ts:90,140` |
| SalesConfigForm | `business_sales_config` (ask_address, ask_phone, allow_cancellation, cancellation_window_hours, confirmation_message, cancellation_message) | API | `src/components/sales/SalesConfigForm.tsx`; `api/sales/config/route.ts` → `upsertSalesConfig()` `knowledge.ts:357-363` |
| Catalog | `products` | directa browser client (`ProductFormDialog.tsx:59-60`) | `src/components/catalog/*`; import: `api/catalog/import/*` → `src/lib/import/engine.ts` |
| Training / corrections | `learning_events` + productos/knowledge/rules | API | `src/components/chat/TrainingChat.tsx`; `api/training/corrections/route.ts:52,76,92,106,120` |
| MIA Lab (laboratorio) | `lab_sessions`, knowledge/rule/instruction via teach | API | `src/app/dashboard/laboratorio/page.tsx`; `src/components/laboratorio/TeachModal.tsx`; `api/laboratorio/teach|sessions|evaluate|analyze|context` |
| Knowledge Studio | sugerencias de análisis → `knowledge_items`/`sales_rules` | API | `api/knowledge/suggestions/[id]/route.ts:66,87,102,120,137` |
| Experience | `experience_memory` + `knowledge_items` | API | `api/admin/experience/*`; `src/components/experience/SuggestionList.tsx` |
| Onboarding | businesses, stock, delivery, sales_config, channels | API | `api/onboarding/complete/route.ts:27-85`; legacy direct: `OnboardingWizard.tsx:162`, `ConversationalOnboarding.tsx:148-162` |
| Connections | `channel_connections`, `whatsapp_sessions` | API | `api/channels/connections/route.ts:87,173,229` |

**Gaps de superficie detectados:**
- No existe editor de `brand_identities` post-onboarding.
- `sales_rules` y `products` CRUD **bypassan API routes** (escritura directa browser) — inconsistencia de auditoría/gobernanza.
- No hay UI para configurar “ofrecer descuento una sola vez”, “no insistir tras rechazo”, “nueva oportunidad”.
- No hay UI para el contrato trigger `intent price` (ver §5.5).

### 5.2 Estado de la separación de conceptos en DB

| Kind | Table | Evidencia |
|------|-------|-----------|
| Información | `knowledge_items` | `supabase/migrations/001_initial_schema.sql:64-75` + 016 (image_url/trigger_condition), 024/039 (media_type), 029 (product_id), 031 (position) |
| Reglas de negocio | `sales_rules` | `001:82-93` (category, content, priority, is_active) |
| Instrucciones de comportamiento | `ai_instructions` | `001:98-108` (instruction, priority, source) |
| Decisiones aprendidas | `business_memory` | `008_business_memory.sql:8-33` (memory_type pattern/experience/insight/trend/decision; is_immutable) |
| Policy tipada | `business_sales_config` | `045_sales_config.sql:17-71` (únicos knobs estructurados) |
| Memoria comercial | `customers.memory` JSONB | `012_customer_memory.sql:7-8`; guard cross-conversación `customers.last_cancelled_order` (`056_cross_conversation_cancel_guard.sql:8-14`) |

**Conclusión:** existe separación estructural *información vs comportamiento*, pero **dentro de cada tabla el comportamiento es free-texto**:
`sales_rules.content` y `ai_instructions.instruction` son texto; el único dato machine-readable es `category`, `priority`, `source`, `is_active`.
No existe representación formal `condition → action`.

> `REQUIERE DECISIÓN DEL CONCILIO` — definir si se introduce un contrato estructurado `when → then`
> (condición, acción, límites de veces, ventana de tiempo, canal de aplicación).

### 5.3 Estado del ensamblado de contexto y prompt

`buildMasterPrompt()` (`src/lib/ai/prompts.ts:188-449`) fija el orden:
identidad → objetivo → idioma → personalidad → estilo comunicación → Reglas Fundamentales (7 hardcodeadas, `es.ts:221-240`) → formato → resolución de conflictos (AUTHORITY_TIER) → autonomía → política de cierre (umbrales 70/30 hardcodeados `prompts.ts:63-85`) → reglas misceláneas → información negocio → productos → reglas → instrucciones → conocimiento → memoria → lecciones → experiencia → acciones permitidas → guards de cancelación/postventa → capabilities → instrucción final.

`getBusinessContext()` (`src/lib/ai/knowledge.ts:29-109`) carga en paralelo: brand, products activos, sales_rules activas (priority DESC), ai_instructions activas, knowledge activos, business_memory activa, business_sales_config.
`getLandingContext()` (`knowledge.ts:134-230`) — versión landing: filtra productos al objetivo y knowledge/rules por “menciona otro producto”.

**Hoja de ruta de prioridad de autoridad (fuente de verdad):**
INMUTABLE → MANUAL → regla por prioridad → conocimiento revisado (CORRECCIÓN) → conocimiento reciente → patrones estadísticos (`prompts.ts:301-306`).

### 5.4 Estado del Core y paridad entre canales

**Arquitectura actual (real):**

```
Dashboard/Lab (UI)
  → DB (business_sales_config, products, knowledge_items, sales_rules, ai_instructions, business_memory)
  → getBusinessContext() / getLandingContext()        src/lib/ai/knowledge.ts
  → buildMasterPrompt()                                src/lib/ai/prompts.ts
  → processCore(input)                                 src/lib/runtime/core.ts:22
      ├── loadConversationContext (prompt)             core.ts:55 / src/lib/conversation/context.ts:64
      ├── resolveRecommendedProduct (producto)         core.ts:94 / src/lib/runtime/product-recommendation.ts:16
      ├── resolveScopeContext (scope)                  core.ts:117 / src/lib/runtime/context-scope.ts:145
      ├── resolveContextMedia (media canónica)         core.ts:128 / src/lib/runtime/context-media.ts:148
      └── executeAI (respuesta)                        core.ts:186/255 / src/lib/runtime/execute-ai.ts:140
  → CoreOutput { response, product, media, interactive, metadata }   src/lib/channels/types.ts:117
  → CHANNELS (solo transporte)
```

**Llamadores de `processCore`: solo 2**, ambos en `runtime.ts`:
- `processStreaming` → `runtime.ts:183-196` (mode stream)
- `processIncomingMessage` → `runtime.ts:263-275` (mode complete)

**Llamadores de `processStreaming`: 2**
- `api/chat/route.ts:59-68` (dashboard/Simulator; auth-gated)
- `api/widget/chat/route.ts:79-87` (WebChat widget)

**Llamadores de `processIncomingMessage`: 2**
- `api/channels/webhook/[channel]/route.ts:33` (web/whatsapp/messenger/instagram)
- `api/channels/baileys/webhook/route.ts:54` (hardcoded 'whatsapp')

**Fuera del Core (bypassean `processCore`):**
- `api/demo/chat/route.ts` — OpenAI directo (L115-153)
- `api/onboarding/chat/route.ts` — usa `executeAI` directo
- `api/laboratorio/{context,analyze,evaluate,teach,sessions}` — nada llama a `processCore`; `evaluate` usa `generateObject` directo
- `api/widget/close/route.ts` — `recordWidgetSale` sin core

**Matriz de entrada a Core por canal:**

| | Simulator | WebChat | WhatsApp |
|---|---|---|---|
| Entry | `LabChatWindow.tsx:141-151` POST `/api/chat` | `widget/page.tsx:53-61` → `ChatWindow.tsx:171-183` POST `/api/widget/chat` | bridge `mia-client.ts:30-52` POST `/api/channels/baileys/webhook` |
| Route | `api/chat/route.ts:21-84` | `api/widget/chat/route.ts:25-119` | `api/channels/baileys/webhook/route.ts:29-78` |
| Procesador | `processStreaming` | `WidgetAdapter` + `resolveCustomer` + `resolveConversation` + `processStreaming` | `BaileysAdapter` + **`handleCancellationWebhook`** + `processIncomingMessage` |
| Channel | `'simulation'` | **no pasado → cae a `'simulation'`** (`runtime.ts:191`) | `'whatsapp'` |
| landingContext | no | sí (`route:38,85`) | no |
| intentTag | no | `detectIntent(lastMessage.content)` (`route:41,86`) | `detectIntent(content, payload)` (`runtime.ts:236,272`) |
| requestType | `'simulation'` | `'live_customer'` (`route:84`) | `'live_customer'` (`runtime.ts:274`) |
| mode | `'stream'` | `'stream'` | `'complete'` (`runtime.ts:273`) |

**PARIDAD FÁCTICA (evidencia):**
- Los tres canales convergen en `processCore`. Producto/media/estado son canal-ag-nósticos dentro del core.
- **Divergencia 1:** el widget envía `channel:'widget'` en el body (`ChatWindow.tsx:179`) PERO la ruta widget NO lo propaga a `processStreaming` (`widget/chat/route.ts:79-87`) → cae al default `'simulation'` (`runtime.ts:191`). WebChat efectivamente ejecuta como `'simulation'` → canal `undefined` en prompt. WebChat y Simulator son idénticos en core (paridad accidental).
- **Divergencia 2:** WhatsApp tiene lógica adicional exclusiva: intercepción del webhook de cancelación (`baileys/route.ts:40-52` → `sales/process.ts:66-331`), quick replies/interactive (`runtime.ts:324-335`), tone + order capture (`prompts.ts:255-260`).
- **Divergencia 3:** adapters `web.ts:38-46` y `widget.ts:36-44` tienen `sendMessage` STUB — no hay transporte real para web/messenger/instagram.
- **Divergencia 4:** `CoreOutput.interactive` (types.ts:123) **nunca es poblado por processCore**; se calcula después solo para WhatsApp.

### 5.5 Estado del contrato de Media

- Decisión es **canónica dentro de processCore**: `resolveScopeContext` (`context-scope.ts:145`) → `resolveContextMedia` (`context-media.ts:148-389`, reglas C-1 L180-201, idempotencia scoped L399-471, claim atómico upsert `chat_media_dispatched` L342-354, guard SSRF L323-338, resend L229-259, recovery failed L267-300).
- Filtro de candidatos: `knowledge_items` con `image_url` y `trigger_condition` no null, `is_active`, scope: `product_id === uniqueScope` O `product_id === null` (genéricos) — solo cuando `scope.length === 1` (`context-media.ts:409-426`).
- Matching de trigger: `triggerMatches` (palabra con contorno + tolerancia plural, `media.ts:11-26`) O `intentMatchesTrigger` (solo `intent <tag>`, `media.ts:28-36`).
- **Contrato `intent price`: CERO usos** — 0 items en DB (SELECT verificado), 0 grep en repo. Contrato definido pero muerto/inusado.
- Delivery: widget/Simulator via SSE `data:{type:'media'}` (`stream-response.ts:31-35`) → render `<img>` (`ChatWindow.tsx:365-372`, `LabChatWindow.tsx:292-299`); WhatsApp via `sendReply(..., imageUrl)` + URL guard + fallback texto (`media-url.ts:101-116`, `session-manager.ts:661`).

### 5.6 Caso de prueba Clean Nails (EVIDENCIA, no solución)

**Caso:** `landingProductId = 96c33f39`, mensaje `"¿qué precio tiene?"` → pérdida de media.

**Investigación DB (solo lectura):**
- Asset scoped Clean Nails existe: `dfb91200-ca96-4dc0-9741-91cebd0081d9`, trigger `uñas, uña, clean nails, aparato`, `product_id = 96c33f39-0cf0-4b1b-994b-181acbef7c57`, activo.
- Asset genérico `76726901-…` trigger `Precio, fotos` → **sí matchea** `que precio tiene` (con el scope correcto).
- Asset genérico `647db1fd-…` trigger `mostrar cuando la gente pida precio del clean nails` → **NO matchea** (matching de frase entera con contorno de palabra).
- `0` items con trigger `intent price`.
- UUID completo resuelve; short-id `96c33f39` → **PostgreSQL 22P02 invalid input syntax for type uuid** (ejecutado contra DB real).

**Cadena de pérdida (FIRST LOSS POINTS):**
1. `knowledge.ts:178-185` — `getLandingContext` lanza `LANDING_PRODUCT_NOT_FOUND` si short-id no iguala `products.id`.
2. `context-scope.ts:164-171` — `.eq('id', shortId)` → 22P02; `if (product)` nunca evalúa `product.error` → error silencioso → sin landing-hit → `source:'none'`, `messageScope:[]`.
3. `context-media.ts:422-426,434` — scope vacío → `uniqueScope=null` → `inScope=[]` → `matches.length===0` → `eligible:false`.

**Conclusiones de evidencia:**
- La arquitectura de media NO era el problema principal: con UUID completo, el asset genérico de precio puede hacer match.
- El trigger del asset scoped de Clean Nails no contiene la palabra precio → por matching de palabra no matchea (issue de DATA).
- El problema reveló fragilidad en la resolución de contexto/provenance del UUID.

**DISCIPLINA:** No diseñar una solución específica para Clean Nails. La solución debe funcionar para todos los productos.
Clean Nails es únicamente un caso de prueba.

---

## 6. HALLAZGOS ADICIONALES (BUGS/EVIDENCIA)

| # | Hallazgo | Clasificación | Evidencia |
|---|----------|---------------|-----------|
| 1 | Short-id → `getLandingContext` throw sin fallback | **BUG / CONTRACT GAP** | `knowledge.ts:178-185` |
| 2 | `context-scope.ts` ignora `product.error` (22P02) | **BUG** | `context-scope.ts:164-171` |
| 3 | Widget no propaga `channel:'widget'` → cae a `'simulation'` | **CHANNEL DIVERGENCE** | `widget/chat/route.ts:79-87` vs `ChatWindow.tsx:179` |
| 4 | WhatsApp único canal con cancelación+descuento+interactive+tone | **CHANNEL DIVERGENCE** | `baileys/route.ts:40-52`, `runtime.ts:324-335`, `prompts.ts:255-260` |
| 5 | Adapters web/messenger/instagram transporte STUB | **CHANNEL DIVERGENCE** | `web.ts:38-46`, `widget.ts:36-44` |
| 6 | `CoreOutput.interactive` nunca poblado por core | **CHANNEL DIVERGENCE** | types.ts:123 |
| 7 | `knowledge.ts:243` select columna `content` inexistente en `knowledge_items` | **BUG** | `knowledge.ts:243` |
| 8 | Media canónica en core para los 3 canales | **NO GAP** | core.ts:117-138 |
| 9 | Lógica behavior hardcodeada (descuento/no-insistir/nueva-oportunidad) | **CONTRACT GAP** | `sales/process.ts`, `es.ts:345-356`, `prompts.ts:366-441` |

---

## 7. CRITERIOS DE ACEPTACIÓN — MATRIZ DE ACCEPTANCE TESTS

> Cada caso debe producir **la misma decisión de negocio** en Simulator, WebChat y WhatsApp.
> Los acceptance tests definen el “deber ser”; implementarlos es posterior (no esta misión).

### CASO A — Precio
- Input: `¿Qué precio tiene?` con producto X configurado (producto en el catálogo, conocimiento/media opcional).
- Debe producirse misma decisión de negocio en Simulator, WebChat y WhatsApp, incluyendo media cuando esté configurada.

### CASO B — Testimonial
- Cliente solicita testimonial.
- Si existe media configurada para esa intención → debe seleccionarse consistentemente en todos los canales.

### CASO C — Cancelación
- Cliente quiere cancelar.
- Regla: ofrecer descuento **una sola vez**.
- Nunca: repetir indefinidamente el descuento.

### CASO D — Rechazo
- Cliente rechaza el descuento.
- Regla: aceptar cancelación. No volver a insistir sobre esa misma oportunidad.

### CASO E — Nueva oportunidad
- Posteriormente el cliente pregunta por otro producto.
- Regla: tratarlo como nueva oportunidad comercial. No revivir automáticamente la venta cancelada.

### CASO F — Paridad
- Misma configuración + mismo estado + mismo mensaje → decisión de negocio equivalente en todos los canales.

---

## 8. ROADMAP POR FASES

> Código de colores: cada fase declara objetivo, entradas, tareas, evidencia requerida, acceptance criteria,
> condición de STOP y qué requiere autorización posterior.

### FASE 0 — Preservación / Baseline
- **Objetivo:** congelar el estado actual (checkpoint Subaru + governance) antes de cualquier trabajo.
- **Entradas:** HEAD actual `70425155`, untracked conocido `workshop/subaru/gate-status-enrich.json`.
- **Tareas:** `git status` limpio/declarado; `npx tsx workshop/subaru/cli.ts freezes/preflight`;
  `npx tsx workshop/governance/cli.ts classify` para el trabajo nuevo.
- **Evidencia requerida:** commit de checkpoint + manifest governance + hash.
- **Acceptance:** `revive` reporta checkpoint válido; governance `validate` aprueba.
- **STOP:** no pasar a Fase 1 sin checkpoint freeze + governance aprobado.
- **Autorización posterior:** para cada Fase, nuevo classify.

### FASE 1 — Auditoría (dónde vive cada decisión)
- **Objetivo:** inventariar, con file:line, DÓNDE vive cada decisión: Dashboard, DB, Core, prompts, channel adapters, código hardcoded.
- **Entradas:** codebase HEAD, este PRD, auditorías previas (secciones 4-6).
- **Tareas:** por cada decisión (producto, media, descuento, no-insistir, nueva-oportunidad, intent, scope): localizar dueño real.
- **Evidencia requerida:** matriz decisión→ubicación→línea→¿configurable?→¿paritario?.
- **Acceptance:** cobertura de las decisiones listadas en §7 + hallazgos clasificados (DATA/BUG/CONTRACT/CHANNEL).
- **STOP:** una decisión sin ubicación demostrable bloquea el cierre de esta fase.
- **Autorización posterior:** los hallazgos de esta fase alimentan Fase 2.

### FASE 2 — Contratos / Concilio
- **Objetivo:** definir formalmente los contratos: Knowledge, Behavior/Policy, State, Media, Canonical Decision, Channel.
- **Entradas:** inventario de Fase 1 + este PRD.
- **Tareas:** redactar ADR(s). Todo cambio de arquitectura marcado `REQUIERE DECISIÓN DEL CONCILIO`.
- **Evidencia requerida:** ADR aprobado por concilio (TASK compleja) + governance approvals secuenciales.
- **Acceptance:** contrato aprobado y documentado. Nada implementado.
- **STOP:** sin ADR aprobado NO se implementa nada (regla general: nadie salta de auditoría a implementación).
- **Autorización posterior:** aprobación explícita del Concilio para Fase 3.

### FASE 3 — Implementación (solo lo aprobado)
- **Objetivo:** mover a MIA Lab / contratos SOLAMENTE lo aprobado por el Concilio.
- **Entradas:** ADR aprobado, manifest governance, checkpoint Subaru con plan congelado.
- **Tareas:** implementar por pasos atómicos con `mark` de Subaru; cambios de media/paridad sin romper canales.
- **Evidencia requerida:** cada paso + gates de calidad (lint, build, tests).
- **Acceptance:** comportamientos aprobados ejecutándose desde configuración; sin regresión en canales.
- **STOP:** cualquier divergencia de canal sin resolver bloquea.

### FASE 4 — Godzilla (adversarial)
- **Objetivo:** intentar romper paridad, reglas, estado, media, cancelación, nuevas oportunidades, diferencias entre canales.
- **Entradas:** implementación de Fase 3.
- **Tareas:** vectores adversariales por archivo modificado; prompt injection si AI modificada; activar y medir.
- **Evidencia requerida:** reporte Godzilla con file:line; CRITICAL/HIGH bloquean release.
- **Acceptance:** sin findings CRITICAL/HIGH; MEDIUM documentados.
- **STOP:** findings CRITICAL/HIGH abiertos.
- **Autorización posterior:** release gate tras cierre.

### FASE 5 — Deploy
- **Objetivo:** deploy controlado + evidencia.
- **Entradas:** QA+Godzilla aprobados, git limpio.
- **Tareas:** commit, push, verificación MCP (HTTP 200, consola), según sección Release de AGENTS.md.
- **Acceptance:** URL live, sin errores de consola/red.
- **STOP:** cualquier gate sin pasar.

### FASE 6 — E2E Multicanal
- **Objetivo:** validar Simulator ≈ WebChat ≈ WhatsApp (y luego Messenger/Instagram/futuros).
- **Entradas:** deploy live + fixtures multi-canal.
- **Tareas:** Playwright + DevTools MCP; misma matriz de casos §7 en cada canal.
- **Acceptance:** matriz §7 verde en los canales soportados y comparación de CoreOutput.
- **STOP:** divergencia observable en una regla de negocio.

### FASE 7 — Checkpoint
- **Objetivo:** crear checkpoint completo para continuidad multi-máquina.
- **Entradas:** Fases 1-6 completadas + evidencias.
- **Tareas:** Subaru `freeze/complete` con plan; governance `complete`; commit + push.
- **Acceptance:** `subaru: checkpoint <id> - completado`, remoto sincronizado.
- **STOP:** sin `--confirm-gates` no se cierra.

### STOP CONDITIONS GENERALES
> Ningún agente debe saltar automáticamente de auditoría a implementación.

---

## 9. REQUIERE DECISIÓN DEL CONCILIO (MARCADORES)

- Definir si se introduce contrato estructurado `when → then` para Behavior/Policy ($5.2).
- Definir Canonical Decision como contrato transpirable por canales (§2, ya prohibido implementar en esta misión).
- Activar / documentar contrato `intent price` en MIA Lab (badge de trigger por intent) vs alternativas (§5.5).
- Definir el contrato de Media respecto a “media por intención/producto/contexto” y no solo por keyword (§5.5).
- Definir quién valida/expande `productId` de landing (provenance del UUID) (§5.6).
- Definir política de configuración → ejecución (dashboard = fuente de verdad) y si implica mover lógica de prompts/código a datos (§4).
- Definir contrato de Channel (transporte vs negocio) y estandarización de `channel` hacia Core (§5.4).
- Biggers sobre bugs §6 #1,#2,#7 (se pueden clasificar como fixes mínimos de robustez — sin ADR — si el Concilio así lo autoriza).

---

## 10. CURRENT STATE

| Campo | Valor |
|-------|-------|
| Versión del PRD | 1.0 |
| Fecha | 2026-09-01 |
| Fase actual | **Fase 0 (preservación) — PRD creado; ninguna fase siguiente iniciada** |
| Último hallazgo | Caso Clean Nails: host `96c33f39` (short-id) → PostgreSQL 22P02 → `context-scope.ts` ignora `product.error` → sin scope → sin media. Con UUID completo el caso resuelve. |
| Decisiones pendientes | Ver §9 (marcadores `REQUIERE DECISIÓN DEL CONCILIO`) |
| Riesgos | (1) divergencia WhatsApp vs resto (cancelación/tone/interactive); (2) widget cae a channel `simulation`; (3) contrato `intent price` inerte; (4) behavior hardcodeada en código/prompt = CONTRACT GAP; (5) adapters web/messenger/instagram sin transporte; (6) bugs puntuales §6. |
| Modificaciones permitidas | SOLO este PRD. Ninguna otra modificación (código, DB, prompts, APIs, arquitectura). |
| Último commit conocido | `7042515` (docs: regenerate MASTER.md at ec71fbb) — HEAD en rama main, sincronizado con origin/main |
| Untracked conocido | `workshop/subaru/gate-status-enrich.json` (NO modificar) |
| Siguiente acción autorizable | Fase 0 completa → solicitar al Concilio autorización para Fase 1 (Auditoría). Nada automatizado. |

---

## 11. NOTA DE CONTINUIDAD (LEER ANTES DE CONTINUAR)

Abriendo este repositorio en otra máquina/agente:
1. **Lee AGENTS.md** §23 (governance) y §24 (Protocolo Subaru).
2. Ejecuta: `npx tsx workshop/subaru/cli.ts preflight` (debe ser SAFE_FOR_NEW_MISSION o REVIVE_REQUIRED).
3. Lea este PRD completo.
4. Verifica HEAD == `7042515` y estado git declarado (untracked `workshop/subaru/gate-status-enrich.json`).
5. Ejecuta governance `classify` antes de tocar cualquier archivo.

**Qué construimos:** MIA como plataforma multi-dominio (AGENTS.md §1), donde MIA Lab / Dashboard es la fuente de verdad de comportamiento y todos los canales ejecutan la misma decisión canónica.

**Por qué:** el caso Clean Nails + la auditoría demostraron que parte de la decisión vive fuera de la configuración visible y los canales divergen.

**Qué está mal actualmente:** CONTRACT GAP (configuración visible ≠ comportamiento ejecutado), CHANNEL DIVERGENCE (WhatsApp vs resto, widget cae a simulation, stubs de transporte), y bugs puntuales en resolución de contexto/media.

**Qué está demostrado:** evidencia en secciones 4-6 con file:line y verificaciones SELECT ejecutadas.

**Qué falta decidir:** §9 (contratos, Canonical Decision, intent price, provenance del UUID, política configuración→ejecución).

**Dónde continuar:** Fase 1 — Auditoría exhaustiva decisión→ubicación (tras autorización del Concilio).