# MIA Capability Contract v2 — Canonical Model (Corrected)

> **Type:** Architecture Design — Documentation Only
> **Status:** Complete (v2 — corrected from readiness audit)
> **Date:** 2026-08-26
> **Input:** Capability Architecture Forensic + Capability Congruence Merge + Dashboard/Customer Experience Discovery + 3 Vertical Readiness Reports + Readiness Audit v1
> **Scope:** 15-phase design loop. No code changes, no DB changes, no migrations.
> **Correction log:** v2 fixes 3 critical factual errors, 2 structural ambiguities, and 1 conceptual conflation from v1.

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
| 7 | 27 ADRs | ✅ Found | `docs/adr/` (key: 010, 017, 019, 020, 025, 026, 027) |
| 8 | Onboarding Code | ✅ Found | `src/components/onboarding/ConversationalOnboarding.tsx`, `src/app/api/onboarding/chat/route.ts` |
| 9 | Edition System + Dashboard | ✅ Found | `src/lib/system/edition.ts`, `src/components/layout/AppLayout.tsx` |

### v1 Corrections Applied

The readiness audit identified these factual errors in v1. All are corrected in v2:

| # | v1 Claim | v1 Error | v2 Correction | Verification |
|---|----------|----------|---------------|-------------|
| 1 | "35 named capabilities" | CapabilityId type defines **27**, not 35 | Corrected to **28** (27 + 2 new − 1 removed — see Phase 3) | `capability-contract.md:155-186` (27 entries) |
| 2 | "22 boolean flags" in EditionCapabilities | Interface has **24** fields | Corrected to **24** | `edition.ts:19-44` (24 fields) |
| 3 | "22 sync canUse*() functions, 16 never imported" | **21** sync functions, **20** never imported | Corrected to 21 functions, 20 never imported | `edition.ts:250-400` (21 defs), `connections/page.tsx:2` (only import) |
| 4 | `MOD_ANALYTICS_DASHBOARD` as a capability | It's a UI permission, not a behavioral capability | **Removed** from CapabilityId | `capability-contract.md:129` says "No prompt impact" |
| 5 | Lab gated behind `CORE_LEARNING` | Lab is a training tool available to all businesses | **Removed** gating — Lab always shown | `dashboard/ActivityRail.tsx:190-199` (Lab always shown) |
| 6 | `MOD_DELIVERY` depends on `MOD_INVENTORY` | Delivery does not technically require inventory | Dependency classified as **NONE** (recommendation only) | `delivery/licensing.ts` — independent of inventory |
| 7 | "experienceContext not in prompt" | It **already exists** — `prompts.ts:357` injects it conditionally | Noted — just needs `industry` column to work | `prompts.ts:202,357`, `context.ts:90-100` |
| 8 | Onboarding "6-10 questions" | Some questions are leading/redundant | Reduced to **6 questions** (see Phase 6.3) | See Phase 6.3 |

---

## Phase 2 — Existing Concept Forensics

### 6 Capability-Related Systems Found

| # | System | Location | Status | Gap |
|---|--------|----------|--------|-----|
| 1 | **Edition System** | `src/lib/system/edition.ts` | 4 editions, **24** boolean flags | **20 of 21** `canUse*()` functions **never imported** (only `canUseWhatsApp` at `connections/page.tsx:2`). Edition gates only checked in inventory/delivery licensing + connections page. |
| 2 | **Module System** | `src/components/layout/AppLayout.tsx` | 3 visual modules (`sales`, `inventory`, `logistics`) | **Zero access control** — all modules shown unconditionally. Module only affects CSS theme. |
| 3 | **3-Gate Activation** | `inventory/licensing.ts`, `delivery/licensing.ts` | Edition → `business_settings.enabled` → SQL trigger | Only for Inventory and Delivery. Sales AI has **no activation gate**. |
| 4 | **Experience Memory** | `experience_memory` table + `blender.ts` | Industry-specific objection patterns | `businesses.industry` column **doesn't exist**. Code reads it (`context.ts:95`) → always `undefined` → `'general'`. Patterns never activate. |
| 5 | **Inventory Vertical** | `inventory.business_settings.vertical` | `ecommerce`, `manufacturing`, `realestate` | **Zero connection to Sales AI**. Vertical is inventory-internal only. |
| 6 | **Sales Config** | `business_sales_config` | `ask_address`, `ask_phone`, `allow_cancellation` | **Only working pipeline**: config → prompt. Lines 331-332 of `prompts.ts`. |

