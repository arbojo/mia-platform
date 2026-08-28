# Capability-Aware Onboarding & Configuration Discovery

**Status**: `MISSION_COMPLETE`  
**Date**: 2026-08-26  
**Loop**: Capability-Aware Onboarding & Configuration Discovery  
**Authoritative Inputs**: Capability Contract v2, Industry Taxonomy Decision, Capability Behavior Contract, Capability Integration Loop Report, Capability Congruence Merge, Capability Architecture Forensic, `capabilities.ts`, `edition.ts`, migration 055, onboarding components, context/prompt/readiness systems, business config tables

---

## Executive Summary

This loop analyzed the complete onboarding → configuration → capability pipeline for MIA Platform. The current onboarding discovers **0 of 28 capabilities** — it only creates brand identity, products, rules, and an assistant. The capability resolution engine (`resolveCapabilities()`) exists and works, but is never fed by onboarding.

**Solution**: An 8-question adaptive quiz that derives 20+ capabilities through industry defaults, language inference, and dependency resolution — replacing the current 3-step flow. No database changes required. All infrastructure exists.

---

## Phase 1 — Input Validation ✅

All authoritative inputs verified and read:

| Document | Status |
|----------|--------|
| `docs/architecture/capability-contract-v2.md` | ✅ Read |
| `docs/architecture/industry-taxonomy-decision.md` | ✅ Read |
| `docs/architecture/capability-behavior-contract.md` | ✅ Read |
| `docs/architecture/capability-integration-loop-report.md` | ✅ Read |
| `docs/architecture/capability-congruence-merge.md` | ✅ Read |
| `docs/architecture/capability-architecture-forensic.md` | ✅ Read |
| `src/lib/system/capabilities.ts` | ✅ Read |
| `src/lib/system/edition.ts` | ✅ Read |
| `supabase/migrations/055_capability_foundation.sql` | ✅ Read |
| `src/components/onboarding/ConversationalOnboarding.tsx` | ✅ Read |
| `src/app/api/onboarding/chat/route.ts` | ✅ Read |
| `src/lib/conversation/context.ts` | ✅ Read |
| `src/lib/ai/prompts.ts` | ✅ Read |
| Business config tables & APIs | ✅ Read |

---

## Phase 2 — Current Onboarding Pipeline Mapping

```
ConversationalOnboarding (3 steps)
         ↓
ExtractedData { business_name, products[], rules[], assistant_name }
         ↓
createBusiness()
         ↓
businesses (status=ready) + brand_identities + products + sales_rules + assistants + assistant_channels
         ↓
resolveCapabilities(businessId, edition, industry=null, capabilities=null)
         ↓
ResolvedCapabilities = CORE(8) only
         ↓
buildMasterPrompt(capabilities=CORE)
         ↓
Dashboard (ActivityRail filters by resolved capabilities)
```

**Critical Gap**: `industry` never asked, `capabilities` never configured, `onboarding_answers` never persisted. Resolution receives `null` for industry and capabilities → only core capabilities activate.

---

## Phase 3 — Configuration Field Forensics

### Complete Inventory & Classification

