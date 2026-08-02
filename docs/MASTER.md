# MIA Platform — Documento Maestro de Arquitectura

> **Documento auto-generado.** No lo edites a mano: se regenera en cada commit con `npm run docs:generate`.
> Fuente de verdad: este repositorio en `e1503c1`.

| Metadato | Valor |
|----------|-------|
| **Commit HEAD** | `e1503c1` |
| **Rama** | `main` |
| **Remoto** | `https://github.com/arbojo/mia-platform` |
| **Generado** | 2026-08-01T20:48:14-06:00 |

---

## 1. Qué es MIA

MIA **no es un chatbot**. Es una **plataforma de inteligencia de ventas conversacional** que permite a las empresas:

- **Aprender** el negocio mediante conocimiento estructurado, productos y reglas.
- **Conversar** con clientes en lenguaje natural.
- **Recordar** interacciones, preferencias y contexto a lo largo del tiempo.
- **Entrenarse** mediante simulación y correcciones.
- **Operar** en múltiples canales desde un núcleo inteligente único.

**Filosofía central**: contratar y entrenar a un nuevo empleado, no configurar software.

**Límite de dominio**: la responsabilidad de MIA empieza cuando empieza una conversación con un cliente y termina cuando (1) la venta se cierra o descarta, (2) los datos del cliente se estructuran o (3) se emiten eventos de Sales Intelligence. MIA **no** hace ERP, inventario, logística, facturación ni cobros. Ver [ADR-010](docs/adr/010-sales-domain-boundary.md).

---

## 2. Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 16.2.12 (App Router) |
| UI | React 19 |
| Lenguaje | TypeScript (strict mode) |
| Estilos | Tailwind CSS v4 |
| Componentes | shadcn/ui |
| Base de datos | Supabase (PostgreSQL + Row Level Security) |
| Auth | Email/password + Google OAuth via `@supabase/ssr` |
| AI | OpenAI `gpt-4o-mini` via Vercel AI SDK |
| Testing | Playwright (e2e) + Vitest (unit) |
| CI | GitHub Actions |

**Dependencias de producción** (19): @ai-sdk/openai, @base-ui/react, @supabase/ssr, @supabase/supabase-js, ai, class-variance-authority, clsx, date-fns, lucide-react, next, openai, pdf-parse, pdfjs-dist, react, react-dom, shadcn, tailwind-merge, tw-animate-css, zod

**DevDependencies** (10): @playwright/test, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom, eslint, eslint-config-next, tailwindcss, typescript, vitest

---

## 3. Arquitectura General

Diseño **multi-tenant desde el día uno**. Toda la data está acotada a un negocio mediante RLS.

```
Business → Assistants → Customers → Conversations → Messages
```

Patrón de cliente Supabase:

| Cliente | Archivo | Uso |
|---------|---------|-----|
| Browser | `src/lib/supabase/client.ts` | `createBrowserClient` — solo frontend |
| Server | `src/lib/supabase/server.ts` | Lecturas server-side |
| Admin | `src/lib/supabase/admin.ts` | Escrituras server-side (bypassa RLS) |
| Route Handler | `src/lib/supabase/route-handler.ts` | Route Handlers, propaga cookies |

**Regla crítica**: cualquier Route Handler que haga escrituras **debe** usar el cliente admin. Las lecturas pueden usar el server client.

---

## 4. Modelo de Datos

28 tablas definidas en `supabase/migrations/`:

| Tabla | Migración |
| --- | --- |
| businesses | 001_initial_schema.sql |
| brand_identities | 001_initial_schema.sql |
| products | 001_initial_schema.sql |
| knowledge_items | 001_initial_schema.sql |
| sales_rules | 001_initial_schema.sql |
| ai_instructions | 001_initial_schema.sql |
| assistants | 001_initial_schema.sql |
| assistant_channels | 001_initial_schema.sql |
| customers | 001_initial_schema.sql |
| assistant_memories | 001_initial_schema.sql |
| conversations | 001_initial_schema.sql |
| messages | 001_initial_schema.sql |
| learning_events | 001_initial_schema.sql |
| knowledge_versions | 001_initial_schema.sql |
| ai_usage | 001_initial_schema.sql |
| lab_sessions | 002_lab_sessions.sql |
| knowledge_analysis_reports | 003_knowledge_studio.sql |
| knowledge_suggestions | 003_knowledge_studio.sql |
| channel_connections | 005_channel_connections.sql |
| channel_messages | 005_channel_connections.sql |
| readiness_snapshots | 006_readiness_index.sql |
| learning_reports | 007_file_learning.sql |
| business_memory | 008_business_memory.sql |
| mia_skills | 008_business_memory.sql |
| weekly_reports | 008_business_memory.sql |
| learning_velocity_snapshots | 008_business_memory.sql |
| mia_signals | 011_mia_signals.sql |
| whatsapp_sessions | 015_whatsapp_sessions.sql |
| chat_media_dispatched | 016_knowledge_media.sql |

Todas las tablas tienen **RLS habilitado y forzado**, scoped al `business_id` del usuario autenticado. Las migraciones son **inmutables** — los cambios de esquema se hacen solo mediante migraciones nuevas.

### Migraciones

| # | Archivo |
| --- | --- |
| 1 | 001_initial_schema.sql |
| 2 | 002_lab_sessions.sql |
| 3 | 003_knowledge_studio.sql |
| 4 | 003_training_corrections.sql |
| 5 | 005_channel_connections.sql |
| 6 | 006_readiness_index.sql |
| 7 | 007_file_learning.sql |
| 8 | 008_business_memory.sql |
| 9 | 009_stage_based_learning.sql |
| 10 | 010_ai_cost_intelligence.sql |
| 11 | 011_mia_signals.sql |
| 12 | 012_customer_memory.sql |
| 13 | 013_assistant_lifecycle.sql |
| 14 | 014_conversation_notes.sql |
| 15 | 015_whatsapp_sessions.sql |
| 16 | 016_knowledge_media.sql |

---

## 5. Dominio de Venta (ADR-010)

MIA **emite** eventos de Sales Intelligence; los sistemas externos (ERP, CRM, billing, logística) los consumen. MIA nunca llama APIs operativas externas directamente.

Eventos: `SALE_STARTED, PRODUCT_SELECTED, OBJECTION_DETECTED, OBJECTION_RESOLVED, UPSELL_ACCEPTED, CROSSSELL_ACCEPTED, FOLLOWUP_REQUIRED, SALE_WON, SALE_LOST, CUSTOMER_HESITATION, PRICE_ACCEPTED, PRICE_REJECTED`

**Test de frontera**: "¿Esto ayuda a MIA a vender mejor?" Si la respuesta es no, pertenece a otro dominio.

---

## 6. Sistema de IA

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| Cliente OpenAI | `src/lib/ai/client.ts` | Singleton, `MODEL='gpt-4o-mini'`, costos por token |
| Prompt Builder | `src/lib/ai/prompts.ts` | Ensambla el system prompt maestro |
| Context Builder | `src/lib/ai/knowledge.ts` | Obtiene y estructura data de la DB |
| Memory | `src/lib/ai/memory.ts` | Memoria de negocio |
| Customer Memory | `src/lib/ai/customer-memory.ts` | Memoria de cliente |
| Maturity | `src/lib/ai/maturity.ts` | Etapa de madurez del asistente |
| Readiness | `src/lib/ai/readiness.ts` | Índice de preparación ponderado |
| Skills | `src/lib/ai/skills.ts` | Habilidades del asistente |
| Product Intelligence | `src/lib/ai/product-intelligence.ts` | Análisis de productos/objeciones |
| Weekly Report | `src/lib/ai/weekly-report.ts` | Reporte semanal narrativo |