### Critical Findings

1. **No capability registry** — capabilities scattered across edition.ts (24 booleans), business_settings (per-domain), business_sales_config (sales-specific). No single source of truth.

2. **Edition capabilities are mostly decorative** — 20 of 21 `canUse*()` functions exported but never imported. Sidebar shows all modules unconditionally. Prompt identical regardless of edition.

3. **`buildMasterPrompt()` has 14 parameters — zero are capability flags** — Receives products, rules, knowledge, memory, salesConfig, but nothing that says "this business has inventory" or "this business does deliveries."

4. **The `industry` concept is broken** — `businesses.industry` column doesn't exist. Code reads it (`context.ts:95`) but always gets `undefined`. Experience memory patterns seeded but never loaded.

5. **Variant system exists but invisible to Sales AI** — Inventory has full variant support (assets, resolve_variant, asset_products), but `formatProducts()` only reads the 15-column `products` table.

6. **Onboarding collects zero capability/vertical data** — Asks: business name, what they sell, assistant name. Never asks: industry, vertical, modules, payment methods, delivery needs.

---

## Phase 3 — Capability Definition

### 3.1 Canonical Capability List

MIA needs **28 named capabilities** organized in 5 tiers. Each capability is a boolean that describes a concrete behavioral capability the system can exhibit.

> **v2 note:** The v1 contract claimed 35 capabilities but its own `CapabilityId` type defined only 27. This v2 adds 2 missing capabilities (`MULTIPLE_BUSINESSES`, `MULTIPLE_ASSISTANTS`) and removes 1 non-capability (`MOD_ANALYTICS_DASHBOARD` — a UI permission), yielding 28.

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
| `MOD_ANALYTICS` | Analytics and insights | Cross-domain data aggregation and reporting | No direct prompt impact (data source only) |

#### Tier 5: Meta Capabilities (platform-level, opt-in per business)

| ID | Capability | Description | Prompt Impact |
|----|-----------|-------------|---------------|
| `MULTIPLE_BUSINESSES` | Multiple business support | Manage multiple businesses from one account | No direct prompt impact (platform behavior) |
| `MULTIPLE_ASSISTANTS` | Multiple assistants per business | Create and manage multiple assistants | No direct prompt impact (platform behavior) |

### 3.2 What Is NOT a Capability

| EditionCapabilities Entry | Why Not a Capability | Correct Classification |
|--------------------------|---------------------|----------------------|
| `demoChat` | Evaluation-only feature, not a business capability | Edition preset (evaluation only) |
| `cloudDeployment` | Infrastructure concern, not behavioral | Edition preset (cloud only) |
| `skills` | Platform feature, not per-business toggle | Always-on when available |
| `weeklyReports` | Reporting frequency, not behavioral | Feature flag |
| `dashboard` | Platform UI, not a per-business capability | Always-on |
| `promptBuilder` | Admin tool, not business-facing | Always-on |
| `knowledgeCenter` | Admin tool, not business-facing | Always-on |
| `knowledgeStudio` | Admin tool, not business-facing | Always-on |
| `salesSimulator` | Training tool, not business-facing | Always-on |
| `connections` | Infrastructure, not behavioral | Always-on |
| `analyticsDashboard` | UI access layer on top of `MOD_ANALYTICS` | UI permission (not a capability) |

### 3.3 EditionCapabilities → CapabilityId Mapping

The 24 `EditionCapabilities` booleans map to the 28 capabilities as follows:

| EditionCapabilities Key | Maps To | Classification |
|------------------------|---------|---------------|
| `demoChat` | (none — evaluation preset) | Edition preset |
| `whatsapp` | `CHANNEL_WHATSAPP` | Capability |
| `webchat` | `CHANNEL_WEBCHAT` | Capability |
| `telegram` | `CHANNEL_TELEGRAM` | Capability |
| `multiChannel` | `CHANNEL_MULTI` | Capability |
| `multipleBusinesses` | `MULTIPLE_BUSINESSES` | **NEW capability** (v2) |
| `multipleAssistants` | `MULTIPLE_ASSISTANTS` | **NEW capability** (v2) |
| `cloudDeployment` | (none — cloud preset) | Edition preset |
| `skills` | (none — always-on) | Platform feature |
| `businessMemory` | `CORE_MEMORY` (always-on) | Core capability |
| `learning` | `CORE_LEARNING` (always-on) | Core capability |
| `weeklyReports` | (none — feature flag) | Feature flag |
| `dashboard` | (none — always-on) | Platform feature |
| `promptBuilder` | (none — always-on) | Platform feature |
| `knowledgeCenter` | (none — always-on) | Platform feature |
| `commercialIntelligence` | `SALES_COMMERCIAL_INTELLIGENCE` | Capability |
| `expectationIntelligence` | `SALES_EXPECTATION_INTELLIGENCE` | Capability |
| `responsibleSelling` | `SALES_RESPONSIBLE_SELLING` | Capability |
| `knowledgeStudio` | (none — always-on) | Platform feature |
| `salesSimulator` | (none — always-on) | Platform feature |
| `connections` | (none — always-on) | Platform feature |
| `deliveryHub` | `MOD_DELIVERY` | Capability |
| `inventoryHub` | `MOD_INVENTORY` | Capability |
| `analyticsDashboard` | `MOD_ANALYTICS` (data layer) | UI permission |

### 3.4 Capability Granularity Rationale

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
 * Total: 28 capabilities (8 core + 5 channel + 10 sales + 3 module + 2 meta)
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
  // Tier 5: Meta
  | 'MULTIPLE_BUSINESSES'
  | 'MULTIPLE_ASSISTANTS'

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

### 4.3 Configuration State vs Resolved State

> **v2 addition:** The v1 contract conflated `businesses.capabilities` (configuration) with the resolved set. v2 distinguishes these clearly.

| Concept | What It Is | Where It Lives | When It Changes |
|---------|-----------|---------------|----------------|
| **Configuration state** | What the business *wants* (onboarding answers + manual overrides) | `businesses.capabilities` TEXT[] | On manual config change |
| **Resolved state** | What the business *gets* (after edition ceiling + dependency resolution) | `ResolvedCapabilities` (in-memory) | On every query |
| **Edition ceiling** | Maximum possible capabilities for this edition | `EditionCapabilities` (static) | Only on edition upgrade/downgrade |

**Rule:** `businesses.capabilities` is the **configuration source of truth**. `resolveCapabilities()` produces the **resolved state** by intersecting with the edition ceiling and resolving dependencies. These are two different things.

### 4.4 Conflict Resolution

When multiple sources disagree:

```
EDITION CEILING (hardcoded) > Manual Instructions > Higher-priority Rules > Reviewed Knowledge > Recent Knowledge > Statistical Patterns
```

The edition ceiling is immutable — if a capability is not in the edition, it cannot be activated regardless of configuration. Within the edition ceiling, the authority hierarchy from `buildMasterPrompt()` (lines 292-300) is preserved.

### 4.5 Relationship to Existing Gating Mechanisms

> **v2 addition:** The capability system is **additive**. It does not replace existing gating.

| Existing Mechanism | What It Gates | Changed by Capability Contract? |
|-------------------|--------------|-------------------------------|
| `edition.ts` → `canBusinessUse*()` | API-level module access | **NO** — remains the ceiling |
| `inventory.business_settings.enabled` | Inventory trigger (SQL) | **NO** — remains the per-schema gate |
| `delivery.business_settings.enabled` | Delivery trigger (SQL) | **NO** — remains the per-schema gate |
| `business_sales_config` | Prompt behavior (4 fields) | **NO** — remains as-is |
| `capability contract` | Prompt behavior + sidebar + onboarding | **NEW** — adds to, does not replace |

**Invariant:** The existing three-tier defense (edition capability → `business_settings.enabled` → SQL trigger) is proven across 3 schemas and 47+ migrations. The capability contract **never replaces** these mechanisms. It adds a new layer for prompt behavior and UI visibility.

---

## Phase 5 — Source of Truth

### 5.1 Where Capabilities Live Today

| Source | What It Stores | What's Missing |
|--------|---------------|----------------|
| `businesses.edition` | Edition name (4 options) | No per-business capability override |
| `EditionCapabilities` | 24 boolean flags per edition | Not per-business, not capability-level granularity |
| `inventory.business_settings` | `enabled`, `vertical`, thresholds | Only for inventory, not connected to prompt |
| `delivery.business_settings` | `enabled`, zones, thresholds | Only for delivery, not connected to prompt |
| `business_sales_config` | `ask_address`, `ask_phone`, `allow_cancellation` | Only 4 fields, no capability-level granularity |
| `experience_memory.industry` | Industry patterns | `businesses.industry` column doesn't exist |

