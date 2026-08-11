# MIA Platform — Documento Maestro de Arquitectura

> **Documento auto-generado.** No lo edites a mano: se regenera en cada commit con `npm run docs:generate`.
> Fuente de verdad: este repositorio en `b062c12`.

| Metadato | Valor |
|----------|-------|
| **Commit HEAD** | `b062c12` |
| **Rama** | `main` |
| **Remoto** | `https://github.com/arbojo/mia-platform` |
| **Generado** | 2026-08-11T16:32:40-06:00 |

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

**Dependencias de producción** (23): @ai-sdk/openai, @base-ui/react, @supabase/ssr, @supabase/supabase-js, ai, cheerio, class-variance-authority, clsx, csv-parse, date-fns, fast-xml-parser, lucide-react, next, openai, pdf-parse, pdfjs-dist, react, react-dom, read-excel-file, shadcn, tailwind-merge, tw-animate-css, zod

**DevDependencies** (16): @playwright/test, @tailwindcss/postcss, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/node, @types/react, @types/react-dom, @vitest/coverage-v8, chrome-devtools-mcp, eslint, eslint-config-next, jsdom, tailwindcss, typescript, vitest

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

53 tablas definidas en `supabase/migrations/`:

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
| IF | 016_knowledge_media.sql |
| IF | 017_profiles_demo.sql |
| IF | 019_health_checks.sql |
| sales_events | 025_sales_events.sql |
| IF | 027_mia_pixel.sql |
| IF | 027_mia_pixel.sql |
| delivery | 031_delivery_hub.sql |
| delivery | 031_delivery_hub.sql |
| delivery | 031_delivery_hub.sql |
| delivery | 031_delivery_hub.sql |
| delivery | 031_delivery_hub.sql |
| delivery | 031_delivery_hub.sql |
| delivery | 031_delivery_hub.sql |
| delivery | 031_delivery_hub.sql |
| delivery | 031_delivery_hub.sql |
| delivery | 031_delivery_hub.sql |
| delivery | 031_delivery_hub.sql |
| delivery | 031_delivery_hub.sql |
| delivery | 031_delivery_hub.sql |
| inventory | 034_inventory_hub.sql |
| inventory | 034_inventory_hub.sql |
| inventory | 034_inventory_hub.sql |
| inventory | 034_inventory_hub.sql |
| inventory | 034_inventory_hub.sql |
| inventory | 034_inventory_hub.sql |

Todas las tablas tienen **RLS habilitado y forzado**, scoped al `business_id` del usuario autenticado. Las migraciones son **inmutables** — los cambios de esquema se hacen solo mediante migraciones nuevas.

### Migraciones

| # | Archivo |
| --- | --- |
| 1 | 001_initial_schema.sql |
| 2 | 002_lab_sessions.sql |
| 3 | 003_knowledge_studio.sql |
| 4 | 004_training_corrections.sql |
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
| 17 | 017_profiles_demo.sql |
| 18 | 018_auto_provision.sql |
| 19 | 019_health_checks.sql |
| 20 | 020_accessibility_preferences.sql |
| 21 | 021_profile_language.sql |
| 22 | 022_channel_modes.sql |
| 23 | 023_follow_up.sql |
| 24 | 024_media_assets.sql |
| 25 | 025_sales_events.sql |
| 26 | 026_legacy_tables_cleanup.sql |
| 27 | 027_mia_pixel.sql |
| 28 | 028_mia_pixel_init_visit.sql |
| 29 | 029_product_media.sql |
| 30 | 030_catalog_sku.sql |
| 31 | 031_delivery_hub.sql |
| 32 | 032_delivery_schema_expose.sql |
| 33 | 033_delivery_grants.sql |
| 34 | 034_inventory_hub.sql |
| 35 | 035_inventory_schema_expose.sql |
| 36 | 036_inventory_grants.sql |

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

81 rutas en `src/app/api/`:

```
accessibility
admin/delivery/closures
admin/delivery/drivers/[id]
admin/delivery/drivers/[id]/token
admin/delivery/drivers
admin/delivery/metrics
admin/delivery/orders/[id]/cancel
admin/delivery/orders
admin/delivery/routes/[id]/assign
admin/delivery/routes
admin/delivery/settings
admin/inventory/adjustments
admin/inventory/import
admin/inventory/items
admin/inventory/items/threshold
admin/inventory/movements
admin/inventory/settings
admin/inventory/suggestions/ai
admin/inventory/suggestions
assistants/[id]
business/memory/analyze
business/memory
business/product-intelligence
business/skills
business/weekly-report
catalog/import/file
catalog/import/source
channels/baileys/followup
channels/baileys/reconnect
channels/baileys/session
channels/baileys/webhook
channels/baileys/ws-token
channels/connections
channels/webhook/[channel]
chat
conversations/[id]/messages
conversations/[id]/notes
conversations/[id]/outcome
conversations/[id]/status
customers/memory
demo/chat
driver/auth/logout
driver/auth/refresh
driver/auth
driver/checkout
driver/deliveries/[id]/arrived
driver/deliveries/[id]/delivered
driver/deliveries/[id]/en-route
driver/deliveries/[id]/incident
driver/deliveries/[id]/revisit
driver/deliveries/[id]
driver/deliveries
driver/me
driver/sync
knowledge/analyze/[reportId]
knowledge/analyze
knowledge/instructions/[id]
knowledge/instructions
knowledge/items/[id]
knowledge/items
knowledge/learn/[id]
knowledge/learn
knowledge/media/upload
knowledge/suggestions/[id]
laboratorio/analyze
laboratorio/context
laboratorio/evaluate
laboratorio/sessions
laboratorio/teach
onboarding/chat
pixel/track
profile/language
sales/events
sales/metrics
signals/[id]
signals
system/health
training/corrections
training/lessons
widget/chat
widget/close
```

---

## 8. Páginas

27 páginas en `src/app/`:

```
(auth)/login
(auth)/signup
dashboard/accessibility
dashboard/assistants/[id]
dashboard/assistants/[id]/products
dashboard/assistants/[id]/rules
dashboard/assistants/[id]/training
dashboard/assistants
dashboard/billing/upgrade
dashboard/catalog/[id]
dashboard/catalog
dashboard/connections
dashboard/conversations
dashboard/delivery
dashboard/health
dashboard/inventory
dashboard/knowledge-studio
dashboard/knowledge
dashboard/laboratorio
dashboard/onboarding
dashboard
demo
driver/deliveries/[id]
driver/login
driver
/
widget
```

---

## 9. Componentes

109 componentes en `src/components/`:

```
accessibility/AccessibilitySettings.tsx
billing/UpgradeCheckout.tsx
catalog/CatalogGrid.tsx
catalog/ProductCard.tsx
catalog/ProductDetail.tsx
catalog/ProductFormDialog.tsx
catalog/ProductMedia.tsx
catalog/import/FileImportPanel.tsx
catalog/import/ImportDialog.tsx
catalog/import/ImportResults.tsx
catalog/import/PreviewTable.tsx
catalog/import/SourceImportPanel.tsx
chat/ChatWindow.tsx
chat/TrainingChat.tsx
connections/ConnectionFollowUpConfig.tsx
connections/ConnectionsManager.tsx
conversations/ConversationFilters.tsx
conversations/ConversationList.tsx
customers/MemoryPanel.tsx
dashboard/AIOperationsCard.tsx
dashboard/AccessibilityProvider.tsx
dashboard/ActivityRail.tsx
dashboard/AtmosphereProvider.tsx
dashboard/BusinessHealth.tsx
dashboard/CelebrateProgress.tsx
dashboard/CommandStrip.tsx
dashboard/ConversationTimeline.tsx
dashboard/DailyReport.tsx
dashboard/EmployeeStatusCard.tsx
dashboard/I18nProvider.tsx
dashboard/LearningTimeline.tsx
dashboard/MIAIndicator.tsx
dashboard/MIAReadiness.tsx
dashboard/ModuleZone.tsx
dashboard/MorningGreeting.tsx
dashboard/MotivationBanner.tsx
dashboard/NeedsFromYou.tsx
dashboard/OnboardingBanner.tsx
dashboard/OpportunityAlerts.tsx
dashboard/ProactiveSuggestions.tsx
dashboard/ProductIntelligenceCard.tsx
dashboard/QuickActions.tsx
dashboard/RulesManager.tsx
dashboard/SalesMetricsCard.tsx
dashboard/SkillsDisplay.tsx
dashboard/ThemeProvider.tsx
dashboard/TodaysActivity.tsx
dashboard/VitalPresence.tsx
dashboard/WeeklyReportCard.tsx
delivery/DeliveryAdmin.tsx
delivery/DeliveryClosuresPanel.tsx
delivery/DeliveryDriversPanel.tsx
delivery/DeliveryOrdersPanel.tsx
delivery/DeliveryRoutesPanel.tsx
delivery/DeliverySettingsPanel.tsx
delivery/admin-api.ts
demo/DemoPaywall.tsx
driver/DeliverForm.tsx
driver/DeliveryDetail.tsx
driver/DriverHome.tsx
driver/DriverLogin.tsx
driver/IncidentForm.tsx
driver/SwRegister.tsx
driver/api.ts
driver/geolocation.ts
driver/offline.ts
driver/outbox.ts
driver/types.ts
health/HealthDashboard.tsx
inventory/InventoryAdmin.tsx
inventory/InventoryImportPanel.tsx
inventory/InventoryMovementsPanel.tsx
inventory/InventoryPaywall.tsx
inventory/InventoryStockPanel.tsx
inventory/InventorySuggestionsPanel.tsx
inventory/admin-api.ts
knowledge/FileUpload.tsx
knowledge/InstructionsManager.tsx
knowledge/KnowledgeCenter.tsx
knowledge/KnowledgeItemDialog.tsx
knowledge/KnowledgeManager.tsx
knowledge/LearningReport.tsx
knowledge/MediaBrowser.tsx
knowledge/MediaEditDialog.tsx
knowledge/MediaGrid.tsx
knowledge/MediaLibrary.tsx
knowledge/MediaUpload.tsx
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
layout/AppLayout.tsx
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

94 módulos:

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
api-error.ts
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
delivery/actions.ts
delivery/admin-api.ts
delivery/auth.ts
delivery/closure.ts
delivery/db.ts
delivery/errors.ts
delivery/evidence.ts
delivery/gps.ts
delivery/http.ts
delivery/incentives.ts
delivery/licensing.ts
delivery/request.ts
delivery/token.ts
delivery/types.ts
delivery/whatsapp.ts
hooks/use-hover-intent.ts
i18n/config.ts
i18n/dictionaries/en.ts
i18n/dictionaries/es.ts
i18n/dictionaries/index.ts
i18n/dictionaries/ja.ts
i18n/dictionaries/pt.ts
i18n/server.ts
import/engine.ts
import/feed.ts
import/parsers.ts
import/scraper.ts
import/sourceClient.ts
import/ssrf.ts
import/types.ts
import/validators.ts
import/woocommerce.ts
inventory/adjustments.ts
inventory/admin-api.ts
inventory/ai.ts
inventory/db.ts
inventory/errors.ts
inventory/import.ts
inventory/licensing.ts
inventory/rules.ts
inventory/stock.ts
inventory/suggestions.ts
inventory/types.ts
knowledge/suggestions.ts
runtime/conditional-media.ts
runtime/execute-ai.ts
runtime/intents.ts
runtime/media.ts
runtime/runtime.ts
runtime/types.ts
sales/detect.ts
sales/events.ts
sales/process.ts
sales/widget.ts
supabase/admin.ts
supabase/client.ts
supabase/route-handler.ts
supabase/server.ts
system/accessibility.ts
system/demo.ts
system/edition.ts
system/health.ts
system/language.ts
system/routing.ts
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

**Tareas registradas (74)**:

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
| TASK-20260802-032051 | Imagenes condicionales en Knowledge Studio (media por gatillo + envio unico) | in_progress |
| TASK-20260802-194636 | Auditoria critica UX Lab: foco chat, logout sesion Baileys, revision Google Auth | completed |
| TASK-20260802-195924 | Cursor arcoiris global en todos los inputs del sistema | completed |
| TASK-20260802-213951436 | Demo publica y captura de leads: auto-registro hibrido con Google Auth | completed |
| TASK-20260803-000141367 | Corrección crítica: OAuth/business auto-provisión, persistencia de chat y contexto Vitanova | completed |
| TASK-20260803-001127354 | Ingeniería de UX proactivo y wayfinding (dropzones, breadcrumbs, layouts dinámicos) | awaiting_council |
| TASK-20260803-001127666 | Motor de diagnóstico y protocolo No Pass No Commit (health-check persistente) | completed |
| TASK-20260803-001127679 | Módulo de accesibilidad, ergonomía y salud óptica (pestaña dedicada) | completed |
| TASK-20260803-001127713 | Arquitectura multilingüe nativa i18n (es/en/pt/ja) | completed |
| TASK-20260803-214859374 | Upgrade Baileys to v7.0.0-rc14 in whatsapp-bridge | completed |
| TASK-20260803-220815401 | Baileys Agent: session health watcher in whatsapp-bridge | completed |
| TASK-20260803-225207190 | Integrar política de cierre comercial condicionada al prompt del asistente | completed |
| TASK-20260803-230254309 | Seguimiento automático por inactividad del canal | completed |
| TASK-20260803-230254397 | Modos de operación del canal (active/shadow/paused) | completed |
| TASK-20260804-000226556 | Multimedia Inteligente: media library y media_type sobre ADR-014 | completed |
| TASK-20260804-011725729 | Fix: ¿Por qué respondió esto? devuelve 404 en el Laboratorio | completed |
| TASK-20260804-023630282 | Flujo de cierre de pedido completo: deteccion IA, sales_events, notificacion y metricas | completed |
| TASK-20260804-031425894 | Fix a11y: campos de filtro sin id/name en ConversationFilters | completed |
| TASK-20260804-032853879 | Remediar RLS: drop de 3 tablas legacy expuestas (analytics_sessions, analytics_events, order_requests) | completed |
| TASK-20260804-034548893 | Documentar deuda tecnica: hallazgos Security Advisor de Supabase | completed |
| TASK-20260804-035152257 | Knowledge Studio: Editar antes de Aprobar en sugerencias | completed |
| TASK-20260804-060647470 | Migracion a esteta Warm Editorial / Hibrido Familiar + micro-transiciones | approved |
| TASK-20260804-073649560 | Arquitectura de Interaccion Inteligente para WhatsApp (Baileys + Knowledge Studio) | completed |
| TASK-20260805-020235754 | Fix reporte de analisis atascado en 'analyzing' | completed |
| TASK-20260805-035136984 | Entorno de pruebas completo y profesional para produccion | completed |
| TASK-20260805-042040441 | Sistema de badges de tests en README con actualizacion automatica via CI | completed |
| TASK-20260805-042439273 | Licencia propietaria del repositorio (no open source, no uso libre) | completed |
| TASK-20260806-030906015 | Fix dark mode toggle not affecting layout | completed |
| TASK-20260806-030906040 | Start WhatsApp bridge and restore channel connectivity | completed |
| TASK-20260806-030906069 | Fix accessibility toggles that apply no styles | completed |
| TASK-20260806-030906393 | Wire atmosphere heuristic to knowledge-studio route | completed |
| TASK-20260806-030906444 | Fix API auth NEXT_REDIRECT to return 401 | completed |
| TASK-20260806-030906450 | Mount or remove orphaned WeeklyReportCard | completed |
| TASK-20260806-030906865 | Internationalize hardcoded dashboard texts | completed |
| TASK-20260806-071815884 | MIA Landings: monorepo evolutivo + Mia Pixel | in_progress |
| TASK-20260807-005539713 | WhatsApp order capture with delivery-day awareness | completed |
| TASK-20260807-233927408 | Medios por Producto: product_id en multimedia + selector UI + product_context en sesion | completed |
| TASK-20260808-000932234 | Rediseno Catalogo & Medios (QuickSell): hub SKU-centric + columna sku + filtro product_id | completed |
| TASK-20260808-005115364 | Motor de importación multipropósito para el Hub de Catálogo (CSV/XLSX, WooCommerce, scraping) | completed |
| TASK-20260808-073131605 | Delivery Hub: modulo logístico aislado (schema delivery) + Portal del Repartidor | completed |
| TASK-20260808-084307057 | Inventory Hub: modulo de inventario, catalogo y probabilidad/demanda (schema inventory) | completed |
| TASK-20260809-185222360 | Delivery Hub: PWA offline-first del Portal del Repartidor | completed |
| TASK-20260809-195717287 | Inventory Hub Paywall + ruta de suscripcion (checkout placeholder) | completed |
| TASK-20260809-203206411 | Paywall Inventory Hub: pulido de copywriting aspiracional | completed |
| TASK-20260809-204316702 | Paywall + Suscripcion Inventory Hub: correccion definitiva de copy y localizacion (espanol neutro, cero voseo) | completed |
| TASK-20260809-210118203 | Auditoria integral de fiabilidad: simulacion de flujos conversacionales + guardrails de intencion + trazabilidad de datos al dashboard | completed |
| TASK-20260809-214955006 | Implementar cierre de venta nativo en el Widget y sincronizacion con metricas (P4) | completed |
| TASK-20260809-222311495 | Fix hydration mismatch en pagina del widget | completed |
| TASK-20260809-231109825 | Sistema de diseño modular MIA con tema claro/oscuro y contexto por módulo (Vestido Azul) | completed |
| TASK-20260809-233611402 | Subaru CLI: resurrección multi-máquina de tareas | completed |
| TASK-20260810-002545865 | MIA Quiet Chrome: contexto por clic derecho, hovers inteligentes y zonas activas | completed |
| TASK-20260810-005415049 | quiet chrome: inbox glass y zonas activas en home | completed |
| TASK-20260810-011350200 | Ghost UI context menu en MIAInbox (reutilizando context-menu.tsx) | completed |
| TASK-20260810-015658359 | Fix hydration mismatch en AppLayout por lectura de localStorage en estado inicial | completed |
| TASK-20260810-020352435 | Dashboard Quiet Chrome: migrar tarjetas legacy a glass atmosferico + ghost UI context menu | completed |
| TASK-20260810-044135422 | Sidebar refine: posicion Settings, hover intent con grace period, purga verde legacy + Quiet Chrome | completed |
| TASK-20260810-051218566 | Canales: boton reconectar, anti-estado-zombie connecting y Quiet Chrome en ConnectionsManager | completed |
| TASK-20260810-070426014 | Bridge WhatsApp: dockerizar, desplegar en hosting de contenedores y sincronizar Vercel | completed |
| TASK-20260811-012128636 | Sidebar estable: Configuracion en la nav principal y sin colapso por hover | completed |
| TASK-20260811-013644736 | Conectar boton WhatsApp (Conectar/Reconectar/Estado) con el bridge de produccion | completed |
| TASK-20260811-024549288 | Pulir UI/UX de la tarjeta de WhatsApp y filas de conexiones (textos amigables y estilos estandarizados) | completed |
| TASK-20260811-031812147 | Endurecer protocolo Return-by-Death (Subaru): governance validado, mark secuencial, complete verificado, revive con drift detection | approved |
| TASK-20260811-072155412 | Edicion por negocio (tenant): capabilities premier para Vitanova con resolucion por businessId y fallback al env global | approved |

---

## 12. Decisiones de Arquitectura (ADRs)

21 ADRs en `docs/adr/`:

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
| 014-conditional-knowledge-media | 014: Conditional Knowledge Media (Imágenes condicionales en Knowledge Studio) |
| 015-mia-landings-architecture | 015: MIA Landings — Modular Monorepo, Concilium Agents and Mia Pixel |
| 016-product-media-context | 016: Medios por Producto + product_context |
| 017-catalog-sku-centric | 017: Catálogo SKU-Centric (Rediseño QuickSell) |
| 018-import-engine | 018: Motor de Importación Multipropósito para el Hub de Catálogo |
| 019-delivery-hub | 019: Delivery Hub — Módulo Logístico Aislado (Schema `delivery`) + Portal del Repartidor |
| 020-inventory-hub | 020: Inventory Hub — Módulo de Inventario, Catálogo y Probabilidad/Demanda (Schema `inventory`) |

---

## 13. Tests

```

