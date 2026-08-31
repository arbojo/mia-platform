# MIA Platform — Documento Maestro de Arquitectura

> **Documento auto-generado.** No lo edites a mano: se regenera en cada commit con `npm run docs:generate`.
> Fuente de verdad: este repositorio en `b5391ae`.

| Metadato | Valor |
|----------|-------|
| **Commit HEAD** | `b5391ae` |
| **Rama** | `main` |
| **Remoto** | `https://github.com/arbojo/mia-platform` |
| **Generado** | 2026-08-30T18:12:55-06:00 |

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

**Dependencias de producción** (30): @ai-sdk/google, @ai-sdk/groq, @ai-sdk/openai, @base-ui/react, @supabase/ssr, @supabase/supabase-js, @types/leaflet, ai, cheerio, class-variance-authority, clsx, csv-parse, date-fns, fast-xml-parser, jose, leaflet, lucide-react, next, openai, pdf-parse, pdfjs-dist, react, react-dom, react-leaflet, read-excel-file, recharts, shadcn, tailwind-merge, tw-animate-css, zod

**DevDependencies** (18): @playwright/test, @tailwindcss/postcss, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/node, @types/react, @types/react-dom, @vitest/coverage-v8, chrome-devtools-mcp, eslint, eslint-config-next, jsdom, tailwindcss, typescript, vitest, ws, wscat

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

72 tablas definidas en `supabase/migrations/`:

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
| inventory | 040_inventory_universal.sql |
| inventory | 040_inventory_universal.sql |
| inventory | 040_inventory_universal.sql |
| inventory | 040_inventory_universal.sql |
| inventory | 043_rop_purchasing.sql |
| inventory | 043_rop_purchasing.sql |
| inventory | 043_rop_purchasing.sql |
| inventory | 043_rop_purchasing.sql |
| inventory | 043_rop_purchasing.sql |
| inventory | 044_eta_cx.sql |
| inventory | 044_eta_cx.sql |
| inventory | 044_eta_cx.sql |
| business_sales_config | 045_sales_config.sql |
| sales_order_counters | 045_sales_config.sql |
| IF | 047_analytics_schema.sql |
| IF | 048_inventory_analytics.sql |
| IF | 051_purchase_advisor_foundation.sql |
| IF | 053_experience_memory.sql |
| IF | 053_experience_memory.sql |

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
| 32 | 031_product_image_position.sql |
| 33 | 032_delivery_schema_expose.sql |
| 34 | 033_delivery_grants.sql |
| 35 | 034_inventory_hub.sql |
| 36 | 035_inventory_schema_expose.sql |
| 37 | 036_inventory_grants.sql |
| 38 | 037_business_edition.sql |
| 39 | 038_media_sent_products.sql |
| 40 | 039_media_type_simple.sql |
| 41 | 040_inventory_universal.sql |
| 42 | 041_inventory_trigger_v2.sql |
| 43 | 042_polymorphic_variants.sql |
| 44 | 043_rop_purchasing.sql |
| 45 | 044_eta_cx.sql |
| 46 | 045_sales_config.sql |
| 47 | 046_products_cost_and_gps_freshness.sql |
| 48 | 047_analytics_schema.sql |
| 49 | 048_inventory_analytics.sql |
| 50 | 050_analytics_foundation.sql |
| 51 | 051_purchase_advisor_foundation.sql |
| 52 | 052_fix_triggers.sql |
| 53 | 053_experience_memory.sql |
| 54 | 054_cloud_architecture.sql |
| 55 | 055_capability_foundation.sql |
| 56 | 056_cross_conversation_cancel_guard.sql |
| 57 | 20260820000000_analytics_public_wrapper.sql |
| 58 | 20260820000001_analytics_grant_permissions.sql |
| 59 | 20260820000002_analytics_security_definer.sql |
| 60 | 20260820000003_analytics_security_definer.sql |

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

104 rutas en `src/app/api/`:

```
accessibility
admin/analytics/inventory
admin/analytics/overview
admin/delivery/closures
admin/delivery/command-center
admin/delivery/drivers/[id]
admin/delivery/drivers/[id]/token
admin/delivery/drivers
admin/delivery/metrics
admin/delivery/orders/[id]/cancel
admin/delivery/orders
admin/delivery/routes/[id]/assign
admin/delivery/routes
admin/delivery/settings
admin/experience/patterns
admin/experience/suggestions/[id]
admin/experience/suggestions
admin/inventory/adjustments
admin/inventory/import
admin/inventory/items
admin/inventory/items/threshold
admin/inventory/movements
admin/inventory/predictions
admin/inventory/purchase-advisor
admin/inventory/settings
admin/inventory/suggestions/ai
admin/inventory/suggestions
admin/platform/actions/reconnect
admin/platform/actions/update-edition
admin/platform/billing-telemetry
admin/platform/channels
admin/platform/overview
assistants/[id]
business/memory/analyze
business/memory
business/product-intelligence
business/skills
business/weekly-report
cache/invalidate
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
cron/margin-audit
customers/memory/approve
customers/memory/batch
customers/memory/extract
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
laboratorio/sessions/[id]
laboratorio/sessions
laboratorio/teach
onboarding/chat
onboarding/complete
onboarding/state
pixel/track
prd/generate
profile/language
sales/config
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

31 páginas en `src/app/`:

```
(auth)/login
(auth)/signup
dashboard/accessibility
dashboard/analytics
dashboard/assistants/[id]/experience
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
dashboard/platform-admin
dashboard/settings
demo
driver/deliveries/[id]
driver/login
driver
/
widget
```

---

## 9. Componentes

134 componentes en `src/components/`:

```
accessibility/AccessibilitySettings.tsx
analytics/AnalyticsPanel.tsx
analytics/InventoryPanel.tsx
analytics/PurchaseAdvisorPanel.tsx
analytics/admin-api.ts
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
chat/ProductMessageCard.tsx
chat/TrainingChat.tsx
chat/TypingIndicator.tsx
connections/ConnectionFollowUpConfig.tsx
connections/ConnectionsManager.tsx
conversations/ConversationDetailModal.tsx
conversations/ConversationFilters.tsx
conversations/ConversationList.tsx
conversations/MemorySuggestionsPanel.tsx
customers/CustomerDataSection.tsx
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
dashboard/GettingStarted.tsx
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
delivery/CommandCenterMap.tsx
delivery/CommandCenterPanel.tsx
delivery/DeliveryAdmin.tsx
delivery/DeliveryClosuresPanel.tsx
delivery/DeliveryDriversPanel.tsx
delivery/DeliveryOrdersPanel.tsx
delivery/DeliveryPaywall.tsx
delivery/DeliveryRoutesPanel.tsx
delivery/DeliverySettingsPanel.tsx
delivery/DriverDetailModal.tsx
delivery/KPICard.tsx
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
experience/SuggestionCard.tsx
experience/SuggestionList.tsx
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
onboarding/OnboardingQuiz.tsx
onboarding/OnboardingWizard.tsx
platform/BridgeMonitor.tsx
platform/PlatformAdminDashboard.tsx
platform/TenantTable.tsx
sales/SalesConfigForm.tsx
signals/MIAInbox.tsx
signals/SignalIndicator.tsx
studio/AnalysisReport.tsx
studio/KnowledgeStudio.tsx
studio/ReadinessScore.tsx
studio/SuggestionCard.tsx
tour/TourOverlay.tsx
tour/TourProvider.tsx
tour/types.ts
training/MemoryTimeline.tsx
```

---

## 10. Módulos de Lógica (`src/lib/`)

134 módulos:

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
ai/providers.ts
ai/readiness.ts
ai/skills.ts
ai/task-routing.ts
ai/usage-report.ts
ai/weekly-report.ts
analytics/db.ts
analytics/margin-audit.ts
analytics/queries.ts
api-error.ts
auth.ts
baileys/bridge.ts
baileys/config.ts
baileys/webhook-auth.ts
cache/invalidator.ts
channels/adapters/baileys.ts
channels/adapters/web.ts
channels/adapters/whatsapp.ts
channels/adapters/widget.ts
channels/gateway.ts
channels/identity.ts
channels/types.ts
chat/sse.ts
chat/useTypingIndicator.ts
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
heuristic/blender.ts
heuristic/suggester.ts
heuristic/types.ts
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
inventory/eta.ts
inventory/forecasting.ts
inventory/import.ts
inventory/licensing.ts
inventory/predictions.ts
inventory/purchase-advisor.ts
inventory/purchasing.ts
inventory/rop.ts
inventory/rules.ts
inventory/stock.ts
inventory/suggestions.ts
inventory/types.ts
knowledge/suggestions.ts
onboarding/derive.ts
onboarding/quiz.ts
onboarding/types.ts
platform/jwt.ts
platform/types.ts
prd/builder.ts
prd/template.ts
reasoning/evidence-extraction-llm.ts
reasoning/evidence.ts
reasoning/prompt-enricher.ts
reasoning/state-loader.ts
reasoning/state.ts
runtime/assistant-gate.ts
runtime/conditional-media.ts
runtime/core.ts
runtime/evidence-extraction.ts
runtime/execute-ai.ts
runtime/intents.ts
runtime/media-guard.ts
runtime/media.ts
runtime/product-recommendation.ts
runtime/runtime.ts
runtime/stream-response.ts
runtime/types.ts
sales/cancel.ts
sales/detect.ts
sales/events.ts
sales/intent-classifier.ts
sales/process.ts
sales/widget.ts
supabase/admin.ts
supabase/client.ts
supabase/route-handler.ts
supabase/server.ts
system/accessibility.ts
system/capabilities.ts
system/demo.ts
system/edition.ts
system/health.ts
system/language.ts
system/routing.ts
tour/tours.ts
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

**Tareas registradas (147)**:

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
| TASK-20260811-220954273 | Protocolo de modos de trabajo MIA: 5 modos de interaccion agente-concilio | completed |
| TASK-20260811-222129849 | Auditoria y endurecimiento Subaru v2: fix multi-maquina, bootstrap, estado frozen, gates en complete, drift detallado + secret scan, docs | approved |
| TASK-20260811-225003841 | UsageBar deterministico: locale explicito es-MX en el formato numerico (test + componente) | approved |
| TASK-20260812-035924427 | WhatsApp en produccion: edition por tenant (migracion 037 + deploy) y reconciliacion read-path del estado channel_connections | approved |
| TASK-20260812-064235021 | Delivery Hub paywall por tenant: enmarcar capacidades delivery/inventory en la edition del negocio (ADR-019) | approved |
| TASK-20260812-073916531 | Estabilizar conectividad del bridge WhatsApp: host unico en Fly.io, MIA_APP_URL de produccion, puertos consistentes y anti-crash | in_progress |
| TASK-20260813-063009431 | Environment Runtime Normalization | in_progress |
| TASK-20260813-063009991 | API & WebSocket Diagnostic Tooling | in_progress |
| TASK-20260813-074636033 | Bridge WhatsApp: llamadas (rechazo defensivo) y notas de voz (respuesta del cerebro MIA) | completed |
| TASK-20260813-205411903 | Hacer determinista el formato numerico de UsageBar con locale explicito | completed |
| TASK-20260813-214825663 | Login password visibility toggle | completed |
| TASK-20260813-222347912 | Fix: edición de Problemas Detectados no persiste (env service role + errores silenciosos + feedback UI) | completed |
| TASK-20260813-232356688 | Directiva reforzada de reglas fundamentales: dominio estrictamente comercial en el system prompt | completed |
| TASK-20260813-235511359 | Tarjetas de producto enriquecidas en el chat web: adjuntar el producto recomendado por MIA al mensaje del asistente | approved |
| TASK-20260814-000546518 | Directiva del Concilio: reformular Rol, Reglas Fundamentales (4 reglas del inquilino) y Formato de Respuesta en el system prompt de MIA | completed |
| TASK-20260814-024029576 | Cerrar gaps del CRUD de Knowledge Base: reflejo inmediato del bot, activar/desactivar y versionado auditable | approved |
| TASK-20260814-031446183 | Regla de envio unico de imagen por producto/sesion + blindaje del pipeline multimedia del bot de WhatsApp (motor Vercel + bridge Fly.io) | approved |
| TASK-20260814-035326841 | Pasada final de limpieza y refactorización: alineación de tipado estricto Supabase, fix de tipos en workshop y verificación completa de calidad | completed |
| TASK-20260814-075051181 | Sellar compatibilidad multiplataforma (Windows): añadir .gitattributes con reglas explícitas de fin de línea y documentar la sección "Desarrollo en Windows" en el README | rejected |
| TASK-20260814-075127659 | Sellar compatibilidad multiplataforma (Windows): añadir .gitattributes con reglas explícitas de fin de línea y documentar la sección "Desarrollo en Windows" en el README | completed |
| TASK-20260814-184127939 | Evitar sesiones automaticas/vacias en el Laboratorio (normal test / chat directo) | completed |
| TASK-20260814-202922311 | Simplificar media_type de knowledge_items a solo image | testimonial | completed |
| TASK-20260814-225411178 | Run e2e tests against production server (next start) to fix Turbopack dev concurrency flakiness | completed |
| TASK-20260814-234953800 | Separar utilidades del chip de modulo en CommandStrip (tema, idioma, MIA Signals) | completed |
| TASK-20260815-001504327 | Tutorial interactivo contextual del dashboard (spotlight tour, activable desde sidebar) | completed |
| TASK-20260815-014157047 | Ajustes al tutorial interactivo: shell solo en Centro de Mando, boton Tutorial junto a Accesibilidad y tour de Knowledge Studio | completed |
| TASK-20260815-022944607 | Fix bucle de confirmacion: regla anti-bucle en prompts (4 diccionarios) y corolario en regla de pedido de Vitanova | completed |
| TASK-20260815-194306248 | Mejorar captura de direcciones y reducir repeticion de ciudad en cierres + fix boton Ensenarle a MIA | completed |
| TASK-20260816-021610 | Indicador 'escribiendo' en simulador web y typing presence real en WhatsApp (bridge) | completed |
| TASK-20260816-025216 | Migrar estilo visual de kusanali a MIA (tokens de diseño, fuentes y botones — solo look) | completed |
| TASK-20260816-032745 | Normalizar paleta del dashboard: fondo slate uniforme + azul único en todas las pantallas de Ventas | completed |
| TASK-20260816-034253 | Dar color de módulo a Inventario y Delivery: acento module-accent en sus pantallas + la ruta gana sobre el selector manual | completed |
| TASK-20260816-040159629 | Opcion Desechar por sugerencia en Enseñarle a MIA (TeachModal) | completed |
| TASK-20260816-042844183 | Logo MIA girando como indicador de carga (auth + dashboards) | completed |
| TASK-20260816-044156521 | Hacer visible el logo MIA girando (duracion minima en auth + loading dashboard) | completed |
| TASK-20260816-045059628 | Texto "Cargando… un momento" + color por modulo en loading del dashboard | completed |
| TASK-20260816-071246514 | Inventario Universal + Motor de IA (fase de diseno) — multi-industria | completed |
| TASK-20260816-072521677 | Inventario Universal F1: assets polimorfico + ledger universal + trigger v2 + motor predictivo hibrido | completed |
| TASK-20260816-075359212 | Acceso full para Vitanova (root): licencias DB-first por negocio | completed |
| TASK-20260816-091002865 | Fase 2 - Logistica predictiva y compras autonomas (variantes, ROP, ETA, CX) | completed |
| TASK-20260816-211422079 | Laboratorio: historial de sesiones gestionable + imágenes condicionales en el simulador | completed |
| TASK-20260816-220813618 | Efecto Scale & Elastic Pop en modales y ventanas flotantes de edición | completed |
| TASK-20260816-223701336 | Fix layout del Laboratorio: tarjeta Escenarios cortada y encogida | completed |
| TASK-20260816-224949925 | Glass Overlay Blur — transición de carga al cambiar de vista | completed |
| TASK-20260819-091751659 | Fix imagen incorrecta — resolveRecommendedProduct no resuelve productId por nombre, conditional-media devuelve genéricos de otros productos | approved |
| TASK-20260819-093136293 | Módulo Delivery Autónomo — App repartidor, geofencing, motor de rutas nativo, IA de re-enrutamiento y dashboard financiero | awaiting_council |
| TASK-20260820-105134487 | Experience Memory — Modelo C 70/30: Migración + API + Prompt + UI + Tests | completed |
| TASK-20260820-ADR026 | ADR-026: Super Admin Platform Dashboard — Cross-Tenant Control Tower | completed |
| TASK-20260820-ADR027 | ADR-027: MIA Cloud Architecture — Cloud MVP Implementation | approved |
| TASK-20260822-073403431 | Reparar suites de tests unitarios (55 fallos) - desbloqueo mision ADR-027 | approved |
| TASK-20260823-102540725 | Engineering Loop v0.1 - minimal worker handoff | approved |
| TASK-20260823-114235663 | Engineering Loop v0.2a - Accountable Handoff: Subaru obligatorio, precondicion de governance e INFRA_FAILURE | approved |
| TASK-20260824-002212903 | Loop Replication Proof v0.1 - Micro-loop Inventory sobre fixtures sinteticos (replica mecanica aislada del Engineering Loop) | approved |
| TASK-20260824-045951522 | refactor(media): clean conditional dispatch flow | completed |
| TASK-20260824-051612423 | fix(media): enforce concurrent dispatch uniqueness | in_progress |
| TASK-20260824-064237689 | Customer Data Integrity Loop V01: outcome cancelado invalido, errores DB silenciosos y enriquecimiento de customer | completed |
| TASK-20260824-075423444 | Customer Dashboard Visibility Loop V02: visibilidad de datos de customer en el dashboard | in_progress |
| TASK-20260824-084457229 | TECH-DEBT-REMEDIATION-V01 bounded remediation | in_progress |
| TASK-20260824-091820357 | INVARIANT-REGISTRY-V01 seed artifact | in_progress |
| TASK-20260824-093806189 | INVARIANT-VERIFICATION-V01 mechanical verification | completed |
| TASK-20260824-172511883 | MIA-FUNCTIONAL-INTEGRITY-V01 functional integrity audit | completed |
| TASK-20260824-174820058 | ENVIRONMENT-DRIFT-RESOLUTION-V01 foreign session forensics | completed |
| TASK-20260824-195702493 | BAILEYS-DISPATCH-E2E-V01 last-mile physical verification | completed |
| TASK-20260824-205443606 | BAILEYS-HOTFIX-AND-DEBT-REGISTRY-V01 | completed |
| TASK-20260825-CLOUD-R1R3 | MIA Cloud Freeze Remediation R-1..R-3 | approved |
| TASK-20260825-EVIDENCE-REASONING | MIA Evidence Accumulation & Customer State Architecture Review | completed |
| TASK-20260825-PRODUCT-ASSETS | Product Asset Unification Implementation | in_progress |
| TASK-20260828-071346359 | Fix: pedido cancelado re-confirmado en conversaciones nuevas | completed |
| TASK-20260830-005512058 | Fix cierre conversacional: gate contextual de afirmativas cortas en processSaleClosing + revision RC5 | in_progress |
| TASK-20260830-015556744 | POST-SALE conversational state: rama post-venta en prompt builder (anti-reconfirmacion tras SALE_WON) | approved |
| TASK-20260830-023352710 | DEEP PARITY & DISPATCH AUDIT — Simulator = Web Chat = WhatsApp (read-only, no implementation) | approved |
| TASK-20260830-024713217 | MIA PARITY MASTER AUDIT — canonical core, transcript/context, product integrity, Clean Nails->Neurotin, Option C eval (read-only, no implementation) | approved |
| TASK-20260830-025948794 | MIA PARITY ETAPA 2 UNIFICAR: fixes quirurjicos C1 (transcript desc+reverse), B1 (media solo del producto canonico + ORDER BY), B1b (eventos desde producto canonico), P1 (guards de cancelacion en todos los canales) + refactor a Shared MIA Core con adapters + parity tests | approved |

---

## 12. Decisiones de Arquitectura (ADRs)

28 ADRs en `docs/adr/`:

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
| 021-subaru-checkpoint | 021: Protocolo Subaru — Checkpoint de Misión Multi-máquina |
| 024-whatsapp-bridge-defensive-block | 024: WhatsApp Bridge — Bloque Defensivo (Llamadas y Notas de Voz) |
| 025-multi-domain-architecture | 025: MIA Platform Multi-Domain Architecture |
| 026-super-admin-platform-dashboard | 026: Super Admin Platform Dashboard |
| 027-mia-cloud-architecture | 027: MIA Cloud Architecture |
| ADR-022 | 022: Environment Runtime Normalization |
| ADR-023 | 023: API & WebSocket Diagnostic Tooling |

---

## 13. Tests

```
engineering-loop.test.ts
inventory-loop.test.ts
```

---

## 14. Commits Recientes

```
b5391ae feat(core): create processCore wrapper with CoreInput/CoreOutput (Step 2)
8b837de subaru: checkpoint TASK-20260830-0363673 - en-progreso
9e21382 docs: regenerate MASTER.md at 19dea9d
19dea9d feat(core): add CoreInput/CoreOutput contract interfaces (Step 1)
1933556 subaru: checkpoint TASK-20260830-0363673 - en-progreso
0f129a6 docs: regenerate MASTER.md at 8008ff0
8008ff0 subaru: checkpoint TASK-20260830-0363673 - listo
25d0fb5 docs: regenerate MASTER.md at 894e865
894e865 subaru: checkpoint TASK-20260830-0363673 - listo
2624e8d docs: regenerate MASTER.md at a9b5c0b
a9b5c0b fix(subaru): correct PARITY-E2 completion record — deferred gates not falsely claimed as PASS
0e7f34f subaru: checkpoint TASK-20260830-PARITY-E2 - completado
48b8d22 docs: regenerate MASTER.md at e6f4c27
e6f4c27 subaru: checkpoint TASK-20260830-PARITY-E2 - bloqueado
a01ab9e chore: gitignore parity/E2E mission artifacts (Q7)
27f5ee5 docs: regenerate MASTER.md at cda8054
cda8054 subaru: checkpoint TASK-20260830-PARITY-E2 - bloqueado
126c635 fix(parity): unifica semantica C1/B1/B1b/P1 entre canales (Etapa 2)
a075d04 docs: regenerate MASTER.md at 7587909
7587909 subaru: checkpoint TASK-20260830-PARITY-E2 - en-progreso
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