### 5.2 Recommended Source of Truth

**Option C (Hybrid) — 4 new columns + lightweight capability flags:**

| Column | Table | Type | Purpose |
|--------|-------|------|---------|
| `industry` | `businesses` | `TEXT` | Business vertical/industry (e.g., `wellness_beauty`, `inmobiliaria`, `zapateria`) |
| `capabilities` | `businesses` | `TEXT[]` | Array of active capability IDs (e.g., `{'SALES_EXPERIENCE', 'MOD_INVENTORY'}`) |
| `onboarding_answers` | `businesses` | `JSONB` | Raw onboarding quiz answers (for re-derivation) |
| `capability_sources` | `businesses` | `JSONB` | How each capability was activated (for debugging) |

**Why this works:**

1. **`industry`** — Enables experience memory patterns, vertical-specific knowledge, industry-aware defaults.
2. **`capabilities`** — Configuration source of truth (what the business wants). Resolved state is computed from this + edition ceiling.
3. **`onboarding_answers`** — Preserves raw input for re-derivation if business model changes.
4. **`capability_sources`** — Debugging: "Why is this capability active?" → `'edition'`, `'config'`, `'onboarding'`.

### 5.3 Why NOT a New Table

A `business_capabilities` table would be over-engineered:

- 28 boolean flags = 28 rows or 28 columns. Either way, more complexity than a `TEXT[]` array.
- No relationships to manage. Capabilities are flat, independent booleans.
- No historical tracking needed (capability_sources handles debugging).
- PostgreSQL `TEXT[]` supports efficient `@>` (contains) queries for capability checks.

### 5.4 What Each Column Is NOT

| Column | Is NOT | Why |
|--------|--------|-----|
| `businesses.capabilities` | Resolved state | It's configuration; resolution happens at query time |
| `businesses.capabilities` | Edition replacement | Edition is the ceiling; capabilities are within-ceiling choices |
| `businesses.industry` | Enum | Free-form TEXT (matches `experience_memory.industry` pattern) |
| `businesses.capability_sources` | Audit log | It's point-in-time debugging; full audit can be added via trigger later |

---

## Phase 6 — Activation Model

### 6.1 The Capability Resolution Pipeline

```
Business Created
    ↓
Onboarding Quiz (6 questions)
    ↓
Derive initial capabilities from answers + edition defaults
    ↓
Store in businesses.capabilities + businesses.industry
    ↓
┌─────────────────────────────────────────────────┐
│           CAPABILITY RESOLUTION                  │
│                                                  │
│  1. Start with edition defaults (ceiling)        │
│  2. Apply onboarding overrides                   │
│  3. Apply manual config overrides                │
│  4. Resolve dependencies                         │
│  5. Intersect with edition ceiling               │
│  6. Produce ResolvedCapabilities                 │
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

  // 2. Edition defaults (ceiling)
  for (const [key, enabled] of Object.entries(edition.capabilities)) {
    if (enabled) {
      const capId = editionKeyToCapabilityId(key)
      if (capId) {
        active.add(capId)
        sources[capId] = 'edition'
      }
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

  // 6. Intersect with edition ceiling
  //    (remove capabilities not in edition)
  for (const capId of active) {
    if (capId in sources && sources[capId] !== 'default') {
      if (!editionHasCapability(edition, capId)) {
        active.delete(capId)
        delete sources[capId]
      }
    }
  }

  return { active, businessId, edition: edition.name, sources }
}
```

### 6.3 Onboarding Quiz Design (6 Questions)

The onboarding quiz replaces the current 3-question conversational flow with a structured capability-discovery flow:

| # | Question | Purpose | Derived Capabilities |
|---|----------|---------|---------------------|
| 1 | ¿Cómo se llama tu negocio? | Brand identity | (none — existing) |
| 2 | ¿Qué vendes o qué servicio ofreces? | Product catalog + industry inference | `industry` column (inferred from description) |
| 3 | ¿Cómo te comunicas con tus clientes? | Channel selection | `CHANNEL_WHATSAPP`, `CHANNEL_WEBCHAT`, etc. |
| 4 | ¿Manejas envíos a domicilio? | Delivery capability | `MOD_DELIVERY` |
| 5 | ¿Qué nombre quieres para tu asistente? | Assistant name | (none — existing) |
| 6 | ¿Qué tono prefieres? | Personality | (none — existing) |

**Key changes from v1:**