| Table | Field | Classification | Rationale |
|-------|-------|----------------|-----------|
| `businesses` | `id`, `owner_id`, `name`, `status` | `CORE_BUSINESS_DATA` | Tenant identity |
| `businesses` | `onboarding_status` | `UI_INPUT` | Flow state machine |
| `businesses` | `edition` | `CAPABILITY_STATE` | Edition ceiling → resolution |
| `businesses` | `deployment_model` | `OPERATIONAL_CONFIG` | Infra, not capability |
| `businesses` | `industry` | `CAPABILITY_INPUT` | Industry defaults → capabilities |
| `businesses` | `capabilities` | `CAPABILITY_STATE` | Explicit config (source='config') |
| `businesses` | `onboarding_answers` | `CAPABILITY_INPUT` | Re-derivation log |
| `businesses` | `capability_sources` | `CAPABILITY_STATE` | Debug metadata |
| `brand_identities` | `business_name`, `tagline`, `target_customers`, `differentiators`, `elevator_pitch`, `tone_of_voice` | `PROMPT_INPUT` | Prompt context |
| `brand_identities` | `avatar_url` | `UI_INPUT` | Visual only |
| `products` | `name`, `price`, `description`, `benefits`, `faq`, `restrictions` | `PROMPT_INPUT` | Catalog in prompt |
| `products` | `sku`, `image_url`, `documents`, `is_active` | `OPERATIONAL_CONFIG` | Inventory integration, visual, visibility |
| `sales_rules` | `category`, `content` | `PROMPT_INPUT` | Rules in prompt |
| `sales_rules` | `priority`, `is_active` | `OPERATIONAL_CONFIG` | Precedence, enablement |
| `ai_instructions` | `instruction` | `PROMPT_INPUT` | Direct prompt injection |
| `ai_instructions` | `priority`, `source`, `is_active` | `OPERATIONAL_CONFIG` | Precedence, authority, enablement |
| `knowledge_items` | `category`, `question`, `answer` | `PROMPT_INPUT` | Q&A in prompt |
| `knowledge_items` | `source`, `confidence`, `image_url`, `trigger_condition`, `product_id` | `OPERATIONAL_CONFIG` | Authority, media, scoping |
| `business_sales_config` | `confirmation_message`, `cancellation_message` | `PROMPT_INPUT` | Templates in prompt |
| `business_sales_config` | `ask_address`, `ask_phone`, `allow_cancellation`, `cancellation_window_hours`, `follow_up_hours`, `timezone` | `OPERATIONAL_CONFIG` | **Behavior config, not capability activation** |
| `inventory.business_settings` | `enabled` | `CAPABILITY_STATE` | **Only field mapping to MOD_INVENTORY** |
| `inventory.business_settings` | All others | `OPERATIONAL_CONFIG` | Thresholds, prediction, CX promises |
| `delivery.business_settings` | `enabled` | `CAPABILITY_STATE` | **Only field mapping to MOD_DELIVERY** |
| `delivery.business_settings` | All others | `OPERATIONAL_CONFIG` | Driver workflow, notifications, geo |
| `assistants` | `name`, `personality`, `communication_style` | `PROMPT_INPUT` | Assistant identity in prompt |
| `assistants` | `status`, `is_active` | `OPERATIONAL_CONFIG` | Lifecycle, enablement |
| `assistant_channels` | `channel` | `CAPABILITY_STATE` | Maps to CHANNEL_* capabilities |
| `assistant_channels` | `credentials`, `is_active` | `OPERATIONAL_CONFIG` | Auth, enablement |
| `edition.ts` | `whatsapp`...`analyticsDashboard` | `CAPABILITY_STATE` | Edition ceiling map |

**Key Distinction**: A field is `CAPABILITY_INPUT` only if it answers *"Does this business need this capability?"* Operational configuration answers *"How should this already-enabled capability behave?"*

---

## Phase 4 — Capability Discovery Matrix (28 Capabilities)

