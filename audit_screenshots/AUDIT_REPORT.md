# MIA Platform — Engineering Council Audit Report

**Date**: 2026-07-29
**HEAD**: `74e411d`
**Auditor**: Engineering Council (full assembly)
**Methodology**: UI navigation, code review, database schema analysis, API endpoint analysis, AI engine analysis
**Scope**: Complete product and functionality audit of the MIA Platform dashboard

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Complete Button Inventory](#2-complete-button-inventory)
3. [Broken Functionality](#3-broken-functionality)
4. [Fake Features / Placeholder UI](#4-fake-features--placeholder-ui)
5. [Missing MVP Functionality](#5-missing-mvp-functionality)
6. [AI Engine Audit](#6-ai-engine-audit)
7. [API Route Audit Summary](#7-api-route-audit-summary)
8. [Database / Persistence Audit](#8-database--persistence-audit)
9. [Security Audit Summary](#9-security-audit-summary)
10. [Performance Audit Summary](#10-performance-audit-summary)
11. [Static UI Pages (Conversations) — No Backend](#11-static-ui-pages--no-backend)
12. [Recommended Priority Order](#12-recommended-priority-order)
13. [Recommended Development Roadmap](#13-recommended-development-roadmap)

---

## 1. Executive Summary

### What MIA Platform Actually Is
MIA is a **conversational sales assistant platform** with:
- Multi-tenant architecture (business-scoped data)
- AI-powered chat (OpenAI `gpt-4o-mini`)
- Product, rule, and knowledge management
- Training via corrections (learning events → system prompt injection)
- Simulation/lab environment for testing
- Web widget and WhatsApp channel adapters
- Dashboard with readiness index, business memory, and skills tracking

### Strengths (What Works Well)
| Area | Assessment |
|------|-----------|
| **Auth** | Login, signup, Google OAuth, callback — all functional |
| **Dashboard** | Greeting, vital stats, module cards, daily report — functional with empty states |
| **Onboarding** | Conversational chat wizard — functional end-to-end |
| **Products CRUD** | Create, Read, Update, Delete — fully functional |
| **Rules CRUD** | Create, Read, Update, Delete — fully functional |
| **Knowledge CRUD** | Create, Read, Update, Delete — fully functional |
| **AI Instructions CRUD** | Create, Read, Update, Delete — fully functional |
| **Training Chat** | Streaming chat + correction workflow — functional |
| **Laboratorio** | Simulation, context panel, session history — functional |
| **Chat Widget** | Embeddable web widget — functional |
| **Channel Connections** | CRUD for channels (web, WhatsApp, Messenger, Instagram) — functional |
| **API Routes** | 28 endpoints, most with proper auth, validation, error handling |
| **Runtime Pipeline** | Full streaming + channel message pipeline with tracking |
| **Business Memory** | Pattern analysis, skill levels, weekly reports — functional |

### Critical Problems Summary

| # | Severity | Area | Problem |
|---|----------|------|---------|
| 1 | **CRITICAL** | Middleware | `src/proxy.ts` named `proxy.ts` instead of `middleware.ts` — Next.js does NOT execute it. No route protection, no token refresh. |
| 2 | **CRITICAL** | AI / Context | `customerMemory` parameter **never populated** — customer-specific memory is completely non-functional. AI has no memory of past interactions per customer beyond raw chat history. |
| 3 | **CRITICAL** | AI / Prompt | `context.ts:80` — bug: `id: k` instead of `id: k.id`. Knowledge item IDs in used_context metadata are wrong, breaking the audit trail. |
| 4 | **CRITICAL** | AI / Context | `knowledge.ts:116` queries `content` column on `knowledge_items` which doesn't exist (table has `question` and `answer`). Extraction context returns undefined content. |
| 5 | **HIGH** | Lab UI | `currentConversationId` in `LaboratorioClient` is initialized as `null` and **never set**. Session evaluation button is permanently invisible. `messageCount` permanently stuck at 0. |
| 6 | **HIGH** | Knowledge Studio | `.single()` throws error when no reports exist — crashes page for new users. |
| 7 | **HIGH** | AI Usage | 3 API routes call OpenAI but don't track usage via `recordAiUsage()` — `/api/laboratorio/evaluate`, `/api/knowledge/analyze` (hardcodes tokens_used: 0), `/api/knowledge/learn`. |
| 8 | **HIGH** | Ownership | 7 API routes (all lab + training endpoints) don't verify business ownership — could leak data across tenants. |
| 9 | **HIGH** | Training UI | `handleTestAgain` uses native DOM manipulation to bypass React controlled components — fragile, may break with React updates. |
| 10 | **MEDIUM** | Context Cache | 5-minute TTL with **no invalidation** on data mutations. `clearContextCache()` exists but never called. New products/rules/knowledge invisible until cache expires. |
| 11 | **MEDIUM** | Onboarding | `businessDescription` state is collected but **never saved** to database. Data loss. |
| 12 | **MEDIUM** | Onboarding | No transaction/rollback — if multi-step creation fails mid-way, orphan records remain. |
| 13 | **MEDIUM** | Product/Rules UI | **Silent failure** on write operations — if Supabase insert/update/delete returns error, user gets NO feedback. |
| 14 | **MEDIUM** | Training | Correction API errors are silently caught with `console.error` only — "saved" toast appears optimistically. |
| 15 | **MEDIUM** | Auth Callback | Open redirect vulnerability — `next` search param used directly without validation. |
| 16 | **MEDIUM** | Sidebar | **No logout button** — users cannot sign out from dashboard. |
| 17 | **MEDIUM** | Login | **No "Forgot password"** link — no password recovery path. |
| 18 | **MEDIUM** | Training Corrections API | Rule category hardcoded as `'payment'` regardless of actual content. |
| 19 | **LOW** | Conversations page | Static "Próximamente" placeholder — no functionality. |
| 20 | **LOW** | Assistant detail page | `/dashboard/assistants/[id]` does not exist — 404. |
| 21 | **LOW** | Lab session detail | `/dashboard/laboratorio/[id]` does not exist — 404. |
| 22 | **LOW** | Chat history | Limited to 20 messages. No summarization for long conversations. |
| 23 | **LOW** | Knowledge Studio | Two migrations with same `003_` prefix — one (`003_knowledge_studio.sql`) was never applied. Tables `knowledge_analysis_reports` and `knowledge_suggestions` might be missing. |
| 24 | **LOW** | Migration 011 | `mia_signals` table cannot be created — `business_id BIGINT` cannot reference `businesses(id UUID)`. |

---

## 2. Complete Button Inventory

### 2.1 Dashboard (Centro de Mando)

| Location | Button | Expected Behavior | Actual Behavior | Status | Recommendation |
|----------|--------|-------------------|-----------------|--------|---------------|
| Sidebar | Centro de Mando | Navigate to `/dashboard` | ✅ Navigates correctly | ✅ Complete | — |
| Sidebar | Relaciones | Navigate to `/dashboard/conversations` | ✅ Navigates to static placeholder | 🟡 Partial | Implement conversation list |
| Sidebar | Memoria | Navigate to `/dashboard/knowledge` | ✅ Navigates to Knowledge Center | ✅ Complete | — |
| Sidebar | Pensamiento | Navigate to `/dashboard/knowledge-studio` | ✅ Navigates to Knowledge Studio | ✅ Complete | — |
| Sidebar | Laboratorio | Navigate to `/dashboard/laboratorio` | ✅ Navigates to Simulator | ✅ Complete | — |
| Sidebar | Ajustes (expand) | Show/hide nested links | ✅ Toggles correctly | ✅ Complete | — |
| Sidebar | Conexiones (nested) | Navigate to `/dashboard/connections` | ✅ Navigates to Connections manager | ✅ Complete | — |
| Sidebar | Concilio (nested) | Opens Council section | ❓ Not audited (likely Council workflow) | ❓ Unknown | — |
| Hero Banner | Enséñame más | Navigate to `/dashboard/onboarding` | ✅ Navigates correctly | ✅ Complete | — |
| Top Bar | MIA encontró algo interesante | Shows MIA signal/message | ✅ Button exists and is clickable | 🟡 Partial | Verify signal flow |
| Top Bar | Cambiar a modo oscuro | Toggles dark mode | ✅ Toggles correctly | ✅ Complete | — |
| Vital Card | Conversaciones activas | Navigate to conversations | ✅ Navigates to placeholder | 🟡 Partial | Implement |
| Vital Card | Nuevos clientes | Shows count | ✅ Displays data | ✅ Complete | — |
| Vital Card | Mensajes gestionados | Navigate to conversations | ✅ Navigates to placeholder | 🟡 Partial | Implement |
| Vital Card | Preparación (readiness) | Navigate to Knowledge Studio | ✅ Navigates correctly | ✅ Complete | — |
| Module Card | Memoria | Navigate to `/dashboard/knowledge` | ✅ Navigates correctly | ✅ Complete | — |
| Module Card | Pensamiento | Navigate to `/dashboard/knowledge-studio` | ✅ Navigates correctly | ✅ Complete | — |
| Module Card | Laboratorio | Navigate to `/dashboard/laboratorio` | ✅ Navigates correctly | ✅ Complete | — |

### 2.2 Assistants

| Location | Button | Expected Behavior | Actual Behavior | Status | Recommendation |
|----------|--------|-------------------|-----------------|--------|---------------|
| List | Nueva asistente | Navigate to onboarding | ✅ Navigates correctly | ✅ Complete | — |
| Card | Entrenar | Navigate to training chat | ✅ Navigates correctly | ✅ Complete | — |
| Card | Productos | Navigate to products manager | ✅ Navigates correctly | ✅ Complete | — |
| Card | Reglas | Navigate to rules manager | ✅ Navigates correctly | ✅ Complete | — |
| Card | (Assistant name) | Click to view/edit assistant | ❌ Not a link — no detail page | 🔴 Missing | Create assistant detail/edit page |
| List | Eliminar asistente | Delete assistant | ❌ Not available | 🔴 Missing | Add delete functionality |
| List | Editar asistente | Edit assistant name/personality | ❌ Not available | 🔴 Missing | Add edit functionality |

### 2.3 Products Manager

| Location | Button | Expected Behavior | Actual Behavior | Status | Recommendation |
|----------|--------|-------------------|-----------------|--------|---------------|
| Form | Agregar producto | Create product in DB | ✅ Creates product | ✅ Complete | Add error feedback |
| List | Editar | Open edit form with data | ✅ Opens edit form | ✅ Complete | — |
| List | Eliminar | Delete product with confirmation | ✅ Deletes with dialog | ✅ Complete | Add error feedback |
| Save | Guardando... | Shows during save | ✅ Shows loading text | ✅ Complete | — |

### 2.4 Rules Manager

| Location | Button | Expected Behavior | Actual Behavior | Status | Recommendation |
|----------|--------|-------------------|-----------------|--------|---------------|
| Category | Zonas de envío | Select category for new rule | ✅ Selects category | ✅ Complete | — |
| Category | Métodos de pago | Select category for new rule | ✅ Selects category | ✅ Complete | — |
| Category | Horarios | Select category for new rule | ✅ Selects category | ✅ Complete | — |
| Category | Promociones | Select category for new rule | ✅ Selects category | ✅ Complete | — |
| Category | Restricciones | Select category for new rule | ✅ Selects category | ✅ Complete | — |
| Category | Escalación a humano | Select category for new rule | ✅ Selects category | ✅ Complete | — |
| List | Editar | Open edit form | ✅ Opens edit form | ✅ Complete | — |
| List | Eliminar | Delete with confirmation | ✅ Deletes with dialog | ✅ Complete | Add error feedback |

### 2.5 Knowledge Center

| Location | Button | Expected Behavior | Actual Behavior | Status | Recommendation |
|----------|--------|-------------------|-----------------|--------|---------------|
| Tabs | Base de Conocimiento | Show knowledge items tab | ✅ Shows tab | ✅ Complete | — |
| Tabs | Instrucciones IA | Show AI instructions tab | ✅ Shows tab | ✅ Complete | — |
| Tabs | Archivos | Show file learning tab | ✅ Shows tab | ✅ Complete | — |
| Filter | Categoría dropdown | Filter by category | ✅ Filters correctly | ✅ Complete | — |
| Form | Agregar conocimiento | Create knowledge item | ✅ Creates item | ✅ Complete | — |
| Search | Buscar conocimiento | Search/filter knowledge | ✅ Searches correctly | ✅ Complete | — |
| Item | Editar | Edit knowledge item | ✅ Opens edit form | ✅ Complete | — |
| Item | Eliminar | Delete knowledge item | ✅ Deletes item | ✅ Complete | — |

### 2.6 Training Chat

| Location | Button | Expected Behavior | Actual Behavior | Status | Recommendation |
|----------|--------|-------------------|-----------------|--------|---------------|
| Type | 🧠 Conocimiento | Select knowledge correction type | ✅ Selects type | ✅ Complete | — |
| Type | 📏 Regla | Select rule correction type | ✅ Selects type | ✅ Complete | — |
| Type | ⚙️ Instrucción | Select instruction correction type | ✅ Selects type | ✅ Complete | — |
| Chat | Enviar | Send message to AI | ✅ Sends and streams response | ✅ Complete | — |
| Response | ✅ Correcto | Approve response as correct | ✅ Creates learning event | ✅ Complete | — |
| Response | ✏️ Corregir | Open correction editor | ✅ Opens inline editor | ✅ Complete | — |
| Correction | Guardar | Save correction | ✅ Saves to API | 🟡 Partial | Optimistic toast, no error feedback |
| Correction | Probar de nuevo | Re-send with correction context | ✅ Substitutes corrected text back into chat | 🟡 Partial | Uses fragile DOM hack |

### 2.7 Laboratorio (Simulator)

| Location | Button | Expected Behavior | Actual Behavior | Status | Recommendation |
|----------|--------|-------------------|-----------------|--------|---------------|
| Selector | Business dropdown | Select business | ✅ Selects business | ✅ Complete | — |
| Selector | Assistant dropdown | Select assistant | ✅ Selects assistant | ✅ Complete | — |
| Mode | 🟢 Cliente Normal | Select normal mode | ✅ Selects mode | ✅ Complete | — |
| Mode | 🟡 Cliente Indeciso | Select indecisive mode | ✅ Selects mode | ✅ Complete | — |
| Mode | 🔴 Cliente Complicado | Select difficult mode | ✅ Selects mode | ✅ Complete | — |
| Mode | 💀 Cliente Exigente | Select demanding mode | ✅ Selects mode | ✅ Complete | — |
| Scenario | 💰 Precio | Load price scenario | ✅ Starts simulation | ✅ Complete | — |
| Scenario | 🚚 Envío | Load shipping scenario | ✅ Starts simulation | ✅ Complete | — |
| Scenario | 🛡️ Garantía | Load guarantee scenario | ✅ Starts simulation | ✅ Complete | — |
| Scenario | ⚖️ Comparación | Load comparison scenario | ✅ Starts simulation | ✅ Complete | — |
| Scenario | 🤔 Objeción | Load objection scenario | ✅ Starts simulation | ✅ Complete | — |
| Scenario | ⏰ Urgencia | Load urgency scenario | ✅ Starts simulation | ✅ Complete | — |
| Scenario | 🤷 No sé qué necesito | Load discovery scenario | ✅ Starts simulation | ✅ Complete | — |
| Chat | Enviar | Send simulated customer message | ✅ Streams assistant response | ✅ Complete | — |
| Context | Cliente / Técnico tabs | Toggle context panel view | ✅ Toggles correctly | ✅ Complete | — |
| Usage | 📥 Exportar | Export usage report | ✅ Button exists | 🟡 Partial | Verify export functionality |
| **Session** | **Evaluar sesión** | **Evaluate simulation session** | **🔴 NEVER SHOWS** — `currentConversationId` is always null | 🔴 Broken | Fix state management |

### 2.8 Connections

| Location | Button | Expected Behavior | Actual Behavior | Status | Recommendation |
|----------|--------|-------------------|-----------------|--------|---------------|
| Form | Canal dropdown | Select channel type | ✅ Dropdown works | ✅ Complete | — |
| Form | Asistente dropdown | Select assistant | ✅ Dropdown works | ✅ Complete | — |
| Form | Conectar | Connect channel | ✅ Creates channel connection | ✅ Complete | — |
| List | Eliminar | Disconnect channel | ✅ Deletes connection | ✅ Complete | — |
| Active | 🌐 Chat Web | Shows connected status | ✅ Shows "Conectado" badge | ✅ Complete | — |

### 2.9 Knowledge Studio

| Location | Button | Expected Behavior | Actual Behavior | Status | Recommendation |
|----------|--------|-------------------|-----------------|--------|---------------|
| Hero | Ejecutar Análisis | Run knowledge analysis | ✅ Calls API | 🟡 Partial | Verify analysis actually completes |
| Empty | Ejecutar Análisis (second) | Same as above | ✅ Same action | 🟡 Partial | — |

### 2.10 Onboarding

| Location | Button | Expected Behavior | Actual Behavior | Status | Recommendation |
|----------|--------|-------------------|-----------------|--------|---------------|
| Chat | Enviar | Send message to MIA | ✅ Sends and streams | ✅ Complete | — |
| Chat | (progress bar) | Show step completion | ✅ Shows step badges | ✅ Complete | — |

### 2.11 Auth Pages

| Location | Button | Expected Behavior | Actual Behavior | Status | Recommendation |
|----------|--------|-------------------|-----------------|--------|---------------|
| Login | Ingresar | Authenticate user | ✅ Logs in | ✅ Complete | — |
| Login | Google OAuth | Authenticate with Google | ✅ Works | ✅ Complete | — |
| Login | Crear cuenta | Navigate to signup | ✅ Navigates | ✅ Complete | — |
| Signup | Crear cuenta | Register new user | ✅ Creates account | ✅ Complete | — |
| Signup | Google OAuth | Register with Google | ✅ Works | ✅ Complete | — |
| Signup | ¿Ya tienes cuenta? | Navigate to login | ✅ Navigates | ✅ Complete | — |
| **All** | **Forgot password?** | **Recover password** | **🔴 NOT AVAILABLE** | 🔴 Missing | Add password recovery |

---

## 3. Broken Functionality

| # | Severity | Feature | Problem | Impact |
|---|----------|---------|---------|--------|
| 1 | **CRITICAL** | Middleware | `src/proxy.ts` named incorrectly (should be `middleware.ts`). Next.js does NOT execute it. All auth token refresh, route protection, and redirect logic is dead code. | No auth token refresh. Users may experience session expiration mid-use. Route protection relies solely on individual page auth guards. |
| 2 | **HIGH** | Laboratorio — Session Evaluation | `currentConversationId` is declared as `useState<string | null>(null)` and its setter is **never called**. The SessionEvaluation component is gated by `if (currentSessionId && currentConversationId)` so it NEVER renders. | Users cannot evaluate simulation sessions. The "Evaluar sesión" button is permanently invisible. This makes the entire evaluation flow dead. |
| 3 | **HIGH** | Laboratorio — Token Counter | `messageCount` is declared as `useState(0)` and **never updated**. The usage bar always shows 0 tokens, 0 messages, $0.0000 cost. | Users see incorrect analytics. No feedback on actual token consumption. |
| 4 | **HIGH** | AI — Customer Memory | `customerMemory` parameter in `buildMasterPrompt()` is **never populated** by any caller. Customer-specific AI memory is completely non-functional despite elaborate prompt template sections for it. | AI has no persistent memory of past interactions with a specific customer. Every conversation starts fresh. |
| 5 | **HIGH** | AI — Knowledge ID Bug | `context.ts:80`: `id: k` should be `id: k.id`. The entire knowledge item object is pushed as the `id` field instead of just the UUID. | The `usedContext` metadata has incorrect IDs for knowledge items. The `/api/laboratorio/analyze` route cannot look up knowledge items by this malformed ID. |
| 6 | **HIGH** | Knowledge Extraction | `knowledge.ts:116`: `.select('category, content')` on `knowledge_items` table which has `question` and `answer` columns, NOT `content`. | Knowledge extraction for document learning returns undefined content. The extraction flow is silently broken. |
| 7 | **MEDIUM** | AI Usage Tracking Gap | 3 routes call OpenAI without tracking: `evaluate`, `knowledge/analyze`, `knowledge/learn`. | Under-reported AI costs. `knowledge/analyze` hardcodes `tokens_used: 0` and `cost: 0`. |
| 8 | **MEDIUM** | Knowledge Studio | `.limit(1).single()` on empty table throws error (PGRST116). | Page crashes for new users with no analysis reports. |
| 9 | **MEDIUM** | Context Cache | 5-minute TTL cache **never invalidated**. `clearContextCache()` exists but is never called anywhere. | New products/rules/instructions/knowledge are invisible to the AI for up to 5 minutes after creation. |
| 10 | **MEDIUM** | Onboarding | `businessDescription` collected from user in wizard but **never saved** to `brand_identities`. Contains business_description field but insert doesn't include it. | User-inputted business description is lost. Data loss bug. |
| 11 | **MEDIUM** | Products/Rules UI | Write operations check `if (error)` but don't display the error to user when it's truthy. | Silent failures — user thinks data saved but it didn't. |
| 12 | **MEDIUM** | Training Chat | Correction save shows "saved" toast optimistically without confirming server response. If API fails, user sees false confirmation. | User believes correction was saved when it may not have been. |
| 13 | **MEDIUM** | Training "Test Again" | Uses `Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set` to bypass React's controlled input. | Fragile DOM hack. May break with React updates or StrictMode. |
| 14 | **MEDIUM** | Auth Callback | `next` search param used in redirect without validation. | Open redirect vulnerability — attacker could craft malicious callback URL. |
| 15 | **MEDIUM** | Training Corrections API | Rule category hardcoded as `'payment'` regardless of actual content. | All corrections of type "rule" are saved as "payment" category. |
| 16 | **LOW** | Onboarding | No transaction/rollback. If multi-step creation fails mid-way, orphan records remain. | Partial data on failure. |
| 17 | **LOW** | Knowledge Analyze API | Race condition: two concurrent POST requests can both pass the "analyzing" status check. | Duplicate analysis runs. |
| 18 | **LOW** | Business API routes | All use `.single()` for business query — fails for multi-business users with error instead of returning first. | Multi-business users get 500 errors. |
| 19 | **LOW** | Chat history | Limited to 20 messages for channel path. No summarization. | Long conversations lose context. |
| 20 | **LOW** | Wiki (ADR) | Migration 003_knowledge_studio.sql never applied (duplicate `003_` prefix with 003_training_corrections.sql). | `knowledge_analysis_reports` and `knowledge_suggestions` tables may not exist. |
| 21 | **LOW** | Migration 011 | `mia_signals` table cannot be created — type mismatch: `business_id BIGINT` cannot FK to `businesses(id UUID)`. | Migration is blocked. |

---

## 4. Fake Features / Placeholder UI

| # | Feature | Location | Problem | Impact | Recommendation |
|---|---------|----------|---------|--------|---------------|
| 1 | **Conversaciones / Relaciones** | `/dashboard/conversations` | Static "Próximamente" page. No real data, no conversation list, no customer history, no search. | Users expect to see real conversations. They see a placeholder. Major gap for a sales platform. | **P0**: Implement conversation management |
| 2 | **Evaluar Sesión** | Laboratorio | "Evaluar sesión" button exists in code but **never renders** because `currentConversationId` is never set. Dead UI. | Users cannot evaluate lab sessions from the UI. | **P1**: Fix state management |
| 3 | **Contador de Tokens** | Laboratorio | Usage bar shows Tokens: 0, Costo: $0.0000, Mensajes: 0 permanently. State never updates. | Misleading analytics. Users see zeros despite real conversations happening. | **P1**: Wire up counters |
| 4 | **Customer Memory** | AI System | Prompt template has elaborate "## Memoria del Cliente" section. Parameter exists in function signature. NO caller populates it. | AI has no customer-specific memory. Feature exists only in code, not in execution. | **P1**: Implement customer memory storage and loading |
| 5 | **Exportar (Lab)** | Laboratorio usage bar | "📥 Exportar" button exists. Export functionality verification pending. | May not produce useful output. | **P2**: Verify or implement |
| 6 | **Knowledge Studio Analysis** | `/dashboard/knowledge-studio` | "Ejecutar Análisis" runs. Results display pending — new users see empty state with no guidance on what happens next. | Users run analysis but may not see meaningful results. | **P2**: Improve results display |
| 7 | **Assistant Detail Page** | `/dashboard/assistants/[id]` | Route does not exist (returns 404). Users cannot view or edit assistant details. | Missing fundamental feature. | **P0**: Implement |
| 8 | **Lab Session Detail** | `/dashboard/laboratorio/[id]` | Route does not exist (returns 404). Users cannot review past sessions. | Cannot revisit or learn from past simulations. | **P2**: Implement |
| 9 | **Delete Assistant** | Assistants list | No delete or edit functionality for assistants. | Assistant lifecycle management incomplete. | **P1**: Implement |
| 10 | **Forgot Password** | Login page | No "Forgot password?" link. No password recovery flow. | Users locked out cannot recover. | **P1**: Implement |
| 11 | **Logout** | Sidebar | No logout button anywhere in app. | Users cannot sign out. Must clear cookies manually. | **P1**: Implement |
| 12 | **Business Description** | Onboarding Wizard | State variable `businessDescription` collected but never persisted to DB. | Data collected and discarded. Users waste time typing description that disappears. | **P1**: Fix persistence |
| 13 | **Knowledge Versions** | Training Corrections API | `/api/training/corrections` creates items but never creates `knowledge_versions` audit trail (unlike `/api/laboratorio/teach` which does). | Corrections made through training UI leave no audit trail. | **P2**: Add audit trail |

---

## 5. Missing MVP Functionality

### P0 — Cannot Sell Without This

| # | Feature | Current State | Why It's Critical |
|---|---------|--------------|-------------------|
| 1 | **Conversation Management** | Static "Próximamente" placeholder | A sales platform without a conversation view is incomplete. Business owners need to see who MIA talked to, what was said, and what happened. **This is the #1 missing feature.** |
| 2 | **Customer Management** | No UI for customers. `customers` table has data but no page to view/edit/manage customers. | Sales requires knowing your customers. No CRM view. |
| 3 | **Assistant Detail / Edit** | No page to view or edit assistant details (name, personality, avatar, status). | Users cannot customize their AI assistant after creation. |
| 4 | **Multi-assistant Management** | Can only create assistants via onboarding. No clone, duplicate, or advanced config. | Businesses with multiple brands/channels need multiple assistants. |

### P1 — Important for Customer Success

| # | Feature | Current State | Why It's Important |
|---|---------|--------------|-------------------|
| 1 | **Logout button** | Missing entirely | Basic auth requirement. |
| 2 | **Forgot password** | Missing | Account recovery. |
| 3 | **Customer Memory** | Broken — never populated | AI continuity per customer is core to sales. |
| 4 | **Lab Session Evaluation** | Broken — never renders | Core lab feature unusable. |
| 5 | **Lab Token Counter** | Stuck at 0 | Users need cost awareness. |
| 6 | **Error feedback on CRUD** | Silent failures | Users think data saved when it didn't. |
| 7 | **Delete Assistant** | Not available | Assistant lifecycle management. |
| 8 | **Context cache invalidation** | Never called | AI stale data window. |

### P2 — Improvement

| # | Feature | Current State |
|---|---------|--------------|
| 1 | Full conversation timeline view | Only summary on dashboard, no detail |
| 2 | Advanced readiness score components | Current score exists but limited drill-down |
| 3 | Priority management for rules | Column exists, UI doesn't expose it |
| 4 | Knowledge analysis results display | Analysis can run, results view limited |
| 5 | Lab session replay | No `[id]` page for past sessions |
| 6 | AI usage dashboards per session | Export button exists, detail pending |
| 7 | File learning for documents | API exists, UI verification pending |
| 8 | Multi-language support | Currently Spanish only |

### P3 — Future

| # | Feature | Notes |
|---|---------|-------|
| 1 | Sales Intelligence events | ADR-010 requires this for external integrations |
| 2 | Premium/paid tier (Lab billing) | Deferred per ADR-010 |
| 3 | Mobile responsiveness | Sidebar fixed-width, no collapse |
| 4 | Dark mode refinement | Toggle exists, completeness unknown |
| 5 | Web widget origin validation | No security on widget embedding |
| 6 | Email notifications | Not started |
| 7 | Analytics dashboard | Not started |

---

## 6. AI Engine Audit

### 6.1 Architecture Summary

```
User Message
    ↓
API Route / Channel Adapter
    ↓
loadConversationContext() → 6 DB sources + 5-min cache
    ↓
buildMasterPrompt() → monolithic system prompt (~2000+ tokens)
    ↓
executeAI() → OpenAI gpt-4o-mini
    ├── Stream: Vercel AI SDK (training, dashboard)
    └── Complete: OpenAI SDK (channels, max 500 tokens)
    ↓
trackAiUsage() → persist tokens + cost
    ↓
Response
```

### 6.2 What Affects AI Behavior

| Source | How It Affects AI | Status |
|--------|------------------|--------|
| **Brand Identity** | Injected as "Informacion del Negocio" section | ✅ Works |
| **Products** | Injected as "Productos" section with name, price, description, benefits | ✅ Works |
| **Sales Rules** | Injected as "Reglas de Venta" section with priority, category | ✅ Works |
| **AI Instructions** | Injected as "Instrucciones Adicionales" with authority tags | ✅ Works |
| **Knowledge Items** | Injected as "Conocimiento Adicional" with Q&A | ✅ Works |
| **Business Memory** | Injected as "Memoria Interna del Negocio" with evidence | ✅ Works |
| **Recent Lessons** | Injected as "Lo que he aprendido de ti" — up to 10 approved corrections | ✅ Works |
| **Hardcoded Rules** | 5 "Reglas Fundamentales" + 6-tier conflict resolution + autonomy rules | ✅ Always present |
| **Personality** | JSONB personality object → formatted as "warmth: 80, formality: 40, humor: 50, sales_aggressiveness: 50" | ✅ Works |
| **Customer Memory** | Never populated — section always omitted | ❌ **Broken** |

### 6.3 Training Effectiveness

Training works through **prompt injection only**:
1. User corrects MIA in Training Chat
2. Correction saved as `learning_event` (status: approved/modified)
3. On next conversation, `getRecentLessons()` loads up to 10 approved events
4. Events are formatted as "Lo que he aprendido de ti" section in system prompt
5. AI reads these as instructions for future behavior

**Limitations**:
- No fine-tuning, no vector DB, no RAG
- Limited to 10 lessons (hardcoded)
- Lessons must fit in context window
- No concept of importance weighting
- Lessons re-injected every call (no persistent behavior change)

### 6.4 Business Memory Pipeline

Works via `analyzeConversationPatterns()`:
1. Queries last 7 days of messages
2. Sends to OpenAI with analysis prompt
3. Extracts patterns, insights, trends
4. Upserts into `business_memory` table
5. Injected into future prompts with authority tags

Also calculates `skill_levels` and `learning_velocity`.

### 6.5 Critical AI Bugs

| # | File:Line | Bug | 
|---|-----------|-----|
| 1 | `context.ts:80` | `id: k` should be `id: k.id` — knowledge item ID in metadata is wrong |
| 2 | `knowledge.ts:116` | `.select('category, content')` — table has `question`, `answer`, no `content` |
| 3 | `prompts.ts:138,207` | `customerMemory` parameter never populated by any caller |
| 4 | `context.ts:24` | 5-min cache with no invalidation on mutations |

---

## 7. API Route Audit Summary

### 7.1 Route Inventory (28 endpoints)

| Route | Methods | Status | Issues |
|-------|---------|--------|--------|
| `/api/chat` | POST | ✅ Complete | None |
| `/api/seed` | POST | ✅ Complete | Minor — assumes first auth user |
| `/api/onboarding/chat` | POST | 🟡 Partial | No auth check, `request_type: 'onboarding'` not in enum |
| `/api/widget/chat` | POST | ✅ Complete | CORS enabled, admin client (intentional) |
| `/api/demo/chat` | POST | 🟡 Partial | In-memory rate limit, `request_type: 'demo'` not in enum |
| `/api/laboratorio/context` | GET | 🟡 Partial | Missing ownership validation |
| `/api/laboratorio/sessions` | GET, POST | 🟡 Partial | Missing ownership validation on POST |
| `/api/laboratorio/analyze` | POST | 🟡 Partial | N+1 queries, hardcoded confidence |
| `/api/laboratorio/evaluate` | POST | 🔴 Partial | **Missing AI usage tracking**, missing ownership |
| `/api/laboratorio/teach` | POST | 🟡 Partial | Silent failures, missing ownership |
| `/api/training/lessons` | GET | 🟡 Partial | N+1 queries, missing ownership |
| `/api/training/corrections` | POST | 🟡 Partial | Rule category hardcoded 'payment', missing ownership |
| `/api/knowledge/items` | GET, POST | ✅ Complete | None |
| `/api/knowledge/items/[id]` | GET, PATCH, DELETE | ✅ Complete | None |
| `/api/knowledge/instructions` | GET, POST | ✅ Complete | None |
| `/api/knowledge/instructions/[id]` | GET, PATCH, DELETE | ✅ Complete | None |
| `/api/knowledge/suggestions/[id]` | PATCH | ✅ Complete | None |
| `/api/knowledge/learn` | POST | 🟡 Partial | Missing AI usage tracking, PDF-parse import may be wrong |
| `/api/knowledge/learn/[id]` | GET, PATCH | 🟡 Partial | No knowledge_versions audit |
| `/api/knowledge/analyze` | POST, GET | 🔴 Partial | **Missing AI usage tracking, hardcodes tokens_used: 0** |
| `/api/knowledge/analyze/[reportId]` | GET | ✅ Complete | None |
| `/api/business/weekly-report` | GET, POST | ✅ Complete | Single-business assumption |
| `/api/business/skills` | GET | ✅ Complete | Single-business assumption |
| `/api/business/product-intelligence` | GET | ✅ Complete | Single-business assumption |
| `/api/business/memory` | GET | ✅ Complete | Single-business assumption |
| `/api/business/memory/analyze` | POST | ✅ Complete | Single-business assumption |
| `/api/channels/webhook/[channel]` | POST, GET | ✅ Complete | None |
| `/api/channels/connections` | GET, POST, DELETE | 🟡 Partial | Race condition in duplicate check |

### 7.2 Cross-cutting Issues

| Issue | Count | Affected Routes |
|-------|-------|----------------|
| Missing ownership validation | 7 | All laboratorio + training routes |
| Missing AI usage tracking | 3 | evaluate, knowledge/analyze, knowledge/learn |
| `request_type` enum violations | 2 | onboarding/chat, demo/chat |
| N+1 queries | 2 | laboratorio/analyze, training/lessons |
| Single-business assumption | 5 | All /api/business/* routes |

---

## 8. Database / Persistence Audit

### 8.1 Schema Status

| Migration | Tables | Status |
|-----------|--------|--------|
| 001_initial_schema | 15 core tables | **Applied** (assumed, not verifiable via MCP — separate project) |
| 002_lab_sessions | lab_sessions | **Applied** |
| 003_training_corrections | learning_events (alter) | **Applied** |
| **003_knowledge_studio** | **knowledge_analysis_reports, knowledge_suggestions** | **⚠️ NOT APPLIED** — duplicate prefix |
| 004_demo_business | Seed data | **Applied** |
| 005_channel_connections | channel_connections, channel_messages | **Applied** |
| 006_readiness_index | readiness_snapshots | **Applied** |
| 007_file_learning | learning_reports | **Applied** |
| 008_business_memory | 4 tables | **Applied** |
| 009_stage_based_learning | ALTER TABLE updates | **Applied** |
| 010_ai_cost_intelligence | ALTER TABLE updates | **Applied** |
| **011_mia_signals** | **mia_signals** | **⚠️ NOT APPLIED** — type mismatch (BIGINT vs UUID) |

### 8.2 RLS Coverage

| Coverage | Count | Tables |
|----------|-------|--------|
| ✅ Full (SELECT, INSERT, UPDATE, DELETE) | 6 | products, knowledge_items, sales_rules, ai_instructions, channel_connections, business_memory |
| 🟡 Partial (missing DELETE) | 12 | brand_identities, assistants, assistant_channels, customers, learning_events, lab_sessions, channel_messages, learning_reports, mia_skills, weekly_reports, conversations, messages |
| 🔴 Minimal (SELECT, INSERT only) | 5 | assistant_memories, conversations, messages, readiness_snapshots, learning_velocity_snapshots |

### 8.3 Tenant Isolation

| Type | Tables |
|------|--------|
| ✅ Direct `business_id` column | Majority of tables |
| ⚠️ Indirect (3+ JOINs) | messages → conversations → assistants → businesses |

---

## 9. Security Audit Summary

### Critical Issues

| # | Issue | Location | Risk |
|---|-------|----------|------|
| 1 | **Open redirect** | `auth/callback/route.ts:15` — `next` param used directly in redirect | Attacker crafts malicious callback URL to redirect users to phishing site after OAuth |
| 2 | **Missing ownership validation** on 7 lab/training API endpoints | All laboratorio + training routes | User A can read/write User B's data by guessing assistant/conversation IDs |
| 3 | **No middleware** | `proxy.ts` not named `middleware.ts` | No route protection, no CSRF, no token refresh |
| 4 | **Widget no origin validation** | `widget/page.tsx` | Any site can embed any assistant ID |

### Medium Issues

| # | Issue | Location |
|---|-------|----------|
| 5 | No logout button | Sidebar |
| 6 | Missing DELETE policies on 12 tables | Database |
| 7 | `request_type` enum violations | onboarding/chat, demo/chat |
| 8 | No rate limiting on main API routes | Most routes |

---

## 10. Performance Audit Summary

| # | Issue | Details |
|---|-------|---------|
| 1 | **No Suspense boundaries** on dashboard | All data must load before any content renders. 10+ parallel queries block initial render. |
| 2 | **N+1 queries** in analyze and lessons routes | Separate DB lookup per item |
| 3 | **Large system prompt** | Business context grows with data. 50+ knowledge items could push gpt-4o-mini's 16K context window. |
| 4 | **No vector search** | All knowledge is injected as raw text. No relevance-based retrieval. |
| 5 | **Indirect tenant JOINs** | Messages require 4-table JOIN for tenant isolation |
| 6 | **No pagination** on lessons query | `getRecentLessons` hardcoded to 10 |
| 7 | **5-min context cache** | Good for repeated queries, bad for freshness |
| 8 | **Chat history limited** to 20 messages | No summarization for long conversations |

---

## 11. Static UI Pages (Conversations) — No Backend

| Page | URL | Current State | Functionality |
|------|-----|---------------|---------------|
| **Conversaciones / Relaciones** | `/dashboard/conversations` | Static "PRÓXIMAMENTE" placeholder | **Zero functionality**. No conversation list, no customer view, no message history, no search. |

**Note**: The `customers` table exists with data, the `conversations` table would have data, and the `messages` table would have data. But there is NO UI to access this data. The sidebar link and dashboard cards all point to this empty page.

---

## 12. Recommended Priority Order

### P0 — Cannot Sell Without This
Must be fixed before MIA can be sold to customers:

1. **Conversation Management** — Implement `/dashboard/conversations` with real data (list, search, filter, detail view)
2. **Assistant Detail/Edit** — Create `/dashboard/assistants/[id]` page with edit capability
3. **Middleware fix** — Rename `proxy.ts` to `middleware.ts` or configure Next.js to use it
4. **Customer Memory** — Fix the never-populated customer memory parameter
5. **Lab Evaluation** — Fix `currentConversationId` state management

### P1 — Important for Customer Success
Should be fixed before onboarding first paying customers:

1. **Logout button** in sidebar
2. **Forgot password** on login page
3. **Error feedback** on CRUD operations (Products, Rules, Knowledge)
4. **Lab token counter** wiring
5. **Delete assistant** from list
6. **Context cache invalidation** on data mutations
7. **AI usage tracking** on evaluate/knowledge/analyze/knowledge/learn
8. **Ownership validation** on lab/training API routes
9. **Business description persistence** in onboarding
10. **Training correction API** — fix hardcoded rule category

### P2 — Improvement

1. Improve Knowledge Studio results display
2. Add lab session detail page (`/dashboard/laboratorio/[id]`)
3. Add knowledge_versions audit trail to training corrections
4. Implement rule priority UI
5. Fix N+1 queries in analyze and lessons routes
6. Implement pagination for knowledge/lessons
7. Add mobile-responsive sidebar (collapse/hamburger)
8. Implement customer management UI
9. Add multi-business support in API routes
10. Fix migration 011 (mia_signals type mismatch)

### P3 — Future

1. Vector search / RAG for large knowledge bases
2. Sales Intelligence event system (ADR-010)
3. Multi-language support
4. Email notifications
5. Analytics dashboard
6. Web widget origin validation
7. Chat history summarization
8. Premium tier / lab billing

---

## 13. Recommended Development Roadmap

### Sprint 1 — MVP Hardening (Fix P0 issues)
- Rename `proxy.ts` → `middleware.ts`
- Implement conversation list page
- Fix `currentConversationId` state in Laboratorio
- Create assistant detail/edit page
- Fix customer memory population in runtime

### Sprint 2 — Quality & Trust (Fix P1 issues)
- Add logout button and forgot password
- Add error feedback to all CRUD operations
- Fix lab token counter
- Add ownership validation to vulnerable API routes
- Implement context cache invalidation
- Fix AI usage tracking gaps

### Sprint 3 — Data & Persistence
- Apply missing migration 003_knowledge_studio
- Fix migration 011 (mia_signals type)
- Add missing RLS DELETE/UPDATE policies
- Add knowledge_versions audit to training corrections
- Fix business description persistence

### Sprint 4 — Intelligence
- Implement customer memory storage and retrieval
- Fix knowledge extraction bug (`content` vs `question`/`answer`)
- Fix knowledge item ID bug in context metadata
- Add vector search for large knowledge bases
- Implement conversation summarization

### Sprint 5 — Polish & Scale
- Mobile-responsive sidebar
- Lab session replay page
- Multi-business support in API routes
- Rule priority UI
- Analytics dashboard preparation

---

## Appendix A: Verdict Summary

| Area | Verdict |
|------|---------|
| **Auth** | ✅ Functional — with caveats (no logout, no password recovery) |
| **Onboarding** | ✅ Functional — with one data loss bug (business description) |
| **Dashboard** | ✅ Functional — good empty states, vital stats |
| **Products** | ✅ Complete CRUD — silent failure on error |
| **Rules** | ✅ Complete CRUD — silent failure, no priority UI |
| **Knowledge** | ✅ Complete CRUD — multiple API routes |
| **AI Instructions** | ✅ Complete CRUD |
| **Training** | ✅ Functional — fragile "test again" hack, optimistic saves |
| **Laboratorio** | 🟡 Functional — **broken evaluation**, **stuck token counter** |
| **Knowledge Studio** | 🟡 Partial — **crashes for new users**, missing tables possible |
| **Conversations** | 🔴 **NOT IMPLEMENTED** — static placeholder |
| **Connections** | ✅ Functional |
| **Widget** | ✅ Functional — no origin security |
| **AI Engine** | 🟡 Functional — **customer memory broken**, knowledge extraction broken, cache never invalidated |
| **Security** | 🟡 Multiple issues — open redirect, missing ownership validation, no middleware |
| **Database** | 🟡 2 migrations not applied, missing RLS policies on 17 tables |
| **Performance** | 🟡 N+1 queries, no pagination on key endpoints, no Suspense |

**Overall: Functional MVP with critical gaps in conversation management, AI memory, and multiple broken/bugged features that must be addressed before customer use.**