1. **Question 2 now combines "what do you sell" with industry inference** — instead of asking "¿Qué tipo de negocio es?" separately, the system infers industry from the business description. This reduces questions from 10 to 6.

2. **Questions 5-8 from v1 (inventory, bulk pricing, SKU variants) are removed** — these can be inferred from the business description and product count. A zapateria with 200 products likely needs inventory. A wellness shop with 6 products doesn't.

3. **Confirmation step** — after inferring capabilities, the system presents them for confirmation: "Based on what you told me, it looks like you need [delivery, inventory]. Is that right?"

### 6.4 Industry → Capability Defaults

| Industry | Auto-Enabled Capabilities |
|----------|--------------------------|
| `wellness_beauty` | `SALES_EXPERIENCE`, `CHANNEL_WHATSAPP` |
| `inmobiliaria` | `SALES_EXPERIENCE`, `SALES_QUOTE_REQUEST`, `SALES_FOLLOWUP` |
| `zapateria` | `SALES_SKU_VARIANTS`, `SALES_BULK_PRICING`, `MOD_INVENTORY` |
| `ropa` | `SALES_SKU_VARIANTS`, `MOD_INVENTORY` |
| `general` | (none beyond core) |

### 6.5 Industry Taxonomy

> **v2 addition:** The v1 contract proposed free-text industry values without a controlled vocabulary. The readiness audit flagged this as a risk — different users could type "Zapateria", "zapateria", "Zapatería", "calzado", or "shoe store" for the same industry.

The onboarding quiz provides a **dropdown of suggested values** that match the seeded experience memory patterns:

| Suggested Value | Display Name | Experience Memory Patterns |
|----------------|-------------|--------------------------|
| `wellness_beauty` | Bienestar y Belleza | `salud_suplementos` |
| `inmobiliaria` | Inmobiliaria | `inmobiliaria` |
| `calzado` | Calzado | (to be seeded) |
| `ropa` | Ropa y Moda | (to be seeded) |
| `general` | General / Otro | (none) |

Users can also type a custom value (free-form TEXT), but the suggested values ensure consistent derivation for common verticals.

---

## Phase 7 — Capability → Prompt Bridge

### 7.1 The Existing Bridge (Partially Working)

Today, `buildMasterPrompt()` receives 14 parameters. **Zero are capability flags.** However, `experienceContext` is **already injected** into the prompt conditionally (`prompts.ts:357`):

```typescript
${experienceContext ? `\n## Experiencia de Ventas\nUsa estas respuestas probadas...` : ''}
```

This means the `SALES_EXPERIENCE` capability **already has a prompt bridge** — it just needs the `industry` column to work (so experience patterns actually load).

### 7.2 Recommended Injection Points

The bridge adds **4 new conditional prompt blocks** (plus 2 that already exist):

| # | Capability | Prompt Block | Location in Prompt | Status |
|---|-----------|-------------|-------------------|--------|
| 1 | `SALES_EXPERIENCE` | `## Experiencia de Ventas` — Blended objection patterns | After business info, before products | **ALREADY EXISTS** (`prompts.ts:357`) — needs `industry` column |
| 2 | `SALES_MULTI_PRODUCT` | `## Recomendación` — Multi-product comparison instructions | After products section | New |
| 3 | `SALES_SKU_VARIANTS` | `## Variantes del Producto` — Variant presentation rules | After product format | New |
| 4 | `SALES_BULK_PRICING` | `## Precios por Volumen` — Volume pricing rules | After sales rules | New |
| 5 | `MOD_INVENTORY` | `## Disponibilidad` — Stock awareness directives | Before closing policy | New |
| 6 | `MOD_DELIVERY` | `## Logística` — Delivery promise/ETA directives | After closing policy | New |

### 7.3 Example: `SALES_EXPERIENCE` Injection

The existing code at `prompts.ts:357` already handles this:

```typescript
const experienceNote = params.capabilities?.active.has('SALES_EXPERIENCE')
  ? `\n## Experiencia de Ventas\nUsa estas respuestas probadas como guía cuando el cliente plantee objeciones similares. Puedes adaptar el texto al contexto de la conversación, pero mantén la esencia de la respuesta recomendada:\n${experienceContext}`
  : ''