| Capability | Tier | Discoverable? | Explicit Question? | Inferred? | Later Config? | Default Source |
|------------|------|---------------|-------------------|-----------|---------------|----------------|
| CORE_CONVERSATION | Core | No (always) | No | N/A | No | default |
| CORE_PRODUCT_PRESENTATION | Core | No (always) | No | N/A | No | default |
| CORE_OBJECTION_HANDLING | Core | No (always) | No | N/A | No | default |
| CORE_CLOSING | Core | No (always) | No | N/A | No | default |
| CORE_KNOWLEDGE | Core | No (always) | No | N/A | No | default |
| CORE_MEMORY | Core | No (always) | No | N/A | No | default |
| CORE_CUSTOMER_MEMORY | Core | No (always) | No | N/A | No | default |
| CORE_LEARNING | Core | No (always) | No | N/A | No | default |
| CHANNEL_WHATSAPP | Channel | Yes | **Yes** | "vendo por WhatsApp" | Credentials | config/edition |
| CHANNEL_WEBCHAT | Channel | Yes | Auto | N/A (always) | No | default |
| CHANNEL_TELEGRAM | Channel | Yes | Low priority | Rare | Credentials | config/edition |
| CHANNEL_MULTI | Channel | Derived | No | ≥2 channels | No | dependency |
| CHANNEL_LANDING | Channel | Yes | Low priority | "tengo web/landing" | Setup | config/edition |
| SALES_EXPERIENCE | Sales | Yes | **Key question** | Industry + "quiero que venda" | No | onboarding/config |
| SALES_COMMERCIAL_INTELLIGENCE | Sales | Yes | Derived | If EXPERIENCE + edition | No | dependency |
| SALES_EXPECTATION_INTELLIGENCE | Sales | Yes | Derived | If EXPERIENCE + edition | No | dependency |
| SALES_RESPONSIBLE_SELLING | Sales | Yes | Optional confirm | If EXPERIENCE + edition | No | dependency |
| SALES_MULTI_PRODUCT | Sales | Yes | Derived | Product count > 1 | No | inference |
| SALES_SKU_VARIANTS | Sales | Yes | Derived | "tallas/colores/variantes" | No | inference |
| SALES_BULK_PRICING | Sales | Yes | Optional confirm | "mayoreo" + MULTI_PRODUCT | No | inference |
| SALES_QUOTE_REQUEST | Sales | Yes | Optional confirm | "cotización" + FOLLOWUP | No | inference |
| SALES_FOLLOWUP | Sales | Yes | **Key question** | "sigo clientes/recupero" | No | onboarding/config |
| SALES_RECOVERY | Sales | Yes | Derived | FOLLOWUP + "recupero perdidos" | No | dependency |
| MOD_INVENTORY | Module | Yes | **Key question** | "manejo stock/inventario" | Settings | onboarding/config |
| MOD_DELIVERY | Module | Yes | **Key question** | "hago envíos/reparto" | Settings | onboarding/config |
| MOD_ANALYTICS | Module | Yes | Derived | INVENTORY or DELIVERY | Settings | dependency |
| MULTIPLE_BUSINESSES | Meta | Yes | Low priority | "varios locales/negocios" | No | config/edition |
| MULTIPLE_ASSISTANTS | Meta | Yes | Low priority | "varios vendedores" | No | config/edition |

**Insight**: 8 core = never ask. 5 channels = 2 need questions. 10 sales = 2 need questions, 8 derived. 3 modules = 2 need questions. 2 meta = rarely need questions.

---

## Phase 5 — Minimum Viable Onboarding Quiz (8 Questions)

| # | Intent | User-Facing | Discovers | Capabilities Derived | Config Fields | Explicit/Inferred | Confirm? | Skip If |
|---|--------|-------------|-----------|---------------------|---------------|-------------------|----------|---------|
| 1 | Business identity | "¿Cómo se llama tu negocio y qué venden?" | name, description | — | brand_identities | Explicit | No | Never |
| 2 | Industry | "¿En qué rubro? (calzado, ropa, inmobiliaria, bienestar, servicios, otro)" | industry slug | Industry defaults | businesses.industry | Explicit | **Yes** | Never |
| 3 | Sales ambition | "¿Quieres que MIA venda activamente o solo informe?" | sales_mode | EXPERIENCE, COMMERCIAL_INTEL, EXPECTATION_INTEL, RESPONSIBLE | — | Explicit | **Yes** | Never |
| 4 | Follow-up | "¿Seguimiento y recuperación de clientes?" | followup_mode | FOLLOWUP, RECOVERY | — | Explicit | **Yes** | Q3=informative |
| 5 | Product complexity | "¿Variantes (tallas/colores) o mayorista?" | product_complexity | MULTI_PRODUCT, SKU_VARIANTS, BULK_PRICING | — | Inferred+Explicit | **Yes** (bulk) | Never |
| 6 | Modules | "¿Gestión de inventario y/o entregas?" | modules[] | INVENTORY, DELIVERY, ANALYTICS | inventory/delivery.enabled | Explicit | **Yes** | Edition blocks |
| 7 | Channels | "¿Por dónde atiendes? (WhatsApp, Web, Landing, Telegram)" | channels[] | WHATSAPP, TELEGRAM, LANDING, MULTI | assistant_channels | Explicit | **Yes** | Edition blocks |
| 8 | Assistant name | "¿Cómo se llama tu asistente?" | assistant_name | — | assistants.name | Explicit | No | Never |

