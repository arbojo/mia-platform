# MIA Platform — Línea Base Arquitectónica

> **Fecha:** 2026-07-30
> **Tipo:** Documento de auditoría / línea base. Sin propuestas de implementación.
> **Regla:** Si algo ya existe, primero se reutiliza. Solo se construye cuando realmente hace falta.
> **Método:** Auditoría sobre el código en `C:\Users\david\mia` (working tree). Sin cambios realizados.

---

## 1. Resumen ejecutivo

MIA Platform es una aplicación **Next.js 16 (App Router) / React 19 / TypeScript / Supabase / OpenAI (`gpt-4o-mini`)**. Es una plataforma de asistentes de ventas multi-tenant en la que un negocio ("business") entrena a un asistente IA con conocimiento, productos y reglas, y luego lo opera en conversaciones.

**Hallazgo central:** el proyecto ya implementó la gran mayoría de las capacidades de una plataforma MIA. El problema no es "qué construir", sino **qué está desconectado, sin terminar o muerto**. El código tiene ~60 API routes, ~90 componentes, un runtime de conversación real y 15 migraciones de esquema; pero múltiples flujos están parcialmente cableados, varios componentes y endpoints están huérfanos, y hay trabajo sin commitear (safety, conversaciones, intelligence) que es de hecho el trabajo más reciente.

Estado global por área:

| Área | Estado | % |
|---|---|---|
| Dashboard (Centro de Mando) | Funcional | ~85 |
| Knowledge Studio (Pensamiento) | Funcional | ~90 |
| Knowledge / Memoria (CRUD + aprendizaje de archivos) | Funcional | ~85 |
| Business Memory (escritura/análisis) | Parcial (dormant) | ~70 código / ~30 accesible |
| Laboratorio (simulación) | Parcial | ~40 |
| Channels / Conexiones | Parcial | ~60 |
| Runtime / Conversation Layer | Funcional | ~80 |
| Canon (AI Instructions) | Funcional | ~80 |
| Safety | Maduro como librería, parcialmente cableado | ~80 lib / ~50 integrado |
| Edition (gating free/premium) | Scaffold | ~15 |
| Signals | Scaffold | ~15-30 |
| Conversaciones (Relaciones) | Funcional | ~85 |

---

## 2. Stack y estructura

- **Framework:** Next.js 16.2 (App Router), `next.config.ts`, middleware reemplazado por `src/proxy.ts` (refresca tokens de auth).
- **UI:** React 19, Tailwind v4, shadcn/ui (`src/components/ui/*`), `lucide-react`.
- **DB/Auth:** Supabase (PostgreSQL + RLS). Email/password + Google OAuth vía `@supabase/ssr`.
- **AI:** OpenAI `gpt-4o-mini` vía Vercel AI SDK (`ai`, `@ai-sdk/openai`) + SDK `openai` para el path no-streaming.
- **Tests:** Playwright (`tests/public.spec.ts` + `tests/safety/*` sin commitear).
- **4 clientes Supabase** en `src/lib/supabase/`: `client` (browser), `server` (RSC, lee con RLS), `admin` (escribe saltando RLS), `route-handler` (Route Handlers; propaga cookies).

### Estructura de directorios clave

```
src/
├── app/
│   ├── (auth)/                 # login, signup, callback
│   ├── api/                    # ~60 route handlers
│   │   ├── chat/               # endpoint streaming (dashboard + laboratorio)
│   │   ├── channels/           # connections + webhook/[channel]
│   │   ├── knowledge/          # items, instructions, analyze, learn, suggestions
│   │   ├── laboratorio/        # context, sessions, analyze, evaluate, teach
│   │   ├── training/           # corrections, lessons
│   │   ├── business/           # memory, skills, weekly-report, product-intelligence (huérfanas)
│   │   ├── conversations/      # [id]/outcome, [id]/archive
│   │   ├── coaching/           # recommendations
│   │   ├── onboarding/         # chat
│   │   └── demo/               # chat (demo público)
│   ├── dashboard/              # home + knowledge + knowledge-studio + laboratorio + conversations + connections + assistants + onboarding
│   └── demo/                   # demo público
├── components/                 # chat, connections, conversations, dashboard, knowledge, laboratorio, onboarding, signals, studio, training, ui
├── lib/
│   ├── ai/                     # client, prompts, knowledge, readiness, maturity, memory, skills, extract, cost, weekly-report, product-intelligence, recommendation-engine, usage-report, confidence
│   ├── channels/               # types, identity, gateway, adapters/{web,whatsapp}
│   ├── conversation/           # context.ts (ensamblado del prompt)
│   ├── runtime/                # runtime.ts (motor de conversación) + types.ts
│   ├── safety/                 # validator, triggers, checks, retry, degradation, events, learning-analyzer
│   ├── dashboard/              # queries, conversations, sales-intelligence
│   ├── system/                 # edition.ts
│   ├── supabase/               # 4 clientes
│   └── types/index.ts          # tipos de BD escritos a mano
├── proxy.ts
├── (auth.ts, utils.ts)
supabase/migrations/            # 001 a 015 (012-015 sin commitear)
scripts/                        # seed, auditoría, memoria, stress/scale tests
tests/                          # public.spec.ts + tests/safety (sin commitear)
workshop/                       # prototipo aislado (council/memory, NO conectado a src/)
docs/                           # ADRs (001-009), features, audits, architecture, etc.
```

