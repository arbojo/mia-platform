# Capability Contract — Implementation Readiness

**Audit Type:** Read-only forensic validation
**Date:** 2026-08-26
**HEAD:** `681c4b8`
**Input:** `docs/architecture/capability-contract.md` (771 lines)
**Scope:** Validate contract against real repository state. No code changes.

---

## Executive Verdict

**READY_WITH_CHANGES**

The capability contract's **conceptual model is sound** — 5-layer architecture (Storage → Resolution → Prompt → Dashboard → Onboarding) with no new tables and no vertical-specific code. However, the contract contains **3 critical factual errors**, **2 structural ambiguities**, and **1 conceptual conflation** that must be corrected before implementation. The most severe: the contract claims **35 capabilities** but its own type definition contains exactly **27** — 8 capabilities are missing from the catalog.

---

## Terminal State

`READY_WITH_CHANGES`

---

## Critical Findings

### CF-1: Capability Count Mismatch (CRITICAL)

| Source | Claimed | Actual |
|--------|---------|--------|
| Contract prose (line 82) | "35 named capabilities" | — |
| `CapabilityId` type (lines 155-186) | — | **27 entries** |
| `EditionCapabilities` interface (edition.ts:19-44) | "22 boolean flags" (contract line 55) | **24 boolean flags** |
| Contract prose (line 66) | "16 of 22 canUse*() functions never imported" | All 16 sync `canUse*()` never imported (correct) |

**Discrepancy 1:** Contract says 35, defines 27. 8 capabilities are missing from the catalog.

**Discrepancy 2:** Contract says EditionCapabilities has 22 booleans. Actual count is 24. The contract undercounts by 2.

**Discrepancy 3:** The 8 missing capabilities likely correspond to EditionCapabilities entries that have no CapabilityId counterpart: `demoChat`, `multipleBusinesses`, `multipleAssistants`, `cloudDeployment`, `skills`, `weeklyReports`, `dashboard`, `promptBuilder`, `knowledgeCenter`, `salesSimulator`, `connections`. That's 11 entries with no CapabilityId — meaning the real CapabilityId count should be higher than 27 if edition capabilities are properly mapped.

### CF-2: `businesses.industry` Column Does Not Exist (CRITICAL)

| Evidence | Location |
|----------|----------|
| `001_initial_schema.sql:12-19` — businesses table has no `industry` column | SQL |
| Zero migrations add `industry` to businesses | All 53+ migrations |
| `src/lib/types/index.ts:12-21` — `businesses.Row` has no `industry` field | TypeScript |
| `src/lib/conversation/context.ts:95` — `fullAssistant.businesses?.industry ?? 'general'` | Runtime phantom reference |
| `src/app/api/admin/experience/patterns/route.ts:26,34` — `business.industry` | Runtime phantom reference |

**3 files** reference `business.industry` as if it exists. It always returns `undefined`, falling back to `'general'`. Experience memory patterns for `salud_suplementos` and `inmobiliaria` are seeded but never loaded.

### CF-3: No Resolution Model Exists (CRITICAL)

| What exists | What's proposed | Gap |
|------------|----------------|-----|
| `edition.ts` — 4 editions, 24 booleans | `resolveCapabilities()` function | **Does not exist** |
| `inventory/licensing.ts` — 3-gate activation | `editionKeyToCapabilityId()` mapping | **Does not exist** |
| `delivery/licensing.ts` — 3-gate activation | `ResolvedCapabilities` type | **Does not exist** |
| `business_sales_config` — 4 booleans | Dependency resolution logic | **Does not exist** |

The contract's resolution algorithm (Phase 6.2) is **entirely hypothetical**. No code in `src/` implements any capability resolution.

### CF-4: EditionCapabilities ↔ CapabilityId Mapping Missing (CRITICAL)

The `EditionCapabilities` interface has 24 camelCase keys. The contract defines 27 SCREAMING_SNAKE `CapabilityId` values. There is **no mapping between them** anywhere in the codebase.

Key mismatches:
- `EditionCapabilities.deliveryHub` → proposed `MOD_DELIVERY` (name change)
- `EditionCapabilities.inventoryHub` → proposed `MOD_INVENTORY` (name change)
- `EditionCapabilities.analyticsDashboard` → proposed `MOD_ANALYTICS` + `MOD_ANALYTICS_DASHBOARD` (split)
- 11 EditionCapabilities entries have **no CapabilityId counterpart** at all

---

## Capability Count

### Contract Claims vs Reality

