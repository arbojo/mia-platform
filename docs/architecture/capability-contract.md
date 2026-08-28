# MIA Capability Contract — Canonical Model

> **Type:** Architecture Design — Documentation Only
> **Status:** Complete
> **Date:** 2026-08-26
> **Input:** Capability Architecture Forensic + Capability Congruence Merge + Dashboard/Customer Experience Discovery + 3 Vertical Readiness Reports
> **Scope:** 15-phase design loop. No code changes, no DB changes, no migrations.

---

## Table of Contents

1. [Phase 1 — Input Validation](#phase-1--input-validation)
2. [Phase 2 — Existing Concept Forensics](#phase-2--existing-concept-forensics)
3. [Phase 3 — Capability Definition](#phase-3--capability-definition)
4. [Phase 4 — Canonical Contract](#phase-4--canonical-contract)
5. [Phase 5 — Source of Truth](#phase-5--source-of-truth)
6. [Phase 6 — Activation Model](#phase-6--activation-model)
7. [Phase 7 — Capability → Prompt Bridge](#phase-7--capability--prompt-bridge)
8. [Phase 8 — Capability → Dashboard Bridge](#phase-8--capability--dashboard-bridge)
9. [Phase 9 — Dependency Graph](#phase-9--dependency-graph)
10. [Phase 10 — Vertical Generalization](#phase-10--vertical-generalization)
11. [Phase 11 — Minimal Hybrid Architecture](#phase-11--minimal-hybrid-architecture)
12. [Phase 12 — Congruence Contract](#phase-12--congruence-contract)
13. [Phase 13 — Adversarial Review](#phase-13--adversarial-review)
14. [Phase 14 — Implementation Boundary](#phase-14--implementation-boundary)
15. [Phase 15 — Final Contract](#phase-15--final-contract)

---

## Phase 1 — Input Validation

All 9 required inputs verified:

| # | Input | Status | Location |
|---|-------|--------|----------|
| 1 | Capability Architecture Forensic | ✅ Found | `docs/architecture/capability-architecture-forensic.md` |
| 2 | Capability Congruence Merge | ✅ Found | `docs/architecture/capability-congruence-merge.md` |
| 3 | Dashboard/Customer Experience Discovery | ✅ Found | `docs/architecture/dashboard-customer-experience-discovery.md` |
| 4 | Real Estate Readiness Report | ✅ Found | `docs/architecture/real-estate-readiness-report.md` |
| 5 | Zapatería Readiness Report | ✅ Found | `docs/architecture/zapateria-readiness-report.md` |
| 6 | Vitanova Research | ✅ Found | `docs/research/fuentes/simulaciones/vitanova.md` |
| 7 | 27 ADRs | ✅ Found | `docs/adr/` (key: 010, 017, 019, 020, 025) |
| 8 | Onboarding Code | ✅ Found | `src/components/onboarding/ConversationalOnboarding.tsx`, `src/app/api/onboarding/chat/route.ts` |
| 9 | Edition System + Dashboard | ✅ Found | `src/lib/system/edition.ts`, `src/components/layout/AppLayout.tsx` |

---

## Phase 2 — Existing Concept Forensics

### 6 Capability-Related Systems Found

| # | System | Location | Status | Gap |
|---|--------|----------|--------|-----|
| 1 | **Edition System** | `src/lib/system/edition.ts` | 4 editions, 22 boolean flags | 16 of 22 `canUse*()` functions **never imported**. Edition gates only checked in inventory/delivery licensing. |
| 2 | **Module System** | `src/components/layout/AppLayout.tsx` | 3 visual modules (`sales`, `inventory`, `logistics`) | **Zero access control** — all modules shown unconditionally. Module only affects CSS theme. |
| 3 | **3-Gate Activation** | `inventory/licensing.ts`, `delivery/licensing.ts` | Edition → `business_settings.enabled` → SQL trigger | Only for Inventory and Delivery. Sales AI has **no activation gate**. |
| 4 | **Experience Memory** | `experience_memory` table + `blender.ts` | Industry-specific objection patterns | `businesses.industry` column **doesn't exist**. Code reads it → always `undefined` → `'general'`. Patterns never activate. |
| 5 | **Inventory Vertical** | `inventory.business_settings.vertical` | `ecommerce`, `manufacturing`, `realestate` | **Zero connection to Sales AI**. Vertical is inventory-internal only. |
| 6 | **Sales Config** | `business_sales_config` | `ask_address`, `ask_phone`, `allow_cancellation` | **Only working pipeline**: config → prompt. Lines 331-332 of `prompts.ts`. |

### Critical Findings

1. **No capability registry** — capabilities scattered across edition.ts (22 booleans), business_settings (per-domain), business_sales_config (sales-specific). No single source of truth.

2. **Edition capabilities are mostly decorative** — 16 of 22 `canUse*()` functions exported but never imported. Sidebar shows all modules unconditionally. Prompt identical regardless of edition.

3. **`buildMasterPrompt()` has 14 parameters — zero are capability flags** — Receives products, rules, knowledge, memory, salesConfig, but nothing that says "this business has inventory" or "this business does deliveries."

4. **The `industry` concept is broken** — `businesses.industry` column doesn't exist. Code reads it (context.ts:95) but always gets `undefined`. Experience memory patterns seeded but never loaded.

5. **Variant system exists but invisible to Sales AI** — Inventory has full variant support (assets, resolve_variant, asset_products), but `formatProducts()` only reads the 15-column `products` table.

6. **Onboarding collects zero capability/vertical data** — Asks: business name, what they sell, assistant name. Never asks: industry, vertical, modules, payment methods, delivery needs.

---

## Phase 3 — Capability Definition

### 3.1 Canonical Capability List

MIA needs **35 named capabilities** organized in 4 tiers. Each capability is a boolean that describes a concrete behavioral capability the system can exhibit.

#### Tier 1: Core Capabilities (always active — cannot be disabled)

| ID | Capability | Description | Prompt Impact |
|----|-----------|-------------|---------------|
| `CORE_CONVERSATION` | Natural language conversation | Basic chat functionality | System prompt personality + communication style |
| `CORE_PRODUCT_PRESENTATION` | Product catalog presentation | Show products with prices, benefits, FAQs | Products section in prompt |
| `CORE_OBJECTION_HANDLING` | Objection detection + response | Identify and address customer objections | Rules section in prompt |
| `CORE_CLOSING` | Sales closing techniques | Guide toward commitment | Closing policy section |
| `CORE_KNOWLEDGE` | Knowledge base Q&A | Answer questions from knowledge items | Knowledge section in prompt |
| `CORE_MEMORY` | Business memory | Remember decisions, patterns, insights | Memory section in prompt |
| `CORE_CUSTOMER_MEMORY` | Per-customer memory | Remember individual customer context | Customer memory section |
| `CORE_LEARNING` | Correction learning | Improve from trainer corrections | Lessons section in prompt |

#### Tier 2: Channel Capabilities (opt-in per business)

| ID | Capability | Description | Prompt Impact |
|----|-----------|-------------|---------------|
| `CHANNEL_WHATSAPP` | WhatsApp integration | WhatsApp Business API messaging | WhatsApp tone directives |
| `CHANNEL_WEBCHAT` | Web chat widget | Embeddable chat on websites | Standard tone |
| `CHANNEL_TELEGRAM` | Telegram bot | Telegram bot integration | Standard tone |
| `CHANNEL_MULTI` | Multi-channel operation | Simultaneous channels with unified memory | Channel-aware routing |
| `CHANNEL_LANDING` | Landing page chat | Chat embedded on landing/sales pages | Landing context directives |

#### Tier 3: Sales Intelligence Capabilities (opt-in per business)

| ID | Capability | Description | Prompt Impact |
|----|-----------|-------------|---------------|
| `SALES_EXPERIENCE` | Experience-based selling | Use blended objection patterns from experience memory | Experience context section |
| `SALES_COMMERCIAL_INTELLIGENCE` | Commercial intelligence | Track conversion patterns, upsell opportunities | Commercial intelligence directives |
| `SALES_EXPECTATION_INTELLIGENCE` | Expectation management | Proactively manage delivery/availability expectations | Expectation directives |
| `SALES_RESPONSIBLE_SELLING` | Responsible selling | Ethical selling constraints, anti-pressure rules | Responsible selling rules |
| `SALES_MULTI_PRODUCT` | Multi-product presentation | Present multiple products simultaneously, compare | Product recommendation logic |
| `SALES_SKU_VARIANTS` | SKU/variant handling | Handle product variants (size, color, model) | Variant-aware product format |
| `SALES_BULK_PRICING` | Volume/bulk pricing | Tiered pricing for wholesale quantities | Bulk pricing rules |
| `SALES_QUOTE_REQUEST` | Quote request flow | Collect requirements, generate quotes | Quote flow directives |
| `SALES_FOLLOWUP` | Intelligent follow-up | Re-engage inactive customers | Follow-up rules |
| `SALES_RECOVERY` | Customer recovery | Win back lost/hesitant customers | Recovery directives |

#### Tier 4: Operational Module Capabilities (opt-in per business)

| ID | Capability | Description | Prompt Impact |
|----|-----------|-------------|---------------|
| `MOD_INVENTORY` | Inventory management | Stock tracking, low-stock alerts, purchase suggestions | Stock awareness in product responses |
| `MOD_DELIVERY` | Delivery management | Driver assignment, route optimization, tracking | Delivery promises, ETA estimates |
| `MOD_ANALYTICS` | Analytics dashboard | Cross-domain insights, business intelligence | No direct prompt impact |
| `MOD_ANALYTICS_DASHBOARD` | Analytics dashboard access | UI access to analytics | No prompt impact |

### 3.2 Capability Granularity Rationale

Each capability maps to a **single behavioral change** in the system:

- `CORE_CONVERSATION` → personality + communication style in prompt
- `CHANNEL_WHATSAPP` → WhatsApp tone directives
- `SALES_EXPERIENCE` → experience context injection
- `SALES_MULTI_PRODUCT` → product recommendation returns array
- `SALES_SKU_VARIANTS` → variant attributes in product format
- `MOD_INVENTORY` → stock levels in product responses

This granularity ensures each capability can be independently tested, toggled, and reasoned about.

---

## Phase 4 — Canonical Contract

### 4.1 The Capability Type

```typescript
/**
 * Canonical capability identifier.
 * Each capability maps to a single behavioral change in the system.
 */
type CapabilityId =
  // Tier 1: Core (always active)
  | 'CORE_CONVERSATION'
  | 'CORE_PRODUCT_PRESENTATION'
  | 'CORE_OBJECTION_HANDLING'
  | 'CORE_CLOSING'
  | 'CORE_KNOWLEDGE'
  | 'CORE_MEMORY'
  | 'CORE_CUSTOMER_MEMORY'
  | 'CORE_LEARNING'
  // Tier 2: Channels
  | 'CHANNEL_WHATSAPP'
  | 'CHANNEL_WEBCHAT'
  | 'CHANNEL_TELEGRAM'
  | 'CHANNEL_MULTI'
  | 'CHANNEL_LANDING'
  // Tier 3: Sales Intelligence
  | 'SALES_EXPERIENCE'
  | 'SALES_COMMERCIAL_INTELLIGENCE'
  | 'SALES_EXPECTATION_INTELLIGENCE'
  | 'SALES_RESPONSIBLE_SELLING'
  | 'SALES_MULTI_PRODUCT'
  | 'SALES_SKU_VARIANTS'
  | 'SALES_BULK_PRICING'
  | 'SALES_QUOTE_REQUEST'
  | 'SALES_FOLLOWUP'
  | 'SALES_RECOVERY'
  // Tier 4: Operational Modules
  | 'MOD_INVENTORY'
  | 'MOD_DELIVERY'
  | 'MOD_ANALYTICS'
  | 'MOD_ANALYTICS_DASHBOARD'

/**
 * A resolved capability set for a specific business.
 * This is what gets passed to buildMasterPrompt().
 */
interface ResolvedCapabilities {
  /** All active capability IDs */
  active: Set<CapabilityId>
  /** Business ID these capabilities were resolved for */
  businessId: string
  /** Edition that contributed to the resolved set */
  edition: string
  /** How each capability was activated (for debugging) */
  sources: Record<CapabilityId, 'edition' | 'config' | 'onboarding' | 'default'>
}
```

### 4.2 Capability Resolution Rules

1. **Tier 1 (Core)**: Always active. Cannot be disabled. No source needed.
2. **Tier 2 (Channels)**: Activated by edition + business configuration. WhatsApp requires `edition.capabilities.whatsapp && business_settings.whatsapp_enabled`.
3. **Tier 3 (Sales Intelligence)**: Activated by edition + onboarding + business configuration. `SALES_EXPERIENCE` requires experience_memory patterns to exist for the business's industry.
4. **Tier 4 (Operational Modules)**: Activated by 3-gate system: edition gate → `business_settings.enabled` gate → SQL trigger gate. Already implemented for Inventory and Delivery.

### 4.3 Conflict Resolution

When multiple sources disagree:

```
IMMUTABLE (hardcoded) > Manual Instructions > Higher-priority Rules > Reviewed Knowledge > Recent Knowledge > Statistical Patterns
```

This authority hierarchy already exists in `buildMasterPrompt()` (lines 292-300) and is preserved.

---

## Phase 5 — Source of Truth

### 5.1 Where Capabilities Live Today

| Source | What It Stores | What's Missing |
|--------|---------------|----------------|
| `businesses.edition` | Edition name (4 options) | No per-business capability override |
| `EditionCapabilities` | 22 boolean flags per edition | Not per-business, not capability-level granularity |
| `inventory.business_settings` | `enabled`, `vertical`, thresholds | Only for inventory, not connected to prompt |
| `delivery.business_settings` | `enabled`, zones, thresholds | Only for delivery, not connected to prompt |
| `business_sales_config` | `ask_address`, `ask_phone`, `allow_cancellation` | Only 4 fields, no capability-level granularity |
| `experience_memory.industry` | Industry patterns | `businesses.industry` column doesn't exist |

### 5.2 Recommended Source of Truth

**Option C (Hybrid) — 3-4 new columns + lightweight capability flags:**

| Column | Table | Type | Purpose |
|--------|-------|------|---------|
| `industry` | `businesses` | `TEXT` | Business vertical/industry (e.g., `wellness_beauty`, `inmobiliaria`, `zapateria`) |
| `capabilities` | `businesses` | `TEXT[]` | Array of active capability IDs (e.g., `{'SALES_EXPERIENCE', 'MOD_INVENTORY'}`) |
| `onboarding_answers` | `businesses` | `JSONB` | Raw onboarding quiz answers (for re-derivation) |
| `capability_sources` | `businesses` | `JSONB` | How each capability was activated (for debugging) |

**Why this works:**

1. **`industry`** — Enables experience memory patterns, vertical-specific knowledge, industry-aware defaults.
2. **`capabilities`** — Explicit, queryable, auditable capability set. Overrides edition defaults.
3. **`onboarding_answers`** — Preserves raw input for re-derivation if business model changes.
4. **`capability_sources`** — Debugging: "Why is this capability active?" → `'edition'`, `'config'`, `'onboarding'`.

### 5.3 Why NOT a New Table

A `business_capabilities` table would be over-engineered:

- 35 boolean flags = 35 rows or 35 columns. Either way, more complexity than a `TEXT[]` array.
- No relationships to manage. Capabilities are flat, independent booleans.
- No historical tracking needed (capability_sources handles debugging).
- PostgreSQL `TEXT[]` supports efficient `@>` (contains) queries for capability checks.

---

## Phase 6 — Activation Model

### 6.1 The Capability Resolution Pipeline

```
Business Created
    ↓
Onboarding Quiz (6-10 questions)
    ↓
Derive initial capabilities from answers + edition defaults
    ↓
Store in businesses.capabilities + businesses.industry
    ↓
┌─────────────────────────────────────────────────┐
│           CAPABILITY RESOLUTION                  │
│                                                  │
│  1. Start with edition defaults                  │
│  2. Apply onboarding overrides                   │
│  3. Apply manual config overrides                │
│  4. Resolve dependencies                         │
│  5. Produce ResolvedCapabilities                 │
└─────────────────────────────────────────────────┘
    ↓
buildMasterPrompt() receives ResolvedCapabilities
    ↓
Prompt adapts to enabled capabilities
    ↓
Dashboard sidebar filters to enabled capabilities
```

### 6.2 Resolution Algorithm

```typescript
function resolveCapabilities(
  businessId: string,
  edition: Edition,
  industry: string | null,
  manualCapabilities: string[] | null
): ResolvedCapabilities {
  const active = new Set<CapabilityId>()
  const sources: Record<CapabilityId, string> = {}

  // 1. Core capabilities (always active)
  for (const id of CORE_CAPABILITIES) {
    active.add(id)
    sources[id] = 'default'
  }

  // 2. Edition defaults
  for (const [key, enabled] of Object.entries(edition.capabilities)) {
    if (enabled) {
      const capId = editionKeyToCapabilityId(key)
      active.add(capId)
      sources[capId] = 'edition'
    }
  }

  // 3. Industry-derived capabilities
  if (industry) {
    const industryCaps = INDUSTRY_DEFAULTS[industry] ?? []
    for (const capId of industryCaps) {
      if (!active.has(capId)) {
        active.add(capId)
        sources[capId] = 'onboarding'
      }
    }
  }

  // 4. Manual overrides (from onboarding or settings)
  if (manualCapabilities) {
    for (const capId of manualCapabilities) {
      active.add(capId as CapabilityId)
      sources[capId as CapabilityId] = 'config'
    }
  }

  // 5. Dependency resolution
  for (const [capId, deps] of Object.entries(CAPABILITY_DEPENDENCIES)) {
    if (active.has(capId as CapabilityId)) {
      for (const dep of deps) {
        active.add(dep)
        sources[dep] = 'dependency'
      }
    }
  }

  return { active, businessId, edition: edition.name, sources }
}
```

### 6.3 Onboarding Quiz Design (6-10 Questions)

The onboarding quiz replaces the current 3-question conversational flow with a structured capability-discovery flow:

| # | Question | Purpose | Derived Capabilities |
|---|----------|---------|---------------------|
| 1 | ¿Cómo se llama tu negocio? | Brand identity | (none — existing) |
| 2 | ¿Qué tipo de negocio es? | Industry detection | `industry` column + experience memory |
| 3 | ¿Qué vendes o qué servicio ofreces? | Product catalog | (none — existing) |
| 4 | ¿Cómo te comunicas con tus clientes? | Channel selection | `CHANNEL_WHATSAPP`, `CHANNEL_WEBCHAT`, etc. |
| 5 | ¿Manejas envíos a domicilio? | Delivery capability | `MOD_DELIVERY` |
| 6 | ¿Necesitas controlar tu inventario? | Inventory capability | `MOD_INVENTORY` |
| 7 | ¿Ofreces precios por volumen? | Bulk pricing | `SALES_BULK_PRICING` |
| 8 | ¿Tienes variants de tus productos? (talla, color, modelo) | SKU variants | `SALES_SKU_VARIANTS` |
| 9 | ¿Qué nombre quieres para tu asistente? | Assistant name | (none — existing) |
| 10 | ¿Qué tono prefieres? | Personality | (none — existing) |

**Key insight**: Questions 2, 4-8 are new. They directly map to capability flags. Questions 1, 3, 9, 10 already exist.

### 6.4 Industry → Capability Defaults

| Industry | Auto-Enabled Capabilities |
|----------|--------------------------|
| `wellness_beauty` | `SALES_EXPERIENCE`, `CHANNEL_WHATSAPP` |
| `inmobiliaria` | `SALES_EXPERIENCE`, `SALES_QUOTE_REQUEST`, `SALES_FOLLOWUP` |
| `zapateria` | `SALES_SKU_VARIANTS`, `SALES_BULK_PRICING`, `MOD_INVENTORY` |
| `ropa` | `SALES_SKU_VARIANTS`, `MOD_INVENTORY` |
| `general` | (none beyond core) |

---

## Phase 7 — Capability → Prompt Bridge

### 7.1 The Missing Bridge

Today, `buildMasterPrompt()` receives 14 parameters. **Zero are capability flags.** The prompt is identical regardless of what the business has enabled.

### 7.2 Recommended Injection Points

The bridge adds **6 conditional prompt blocks** that activate based on capabilities:

```typescript
// NEW: Add to buildMasterPrompt() params
interface SalesPromptConfig {
  // ... existing fields ...
  capabilities?: ResolvedCapabilities  // NEW
}
```

| # | Capability | Prompt Block | Location in Prompt |
|---|-----------|-------------|-------------------|
| 1 | `SALES_EXPERIENCE` | `## Experiencia de Ventas` — Blended objection patterns | After business info, before products |
| 2 | `SALES_MULTI_PRODUCT` | `## Recomendación` — Multi-product comparison instructions | After products section |
| 3 | `SALES_SKU_VARIANTS` | `## Variantes del Producto` — Variant presentation rules | After product format |
| 4 | `SALES_BULK_PRICING` | `## Precios por Volumen` — Volume pricing rules | After sales rules |
| 5 | `MOD_INVENTORY` | `## Disponibilidad` — Stock awareness directives | Before closing policy |
| 6 | `MOD_DELIVERY` | `## Logística` — Delivery promise/ETA directives | After closing policy |

### 7.3 Example: `SALES_EXPERIENCE` Injection

```typescript
// In buildMasterPrompt(), after businessInfo section:
const experienceNote = params.capabilities?.active.has('SALES_EXPERIENCE')
  ? `\n## Experiencia de Ventas\nUsa estas respuestas probadas como guía cuando el cliente plantee objeciones similares. Puedes adaptar el texto al contexto de la conversación, pero mantén la esencia de la respuesta recomendada:\n${experienceContext}`
  : ''
```

### 7.4 Example: `MOD_INVENTORY` Injection

```typescript
// In buildMasterPrompt(), before closing policy:
const inventoryNote = params.capabilities?.active.has('MOD_INVENTORY')
  ? `\n## Disponibilidad\nTienes acceso al inventario en tiempo real. Si el cliente pregunta por disponibilidad, confirma el stock actual. Si el stock es bajo (menos de 5 unidades), menciona que el stock es limitado. NUNCA prometas stock que no existe.`
  : ''
```

### 7.5 Token Budget Impact

Each conditional block adds ~50-150 tokens. With 6 blocks max active, worst case adds ~900 tokens to a ~2000 token prompt. **45% increase** — within acceptable limits for gpt-4o-mini.

---

## Phase 8 — Capability → Dashboard Bridge

### 8.1 Current State

The sidebar (`ActivityRail.tsx`) shows all 15 navigation items unconditionally. The only gating is `isPlatformOwner` for Platform Admin.

### 8.2 Recommended: Capability-Driven Sidebar

```typescript
// In ActivityRail.tsx, filter items by capabilities:
const nav = useCapabilityFilteredNav(capabilities)

function useCapabilityFilteredNav(capabilities: ResolvedCapabilities) {
  return NAV_ITEMS.filter(item => {
    if (!item.requiredCapability) return true  // Core items always shown
    return capabilities.active.has(item.requiredCapability)
  })
}
```

| Sidebar Item | Required Capability | Currently Shown |
|-------------|-------------------|-----------------|
| Command Center | (core) | ✅ Always |
| Relations | (core) | ✅ Always |
| Memory | (core) | ✅ Always |
| Thinking | (core) | ✅ Always |
| Catalog | (core) | ✅ Always |
| Lab | `CORE_LEARNING` | ✅ Always |
| Delivery | `MOD_DELIVERY` | ✅ Always (should be gated) |
| Inventory | `MOD_INVENTORY` | ✅ Always (should be gated) |
| Analytics | `MOD_ANALYTICS` | ✅ Always (should be gated) |
| Sales Settings | (core) | ✅ Always |
| Connections | (core) | ✅ Always |
| Council | (core) | ✅ Always |
| Health | (core) | ✅ Always |
| Accessibility | (core) | ✅ Always |
| Platform Admin | `isPlatformOwner` | ✅ Gated |

### 8.3 Progressive Disclosure

For capabilities that are available but not activated, show a "coming soon" or "activate" state:

```typescript
// Instead of hiding, show with activation prompt:
{
  href: '/dashboard/inventory',
  label: t.nav.inventory,
  icon: Package,
  requiredCapability: 'MOD_INVENTORY',
  comingSoon: !capabilities.active.has('MOD_INVENTORY'),  // Show grayed out
}
```

---

## Phase 9 — Dependency Graph

### 9.1 Capability Dependencies

| Capability | Depends On | Reason |
|-----------|-----------|--------|
| `CHANNEL_MULTI` | `CHANNEL_WHATSAPP` OR `CHANNEL_WEBCHAT` OR `CHANNEL_TELEGRAM` | Multi-channel requires at least 2 channels |
| `SALES_EXPERIENCE` | `industry` column set | Experience memory requires industry to load patterns |
| `SALES_FOLLOWUP` | `CORE_CUSTOMER_MEMORY` | Follow-up requires customer memory |
| `SALES_RECOVERY` | `CORE_CUSTOMER_MEMORY` + `SALES_FOLLOWUP` | Recovery requires memory + follow-up |
| `MOD_DELIVERY` | `MOD_INVENTORY` (recommended) | Delivery benefits from stock awareness |
| `MOD_ANALYTICS` | Any `MOD_*` enabled | Analytics requires at least one operational module |

### 9.2 Conflict Rules

| Rule | Description |
|------|-------------|
| `CHANNEL_MULTI` cannot be active with only 1 channel | Requires ≥2 channel capabilities |
| `SALES_BULK_PRICING` requires `SALES_MULTI_PRODUCT` | Volume pricing implies multiple products |
| `SALES_QUOTE_REQUEST` requires `SALES_FOLLOWUP` | Quotes need follow-up mechanism |

### 9.3 Dependency Resolution Order

```
1. Resolve core (always active)
2. Resolve edition defaults
3. Resolve industry defaults
4. Resolve manual overrides
5. Resolve dependencies (add missing deps)
6. Resolve conflicts (remove invalid combos)
7. Produce final ResolvedCapabilities
```

---

## Phase 10 — Vertical Generalization

### 10.1 Core Thesis

**No vertical-specific architecture is needed.** Every vertical (wellness, real estate, zapateria, ropa) can be expressed as a **combination of the same 35 capabilities** with different default sets.

### 10.2 Vertical → Capability Matrix

| Capability | Vitanova (wellness) | Real Estate | Zapatería | Ropa |
|-----------|-------------------|-------------|-----------|------|
| `CORE_*` (8) | ✅ | ✅ | ✅ | ✅ |
| `CHANNEL_WHATSAPP` | ✅ | ✅ | ✅ | ✅ |
| `CHANNEL_WEBCHAT` | ✅ | ❌ | ❌ | ❌ |
| `CHANNEL_LANDING` | ✅ | ✅ | ✅ | ✅ |
| `SALES_EXPERIENCE` | ✅ | ✅ | ✅ | ✅ |
| `SALES_MULTI_PRODUCT` | ❌ | ✅ | ✅ | ✅ |
| `SALES_SKU_VARIANTS` | ❌ | ❌ | ✅ | ✅ |
| `SALES_BULK_PRICING` | ❌ | ❌ | ✅ | ✅ |
| `SALES_QUOTE_REQUEST` | ❌ | ✅ | ❌ | ❌ |
| `SALES_FOLLOWUP` | ✅ | ✅ | ✅ | ✅ |
| `MOD_INVENTORY` | ❌ | ❌ | ✅ | ✅ |
| `MOD_DELIVERY` | ❌ | ✅ | ✅ | ✅ |

### 10.3 Vertical Readiness Score (Revised)

| Vertical | Current Score | With Capability Contract | Gap |
|----------|--------------|-------------------------|-----|
| Vitanova (wellness) | 3.4/5 | 4.5/5 | Minimal — mostly prompt wiring |
| Real Estate | 3.4/5 | 4.0/5 | Quote flow + multi-product |
| Zapatería | 2.5/5 | 4.0/5 | SKU variants + inventory bridge + bulk pricing |
| Ropa | 2.5/5 | 4.0/5 | SKU variants + inventory bridge |

---

## Phase 11 — Minimal Hybrid Architecture

### 11.1 Implementation Layers

```
┌─────────────────────────────────────────────────┐
│  Layer 1: DB Schema (4 columns)                  │
│  businesses.industry TEXT                        │
│  businesses.capabilities TEXT[]                  │
│  businesses.onboarding_answers JSONB             │
│  businesses.capability_sources JSONB             │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Layer 2: Capability Resolution (1 new file)     │
│  src/lib/system/capabilities.ts                  │
│  resolveCapabilities(businessId)                 │
│  ResolvedCapabilities type                       │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Layer 3: Prompt Bridge (6 conditional blocks)   │
│  src/lib/ai/prompts.ts — add capabilities param │
│  6 new prompt sections (50-150 tokens each)      │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Layer 4: Dashboard Bridge (sidebar filtering)   │
│  src/components/dashboard/ActivityRail.tsx       │
│  Filter nav items by ResolvedCapabilities        │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Layer 5: Onboarding Redesign (6-10 questions)   │
│  src/components/onboarding/ConversationalOnboarding.tsx │
│  Add capability-discovery questions              │
└─────────────────────────────────────────────────┘
```

### 11.2 Effort Estimate

| Layer | Files Modified | New Files | Effort |
|-------|---------------|-----------|--------|
| DB Schema | 1 migration | 0 | 1 day |
| Capability Resolution | 0 | 1 (`capabilities.ts`) | 1 day |
| Prompt Bridge | 1 (`prompts.ts`) | 0 | 1-2 days |
| Dashboard Bridge | 1 (`ActivityRail.tsx`) | 0 | 1 day |
| Onboarding Redesign | 2 (`ConversationalOnboarding.tsx`, `route.ts`) | 0 | 2-3 days |
| **Total** | **5 files** | **1 file** | **6-8 days** |

### 11.3 What We're NOT Building

- ❌ No new database tables
- ❌ No vertical-specific code paths
- ❌ No capability-specific UI components
- ❌ No capability registry microservice
- ❌ No capability versioning system
- ❌ No capability audit log (beyond capability_sources)

---

## Phase 12 — Congruence Contract

### 12.1 Alignment Matrix

| System | Today | After Contract | Alignment |
|--------|-------|---------------|-----------|
| Edition → Capabilities | 22 booleans, mostly unused | 35 named capabilities, actively resolved | ✅ HIGH |
| Capabilities → Prompt | **No bridge** | 6 conditional prompt blocks | ✅ HIGH |
| Capabilities → Dashboard | **No filtering** | Sidebar filtered by capabilities | ✅ HIGH |
| Onboarding → Capabilities | **No discovery** | 6-10 question quiz → capability derivation | ✅ HIGH |
| Industry → Experience Memory | **Broken** (`industry` column missing) | `businesses.industry` → experience memory loads | ✅ HIGH |
| Variants → Sales AI | **Disconnected** (Inventory only) | `SALES_SKU_VARIANTS` → variant-aware prompt | ✅ MEDIUM |
| Business Config → Prompt | 4 fields working (`ask_address`, etc.) | Extended with capability flags | ✅ HIGH |

### 12.2 Semantic Contracts

| Contract | Guarantee |
|----------|-----------|
| **Capability Immutability** | Once a capability is in `businesses.capabilities`, it persists until explicitly changed |
| **Capability Resolution Idempotency** | Resolving capabilities for the same business always produces the same result |
| **Prompt Adaptation** | `buildMasterPrompt()` with identical inputs produces identical outputs |
| **Dashboard Consistency** | Sidebar shows exactly the capabilities the business has active |
| **Onboarding Determinism** | Same quiz answers → same capability set |

---

## Phase 13 — Adversarial Review

### 13.1 Challenge: "Why not just use the edition system?"

**Answer**: Editions are **deployment tiers** (evaluation/professional/enterprise/cloud), not **business configurations**. A wellness business and a real estate business on the same enterprise edition need different capabilities. Editions set the **ceiling** (what's possible), capabilities set the **floor** (what's active).

### 13.2 Challenge: "Isn't a TEXT[] array an anti-pattern?"

**Answer**: For 35 flat, independent boolean flags with no relationships, a `TEXT[]` is simpler and more performant than:
- 35 boolean columns (schema bloat)
- A junction table (unnecessary join)
- A JSONB object (harder to query with `@>`)

PostgreSQL `TEXT[]` supports `@>` (contains), `ANY()`, and GIN indexing. It's the right tool for this job.

### 13.3 Challenge: "What about capability versioning?"

**Answer**: Not needed. Capabilities are **current state**, not **historical events**. If a business changes its capabilities, the new set overwrites the old. `capability_sources` provides debugging context. If audit history is needed later, it can be added via a trigger.

### 13.4 Challenge: "What about the 16 unused `canUse*()` functions?"

**Answer**: They become **deprecated** after the capability contract is implemented. The new `resolveCapabilities()` replaces them. They can be removed in a follow-up refactor.

### 13.5 Challenge: "What if a business wants a capability their edition doesn't support?"

**Answer**: Edition is the **ceiling**. If `evaluation` doesn't include `MOD_INVENTORY`, the business can't activate it regardless of onboarding answers. This is the correct behavior — editions are licensing constraints.

---

## Phase 14 — Implementation Boundary

### 14.1 In Scope (This Contract)

| # | Work Item | Priority | Effort |
|---|----------|----------|--------|
| 1 | Add `industry` column to `businesses` | CRITICAL | 0.5 day |
| 2 | Add `capabilities` column to `businesses` | CRITICAL | 0.5 day |
| 3 | Add `onboarding_answers` column to `businesses` | MEDIUM | 0.5 day |
| 4 | Add `capability_sources` column to `businesses` | LOW | 0.5 day |
| 5 | Create `src/lib/system/capabilities.ts` | CRITICAL | 1 day |
| 6 | Wire `ResolvedCapabilities` into `buildMasterPrompt()` | CRITICAL | 1-2 days |
| 7 | Wire `ResolvedCapabilities` into `ActivityRail.tsx` | HIGH | 1 day |
| 8 | Redesign onboarding quiz (6-10 questions) | HIGH | 2-3 days |
| 9 | Add onboarding → capability derivation logic | HIGH | 1 day |
| 10 | Fix `businesses.industry` for experience memory | HIGH | 0.5 day |

### 14.2 Out of Scope (Future Work)

| # | Work Item | Reason |
|---|----------|--------|
| 1 | Multi-product presentation in prompt | Requires `ProductReference[]` change in runtime |
| 2 | Variant system integration in Sales AI | Requires `resolve_variant()` call in prompt builder |
| 3 | Bulk pricing UI in catalog | Requires catalog schema extension |
| 4 | Quote request flow | Requires new conversation state machine |
| 5 | Capability versioning/audit | Not needed yet |
| 6 | Remove deprecated `canUse*()` functions | Cleanup, not blocking |
| 7 | Experience memory industry seeding | Data task, not code |

---

## Phase 15 — Final Contract

### 15.1 The Contract

**MIA's capability system is a 5-layer architecture:**

```
┌─────────────────────────────────────────────────┐
│  1. STORAGE: businesses.industry + .capabilities │
│     (35 named capabilities, TEXT[] array)        │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  2. RESOLUTION: resolveCapabilities()            │
│     (edition + industry + config → active set)   │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  3. PROMPT: buildMasterPrompt() + capabilities   │
│     (6 conditional prompt blocks)                │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  4. DASHBOARD: ActivityRail filtered by caps     │
│     (sidebar shows only active capabilities)     │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  5. ONBOARDING: Quiz → capability derivation     │
│     (6-10 questions → industry + capabilities)   │
└─────────────────────────────────────────────────┘
```

### 15.2 Key Invariants

1. **No vertical-specific code paths.** Every vertical is a capability combination.
2. **No new tables.** 4 columns on existing `businesses` table.
3. **No prompt without capabilities.** Every `buildMasterPrompt()` call includes `ResolvedCapabilities`.
4. **No dashboard without capabilities.** Every sidebar render filters by `ResolvedCapabilities`.
5. **No capability without source.** Every activation has a traceable source (edition/config/onboarding/default).

### 15.3 Success Criteria

| Criterion | Metric |
|-----------|--------|
| Prompt adapts to capabilities | A wellness business prompt differs from a zapateria prompt |
| Sidebar adapts to capabilities | A business without inventory doesn't see Inventory in sidebar |
| Experience memory activates | `industry` column set → experience patterns load |
| Onboarding discovers capabilities | New businesses get capability-appropriate defaults |
| No regressions | Existing Vitanova behavior unchanged |

### 15.4 Terminal State

**This document is the complete capability contract.** It defines:
- ✅ What capabilities exist (35 named capabilities, 4 tiers)
- ✅ How they're stored (4 columns on `businesses`)
- ✅ How they're resolved (edition + industry + config)
- ✅ How they affect the prompt (6 conditional blocks)
- ✅ How they affect the dashboard (sidebar filtering)
- ✅ How they're discovered (onboarding quiz)
- ✅ What's in scope (6-8 days, 6 files)
- ✅ What's out of scope (7 deferred items)

**READ-ONLY. No code changes. No DB changes. No migrations.**