**Derivation Logic**: Industry → defaults; Product count → MULTI_PRODUCT; "variantes" → SKU_VARIANTS; "mayoreo" + MULTI_PRODUCT → BULK_PRICING; "cotización" + FOLLOWUP → QUOTE_REQUEST; "sigo/recupero" → FOLLOWUP+RECOVERY; ≥2 channels → CHANNEL_MULTI; INVENTORY∨DELIVERY → ANALYTICS.

---

## Phase 6 — Inference vs Explicit Confirmation

### Three-State Model

```typescript
type CapabilityState = 'UNKNOWN' | 'ENABLED' | 'DISABLED'
```

### Inference Rules

| Signal | Inferred | State | Confirm? |
|--------|----------|-------|----------|
| Industry = `calzado` | SKU_VARIANTS, BULK_PRICING, MOD_INVENTORY | ENABLED | **Yes** (module) |
| Industry = `ropa` | SKU_VARIANTS, MOD_INVENTORY | ENABLED | **Yes** (module) |
| Industry = `inmobiliaria` | EXPERIENCE, QUOTE_REQUEST, FOLLOWUP | ENABLED | **Yes** (EXPERIENCE) |
| "vendo por WhatsApp" | CHANNEL_WHATSAPP | ENABLED | **Yes** |
| "hago envíos/reparto" | MOD_DELIVERY | ENABLED | **Yes** |
| "manejo stock" | MOD_INVENTORY | ENABLED | **Yes** |
| Product count > 1 | MULTI_PRODUCT | ENABLED | No |
| "tallas/colores" | SKU_VARIANTS | ENABLED | No |
| "mayoreo/volumen" | BULK_PRICING | ENABLED | **Yes** |
| "cotización/presupuesto" | QUOTE_REQUEST | ENABLED | **Yes** |
| "sigo clientes" | FOLLOWUP, RECOVERY | ENABLED | **Yes** |

### Critical Rules

1. **NEVER force UNKNOWN → DISABLED** — leave UNKNOWN for later config
2. **Modules ALWAYS require explicit confirmation** — operational impact, cost, settings
3. **Channels require explicit confirmation** — credentials, setup needed
4. **SALES_EXPERIENCE is master sales switch** — confirm explicitly
5. **Derived capabilities (MULTI, deps) never ask** — computed at resolution

---

## Phase 7 — Capability State Model

### State Definitions

| State | Location | Persisted? | Authoritative? | Recalculated? |
|-------|----------|------------|----------------|---------------|
| Configured Capabilities | `businesses.capabilities` | Yes | **Config source of truth** | On admin change |
| Industry Defaults | `businesses.industry` → `getIndustryDefaults()` | Via industry | Defaulting metadata | On industry change |
| Onboarding Answers | `businesses.onboarding_answers` | Yes | Re-derivation source | Never (immutable) |
| Capability Sources | `businesses.capability_sources` | Yes | Debug only | On resolution |
| **Resolved Capabilities** | Runtime `resolveCapabilities()` | No | **Runtime authority** | Every context load |
| Edition Ceiling | `businesses.edition` → `EDITIONS[edition]` | Yes | Hard constraint | On edition change |
| Operational Config | `business_sales_config`, `inventory/delivery.business_settings` | Yes | Behavior for active caps | On admin change |

### Resolution Order (from `capabilities.ts:281-372`)