**Reglas**:
- Nunca se hardcodea conocimiento: todo proviene de la DB.
- Toda llamada AI se registra con `recordAiUsage()` y `request_type`.
- El contexto se construye **exclusivamente** con datos de la base de datos.

---

## 7. API Routes

34 rutas en `src/app/api/`:

```
assistants/[id]
business/memory/analyze
business/memory
business/product-intelligence
business/skills
business/weekly-report
channels/baileys/session
channels/baileys/webhook
channels/baileys/ws-token
channels/connections
channels/webhook/[channel]
chat
conversations/[id]/notes
conversations/[id]/status
customers/memory
demo/chat
knowledge/analyze/[reportId]
knowledge/analyze
knowledge/instructions/[id]
knowledge/instructions
knowledge/items/[id]
knowledge/items
knowledge/learn/[id]
knowledge/learn
knowledge/suggestions/[id]
laboratorio/analyze
laboratorio/context
laboratorio/evaluate
laboratorio/sessions
laboratorio/teach
onboarding/chat
training/corrections
training/lessons
widget/chat
```

---

## 8. Páginas

17 páginas en `src/app/`:

```
(auth)/login
(auth)/signup
dashboard/assistants/[id]
dashboard/assistants/[id]/products
dashboard/assistants/[id]/rules
dashboard/assistants/[id]/training
dashboard/assistants
dashboard/connections
dashboard/conversations
dashboard/knowledge-studio
dashboard/knowledge
dashboard/laboratorio
dashboard/onboarding
dashboard
demo
/
widget
```

---

## 9. Componentes

61 componentes en `src/components/`:

```
chat/ChatWindow.tsx
chat/TrainingChat.tsx
connections/ConnectionsManager.tsx
conversations/ConversationFilters.tsx
conversations/ConversationList.tsx
customers/MemoryPanel.tsx
dashboard/AIOperationsCard.tsx
dashboard/AtmosphereProvider.tsx
dashboard/BusinessHealth.tsx
dashboard/CelebrateProgress.tsx
dashboard/ConversationTimeline.tsx
dashboard/DailyReport.tsx
dashboard/EmployeeStatusCard.tsx
dashboard/LearningTimeline.tsx
dashboard/MIAIndicator.tsx
dashboard/MIAReadiness.tsx
dashboard/ModuleCard.tsx
dashboard/MorningGreeting.tsx
dashboard/MotivationBanner.tsx
dashboard/NeedsFromYou.tsx
dashboard/OnboardingBanner.tsx
dashboard/OpportunityAlerts.tsx
dashboard/ProactiveSuggestions.tsx
dashboard/ProductIntelligenceCard.tsx
dashboard/ProductsManager.tsx
dashboard/QuickActions.tsx
dashboard/RulesManager.tsx
dashboard/Sidebar.tsx
dashboard/SkillsDisplay.tsx
dashboard/ThemeProvider.tsx
dashboard/ThemeToggle.tsx
dashboard/TodaysActivity.tsx
dashboard/TopBar.tsx
dashboard/VitalPresence.tsx
dashboard/WeeklyReportCard.tsx
knowledge/FileUpload.tsx
knowledge/InstructionsManager.tsx
knowledge/KnowledgeCenter.tsx
knowledge/KnowledgeManager.tsx
knowledge/LearningReport.tsx
knowledge/ProductCard.tsx
laboratorio/CoachingFeedback.tsx
laboratorio/ContextPanel.tsx
laboratorio/LabChatWindow.tsx
laboratorio/LaboratorioClient.tsx
laboratorio/ResponseAnalysis.tsx
laboratorio/ScenariosPanel.tsx
laboratorio/SessionEvaluation.tsx
laboratorio/SessionHistory.tsx
laboratorio/SimulationModes.tsx
laboratorio/TeachModal.tsx
laboratorio/UsageBar.tsx
onboarding/ConversationalOnboarding.tsx
onboarding/OnboardingWizard.tsx
signals/MIAInbox.tsx
signals/SignalIndicator.tsx
studio/AnalysisReport.tsx
studio/KnowledgeStudio.tsx
studio/ReadinessScore.tsx
studio/SuggestionCard.tsx
training/MemoryTimeline.tsx
```