```

---

## 14. Commits Recientes

```
b062c12 subaru: checkpoint subaru-audit-v2 - en-progreso
50f780a feat(subaru): complete exige --confirm-gates y escribe resultado final en Current state
708209d docs: regenerate MASTER.md at 1a51258
1a51258 subaru: checkpoint subaru-audit-v2 - en-progreso
3e30bad docs: regenerate MASTER.md at b08fe5d
b08fe5d feat(subaru): scaffold enriquecido con 7 atributos por paso + parser
185c5af docs: regenerate MASTER.md at e7c6b34
e7c6b34 subaru: checkpoint subaru-audit-v2 - en-progreso
6630c8f feat(subaru): estado frozen retrocompatible (blueprint_ready -> frozen)
8ee6846 docs: regenerate MASTER.md at 0b93a86
0b93a86 subaru: checkpoint subaru-audit-v2 - en-progreso
fcc2db8 feat(subaru): bootstrap valida entorno completo (node, git, remote, checkpoint, identidad)
ffa03b0 docs: regenerate MASTER.md at 245fde9
245fde9 subaru: checkpoint subaru-audit-v2 - en-progreso
222ce84 fix(subaru): configurar identidad git en cloneRepo de tests multi-maquina
dac0322 subaru: checkpoint subaru-audit-v2 - listo
34b1771 docs: regenerate MASTER.md at 9ae58b5
9ae58b5 subaru: blueprint tenant-edition-premier - completar plan atómico
f1f7ff9 docs: regenerate MASTER.md at 1264794
1264794 chore: governance manifest y script de clasificacion para edicion por negocio (tenant)
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