**Nota de git:** hay cambios sin commitear (working tree sucio): `src/lib/safety/`, `src/app/api/coaching/`, `src/app/api/conversations/`, `src/components/conversations/`, `src/lib/dashboard/conversations.ts`, `src/lib/dashboard/sales-intelligence.ts`, `src/lib/ai/recommendation-engine.ts`, `src/lib/runtime/runtime.ts` (modificado), `migrations 012-015`, `tests/safety/`. Esto es lo más reciente del proyecto y no está respaldado en el repositorio.

---

## 3. Módulos — estado detallado

### 3.1 Dashboard (Centro de Mando)

- **Responsabilidad:** Home del módulo. Muestra el estado del negocio, actividad de hoy, habilidades/readiness, guía del dueño, sugerencias, timeline de conversaciones, reporte diario y tarjetas de acceso a los demás módulos.
- **Estado:** Funcional (~85%).
- **Detalle:** Server Component `src/app/dashboard/page.tsx` + `layout.tsx` (guard de auth + shell). Orquestador server-side `src/lib/dashboard/queries.ts` (`getDashboardData`, ~25 queries por carga). Los datos son reales (Supabase), no mocks. ~15 componentes renderizados con datos reales. Layout usa Sidebar, TopBar, OnboardingBanner, AtmosphereProvider, MIAIndicator.
- **Dependencias:** usa `lib/ai/readiness`, `lib/ai/skills`, `lib/ai/maturity`, `lib/ai/memory`, `lib/ai/recommendation-engine`, `lib/ai/weekly-report`, `lib/ai/product-intelligence`; clientes supabase (server/admin); señales visuales (`signals/SignalIndicator`, `signals/MIAInbox`). La ruta `POST /api/coaching/recommendations` es la única API que la UI llama.
- **APIs:** ninguna propia; consume server-side. Las 5 rutas `/api/business/*` existen pero están huérfanas.
- **Reutilizable:** query layer completo (`getDashboardData` + 15 leaf queries), shell (sidebar/layout/atmosphere/theme), ~15 tarjetas de datos reales.
- **Falta:** cablear `MIAInbox` a la tabla `signals` (hoy mock hardcodeado); pasar datos reales en vez de valores hardcodeados (`trend`, `recentLessons`, `status` de ModuleCard); decidir destino de 10 componentes huérfanos y 5 rutas huérfanas; corregir 8 queries sin scope de `business_id` (ver §6.1).

---

### 3.2 Knowledge Studio (Pensamiento)

- **Responsabilidad:** Análisis de la base de conocimiento de un negocio vía LLM: scores (overall/completeness/consistency/readiness), gaps, conflictos, issues de readiness, y sugerencias aprobables por el dueño.
- **Estado:** Funcional (~90%).
- **Detalle:** `src/app/dashboard/knowledge-studio/page.tsx` (server) + `components/studio/*` (`KnowledgeStudio`, `AnalysisReport`, `ReadinessScore`, `SuggestionCard`). Flujo: `POST /api/knowledge/analyze` → inserta `knowledge_analysis_reports` → LLM `generateObject` → guarda scores/gaps/conflicts/suggestions en `knowledge_suggestions` → `PATCH /api/knowledge/suggestions/[id]` aprueba/rechaza (al aprobar crea `knowledge_items` o `sales_rules`).
- **Dependencias:** `lib/ai/client`, `lib/ai/knowledge`, auth, tablas `knowledge_analysis_reports`, `knowledge_suggestions`, `knowledge_items`, `sales_rules`.
- **Reutilizable:** TODO el flujo de análisis es reutilizable. Es el módulo más completo.
- **Falta:** tracking de tokens (`tokens_used: 0`, `cost: 0` hardcodeados — no usa `recordAiUsage`); manejo del caso de 0 reportes (el `.single()` puede hacer 500 si no existe ningún análisis aún).

---

### 3.3 Knowledge / Memoria (CRUD + aprendizaje de archivos)

- **Responsabilidad:** Gestión de la base de conocimiento (`knowledge_items`), instrucciones IA (`ai_instructions`) y aprendizaje a partir de archivos subidos (PDF/imagen/texto/CSV → extracción → revisión/aprobación).
- **Estado:** Funcional (~85%).
- **Detalle:** `src/app/dashboard/knowledge/page.tsx` → `components/knowledge/KnowledgeCenter` con tabs: `KnowledgeManager` (CRUD knowledge_items), `InstructionsManager` (CRUD ai_instructions con bump de prioridad), `FileUpload` → `LearningReport` (aprobación de productos/conocimiento/reglas extraídos). Ruta `POST /api/knowledge/learn` usa `pdf-parse`, visión OpenAI y `lib/ai/extract.ts`. `GET /api/knowledge/learn/[id]` y `PATCH` para aprobaciones.
- **Dependencias:** `lib/ai/extract`, `lib/ai/knowledge`, `lib/ai/client`; tablas `knowledge_items`, `ai_instructions`, `learning_reports`, `products`, `sales_rules`.
- **Reutilizable:** pipeline de extracción (texto → objetos zod → DB) y toda la UI de CRUD.
- **Falta:** las aprobaciones del `LearningReport` no crean `learning_events` (invisible para readiness/entrenamiento); el estado de aprobación es efímero (solo en el front). CRUD no usa las rutas GET (`items`/`instructions`) — lee de DB server-side.