---

## 10. Módulos de Lógica (`src/lib/`)

37 módulos:

```
ai/client.ts
ai/confidence.ts
ai/cost.ts
ai/customer-memory.ts
ai/extract.ts
ai/knowledge.ts
ai/maturity.ts
ai/memory.ts
ai/product-intelligence.ts
ai/prompts.ts
ai/readiness.ts
ai/skills.ts
ai/usage-report.ts
ai/weekly-report.ts
auth.ts
baileys/bridge.ts
baileys/config.ts
channels/adapters/baileys.ts
channels/adapters/web.ts
channels/adapters/whatsapp.ts
channels/adapters/widget.ts
channels/gateway.ts
channels/identity.ts
channels/types.ts
conversation/context.ts
conversation/resolver.ts
dashboard/queries.ts
runtime/execute-ai.ts
runtime/runtime.ts
runtime/types.ts
supabase/admin.ts
supabase/client.ts
supabase/route-handler.ts
supabase/server.ts
system/edition.ts
types/index.ts
utils.ts
```

---

## 11. Gobernanza y Workflow de Desarrollo

MIA usa un **sistema de agentes de ingeniería** con 17 roles (ver `AGENTS.md` y `docs/adr/001-agent-system.md`). El Orchestrator es el punto de entrada: clasifica cada tarea (simple/compleja), selecciona agentes y coordina el flujo.

**Gate obligatorio antes de tocar código**:
```bash
npx tsx workshop/governance/cli.ts classify   # clasificar tarea
npx tsx workshop/governance/cli.ts validate   # verificar aprobación
```

**Artefactos**:
- Manifests de tareas: `.governance/tasks/<id>.json`
- Log de gobernanza: `.governance/logs/governance-<fecha>.log`

**Tareas registradas (11)**:

| ID | Título | Estado |
| --- | --- | --- |
| TASK-20260729-173000 | Sprint 3 — Business Intelligence & Learning Evolution | in_progress |
| TASK-20260730-022854 | Sprint 1 — Product Survival | completed |
| TASK-20260730-025752 | Sprint 2 — Product Trust | completed |
| TASK-20260801-211951 | Documento maestro de arquitectura | completed |
| TASK-20260801-214104 | Arreglar tests unitarios con fallos pre-existentes | completed |
| TASK-20260801-215301 | Auditoría de Concilio: UX/UI - Enlaces y Botones Desconectados (Alcance Global) | completed |
| TASK-20260801-222236 | Ejecución de Concilio: Corrección de Auditoría UX/UI | completed |
| TASK-20260801-231453 | Refino UI/UX: Modal MIA Signals y Banner Enséñame más | completed |
| TASK-20260802-013217 | Aplicar migraciones faltantes en MIA Lab y corregir 011_mia_signals a esquema UUID | completed |
| TASK-20260802-014814 | Purga de datos demo y refino UX/UI del Simulador de Ventas | completed |
| TASK-20260802-021850 | Integracion WhatsApp con Baileys (QR + puente de mensajeria) | completed |

---

## 12. Decisiones de Arquitectura (ADRs)

15 ADRs en `docs/adr/`:

| ADR | Título |
| --- | --- |
| 001-agent-system | 001: Specialized Engineering Agent System |
| 002-stage-based-learning | 002: Stage-Based Learning & Reverse Training Evolution |
| 003-knowledge-conflict-resolution | 003: Knowledge Conflict Resolution & Source Hierarchy |
| 004-health-communication-policy | 004: Health Communication Policy |
| 005-channel-abstraction | 005: Channel Abstraction |
| 006-conversation-continuity-protocol | 006: Conversation Continuity Protocol (CCP) |
| 007-heuristic-engine | 007: Heuristic Engine — Conversational Intelligence Layer |
| 007-review-v1.1 | 007 v1.1 — Council Review |
| 008-conversation-center | 008: Conversation Center — Unified Inbox & Agent Workspace |
| 009-health-risk-evaluator | 009: Health Risk Evaluator |
| 010-sales-domain-boundary | 010: MIA Sales Domain Boundary |
| 011-evidence-first-protocol | 011: Evidence First Protocol — Council Audit Reliability |
| 012-council-advisory-gate | 012: Council Advisory Gate — Automated Post-Development Audit |
| 013-whatsapp-baileys-bridge | 013: WhatsApp Bridge with Baileys |
| 014-conditional-knowledge-media | 014: Conditional Knowledge Media |

---

## 13. Tests

```
public.spec.ts
```

---

## 14. Commits Recientes

```
e1503c1 docs: regenerate MASTER.md at f5418bd
f5418bd docs: regenerate MASTER.md at 38fc33e
6accd4c feat(whatsapp): add Baileys bridge service, session persistence, and QR connection flow
3ecf63e docs: regenerate MASTER.md at 86d3000
86d3000 chore(governance): complete TASK-20260802-014814
fd72f1c docs: regenerate MASTER.md at 48d47e1
48d47e1 refactor: purge demo data seeds and fix TeachModal overlay in sales simulator
b25a8f9 docs: regenerate MASTER.md at 3565d39
3565d39 fix(db): align 011_mia_signals to UUID schema and apply missing MIA Lab migrations
414c639 docs: regenerate MASTER.md at 42dcac4
42dcac4 fix(ui): solid MIA Signals modal and closable onboarding banner
91526d5 chore: ignore .env files for Vercel CLI integration
806b5f4 docs: regenerate MASTER.md at 40a1b07
40a1b07 fix(ux): apply UX/UI audit corrections P0-P2
395a068 docs: regenerate MASTER.md at 024ab3a
024ab3a docs(audit): UX/UI disconnected buttons and links global audit
681b67a docs: regenerate MASTER.md at 1756034
1756034 fix(tests): align mocks with resolveCustomer and processStreaming
fe8d78e docs: regenerate MASTER.md at 873bf92
873bf92 governance: complete TASK-20260801-211951 (master doc)
```

---

## 15. Comandos de Desarrollo

```bash
npm run dev                 # dev server (puerto 3000)
npm run build               # build de producción
npm run lint                # ESLint (0 errores, 0 warnings)
npm test                    # Playwright e2e
npm run test:unit           # Vitest unit tests
npm run docs:generate       # regenerar ESTE documento maestro
npm run council-audit       # auditoría post-desarrollo del council
npm run governance          # CLI de gobernanza
```

---

## 16. Guía de Lectura para Otra IA

Para entender este proyecto al máximo:

1. **Empieza por `AGENTS.md`** — define la filosofía, los 17 agentes, el workflow obligatorio, las reglas de calidad y el límite de dominio.
2. **Lee este documento maestro** — te da el mapa actual del código (HEAD, tablas, rutas, componentes, ADRs).
3. **Revisa los ADRs** en `docs/adr/` — cada decisión arquitectónica importante tiene su registro.
4. **Lee la gobernanza** en `workshop/governance/` — cómo se clasifican y aprueban las tareas.
5. **Antes de modificar código**: ejecuta `npx tsx workshop/governance/cli.ts validate` para verificar que existe un manifest aprobado.
6. **Después de modificar código**: pasa lint + build + tests antes de reportar completado.
7. **Nunca** modifiques migraciones ya aplicadas ni crees jerarquías de datos paralelas al modelo multi-tenant.

**Reglas de oro**:
- No inventar información: el contexto AI se construye solo con data real de la DB.
- Escrituras server-side → cliente admin; lecturas → server client.
- Servidor y gobernanza primero: ningún cambio sin manifest aprobado.