1. Core capabilities → source='default'
2. Industry defaults → source='onboarding'
3. Explicit config (`businesses.capabilities`) → source='config' **← WINS**
4. Dependency resolution (soft deps) → source='dependency'
5. CHANNEL_MULTI special case (≥2 channels)
6. Conflict resolution (remove invalid combos)
7. **Edition ceiling enforcement** → remove caps not in edition **← HARD CEILING**

### Invariants

- Configured capabilities persist; resolved are ephemeral
- Edition is ceiling; config wins over industry; core always wins
- Downgrade preserves config, hides from resolved; upgrade restores

---

## Phase 8 — Onboarding → Configuration Contract

### Transformation Pipeline

```
Onboarding Answers (Q1-Q8)
         ↓
normalizeAnswers()
         ↓
Business Profile { name, industry, salesMode, followupMode, productComplexity, modules[], channels[], assistantName }
         ↓
deriveCapabilities(profile, edition)
         ↓
Capability Intent { explicit[], inferred[], unknown[] }
         ↓
persistToBusiness()
         ↓
Business Row:
  industry = profile.industry
  capabilities = explicit + inferred (deduped)
  onboarding_answers = rawAnswers
  capability_sources = { [capId]: 'onboarding' | 'inferred' }
  onboarding_status = 'ready'
         ↓
Operational Config Seeds:
  modules.inventory → inventory.business_settings { enabled: true, vertical: industry, ... }
  modules.delivery → delivery.business_settings { enabled: true, ... }
  salesMode=active → business_sales_config { ...defaults }
  channels → assistant_channels rows
```

**No new tables required** — all targets exist.

---

## Phase 9 — Capability → Dashboard Congruence

| Surface | Required Capability | Visible When | Hidden When | UNKNOWN Behavior |
|---------|---------------------|--------------|-------------|------------------|
| Dashboard Home | (core) | Always | Never | — |
| Inventory | `MOD_INVENTORY` | Active + enabled=true | Inactive OR edition blocks | Hide + "Inventario no habilitado" CTA |
| Delivery | `MOD_DELIVERY` | Active + enabled=true | Inactive OR edition blocks | Hide + "Entregas no habilitado" CTA |
| Analytics | `MOD_ANALYTICS` | Active + (INV∨DEL) | Inactive | Hide |
| Catalog | `SALES_MULTI_PRODUCT`∨`SKU_VARIANTS` | Any sales cap | No sales caps | Basic products only |
| Laboratorio | `SALES_EXPERIENCE` + `salesSimulator` (edition) | Both true | Either false | "Simulador no disponible en tu plan" |
| Connections | `CHANNEL_*` | Resolved + edition | No channel caps | "Conecta un canal" CTA |

**Rule**: Dashboard reads **ONLY resolved capabilities**. UNKNOWN = inactive for visibility.

---

## Phase 10 — Capability → Prompt Congruence

### Current Wiring

| Capability | Prompt Wired? | Section |
|------------|---------------|---------|
| CORE_* (8) | ✅ | Base prompt |
| CHANNEL_WHATSAPP | ✅ | `channelNote` (WhatsApp tone + intent tag) |
| CHANNEL_WEBCHAT | ✅ | Default |
| CHANNEL_TELEGRAM | ⚠️ Partial | No specific section |
| CHANNEL_LANDING | ✅ | `landingNote` + `productContextNote` |
| MOD_INVENTORY | ✅ | Lines 368-369 (conditional) |
| MOD_DELIVERY | ✅ | Lines 370-371 (conditional) |
| SALES_EXPERIENCE | ❌ | **Missing** |
| SALES_FOLLOWUP/RECOVERY | ❌ | **Missing** |
| SALES_QUOTE_REQUEST | ❌ | **Missing** |
| SALES_BULK_PRICING | ❌ | **Missing** |
| SALES_SKU_VARIANTS | ❌ | **Missing** |
| SALES_RESPONSIBLE_SELLING | ❌ | **Missing** |
| SALES_COMMERCIAL_INTELLIGENCE | ❌ | **Missing** |
| MOD_ANALYTICS | ❌ | Should not affect prompt |
| MULTIPLE_BUSINESSES/ASSISTANTS | ❌ | Platform routing |