---

### 3.4 Business Memory

- **Responsabilidad:** Memoria de largo plazo del negocio: `business_memory` (patrones, observaciones), `mia_skills` (niveles de habilidad), `learning_velocity_snapshots` (velocidad de aprendizaje).
- **Estado:** Parcial (~70% código, ~30% accesible). **El loop de escritura está dormido.**
- **Detalle:** `lib/ai/memory.ts` (495 líneas) implementa `analyzeConversationPatterns`, `upsertBusinessMemory`, `calculateSkillLevels`, `calculateLearningVelocity`. **Pero solo es alcanzable vía las rutas huérfanas `POST/GET /api/business/memory*`, que nadie llama** (sin cron, sin scheduler). La lectura sí está cableada: `getBusinessContext` inyecta `business_memory` en el prompt de chat y el dashboard lee memoria/habilidades/velocidad.
- **Dependencias:** tablas `business_memory`, `mia_skills`, `learning_velocity_snapshots`, `messages`, `learning_events`.
- **Reutilizable:** el módulo de memoria completo (funciones listas, solo falta un disparador).
- **Falta:** un disparador programado o una ruta real para ejecutar el análisis de patrones → memoria → habilidades → velocidad. También `lib/ai/confidence.ts` (decaimiento temporal de confianza) existe pero nadie lo importa.

---

### 3.5 Laboratorio

- **Responsabilidad:** Simulador de ventas. El dueño entrena a su asistente en modo simulación (Normal/Indeciso/Complicado/Cliente Exigente o escenarios), debe obtener análisis de respuesta, evaluación de sesión, coaching y flujo "enseñar" (correcciones a la knowledge base).
- **Estado:** Parcial (~40%). El chat de simulación funciona; el loop de evaluación/coaching/teach está roto o inalcanzable.
- **Detalle:** `src/app/dashboard/laboratorio/page.tsx` (server) → `components/laboratorio/LaboratorioClient`. El chat llama a `/api/chat` con `requestType: 'simulation'`.
- **Problemas verificados:**
  - `currentConversationId` nunca se asigna (`LaboratorioClient.tsx:53`) → `SessionEvaluation` inalcanzable, las conversaciones de laboratorio nunca se persisten, las sesiones quedan siempre `status='running'`, `score=null`.
  - `/api/laboratorio/analyze` está roto: el caller de coaching envía `{userMessage, assistantResponse, mode}` pero la ruta solo lee `{messageId, assistantId}`; el otro caller envía un `crypto.randomUUID()` que nunca existe → `ResponseAnalysis` crashea en render (`analysis.reasoning.length` sobre `undefined`).
  - `onTokensUsed` nunca se invoca → `UsageBar` siempre $0; `messageCount` nunca se incrementa.
  - El flujo "enseñar" (`TeachModal`) es inalcanzable.
  - `handleExport` exporta estadísticas en cero.
- **Dependencias:** `api/chat`, `lib/ai/knowledge` (context), tablas `lab_sessions`, `ai_usage`.
- **Reutilizable:** toda la UI de simulación (11 componentes), el `evaluate` route (~85% sólido aunque inalcanzable), el `teach` route (~90% sólido), `ContextPanel`.
- **Falta:** unir chat ↔ sesión ↔ evaluación (conversationId real), arreglar `analyze` (contrato + shape), disparar `onTokensUsed`, y decidir si `LearningReport`/teach debe crear `learning_events`.

---

### 3.6 Channels / Conexiones

- **Responsabilidad:** Capa de canales: abstracción de adapters (`ChannelAdapter`), gateway de canales, identidad de clientes (`resolveCustomer`), webhook de entrada, y UI de conexiones.
- **Estado:** Parcial (~60%). El ingreso webhook funciona a nivel de DB; **ningún canal puede enviar mensajes de salida**.
- **Detalle:**
  - `lib/channels/types.ts`: contrato de mensajes (`NormalizedMessage`, `OutgoingMessage`, `ChannelAdapter`) — real y usado.
  - `lib/channels/gateway.ts`: registry; **`messenger` e `instagram` son aliases del WebChatAdapter**.
  - `lib/channels/adapters/web.ts`: `sendMessage` es no-op con ID fabricado; `validateWebhook` siempre `true`.
  - `lib/channels/adapters/whatsapp.ts`: **parsing real del shape de WhatsApp Cloud API**, pero `sendMessage` es stub (`'whatsapp-stub-…'`), `validateWebhook` tiene un TODO (siempre `true`). No existe ninguna llamada a `graph.facebook.com`.
  - `POST /api/channels/webhook/[channel]`: recibe → valida (stub) → `processIncomingMessage` (runtime) → persiste mensajes/channel_messages/conversación → **devuelve la respuesta como JSON HTTP; `adapter.sendMessage` nunca se invoca en todo el repo**.
  - `GET` del webhook: verificación WhatsApp `hub.*` compara contra `WHATSAPP_VERIFY_TOKEN`, que **no está en `.env.example`**.
  - `POST /api/channels/connections`: nunca guarda `credentials` → la resolución por `phone_number_id` es inalcanzable.
  - UI: `ConnectionsManager` (listar/crear/borrar conexiones), gateado por `canUseWhatsApp()`.