```

**No new code needed for this block.** The only change is ensuring `experienceContext` is non-empty (requires `industry` column).

### 7.4 Example: `MOD_INVENTORY` Injection

```typescript
const inventoryNote = params.capabilities?.active.has('MOD_INVENTORY')
  ? `\n## Disponibilidad\nTienes acceso al inventario en tiempo real. Si el cliente pregunta por disponibilidad, confirma el stock actual. Si el stock es bajo (menos de 5 unidades), menciona que el stock es limitado. NUNCA prometas stock que no existe.`
  : ''
```

### 7.5 Caller Impact

| Caller | File:Line | Needs Update? | Reason |
|--------|-----------|--------------|--------|
| Production conversation | `context.ts:136` | YES — pass `ResolvedCapabilities` | Main prompt builder |
| Laboratorio simulation | `laboratorio/context/route.ts:33` | YES — pass `ResolvedCapabilities` | Training prompt |
| Demo chat | `demo/chat/route.ts:96` | NO — demo doesn't need capabilities | Evaluation only |

### 7.6 Token Budget Impact

Each conditional block adds ~50-150 tokens. With 4 new blocks + 1 existing, worst case adds ~750 tokens to a ~2000 token prompt. **37% increase** — within acceptable limits for gpt-4o-mini.

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
| Lab | (core) | ✅ Always (no gating) |
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

> **v2 addition:** All dependencies are classified as HARD (technically required), SOFT (convenient but not required), or NONE (no dependency). The v1 used "recommended" which is not deterministic.

| Capability | Depends On | Type | Reason |
|-----------|-----------|------|--------|
| `CHANNEL_MULTI` | ≥2 `CHANNEL_*` capabilities | **HARD** | Multi-channel requires at least 2 channels |
| `SALES_EXPERIENCE` | `industry` column set | **HARD** | Experience memory requires industry to load patterns |
| `SALES_FOLLOWUP` | `CORE_CUSTOMER_MEMORY` | **SOFT** | Follow-up benefits from customer memory but can work without it |
| `SALES_RECOVERY` | `CORE_CUSTOMER_MEMORY` + `SALES_FOLLOWUP` | **SOFT** | Recovery benefits from both but doesn't strictly require them |
| `MOD_DELIVERY` | (none) | **NONE** | Delivery is independent of inventory |
| `MOD_ANALYTICS` | Any `MOD_*` enabled | **SOFT** | Analytics is more useful with data from modules |
| `SALES_BULK_PRICING` | `SALES_MULTI_PRODUCT` | **SOFT** | Bulk pricing is more useful with multi-product |
| `SALES_QUOTE_REQUEST` | `SALES_FOLLOWUP` | **SOFT** | Quotes benefit from follow-up |

### 9.2 Dependency Resolution Rules

| Rule | Classification | Action |
|------|---------------|--------|
| HARD dependency not met | **BLOCKS** | Capability cannot be activated |
| SOFT dependency not met | **WARNS** | Capability activates but logs a warning |
| Conflict detected | **RESOLVES** | Higher-priority capability wins |

### 9.3 Conflict Rules

| Rule | Description |
|------|-------------|
| `CHANNEL_MULTI` cannot be active with only 1 channel | Requires ≥2 channel capabilities |
| `SALES_BULK_PRICING` requires `SALES_MULTI_PRODUCT` | Volume pricing implies multiple products |
| `SALES_QUOTE_REQUEST` requires `SALES_FOLLOWUP` | Quotes need follow-up mechanism |

### 9.4 Dependency Resolution Order

```
1. Resolve core (always active)
2. Resolve edition defaults (ceiling)
3. Resolve industry defaults
4. Resolve manual overrides
5. Resolve dependencies (add missing HARD deps, warn on missing SOFT deps)
6. Resolve conflicts (remove invalid combos)
7. Intersect with edition ceiling
8. Produce final ResolvedCapabilities
```

---

## Phase 10 — Vertical Generalization

### 10.1 Core Thesis

**No vertical-specific architecture is needed.** Every vertical (wellness, real estate, zapateria, ropa) can be expressed as a **combination of the same 28 capabilities** with different default sets.

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
| `MULTIPLE_BUSINESSES` | ❌ | ❌ | ❌ | ❌ |
| `MULTIPLE_ASSISTANTS` | ❌ | ❌ | ❌ | ❌ |

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
│  Layer 3: Prompt Bridge (4 new + 1 existing)     │
│  src/lib/ai/prompts.ts — add capabilities param │
│  4 new prompt sections (50-150 tokens each)      │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Layer 4: Dashboard Bridge (sidebar filtering)   │
│  src/components/dashboard/ActivityRail.tsx       │
│  Filter nav items by ResolvedCapabilities        │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Layer 5: Onboarding Redesign (6 questions)      │
│  src/components/onboarding/ConversationalOnboarding.tsx │
│  Add capability-discovery questions              │
└─────────────────────────────────────────────────┘
```