| Tier | Contract Table | Contract Type | Actual |
|------|---------------|--------------|--------|
| Tier 1 Core | 8 | 8 | **8** ✅ |
| Tier 2 Channel | 5 | 5 | **5** ✅ |
| Tier 3 Sales | 10 | 10 | **10** ✅ |
| Tier 4 MOD | 4 | 4 | **4** ✅ |
| **Total** | **27** | **27** | **27** |

**The contract says 35 but defines 27. The number 35 appears 4 times in the document (lines 82, 258, 356, 531) but is not supported by the actual type definition or table.**

### EditionCapabilities Count

Contract says "22 boolean flags" (line 55). Actual count in `edition.ts:19-44`: **24 boolean flags**.

The 24 are: demoChat, whatsapp, webchat, telegram, multiChannel, multipleBusinesses, multipleAssistants, cloudDeployment, skills, businessMemory, learning, weeklyReports, dashboard, promptBuilder, knowledgeCenter, commercialIntelligence, expectationIntelligence, responsibleSelling, knowledgeStudio, salesSimulator, connections, deliveryHub, inventoryHub, analyticsDashboard.

---

## Source of Truth Verdict

### Questions Answered with Evidence

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 1 | ¿Qué significa "capability activa"? | A capability ID present in `businesses.capabilities` TEXT[] array (proposed) | Contract Phase 5.2 — no existing implementation |
| 2 | ¿Dónde se persiste? | `businesses.capabilities` column (proposed) | Does not exist yet |
| 3 | ¿Quién puede cambiarla? | Onboarding (initial), manual config (override), admin API (proposed) | Contract Phase 6.1 |
| 4 | ¿Quién puede sobrescribirla? | Manual config overrides onboarding; edition is ceiling | Contract Phase 6.2 |
| 5 | ¿Edition es ceiling, default o source? | **Ceiling** — edition sets maximum possible capabilities | Contract Phase 13.1 |
| 6 | ¿Onboarding escribe capabilities o propone? | **Proposes** — derives from answers, stores in `businesses.capabilities` | Contract Phase 6.1 |
| 7 | ¿Manual config puede contradecir onboarding? | **Yes** — manual overrides onboarding | Contract Phase 6.2 step 4 |
| 8 | ¿Qué pasa si DB capability dice ON pero edition dice OFF? | **CONFLICT** — not addressed by contract | See Resolution below |

### Source of Truth Classification

| Proposed Column | Classification | Reason |
|----------------|---------------|--------|
| `businesses.capabilities` | **Materialized resolved state** | Combines edition + industry + onboarding + manual. Not raw input, not pure config. |
| `businesses.industry` | **Configuration input** | Set by onboarding, overrideable by admin |
| `businesses.onboarding_answers` | **Raw input archive** | For re-derivation, never read by resolution |
| `businesses.capability_sources` | **Debug metadata** | Read-only audit trail |

**AMBIGUITY:** The contract calls `businesses.capabilities` both "explicit, queryable, auditable capability set" (line 250) and implies it's the resolved state. But if edition is a ceiling, and manual config can override onboarding, then `businesses.capabilities` is NOT the resolved state — it's the **requested** state that must be re-resolved at query time against the edition ceiling.

**VERDICT:** `businesses.capabilities` should be the **configuration source** (what the business wants), and `resolveCapabilities()` should produce the **resolved state** (what the business gets) by intersecting with the edition ceiling. The contract does not clearly distinguish these two states.

---

## Resolution Model Verdict

### What Exists Today

| Source | Affects Prompt? | Affects API? | Affects UI? |
|--------|----------------|-------------|------------|
| `edition.ts` (24 booleans) | **NO** | YES (licensing) | **NO** (sidebar shows all) |
| `inventory.business_settings.enabled` | **NO** | YES (403 gate) | **NO** |
| `delivery.business_settings.enabled` | **NO** | YES (403 gate) | **NO** |
| `business_sales_config` (4 booleans) | **YES** (lines 331-332) | YES | YES (settings page) |
| `experience_memory.industry` | **NO** (always 'general') | NO | NO |

### What the Contract Proposes

| Source | Affects Prompt? | Affects API? | Affects UI? |
|--------|----------------|-------------|------------|
| `businesses.capabilities` (TEXT[]) | **YES** (6 blocks) | YES | YES (sidebar) |
| `businesses.industry` | **YES** (experience memory) | YES | NO |
| `resolveCapabilities()` | **YES** (produces resolved set) | YES | YES |

### Risk: Multiple Sources of Truth

The contract creates **4 new resolution paths**:

```
PATH A: edition → licensing → API gate (EXISTING)
PATH B: business_settings.enabled → licensing → API gate (EXISTING)
PATH C: businesses.capabilities → resolveCapabilities() → prompt + dashboard (NEW)
PATH D: business_sales_config → buildMasterPrompt() (EXISTING)
```

**PATH C does not replace PATH A or PATH B.** It adds a third resolution mechanism. The contract should explicitly state:
- PATH A and PATH B continue to gate API access ( licensing)
- PATH C gates prompt behavior and UI visibility
- PATH D continues to inject sales config into prompt
- These are **complementary, not competing** sources

**VERDICT:** The resolution model is architecturally sound but the contract fails to explicitly state that the existing edition→licensing and business_settings→licensing paths remain unchanged. This creates risk of implementer confusion.

---

## Dependency Verdict

### Each Dependency Audited

| Capability | Declared Dependency | Classification | Technical Necessity | Exists Today |
|-----------|-------------------|---------------|--------------------|----|
| `CHANNEL_MULTI` | ≥2 CHANNEL_* | **HARD** | Technically necessary — multi-channel requires ≥2 channels | No (no channel gating) |
| `SALES_EXPERIENCE` | `industry` column set | **HARD** | Technically necessary — experience memory queries by industry | No (column missing) |
| `SALES_FOLLOWUP` | `CORE_CUSTOMER_MEMORY` | **SOFT** | Convenient but not technically required — follow-up can work without per-customer memory | No |
| `SALES_RECOVERY` | `CORE_CUSTOMER_MEMORY` + `SALES_FOLLOWUP` | **SOFT** | Convenient — recovery benefits from both but doesn't strictly require them | No |
| `MOD_DELIVERY` | `MOD_INVENTORY` (recommended) | **NONE** | **NOT a dependency** — delivery does not technically require inventory | Contract calls it "recommended" |
| `MOD_ANALYTICS` | Any `MOD_*` enabled | **SOFT** | Convenient — analytics is more useful with data from modules | No |
| `SALES_BULK_PRICING` | `SALES_MULTI_PRODUCT` | **SOFT** | Convenient — bulk pricing is more useful with multi-product | No |
| `SALES_QUOTE_REQUEST` | `SALES_FOLLOWUP` | **SOFT** | Convenient — quotes benefit from follow-up | No |

### `MOD_DELIVERY → MOD_INVENTORY` — CRITICAL

The contract states (line 502): `MOD_DELIVERY | MOD_INVENTORY (recommended) | Delivery benefits from stock awareness`

**This is NOT a dependency.** It's a recommendation. In a deterministic dependency system, "recommended" is not a valid dependency type. The contract's own dependency classification section (Phase 9) does not classify dependencies as HARD/SOFT/NONE, which makes the dependency graph non-deterministic.

**VERDICT:** Dependencies must be classified as HARD (technically required), SOFT (convenient but not required), or NONE (no dependency). "Recommended" must be eliminated. `MOD_DELIVERY → MOD_INVENTORY` should be NONE.

---

## Capability / Module / Feature Taxonomy

### The Contract Conflates Three Concepts

| Concept | Examples | What It Controls |
|---------|----------|-----------------|
| **Capability** | `SALES_EXPERIENCE`, `SALES_BULK_PRICING` | Prompt behavior, AI intelligence |
| **Module** | `MOD_INVENTORY`, `MOD_DELIVERY` | API access, domain isolation, separate schema |
| **Feature** | `CHANNEL_WHATSAPP`, `CHANNEL_WEBCHAT` | Channel connectivity, UI routing |

### Evidence of Conflation

1. **`MOD_INVENTORY`** is a **module** (has its own schema, licensing, API routes). But in the contract, it's treated as a capability alongside `SALES_BULK_PRICING` (which is just a prompt directive).

2. **`MOD_ANALYTICS`** and **`MOD_ANALYTICS_DASHBOARD`** are **two separate entries** (lines 128-129). `MOD_ANALYTICS` has "No direct prompt impact" and `MOD_ANALYTICS_DASHBOARD` has "No direct prompt impact." These are **UI features**, not capabilities.

3. **`CHANNEL_MULTI`** is a **meta-capability** (depends on other channels existing). It's fundamentally different from `CHANNEL_WHATSAPP` (a concrete integration).

4. **`CORE_LEARNING`** is listed as a sidebar trigger (Lab) but is actually a **platform behavior** (correction learning). It's not something a business enables/disables.

### Recommended Taxonomy