- **Dependencias:** runtime (`processIncomingMessage`), `lib/channels/identity`, tablas `channel_connections`, `channel_messages`, `customers`, `messages`, `conversations`.
- **Reutilizable:** abstracción de canales, identity, webhook ingress, UI de conexiones.
- **Falta:** implementar el envío real (`sendMessage`) y la verificación de webhook; guardar `credentials`; decidir el destino de `assistant_channels` (tabla paralela de la migración 001, escrita por onboarding, nunca leída); definir el contrato de mensajes compartido (hoy `NormalizedMessage` y `WireMessage` están duplicados).

---

### 3.7 Runtime / Conversation Layer

- **Responsabilidad:** Motor de conversación. Dos puntos de entrada: `processStreaming` (UI dashboard/laboratorio vía `/api/chat`) y `processIncomingMessage` (canales vía webhook).
- **Estado:** Funcional (~80%). Es un motor **procedural** (no una máquina de estados).
- **Detalle:** `src/lib/runtime/runtime.ts`:
  - `processStreaming`: `streamText` (AI SDK) → `trackAiUsage` → valida safety (solo loguea, no retry) → persiste mensajes solo si hay `conversationId`.
  - `processIncomingMessage`: resuelve connection → customer (`identity.ts`) → conversation (`resolveConversation`) → inserta mensaje → `loadConversationContext` → history (últimos 20) → `chat.completions.create` no-streaming → **safety full loop (validate + retry + degradation + log)** → persiste mensaje + 2 `channel_messages` → actualiza `customers.last_interaction`.
- **Dependencias:** `lib/ai/client`, `lib/ai/cost`, `lib/conversation/context`, `lib/channels/identity`, `lib/safety`, supabase admin. Solo lo importan `api/chat/route.ts` y el webhook.
- **Reutilizable:** el runtime completo es el corazón de la plataforma; no reconstruirlo.
- **Falta:** el path streaming no persiste historial real de `/api/chat` si no llega `conversationId` (los chats del dashboard no quedan en `messages` salvo en training); `last_interaction` solo se actualiza en el path de canales; `_adapter` no se usa; el "último mensaje" se toma por posición del array (puede tomar un mensaje de asistente como si fuera de usuario).

---

### 3.8 MIA Core (ensamblado)

- **Responsabilidad:** "Cerebro" = ensamblado de datos + prompt canónico.
- **Estado:** No existe un módulo único llamado "core". El core es un ensamblado de 4 piezas:
  1. `lib/ai/knowledge.ts` → `getBusinessContext` (datos: brand/products/rules/instructions/knowledge/memory/lessons).
  2. `lib/ai/prompts.ts` → `buildMasterPrompt` (el prompt canónico, hardcodeado en español).
  3. `lib/conversation/context.ts` → `loadConversationContext` (cablea datos + prompt + safety context; es la pieza más cercana a un "core").
  4. `lib/runtime/runtime.ts` → motor.
- **Detalle:** El ensamblado se duplica en 3 lugares: `context.ts` (producción, incluye memory + lessons), `api/laboratorio/context/route.ts` (sin memory/lessons), `api/demo/chat/route.ts` (sin memory/lessons, sin context, llama `buildMasterPrompt` directo). Solo `context.ts` es el ensamblado completo.
- **Reutilizable:** `getBusinessContext` + `buildMasterPrompt` + `loadConversationContext` = el core que debe reutilizarse siempre.
- **Falta:** unificar el ensamblado (evitar que demo/laboratorio construyan prompts distintos) y decidir si "MIA Core" debe ser un módulo explícito o seguir siendo el ensamblado actual.

---

### 3.9 Canon (AI Instructions)

- **Responsabilidad:** Reglas de comportamiento del asistente, separadas de la base de conocimiento. Se inyectan en el prompt principal.
- **Estado:** Funcional (~80%).
- **Detalle:** Tabla `ai_instructions` (migración 001). Leída en `getBusinessContext` (`is_active=true`, orden `priority desc`) e inyectada por `buildMasterPrompt`. UI: `InstructionsManager` (CRUD + bump de prioridad). Knowledge Studio puede sugerir instrucciones.
- **Reutilizable:** completo.
- **Falta:** nada esencial; alinearlo con el modelo "Canon" si se quiere (hoy es solo una tabla + CRUD).

---

### 3.10 Safety