### 11.2 Effort Estimate

| Layer | Files Modified | New Files | Effort |
|-------|---------------|-----------|--------|
| DB Schema | 1 migration | 0 | 1 day |
| Capability Resolution | 0 | 1 (`capabilities.ts`) | 1.5 days |
| Prompt Bridge | 1 (`prompts.ts`) | 0 | 1 day |
| Dashboard Bridge | 1 (`ActivityRail.tsx`) | 0 | 0.5 day |
| Onboarding Redesign | 2 (`ConversationalOnboarding.tsx`, `route.ts`) | 0 | 2 days |
| TypeScript types | auto-generated | 0 | 0.5 day |
| Tests | 1 new test file | 0 | 1 day |
| **Total** | **5 files** | **1 file + 1 test** | **7.5 days** |

### 11.3 What We're NOT Building

- ❌ No new database tables
- ❌ No vertical-specific code paths
- ❌ No capability-specific UI components
- ❌ No capability registry microservice
- ❌ No capability versioning system
- ❌ No capability audit log (beyond capability_sources)
- ❌ No replacement of existing edition→licensing or business_settings→licensing paths

---

## Phase 12 — Congruence Contract

### 12.1 Alignment Matrix

| System | Today | After Contract | Alignment |
|--------|-------|---------------|-----------|
| Edition → Capabilities | 24 booleans, mostly unused | 28 named capabilities, actively resolved | ✅ HIGH |
| Capabilities → Prompt | **Partial** (`experienceContext` exists, but not gated) | 4 new + 1 existing conditional prompt blocks | ✅ HIGH |
| Capabilities → Dashboard | **No filtering** | Sidebar filtered by capabilities | ✅ HIGH |
| Onboarding → Capabilities | **No discovery** | 6-question quiz → capability derivation | ✅ HIGH |
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
| **Edition Ceiling Invariant** | Edition always wins — no capability can exceed the edition's maximum |

---

## Phase 13 — Adversarial Review

### 13.1 Challenge: "Why not just use the edition system?"

**Answer**: Editions are **deployment tiers** (evaluation/professional/enterprise/cloud), not **business configurations**. A wellness business and a real estate business on the same enterprise edition need different capabilities. Editions set the **ceiling** (what's possible), capabilities set the **floor** (what's active).

### 13.2 Challenge: "Isn't a TEXT[] array an anti-pattern?"

**Answer**: For 28 flat, independent boolean flags with no relationships, a `TEXT[]` is simpler and more performant than:
- 28 boolean columns (schema bloat)
- A junction table (unnecessary join)
- A JSONB object (harder to query with `@>`)

PostgreSQL `TEXT[]` supports `@>` (contains), `ANY()`, and GIN indexing. It's the right tool for this job.

### 13.3 Challenge: "What about capability versioning?"

**Answer**: Not needed. Capabilities are **current state**, not **historical events**. If a business changes its capabilities, the new set overwrites the old. `capability_sources` provides debugging context. If audit history is needed later, it can be added via a trigger.

### 13.4 Challenge: "What about the 20 unused `canUse*()` functions?"

**Answer**: They become **deprecated** after the capability contract is implemented. The new `resolveCapabilities()` replaces them. They can be removed in a follow-up refactor.

### 13.5 Challenge: "What if a business wants a capability their edition doesn't support?"

**Answer**: Edition is the **ceiling**. If `evaluation` doesn't include `MOD_INVENTORY`, the business can't activate it regardless of onboarding answers. This is the correct behavior — editions are licensing constraints.

### 13.6 Challenge: "Doesn't this duplicate the existing gating in edition.ts + business_settings?"

**Answer**: The existing gating controls **API access** (can this business call inventory endpoints?). The capability contract controls **prompt behavior and UI visibility** (should the AI mention stock? should the sidebar show Inventory?). These are different concerns that happen to use the same capability names. The capability contract is additive, not a replacement.

---

## Phase 14 — Implementation Boundary

### 14.1 In Scope (This Contract)