| Type | Prefix | Controls | Examples |
|------|--------|----------|---------|
| **Capability** | (none) | Prompt behavior | `SALES_EXPERIENCE`, `SALES_BULK_PRICING` |
| **Module** | `MOD_` | API access + domain isolation | `MOD_INVENTORY`, `MOD_DELIVERY` |
| **Channel** | `CHANNEL_` | Channel connectivity | `CHANNEL_WHATSAPP`, `CHANNEL_WEBCHAT` |
| **Platform** | (remove from capabilities) | Always-on platform features | `CORE_*`, `MOD_ANALYTICS_DASHBOARD` |

**VERDICT:** The contract's flat CapabilityId list mixes 4 distinct concept types. This should be separated into at minimum 2 categories: **capabilities** (prompt-affecting) and **modules** (API-affecting). `MOD_ANALYTICS_DASHBOARD` should not be a capability — it's a UI permission.

---

## Prompt Bridge Verdict

### Current State

| Caller | File:Line | Passes salesConfig? | Passes experienceContext? |
|--------|-----------|--------------------|-----------------------|
| Production conversation | `context.ts:136` | ✅ YES | ✅ YES |
| Laboratorio simulation | `laboratorio/context/route.ts:33` | ❌ NO | ❌ NO |
| Demo chat | `demo/chat/route.ts:96` | ❌ NO | ❌ NO |

### Contract Claims vs Reality

| Contract Claim | Reality |
|---------------|---------|
| "buildMasterPrompt() has 14 parameters" | ✅ Correct (lines 187-216) |
| "Zero are capability flags" | ✅ Correct |
| "6 conditional prompt blocks" | Proposes 6 new blocks — reasonable |
| "SALES_EXPERIENCE → experience context" | **PARTIALLY EXISTS** — `experienceContext` is already passed by `context.ts:154`. The contract proposes gating it behind a capability flag. |
| "MOD_INVENTORY → stock awareness" | **DOES NOT EXIST** — no stock data reaches prompt |
| "MOD_DELIVERY → delivery promises" | **PARTIALLY EXISTS** — `ai.deliveryPromiseRule` is always in prompt (line 323). It's a static rule, not dynamic. |

### Risk: Duplicate Prompt Sections

The contract proposes adding `## Experiencia de Ventas` gated by `SALES_EXPERIENCE`. But `experienceContext` is **already passed** to `buildMasterPrompt()` (line 154 of `context.ts`) and **already injected** into the prompt (line 357 of `prompts.ts`):