- **Responsabilidad:** Validación de respuestas del asistente (precio, entrega, garantía, descuentos, memoria inmutable), retry seguro, degradación, eventos, y aprendizaje de patrones.
- **Estado:** Maduro como librería (~80%); integración parcial (~50%).
- **Detalle:** `lib/safety/*`: triggers regex, 5 checks, `validateAIResponse`, `retryWithSafety`, `handleDegradation`, `logSafetyEvent`, `runSafetyLearning`. Test suite `tests/safety/` (9 tests, sin commitear). **Sin commitear.**
- **Problemas:** en el path streaming (dashboard + laboratorio) solo loguea `blocked_with_retry` pero no retry ni corrige; el full loop solo corre en el path de canales. `retry.ts` usa `request_type: 'safety_retry'` que viola el CHECK de `ai_usage` (el insert falla silenciosamente). `runSafetyLearning` no tiene callers (no corre nunca). Migración 015 tiene una policy de insert `WITH CHECK (true)` sin restringir a service_role. Migraciones 014/015 sin commitear.
- **Reutilizable:** toda la librería de validación + tests.
- **Falta:** decidir si el path streaming debe retry/degradar; disparador para `runSafetyLearning`; arreglar el CHECK de `ai_usage`.

---

### 3.11 Edition (gating free/premium)

- **Responsabilidad:** Sistema de ediciones (evaluation/professional/enterprise/cloud) con 27 capability flags.
- **Estado:** Scaffold (~15%).
- **Detalle:** `lib/system/edition.ts` define ediciones, límites y helpers. Solo 2 de ~25 helpers se usan: `canDemoChat` (demo) y `canUseWhatsApp` (ConnectionsManager). **El Laboratorio NO tiene gating** a pesar de existir `canUseSalesSimulator`. La UI no muestra badge de edición ni barra de límites (la doc `edition-system.md` lo describe pero no existe en código).
- **Falta:** decidir el modelo de edición; cablear gating real donde corresponda.

---

### 3.12 Signals

- **Responsabilidad:** "Señales" de MIA hacia el dueño (bandeja de entrada, indicador).
- **Estado:** Scaffold (~15-30%).
- **Detalle:** Tabla `mia_signals` (migración 011) tiene **bug de tipos: `business_id BIGINT REFERENCES businesses(id)` (UUID) y `resolved_by BIGINT REFERENCES users(id)` (no existe tabla `users`)** → la migración no se puede aplicar. **Ningún código lee/escribe `mia_signals`.** La UI (`MIAInbox`, `SignalIndicator`) usa datos mock hardcodeados.
- **Falta:** arreglar/eliminar la migración 011 y decidir el modelo de señales (o eliminarlo).

---

## 4. APIs disponibles

### 4.1 Endpoints (ruta → estado → callers)

| Ruta | Método | Estado | Caller |
|---|---|---|---|
| `/api/chat` | POST | Funcional | ChatWindow, LabChatWindow |
| `/api/demo/chat` | POST | Funcional | demo/page |
| `/api/onboarding/chat` | POST | Funcional | OnboardingWizard/ConversationalOnboarding |
| `/api/channels/connections` | GET/POST/DELETE | Funcional | ConnectionsManager |
| `/api/channels/webhook/[channel]` | POST/GET | Parcial | externo (no sendMessage) |
| `/api/knowledge/analyze` | POST | Funcional | KnowledgeStudio |
| `/api/knowledge/analyze` | GET | **Muerto** | — |
| `/api/knowledge/analyze/[reportId]` | GET | Funcional | KnowledgeStudio |
| `/api/knowledge/items` | GET | **Muerto** | — |
| `/api/knowledge/items` | POST | Funcional | KnowledgeManager |
| `/api/knowledge/items/[id]` | GET | **Muerto** | — |
| `/api/knowledge/items/[id]` | PATCH/DELETE | Funcional | KnowledgeManager |
| `/api/knowledge/instructions` | GET | **Muerto** | — |
| `/api/knowledge/instructions` | POST | Funcional | InstructionsManager |
| `/api/knowledge/instructions/[id]` | GET | **Muerto** | — |
| `/api/knowledge/instructions/[id]` | PATCH/DELETE | Funcional | InstructionsManager |
| `/api/knowledge/suggestions/[id]` | PATCH | Funcional | KnowledgeStudio |
| `/api/knowledge/learn` | POST | Funcional | FileUpload |
| `/api/knowledge/learn/[id]` | GET/PATCH | Funcional | KnowledgeCenter / LearningReport |
| `/api/laboratorio/context` | GET | Funcional | LaboratorioClient |
| `/api/laboratorio/sessions` | GET/POST | Funcional | LaboratorioClient |
| `/api/laboratorio/analyze` | POST | **Roto** | (2 callers, ambos fallan) |
| `/api/laboratorio/evaluate` | POST | Funcional pero inalcanzable | SessionEvaluation (no renderiza) |
| `/api/laboratorio/teach` | POST | Funcional pero inalcanzable | TeachModal (no renderiza) |
| `/api/training/corrections` | POST | Parcial (viola FK) | TrainingChat |
| `/api/training/lessons` | GET | Funcional | MemoryTimeline |
| `/api/coaching/recommendations` | GET/POST | Funcional (GET no usado) | OwnerGuidance (POST) |
| `/api/conversations/[id]/outcome` | PATCH | Funcional | Conversación [id] |
| `/api/conversations/[id]/archive` | POST | Funcional | Conversación [id] |
| `/api/business/memory` | GET | **Huérfana** | — |
| `/api/business/memory/analyze` | POST | **Huérfana** | — |
| `/api/business/skills` | GET | **Huérfana** | — |
| `/api/business/weekly-report` | GET/POST | **Huérfana** | — |
| `/api/business/product-intelligence` | GET | **Huérfana** | — |