| # | Work Item | Priority | Effort |
|---|----------|----------|--------|
| 1 | Add `industry` column to `businesses` | CRITICAL | 0.5 day |
| 2 | Add `capabilities` column to `businesses` | CRITICAL | 0.5 day |
| 3 | Add `onboarding_answers` column to `businesses` | MEDIUM | 0.5 day |
| 4 | Add `capability_sources` column to `businesses` | LOW | 0.5 day |
| 5 | Create `src/lib/system/capabilities.ts` | CRITICAL | 1.5 days |
| 6 | Wire `ResolvedCapabilities` into `buildMasterPrompt()` | CRITICAL | 1 day |
| 7 | Wire `ResolvedCapabilities` into `ActivityRail.tsx` | HIGH | 0.5 day |
| 8 | Redesign onboarding quiz (6 questions) | HIGH | 2 days |
| 9 | Add onboarding → capability derivation logic | HIGH | 1 day |
| 10 | Fix `businesses.industry` for experience memory | HIGH | 0.5 day |
| 11 | Update TypeScript types (supabase gen) | MEDIUM | 0.5 day |
| 12 | Tests: capability resolution, prompt adaptation, sidebar | HIGH | 1 day |

### 14.2 Out of Scope (Future Work)

| # | Work Item | Reason |
|---|----------|--------|
| 1 | Multi-product presentation in prompt | Requires `ProductReference[]` change in runtime |
| 2 | Variant system integration in Sales AI | Requires `resolve_variant()` call in prompt builder |
| 3 | Bulk pricing UI in catalog | Requires catalog schema extension |
| 4 | Quote request flow | Requires new conversation state machine |
| 5 | Capability versioning/audit | Not needed yet |
| 6 | Remove deprecated `canUse*()` functions | Cleanup, not blocking |
| 7 | Experience memory industry seeding | Data task, needs industry taxonomy first |

---

## Phase 15 — Final Contract

### 15.1 The Contract

**MIA's capability system is a 5-layer architecture:**

```
┌─────────────────────────────────────────────────┐
│  1. STORAGE: businesses.industry + .capabilities │
│     (28 named capabilities, TEXT[] array)        │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  2. RESOLUTION: resolveCapabilities()            │
│     (edition ceiling + industry + config → active)│
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  3. PROMPT: buildMasterPrompt() + capabilities   │
│     (4 new + 1 existing conditional blocks)      │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  4. DASHBOARD: ActivityRail filtered by caps     │
│     (sidebar shows only active capabilities)     │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  5. ONBOARDING: Quiz → capability derivation     │
│     (6 questions → industry + capabilities)      │
└─────────────────────────────────────────────────┘
```

### 15.2 Key Invariants

1. **No vertical-specific code paths.** Every vertical is a capability combination.
2. **No new tables.** 4 columns on existing `businesses` table.
3. **No prompt without capabilities.** Every `buildMasterPrompt()` call includes `ResolvedCapabilities`.
4. **No dashboard without capabilities.** Every sidebar render filters by `ResolvedCapabilities`.
5. **No capability without source.** Every activation has a traceable source (edition/config/onboarding/default).
6. **Edition is the ceiling.** No capability can exceed the edition's maximum.
7. **Existing gating preserved.** Edition→licensing and business_settings→licensing paths remain unchanged.

### 15.3 Success Criteria

| Criterion | Metric |
|-----------|--------|
| Prompt adapts to capabilities | A wellness business prompt differs from a zapateria prompt |
| Sidebar adapts to capabilities | A business without inventory doesn't see Inventory in sidebar |
| Experience memory activates | `industry` column set → experience patterns load |
| Onboarding discovers capabilities | New businesses get capability-appropriate defaults |
| No regressions | Existing Vitanova behavior unchanged |
| Edition ceiling enforced | No capability exceeds edition maximum |

### 15.4 Terminal State

**This document is the complete capability contract v2.** It defines:
- ✅ What capabilities exist (28 named capabilities, 5 tiers)
- ✅ How they're stored (4 columns on `businesses`)
- ✅ How they're resolved (edition ceiling + industry + config)
- ✅ How they affect the prompt (4 new + 1 existing conditional blocks)
- ✅ How they affect the dashboard (sidebar filtering)
- ✅ How they're discovered (onboarding quiz)
- ✅ What's in scope (7.5 days, 6 files)
- ✅ What's out of scope (7 deferred items)
- ✅ How they relate to existing gating (additive, not replacement)
- ✅ Configuration vs resolved state distinction

**READ-ONLY. No code changes. No DB changes. No migrations.**