### Capabilities That Should NOT Affect Prompt

- `MOD_ANALYTICS` — cross-domain insights
- `MULTIPLE_BUSINESSES` / `MULTIPLE_ASSISTANTS` — platform routing
- `CHANNEL_MULTI` — routing logic
- `CHANNEL_TELEGRAM` — no unique style needed

---

## Phase 11 — Vertical Simulation (6 Verticals)

### 1. Wellness / Vitanova
- Industry: `wellness_beauty` → defaults: EXPERIENCE, WHATSAPP
- Modules: none
- Result: CORE + WHATSAPP + WEB + MULTI + Sales Intelligence (no modules)

### 2. Zapatería
- Industry: `calzado` → defaults: SKU_VARIANTS, BULK_PRICING, INVENTORY
- Modules: INVENTORY
- Result: Full sales + inventory + analytics

### 3. Inmobiliaria
- Industry: `inmobiliaria` → defaults: EXPERIENCE, QUOTE_REQUEST, FOLLOWUP
- Channels: WHATSAPP, WEB, LANDING
- Result: Sales intelligence + landing channel

### 4. Ropa/Moda
- Industry: `ropa` → defaults: SKU_VARIANTS, INVENTORY
- Modules: INVENTORY
- Followup: later
- Result: Variants + inventory, no followup

### 5. Servicio Genérico (Plomería)
- Industry: `general`
- Sales: informative only
- Result: CORE + WHATSAPP + WEB + MULTI only

### 5. B2B Mayorista
- Industry: `general`
- Product: bulk pricing, no variants
- Modules: INVENTORY
- Result: Bulk pricing + quotes + inventory + full enterprise

**All 6 verticals use same quiz, same derivation, same resolution — zero vertical-specific code.**

---

## Phase 12 — Godzilla Adversarial Review

| Hypothesis | Result | Evidence |
|------------|--------|----------|
| H1: NL onboarding incorrectly activates caps | **SURVIVES** | Structured quiz, not free-text parsing |
| H2: Industry becomes accidental source of truth | **SURVIVES** | Config (step 3) > Industry (step 2) > Edition (step 7) |
| H3: Operational settings confused with capability activation | **SURVIVES** | Only `enabled` fields map to capabilities |
| H4: UNKNOWN accidentally becomes DISABLED | **SURVIVES** | Three-state model; resolution never writes DISABLED |
| H5: Edition and capability state contradict | **SURVIVES** | Ceiling enforced last; config preserved |
| H6: Dashboard/runtime drift | **PARTIALLY_SURVIVES** | ActivityRail uses resolved; must enforce for ALL surfaces |
| H7: Quiz becomes enormous wizard | **SURVIVES** | 8 questions, heavy derivation, conditional skip |
| H8: Re-onboarding overwrites admin config | **SURVIVES** | Config wins over onboarding in resolution |
| H9: Active capability without runtime behavior | **PARTIALLY_SURVIVES** | 11/28 caps lack prompt wiring (see Phase 10) |
| H10: Requires vertical-specific exceptions | **SURVIVES** | All 6 verticals simulated with same logic |

---

## Phase 13 — Minimal Architecture

### Files to Modify
- `src/app/api/onboarding/chat/route.ts` — Adaptive quiz engine
- `src/components/onboarding/ConversationalOnboarding.tsx` → `OnboardingQuiz.tsx`
- `src/lib/system/capabilities.ts` — Export `deriveCapabilities()`, `normalizeAnswers()`
- `src/lib/ai/knowledge.ts` — Add `seedOperationalConfig()`

### Files to Create
- `src/lib/onboarding/types.ts`
- `src/lib/onboarding/quiz.ts`
- `src/lib/onboarding/derive.ts`
- `src/app/api/onboarding/complete/route.ts`
- `src/app/api/onboarding/state/route.ts`