### 4.2 Contratos públicos ya definidos

- **`ChannelAdapter`** (`lib/channels/types.ts`): `receiveMessage/sendMessage/validateWebhook/getStatus` + `NormalizedMessage`/`OutgoingMessage`. **Este es el contrato de mensajes por canal.**
- **Zod schemas** en las rutas (`chat/route.ts`, `laboratorio/*`, etc.) como validación de input.
- **`WireMessage`** en `lib/runtime/types.ts` — duplicado estructural de `NormalizedMessage` (no compartido).

---

## 5. Mapa de dependencias

```
                      ┌──────────────────────┐
                      │   supabase (4 clients)│
                      └──────────┬───────────┘
                                 │
   ┌──────────────┬──────────────┼───────────────┬─────────────────┐
   ▼              ▼              ▼               ▼                 ▼
Knowledge     Runtime      Conversations     Dashboard       Laboratorio
 (ai/*)      (runtime.ts)  (lib/dashboard/   (queries.ts)   (components/*)
              │              conversations.ts)
              ├── context.ts ── ai/knowledge ── ai/prompts (MIA Core)
              ├── channels/identity ── customers/channel_messages
              ├── safety/* (validate/retry/degradation)
              └── ai/cost ── ai_usage

Canon (ai_instructions)  →  getBusinessContext → prompts
Business Memory (ai/memory) → getBusinessContext (lectura) / rutas huérfanas (escritura)
Edition (system/edition)  →  demo chat, ConnectionsManager (solo 2 usos)
Signals → nada (solo migración con bug)
```

Dependencia clave: **todo** el chat (dashboard, laboratorio, canales) pasa por `runtime` → `conversation/context` → `ai/knowledge` + `ai/prompts`. El core de la plataforma es esa cadena.

---

## 6. Deuda técnica

### 6.1 Código duplicado
- **CRUD duplicados:** `ProductsManager` y `RulesManager` son casi idénticos entre sí y duplican el patrón de `KnowledgeManager` e `InstructionsManager` (4 managers + 2 escritores en onboarding).
- **Prompt assembly duplicado en 3 lugares:** `context.ts` (completo), `api/laboratorio/context`, `api/demo/chat`.
- **Contrato de mensajes duplicado:** `NormalizedMessage` (channels) vs `WireMessage` (runtime).
- **Mensaje de escenario duplicado:** `simulationSystemMessages` (SimulationModes.tsx, export muerto) y copia inline en LabChatWindow.

### 6.2 Módulos / componentes abandonados o reemplazados
- **10 componentes del dashboard sin importers:** `BusinessHealth`, `RevenueSummary`, `SalesFunnel`, `TodaysActivity`, `NeedsFromYou`, `CelebrateProgress`, `MotivationBanner`, `QuickActions`, `ProductIntelligenceCard`, `AIOperationsCard`. (Varios fueron quitados de `page.tsx` en el commit `d4cb34a` "passive observability".)
- **`lib/ai/confidence.ts`** — zero importers.
- **`lib/ai/usage-report.ts`** — solo lo consume `AIOperationsCard` (muerto).
- **`generateRecommendations`** (`recommendation-engine.ts:91`) — zero callers.
- **`runSafetyLearning`** (`safety/learning-analyzer.ts`) — zero callers.
- **`BrainMessage`/`BrainResponse`** (`runtime/types.ts`) — zero importers.
- **`formatTimeAgo`** (`lib/utils.ts`) — zero importers.
- **`AUTHORITY_TIER`, `getAssistantWithBusiness`** (`lib/ai/knowledge.ts`) — zero importers.
- **`assistant_channels`** — tabla paralela (migración 001), escrita por onboarding, nunca leída.
- **`workshop/`** — prototipo completo (council/memory/deterministic intelligence, últimos 5 commits) NO conectado a `src/`.
- **`docs/architecture/mia-knowledge-center.md`** referencia rutas `/api/knowledge/documents*` y `/api/knowledge/search` que no existen.

### 6.3 Rutas muertas / APIs sin usar
- 5 rutas `/api/business/*` (memory, memory/analyze, skills, weekly-report, product-intelligence).
- 5 endpoints GET de knowledge (analyze, items, items/[id], instructions, instructions/[id]).
- `GET /api/coaching/recommendations` (el cliente solo POSTea; el dashboard lee server-side).

### 6.4 Componentes que deberían eliminarse (decisión pendiente)
Los 10 del §6.2, más decidir el destino de `MIAInbox`/`SignalIndicator` (mocks) y la migración 011.

### 6.5 Datos falsos / hardcodeados en UI "real"
- `MIAInbox.tsx:48-76` (3 señales mock), `TopBar.tsx:21` (`state="observacion"`), `layout.tsx:44` (`status="active"`), `page.tsx:125,152` (`trend`), `page.tsx:200` (`recentLessons={[]}`), `page.tsx:261` (`status="Score 7.8"`), `queries.ts:477` (`channel: 'web'`).