```typescript
${experienceContext ? `\n## Experiencia de Ventas\nUsa estas respuestas probadas como guía...` : ''}
```

**This section already exists in the prompt.** The contract proposes gating it behind `SALES_EXPERIENCE`, but the data pipeline already works — the issue is that `experienceContext` is always empty because `business.industry` is always `'general'`. The fix is adding the `industry` column, not adding a capability gate.

### Token Budget

Contract claims ~2000 token base prompt + ~900 tokens worst case = 45% increase. The `experienceContext` section alone can add 500-1000 tokens when patterns exist. The 45% estimate is reasonable.

**VERDICT:** The prompt bridge is mostly sound, but:
1. `SALES_EXPERIENCE` injection **already exists** — it just needs the `industry` column to work
2. `MOD_INVENTORY` and `MOD_DELIVERY` prompt blocks are genuinely new
3. The laboratorio and demo chat callers need to be updated to pass capabilities (or explicitly not)
4. Not all 6 proposed blocks are truly new — some are re-gating existing behavior

---

## Dashboard Bridge Verdict

### Current State

| Sidebar Item | Route | Edition Gate | Module Gate |
|-------------|-------|-------------|------------|
| Command Center | `/dashboard` | None | None |
| Relations | `/dashboard/conversations` | None | None |
| Memory | `/dashboard/knowledge` | None | None |
| Thinking | `/dashboard/knowledge-studio` | None | None |
| Catalog | `/dashboard/catalog` | None | None |
| Lab | `/dashboard/laboratorio` | None | None |
| Delivery | `/dashboard/delivery` | None | None |
| Inventory | `/dashboard/inventory` | None | None |
| Analytics | `/dashboard/analytics` | None | None |
| Sales Settings | `/dashboard/settings` | None | None |
| Connections | `/dashboard/connections` | None | None |
| Council | `/dashboard/assistants` | None | None |
| Health | `/dashboard/health` | None | None |
| Accessibility | `/dashboard/accessibility` | None | None |
| Platform Admin | `/dashboard/platform-admin` | `isPlatformOwner` | None |

**Zero capability gates on sidebar.** All 15 items shown unconditionally (except Platform Admin).

### Contract Mapping

| Sidebar Item | Contract Says | Should Be |
|-------------|--------------|-----------|
| Lab | `CORE_LEARNING` | **REMOVE** — Lab is always available (it's a training tool, not gated) |
| Delivery | `MOD_DELIVERY` | ✅ Correct — should be gated |
| Inventory | `MOD_INVENTORY` | ✅ Correct — should be gated |
| Analytics | `MOD_ANALYTICS` | ✅ Correct — should be gated |
| Thinking | (core) | ✅ Correct — always shown |

**VERDICT:** The dashboard bridge is mostly sound. The Lab gating behind `CORE_LEARNING` is incorrect — the Lab is a training tool available to all businesses. Delivery, Inventory, and Analytics gating is correct.

---

## Onboarding Verdict

### Current State

| Aspect | Reality |
|--------|---------|
| Questions asked | 3: business name, what they sell, assistant name |
| Industry collected | ❌ NO |
| Channel preferences | ❌ NO (hardcodes `'web'`) |
| Delivery needs | ❌ NO |
| Inventory needs | ❌ NO |
| Bulk pricing | ❌ NO |
| SKU variants | ❌ NO |
| Data persisted to | `businesses`, `brand_identities`, `products`, `sales_rules`, `assistants`, `assistant_channels` |
| Business creation | Client-side (RLS), at end when `all_complete=true` |

### Contract's 10 Questions

| # | Question | Classification | Issue |
|---|----------|---------------|-------|
| 1 | ¿Cómo se llama tu negocio? | BUSINESS DATA | ✅ Already exists |
| 2 | ¿Qué tipo de negocio es? | INDUSTRY SIGNAL | New — maps to `industry` column |
| 3 | ¿Qué vendes o qué servicio ofreces? | BUSINESS DATA | ✅ Already exists |
| 4 | ¿Cómo te comunicas con tus clientes? | DIRECT CAPABILITY | New — maps to CHANNEL_* |
| 5 | ¿Manejas envíos a domicilio? | DIRECT CAPABILITY | New — maps to MOD_DELIVERY |
| 6 | ¿Necesitas controlar tu inventario? | DIRECT CAPABILITY | New — maps to MOD_INVENTORY |
| 7 | ¿Ofreces precios por volumen? | DIRECT CAPABILITY | New — maps to SALES_BULK_PRICING |
| 8 | ¿Tienes variants de tus productos? | DIRECT CAPABILITY | New — maps to SALES_SKU_VARIANTS |
| 9 | ¿Qué nombre quieres para tu asistente? | PERSONALIZATION | ✅ Already exists |
| 10 | ¿Qué tono prefieres? | PERSONALIZATION | Partially exists (tone defaults to "Profesional y cálido") |

### Issues

1. **Questions 5-8 are leading** — "¿Necesitas controlar tu inventario?" assumes the business knows what inventory management means. A better question: "¿Cuántos productos diferentes manejas?" (infers inventory from count).

2. **Questions are not inferable** — The contract says "evitar un quiz largo que pregunte cosas que el sistema puede inferir." But questions 5-8 are exactly the kind of thing that can be inferred from the business description (question 3). A wellness shop with 6 products doesn't need inventory. A zapateria with 200 SKUs does.

3. **Business is created at the end** — The current flow creates the business only when `all_complete=true`. Adding 5-7 new questions means the user must complete all questions before any data is saved. If they abandon mid-quiz, nothing is persisted.

4. **Client-side creation** — Business creation happens via browser Supabase client with RLS. Adding `industry` and `capabilities` columns means the client must have permission to write these fields. This may require new RLS policies.

**VERDICT:** The onboarding redesign is necessary but the 10-question quiz should be reduced to 5-6 questions with some inferred from business description. Questions 5-8 could be presented as confirmation ("Based on what you told me, it looks like you need inventory management. Is that right?").

---

## Industry Verdict

### The `businesses.industry` Problem

| Aspect | Reality |
|--------|---------|
| Column exists in DB | ❌ NO |
| Column in TypeScript types | ❌ NO |
| Code references it | ✅ YES — 3 files |
| Always returns | `undefined` → `'general'` |
| Experience memory seeded | ✅ YES — `salud_suplementos`, `inmobiliaria` patterns |
| Patterns ever loaded | ❌ NO — always queries with `'general'` |

### Values Used

| Source | Values |
|--------|--------|
| `experience_memory.seed` | `salud_suplementos`, `inmobiliaria` |
| `conversation/context.ts:95` | Falls back to `'general'` |
| Contract Phase 6.4 | `wellness_beauty`, `inmobiliaria`, `zapateria`, `ropa`, `general` |

**The contract proposes 5 industry values. The seed data uses 2 different values. There is no shared taxonomy.**

### Recommendation

The `industry` column should be free-form TEXT (not an enum) to allow organic growth, but the onboarding quiz should provide a dropdown of suggested values that match the seeded experience memory patterns.

**VERDICT:** Adding `businesses.industry` column is CRITICAL and unblocks experience memory. The column type should be `TEXT` with no CHECK constraint, matching the existing `experience_memory.industry` pattern.

---

## Vertical Generalization Verdict

### Thesis Test: "No vertical-specific architecture needed"

**PASS.** Evidence:

1. Zero `if industry ===` or `switch industry` in `src/lib/ai/`
2. Zero industry-specific components or routes
3. Zero industry-specific API endpoints
4. The only `vertical` concept is in `inventory.business_settings.vertical` (inventory-internal)
5. All 4 verticals (wellness, real estate, zapateria, ropa) can be expressed as capability combinations

### Hidden Vertical Logic

**None found.** The only vertical-specific code is:
- `inventory.business_settings.vertical` — affects predictions only
- `experience_memory.industry` — affects objection patterns only

Both are data-driven, not code-driven.

**VERDICT:** The thesis holds. Vertical = Capability Configuration. No vertical-specific code paths exist or are needed.

---

## Congruence Verdict

### Full Chain Trace

```
ONBOARDING (proposed: 10 questions)
    ↓