### Database Changes: **NONE** — all columns/tables exist (migrations 031, 034, 045, 055)

### Prompt Additions Needed (7 capabilities)
- SALES_EXPERIENCE, SALES_SKU_VARIANTS, SALES_BULK_PRICING, SALES_QUOTE_REQUEST, SALES_FOLLOWUP, SALES_RECOVERY, SALES_RESPONSIBLE_SELLING

---

## Phase 14 — Implementation Sequence

```text
Week 1: Foundation (types, quiz, derive, tests)
Week 2: Onboarding API + UI rewrite
Week 3: Resolution verification (edition transitions, config persistence)
Week 4: Dashboard congruence audit + guards
Week 5: Prompt congruence (7 sales intelligence sections)
Week 6: 6 vertical E2E + Godzilla stress test
```

---

## Phase 15 — Final Architecture Contract

1. **Onboarding discovers**: Identity, industry, sales ambition, followup, product complexity, modules, channels, assistant name
2. **Onboarding infers**: 20+ capabilities via industry defaults + language signals + dependency resolution
3. **Persisted**: `businesses.{industry,capabilities,onboarding_answers,capability_sources}` + brand/assistant/channels + seeded operational config
4. **Remains configuration**: All OPERATIONAL_CONFIG fields (post-onboarding tuning)
5. **Active capabilities**: `resolveCapabilities()` — Core → Industry → Config → Deps → Conflicts → **Edition ceiling**
6. **Dashboard visibility**: Resolved capabilities only — UNKNOWN = hidden
7. **Prompt behavior**: `buildMasterPrompt({ capabilities: resolved })` — conditional sections for modules; sales intelligence wiring pending
8. **Edition eligibility**: `getEffectiveEdition()` → hard ceiling at resolution step 7
9. **UNKNOWN handling**: Inactive — hidden from dashboard, omitted from prompt, config not seeded, re-enableable later
10. **Source-of-truth conflicts prevented**: Config > Industry > Edition ceiling; single resolution function; dashboard uses resolved only

### Preservation Invariants
> ✅ Industry is descriptive/defaulting metadata, not capability authority  
> ✅ Edition is the ceiling  
> ✅ Capabilities represent what the business has enabled  
> ✅ Operational configuration represents how an enabled capability behaves  

---

## Phase 16 — Validation (Read-Only)

| Check | Command |
|-------|---------|
| TypeScript | `npx tsc --noEmit` |
| ESLint | `npm run lint` |
| Build | `npm run build` |
| Unit tests | `npm test -- tests/unit/capabilities.test.ts` |
| New unit tests | `npm test -- tests/unit/onboarding-derive.test.ts` |
| E2E | `npm test` |

---

## Phase 17 — Deliverables

This document: `docs/architecture/capability-aware-onboarding-discovery.md`

---

## Loop Termination Report

| Metric | Value |
|--------|-------|
| Terminal State | `MISSION_COMPLETE` |
| Phases Completed | 17/17 |
| Files Created | 1 (this document) |
| Files Modified | 0 |
| Files Deleted | 0 |
| Implementation | 0 |
| Database Changes | 0 |

### Critical Findings
1. Current onboarding discovers 0/28 capabilities
2. 11 capabilities active but not expressed in prompt (sales intelligence gap)
3. Dashboard congruence verified for ActivityRail; must enforce for all surfaces
4. No DB migrations needed — all infrastructure exists
5. 8-question adaptive quiz replaces 3-step flow with full derivation

### Unresolved Human Decisions
1. Which 7 sales intelligence capabilities get prompt sections (priority)?
2. Industry taxonomy expansion (servicios, b2b, alimentacion)?
3. Quiz i18n strategy?
4. Confirmation UX pattern (modal/inline/toast)?
5. Abandoned quiz resume behavior?

### Recommended Next Loop
**Implementation Loop** — Execute Phase 13-14 sequence with Governance Gate (CTO + Architect + Domain Expert + AI Engineer approval).