### 6.6 Bugs de esquema / tipos
- **Migración 011 no aplicable** (`BIGINT` → UUID, tabla `users` inexistente).
- `lib/ai/knowledge.ts:116` y `memory.ts` leen columna `content` de `knowledge_items`, pero `src/lib/types/index.ts` define `question/answer` (drift de tipos).
- `readiness.ts:187,391` filtran `.eq('created_at', …)` en vez de `.gte` (nunca matchea).
- `retry.ts:54` usa `request_type: 'safety_retry'` no permitido por el CHECK de `ai_usage`.
- `training/corrections` inserta `learning_events` con `message_id` = UUID generado en el cliente → viola FK → el loop de aprendizaje nunca se puebla vía app.
- `lab_sessions.tokens_used/cost` existen pero nunca se escriben.
- `context.ts:63` push `id: k` (objeto completo) en vez de `k.id`.
- Tipos de BD escritos a mano y desactualizados (sin `lab_sessions`, `safety_events`, `readiness_snapshots`, `mia_skills`, etc.).

### 6.7 Sin commitear
Safety completo, conversaciones/outcome, recommendation-engine, sales-intelligence, migraciones 012-015, tests/safety. Es el trabajo más reciente y no está respaldado.

---

## 7. Riesgos arquitectónicos

1. **Scope multi-tenant roto en 8 queries del dashboard** (`queries.ts`): conteos/agregados sin filtro de `business_id` (conversaciones activas, mensajes, learning_events, knowledge_suggestions, milestones, greeting). Riesgo de fuga de datos entre tenants. También en `readiness.ts` (queries por assistant/date sin business_id).
2. **Migraciones sin aplicar / no aplicables:** 011 (bug de tipos) y 012-015 sin commitear. El esquema real de la BD puede divergir del repo.
3. **`knowledge_items.content` vs `question/answer`:** drift de tipos que puede romper `getBusinessExtractionContext` en runtime.
4. **Laboratorio roto internamente:** el loop de entrenamiento (evaluate/teach/coaching) es inalcanzable; el módulo parece completo pero su función central no funciona. Afecta la percepción del producto y el readiness.
5. **Path streaming de safety sin corregir:** en dashboard/laboratorio se loguea "blocked_with_retry" pero se entrega el texto sin corregir; retry/degrada solo en el path de canales.
6. **Ensamble de prompt fragmentado:** 3 builders con capacidades distintas (memoria/lessons presentes solo en producción). Riesgo de que demo/laboratorio se comporten distinto a producción.
7. **WhatsApp es una promesa, no una integración:** sin sendMessage, sin verificación de firma, sin credenciales, sin token en `.env.example`. El primer cliente real en WhatsApp no recibiría respuestas.
8. **Acoplamiento runtime ↔ todo:** `runtime.ts` concentra engine + persistencia + seguridad + canales + costos (~246 líneas y creciendo). Es el cuello de botella para canales nuevos.
9. **Tipos de BD a mano:** `src/lib/types/index.ts` desincronizado del esquema; los clientes Supabase no usan el generic `Database`.
10. **`getDashboardData` ~25 queries por carga, ~10 para datos que no se renderizan** (datos huérfanos). Cuello de botella de rendimiento en la página principal.

---

## 8. Auditoría Sprint 12A — comparación contra el código existente

| Entregable | Estado | Evidencia |
|---|---|---|
| **Contrato de mensajes** | **Existe parcialmente** | `NormalizedMessage`/`OutgoingMessage`/`ChannelAdapter` en `lib/channels/types.ts` (usado). Pero `WireMessage` en runtime lo duplica y el webhook hace conversión implícita. No es un contrato único. |
| **MIA Core** | **Existe parcialmente** | No hay módulo "core"; el ensamblado vive en `conversation/context.ts` + `ai/prompts.ts` + `ai/knowledge.ts`. Duplicado parcialmente en demo y laboratorio. |
| **Conversation Layer** | **Existe** | `runtime.ts` (processStreaming + processIncomingMessage) + `/api/chat` + webhook. Funcional, con gaps (persistencia sin conversationId, last_interaction parcial, retry de safety solo en canales). |
| **Web Chat SDK** | **No existe** | No hay widget/SDK embebible; no hay frontend que llame al webhook `web`; `sendMessage` del adapter web es no-op. Existe solo el chat del dashboard. |
| **WhatsApp Adapter** | **Existe parcialmente** | Parsing real del webhook shape de WhatsApp Cloud API. `sendMessage`/`validateWebhook` son stubs; sin credenciales; sin `WHATSAPP_VERIFY_TOKEN` en `.env.example`. |
| **Business Memory** | **Existe parcialmente** | Lectura cableada en prompt y dashboard. Escritura (análisis de patrones → skills → velocidad) solo vía rutas huérfanas, sin cron. |
| **Canon** | **Existe** | `ai_instructions` + CRUD + inyección en prompt. El concepto "Canon" como módulo formal no existe (es la tabla + manager). |
| **Dashboard** | **Existe** | Funcional ~85%, con 10 componentes muertos, 5 rutas huérfanas y 8 queries sin scope. |
| **Knowledge Studio** | **Existe** | Funcional ~90%. Sin tracking de tokens. |
| **Laboratorio** | **Existe parcialmente** | Chat de simulación funcional; evaluación/coaching/teach/usage rotos o inalcanzables (~40%). |
| **Runtime** | **Existe** | Motor procedural funcional (~80%). |
| **Conexiones (Channels)** | **Existe parcialmente** | Abstraction + identity + webhook ingress funcionales; sin outbound, sin WhatsApp real, sin SDK web. |