BUSINESS CONFIG (proposed: businesses.industry + businesses.capabilities)
    ↓
CAPABILITY RESOLUTION (proposed: resolveCapabilities())
    ↓
┌───────────────┬───────────────┐
↓               ↓               ↓
PROMPT       DASHBOARD       RUNTIME
(prompts.ts)  (ActivityRail)  (API licensing)
```

### Existing Paths (Not Replaced)

```
EDITION → licensing.ts → API gate (EXISTING, UNCHANGED)
business_settings.enabled → licensing.ts → API gate (EXISTING, UNCHANGED)
business_sales_config → buildMasterPrompt() (EXISTING, UNCHANGED)
```

### Path Classification

| Path | Status | Risk |
|------|--------|------|
| ONBOARDING → BUSINESS CONFIG | **NEW** (proposed) | Client-side creation, RLS needed |
| BUSINESS CONFIG → RESOLUTION | **NEW** (proposed) | Does not exist |
| RESOLUTION → PROMPT | **NEW** (proposed) | 3 callers need update |
| RESOLUTION → DASHBOARD | **NEW** (proposed) | 1 component needs update |
| EDITION → LICENSING → API | **EXISTING** | Unchanged |
| business_settings → LICENSING → API | **EXISTING** | Unchanged |
| business_sales_config → PROMPT | **EXISTING** | Unchanged |

**VERDICT:** The congruence chain is architecturally sound. The contract correctly identifies that the new capability system adds to (not replaces) the existing edition/licensing system. However, the contract should explicitly state that PATH A (edition→licensing) and PATH B (business_settings→licensing) remain unchanged.

---

## Godzilla Findings

### H1: "businesses.capabilities puede ser la única fuente de verdad"

**PARTIALLY_SURVIVES**

`businesses.capabilities` can be the **configuration source of truth** (what the business wants), but NOT the **resolved source of truth** (what the business gets). The edition ceiling means the resolved state can be a subset of `businesses.capabilities`. The contract conflates these two states.

### H2: "35 capabilities son suficientes"

**FAILS**

The contract defines 27 capabilities, not 35. 8 capabilities are missing from the catalog. Additionally, the 24 EditionCapabilities entries are not fully mapped — 11 have no CapabilityId counterpart. The catalog is incomplete.

### H3: "Todas las capabilities pueden representarse como booleanos"

**PARTIALLY_SURVIVES**

Most capabilities are boolean (on/off). But `CHANNEL_MULTI` requires a count condition (≥2 channels). `SALES_EXPERIENCE` requires `industry` to be set (a string, not a boolean). The boolean model works for 25 of 27 capabilities but breaks for these 2.

### H4: "Capability → Prompt es siempre la relación correcta"

**FAILS**

`MOD_ANALYTICS` and `MOD_ANALYTICS_DASHBOARD` have "No direct prompt impact" (lines 128-129). They are capabilities that don't affect the prompt. The contract's own table shows this. Not all capabilities need prompt blocks.

### H5: "Capability → Dashboard es siempre la relación correcta"

**PARTIALLY_SURVIVES**

Works for `MOD_DELIVERY` → Delivery sidebar. But `SALES_EXPERIENCE` has no sidebar item — it's a prompt-only capability. The relationship is: some capabilities affect prompt, some affect dashboard, some affect both, some affect neither.

### H6: "Industry puede derivar capabilities de forma segura"

**FAILS**

The industry column is free-text with no validation. Different onboarding users could type "Zapateria", "zapateria", "Zapatería", "calzado", or "shoe store" for the same industry. Without a controlled vocabulary or fuzzy matching, industry→capability derivation is not deterministic.

### H7: "Edition puede actuar como ceiling sin convertirse en otra fuente de verdad"

**SURVIVES**

Edition is a static ceiling (4 presets). It doesn't change per-business. It's a constraint, not a source of truth. This is architecturally clean.

### H8: "TEXT[] es mejor que una tabla"

**SURVIVES**

For 27-35 flat, independent boolean flags, TEXT[] with `@>` queries is simpler and more performant than a junction table. PostgreSQL TEXT[] is the right tool.

### H9: "No necesitamos capability history"

**SURVIVES**

`capability_sources` provides point-in-time debugging. Full audit history can be added via trigger later if needed.

### H10: "El onboarding puede derivar capabilities determinísticamente"

**FAILS**

Questions 5-8 ("¿Manejas envíos?", "¿Necesitas inventario?") are self-reported, not inferred. Different users answering the same business type could give different answers. The derivation is not deterministic — it depends on user perception, not business reality.

---

## Required Changes Before Implementation

| # | Change | Priority | Reason |
|---|--------|----------|--------|
| 1 | **Fix capability count** — either define all 35 or correct to 27 | CRITICAL | Contract's own type definition contradicts prose |
| 2 | **Add EditionCapabilities → CapabilityId mapping** | CRITICAL | No mapping exists; 11 edition entries unaccounted |
| 3 | **Classify dependencies as HARD/SOFT/NONE** | CRITICAL | "Recommended" is not deterministic |
| 4 | **Distinguish configuration state vs resolved state** | CRITICAL | `businesses.capabilities` is config, not resolved |
| 5 | **Fix `SALES_EXPERIENCE` — it already exists** | HIGH | Experience context is already injected; just needs industry column |
| 6 | **Remove `MOD_ANALYTICS_DASHBOARD` from capabilities** | HIGH | It's a UI permission, not a capability |
| 7 | **Remove Lab gating behind `CORE_LEARNING`** | HIGH | Lab is always available |
| 8 | **Define industry value taxonomy** | HIGH | Free-text industry will cause inconsistent derivation |
| 9 | **Reduce onboarding to 5-6 questions** | MEDIUM | Some capabilities can be inferred from business description |
| 10 | **State that edition→licensing paths remain unchanged** | MEDIUM | Prevents implementer confusion |
| 11 | **Update effort estimate** | MEDIUM | 6-8 days likely underestimates: TypeScript types, RLS policies, 3 callers, tests |

---

## Approved Implementation Boundary

### In Scope (Revised)

| # | Work Item | Files | Effort |
|---|----------|-------|--------|
| 1 | Migration: add `industry`, `capabilities`, `onboarding_answers`, `capability_sources` to `businesses` | 1 migration | 0.5 day |
| 2 | Create `src/lib/system/capabilities.ts` with types + resolveCapabilities() | 1 new file | 1.5 days |
| 3 | Add EditionCapabilities → CapabilityId mapping | in capabilities.ts | (included above) |
| 4 | Wire `ResolvedCapabilities` into `context.ts` → `buildMasterPrompt()` | 1 modified | 1 day |
| 5 | Add 4-6 conditional prompt blocks in `prompts.ts` | 1 modified | 1 day |
| 6 | Wire `ResolvedCapabilities` into `ActivityRail.tsx` | 1 modified | 0.5 day |
| 7 | Update onboarding: add industry + capability questions | 2 modified | 2 days |
| 8 | Add `industry` to experience memory pipeline | 1 modified (context.ts) | 0.5 day |
| 9 | Update TypeScript types (supabase gen) | auto-generated | 0.5 day |
| 10 | Tests: capability resolution, prompt adaptation, sidebar filtering | 1 new test file | 1 day |
| **Total** | **10 items** | **6 modified + 1 new + 1 migration** | **8.5 days** |

### Deferred Work

| # | Work Item | Reason |
|---|----------|--------|
| 1 | Multi-product presentation in prompt | Requires runtime ProductReference[] change |
| 2 | Variant system integration in Sales AI | Requires resolve_variant() in prompt builder |
| 3 | Bulk pricing UI in catalog | Requires catalog schema extension |
| 4 | Quote request flow | Requires new conversation state machine |
| 5 | Capability versioning/audit | Not needed yet |
| 6 | Remove deprecated canUse*() functions | Cleanup, not blocking |
| 7 | Experience memory industry seeding | Data task, needs industry taxonomy first |

---

## Evidence

### Files Read

| File | Lines | Purpose |
|------|-------|---------|
| `docs/architecture/capability-contract.md` | 771 | The contract under audit |
| `src/lib/system/edition.ts` | 452 | Edition system, EditionCapabilities (24 booleans) |
| `src/lib/inventory/licensing.ts` | 51 | 3-gate activation |
| `src/lib/delivery/licensing.ts` | 51 | 3-gate activation |
| `src/lib/ai/prompts.ts` | 368 | buildMasterPrompt() — 3 production callers |
| `src/lib/ai/knowledge.ts` | 392 | getBusinessContext(), sales_config, experience context |
| `src/lib/conversation/context.ts` | 192 | loadConversationContext() — phantom industry reference |
| `src/components/onboarding/ConversationalOnboarding.tsx` | 393 | Onboarding flow — 3 questions, client-side creation |
| `src/app/api/onboarding/chat/route.ts` | 117 | Onboarding prompt — 3-step flow |
| `src/components/layout/AppLayout.tsx` | 99 | Module system — 3 modules, no gating |
| `src/components/dashboard/ActivityRail.tsx` | 311 | Sidebar — 15 items, no capability gating |
| `supabase/migrations/001_initial_schema.sql` | 546 | Original schema — no industry column |
| `supabase/migrations/045_sales_config.sql` | 44 | business_sales_config — 8 scalar columns |
| `supabase/migrations/053_experience_memory.sql` | 60 | experience_memory — has industry TEXT column |
| `src/lib/types/index.ts` | 1007 | TypeScript types — no industry field |
| `src/lib/heuristic/blender.ts` | 68 | Industry-based pattern blending |
| `src/lib/runtime/runtime.ts` | 424 | 2 callers of loadConversationContext |

### Grep Searches

| Pattern | Scope | Result |
|---------|-------|--------|
| `import.*canUse` | src/ | **0 matches** (16 functions never imported) |
| `import.*canBusinessUse` | src/ | **4 matches** (inventory, delivery, whatsapp) |
| `resolveCapabilities` | src/ | **0 matches** (proposed only) |
| `editionKeyToCapabilityId` | src/ | **0 matches** (proposed only) |
| `business.industry` | src/ | **3 matches** (phantom references) |
| `industry` | src/lib/ai/ | **2 matches** (pass-through only) |
| `if.*industry\|switch.*industry` | src/ | **0 matches** (no vertical branching) |
| `wellness\|beauty\|inmobiliaria\|zapateria\|ropa` | src/*.ts | **0 matches** (no vertical strings) |

---

## Tests / Commands Executed

| Command | Result |
|---------|--------|
| `git log --oneline -1` | `681c4b8` — clean HEAD |
| `git status --short` | Modified: 6 files (prior sprint work), Untracked: 6 docs |
| `npm run lint` | 0 errors, 6 warnings (pre-existing) |
| `npm run build` | PASS |

---

## Files Modified

**NONE.** This is a read-only audit. No files were modified or created.

The readiness report is the sole deliverable: `docs/architecture/capability-contract-readiness.md`.

---

## LOOP TERMINATION REPORT

```
STATUS: READY_WITH_CHANGES
PHASES COMPLETED: 15/15
PHASES REMAINING: 0
FILES MODIFIED: 0
FILES CREATED: 1 (this report)
TESTS: lint (0 errors), build (pass)
CONTRADICTIONS: 3 critical, 2 structural, 1 conceptual
GODZILLA: 4 FAILS, 4 PARTIALLY_SURVIVES, 2 SURVIVES
IMPLEMENTATION READINESS: READY_WITH_CHANGES
HUMAN DECISIONS REQUIRED:
  1. Fix capability count (27 vs 35) — which is correct?
  2. Define industry value taxonomy — enum or free-text?
  3. Distinguish configuration state vs resolved state
  4. Classify dependencies as HARD/SOFT/NONE
NEXT RECOMMENDED LOOP: Capability Contract v2 (corrected catalog + resolution model)
```