**Resumen Sprint 12A:** de 12 entregables, **7 existen** (Conversation Layer, Canon, Dashboard, Knowledge Studio, Runtime; y parcialmente contado en las columnas), **5 existen parcialmente** (Contrato de mensajes, MIA Core, WhatsApp Adapter, Business Memory, Laboratorio, Conexiones — es decir 6 parciales), y **1 no existe** (Web Chat SDK). Ningún entregable del Sprint 12A está al 100% funcional como se concibe en el sprint.

---

## 9. ¿Qué necesitamos construir realmente?

### A. Cosas que YA existen y se deben REUTILIZAR (no reconstruir)
1. **Runtime / Conversation Layer** — motor de chat streaming + canales.
2. **MIA Core (ensamblado)** — `getBusinessContext` + `buildMasterPrompt` + `loadConversationContext`.
3. **Contrato de canales + identity + webhook ingress** — `lib/channels/*`.
4. **Knowledge Studio (análisis + sugerencias)** — completo.
5. **Knowledge CRUD + aprendizaje de archivos** — completo.
6. **Canon (`ai_instructions`)** — completo.
7. **Business Memory (lectura) + skills + readiness + maturity** — completos.
8. **Laboratorio (UI + evaluate + teach)** — la lógica casi completa, rota por cableado.
9. **Safety (validadores + tests)** — maduro.
10. **Conversaciones (Relaciones)** — listado/detalle/outcome/archive.
11. **Dashboard query layer** — `getDashboardData` + leaf queries.

### B. Qué falta realmente (piezas que impiden que la arquitectura funcione)
1. **Conectar el Laboratorio**: conversationId real en el chat de simulación → evaluación → coaching → teach → tokens. (Es cableado + fixes, no construcción nueva.)
2. **Disparadores para los loops dormidos**: Business Memory (análisis de patrones), `generateRecommendations`, `runSafetyLearning`, weekly report. Algo tipo scheduler/cron o invocación bajo demanda desde la UI.
3. **Persistencia del chat del dashboard**: que `/api/chat` cree/retome conversaciones reales (hoy solo persiste si el cliente envía conversationId).
4. **Outbound de canales**: implementar `sendMessage` real (WhatsApp) + guardar credenciales + token de verificación. Decidir si el Web Chat SDK es un entregable real.
5. **Corregir el loop de aprendizaje**: `learning_events` (FK rota) para que lessons/timeline/readiness tengan datos.
6. **Sanear el dashboard**: quitar o re-cablear los 10 componentes muertos, 5 rutas huérfanas, y corregir las 8 queries sin scope de business_id (seguridad multi-tenant).
7. **Decisiones de alcance**: qué hacer con `signals` (arreglar migración 011 o eliminar el concepto), `edition` (definir gating real), `workshop/` (prototipo aislado), y el plan de migración git (committear 012-015 + safety).

### C. Lo que NO es necesario construir hoy (porque ya existe o no está pedido)
- Un nuevo sistema de conversaciones (existe).
- Un nuevo runtime (existe).
- Un nuevo módulo de canales desde cero (existe la abstracción).
- Un nuevo laboratorio (existe; hay que arreglar el cableado).
- Una nueva knowledge base (existe).
- Arquitectura propuesta o refactors (explicitamente fuera de alcance de este documento).

---

## 10. Tabla de estado consolidada

| Módulo | Estado | % | Freno principal |
|---|---|---|---|
| Knowledge Studio | Funcional | 90 | tracking de tokens |
| Knowledge/Memoria CRUD | Funcional | 85 | learning_events ausente en aprobaciones |
| Conversaciones (Relaciones) | Funcional | 85 | — |
| Dashboard | Funcional | 85 | 8 queries sin scope + datos muertos |
| Runtime | Funcional | 80 | persistencia sin conversationId |
| Canon | Funcional | 80 | — |
| Safety | Maduro lib / parcial integrado | 80/50 | solo retry en path canales |
| Business Memory | Parcial (dormant) | 70/30 | sin disparador |
| Channels/Conexiones | Parcial | 60 | sin outbound, WhatsApp stub |
| Laboratorio | Parcial | 40 | conversationId nunca asignado |
| Signals | Scaffold | 15-30 | migración rota, UI mock |
| Edition | Scaffold | 15 | sin gating real |
| Web Chat SDK | No existe | 0 | — |

---

## 11. Fuentes y método

- Auditoría sobre el working tree de `C:\Users\david\mia` (commit `56583b5` + cambios sin commitear).
- Archivos leídos: ~200 (src completo, migraciones, docs, scripts, tests, config).
- Verificación de uso: grep de imports y callers de cada componente/ruta en todo el repo.
- ADRs (005, 006, 007, 008) contrastados contra el código real; muchos están en estado "Proposed" y describen intención, no realidad.
- Documentos de docs/audits y docs/remediation contrastados con el código (varios hallazgos siguen abiertos: ver §6).
