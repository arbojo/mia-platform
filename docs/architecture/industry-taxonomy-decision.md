# Industry Taxonomy Decision

> **Type:** Architecture Decision — Documentation Only
> **Status:** Complete
> **Date:** 2026-08-26
> **Input:** Codebase audit (58 migrations, all src/ references, 5 ADRs, AGENTS.md)
> **Scope:** READ-ONLY decision loop. No code changes, no DB changes.

---

## Decision

**INDUSTRY_OPTIONAL**

Industry is a **convenience label** — not a source of truth, not a capability controller, not a required field. It may exist on `businesses` as optional metadata, but the system must function correctly without it.

---

## Why

The audit found that:

1. **No `industry` column exists** on `businesses` (verified across 58 migrations)
2. **2 phantom code references** read `businesses.industry` — both silently fall back to `'general'`
3. **Experience memory** has an `industry` TEXT column with 2 seeded values (`salud_suplementos`, `inmobiliaria`) — never loaded because the fallback is always `'general'`
4. **Zero behavior** in the system depends on industry — no `if industry ===`, no `switch industry`, no industry-specific code paths
5. **All 5 ADRs** are industry-agnostic — the platform is designed to be industry-agnostic
6. **ADR-026** explicitly documents that `businesses.industry` does not exist

Industry is a **useful concept** for onboarding UX and experience memory, but it is **not architecturally necessary**.

---

## Existing Evidence

### Where `industry` Exists Today

| Location | Table | Type | Values | Status |
|----------|-------|------|--------|--------|
| `experience_memory.industry` | `experience_memory` | `TEXT` (nullable) | `'salud_suplementos'`, `'inmobiliaria'` | **Exists** — column in migration 053 |
| `businesses.industry` | `businesses` | — | — | **Does NOT exist** — referenced in code but never created |

### Where `vertical` Exists Today

| Location | Table | Type | Values | Status |
|----------|-------|------|--------|--------|
| `inventory.business_settings.vertical` | `inventory.business_settings` | `TEXT` (enum constraint) | `'ecommerce'`, `'manufacturing'`, `'realestate'` | **Exists** — migration 040, inventory-only |

### Code References

| File | Line | Reference | Runtime Value | Behavior |
|------|------|-----------|--------------|----------|
| `src/lib/conversation/context.ts` | 95 | `fullAssistant.businesses?.industry ?? 'general'` | Always `'general'` | Passes to experience memory (loads global only) |
| `src/app/api/admin/experience/patterns/route.ts` | 26,34 | `business.industry \|\| 'general'` | Always `'general'` | Same — global patterns only |
| `src/lib/heuristic/blender.ts` | 20 | `.or('scope.eq.global,and(scope.eq.industry,industry.eq.${industry})')` | Queries with `'general'` | No industry patterns match |
| `src/lib/heuristic/suggester.ts` | 26-34 | `generateIndustrySuggestions(businessId, industry)` | — | **Dead code** — never imported |
| `src/lib/ai/prompts.ts` | 357 | `${experienceContext ? ... : ''}` | Always falsy | No experience section in prompt |

### ADR Constraints

| ADR | Relevant Finding |
|-----|-----------------|
| ADR-010 | Industry-agnostic — draws functional boundary (sales vs operations), not vertical boundary |
| ADR-025 | Industry-agnostic — "domain" refers to software domains (Sales, Inventory, Delivery), not business industries |
| ADR-026 | **Explicitly states** `businesses.industry` does not exist; substitute is `businesses.edition` |
| ADR-027 | Implies mass-market vs B2B segments for provisioning, but does not define industry taxonomy |

---

## Semantic Model

### The Six Concepts

| Concept | Definition | MIA Needs It? | Status |
|---------|-----------|--------------|--------|
| **INDUSTRY** | What a business sells (wellness, real estate, calzado) | **Optional** — useful for onboarding UX and experience memory | Not implemented |
| **VERTICAL** | How the business operates technically (ecommerce, manufacturing) | **Optional** — inventory-only, controls prediction algorithms | Implemented (inventory domain) |
| **BUSINESS MODEL** | How the business makes money (B2B, B2C, subscription) | **Not needed** — not used anywhere | Not implemented |
| **CAPABILITY** | What the system can do for the business (MOD_INVENTORY, SALES_EXPERIENCE) | **Required** — the core configuration concept | Designed (v2 contract) |
| **MODULE** | An independently deployable domain (Inventory, Delivery, Analytics) | **Required** — existing architectural boundary | Implemented |
| **FEATURE** | A UI or platform feature (weekly reports, knowledge studio) | **Implicit** — always-on, not configurable per business | Implemented |

### The Key Insight

**Industry and Vertical are inputs. Capability is the output.**

A business's industry/vertical can **suggest** capabilities, but capabilities remain independently configurable. The system never asks "what industry are you?" to determine behavior — it asks "what can you do?" (capabilities).

### Do We Need All Six?

**No.** MIA needs exactly three:

| Concept | Needed | Reason |
|---------|--------|--------|
| **Capability** | YES | Core configuration — determines prompt behavior and UI |
| **Module** | YES | Existing architectural boundary — domain isolation |
| **Industry** | OPTIONAL | Convenience label — onboarding UX + experience memory |
| **Vertical** | OPTIONAL | Inventory-only — prediction algorithm selection |
| **Business Model** | NO | Not used, not needed |
| **Feature** | NO | Always-on platform features, not configurable |

---

## Taxonomy Decision

### Options Evaluated

| Option | Description | Complexity | Extensibility | Migration Cost | Risk of Becoming Source of Truth |
|--------|------------|------------|--------------|---------------|-------------------------------|
| **A. Free-form text** | `industry TEXT` — any string | LOW | HIGH (anything goes) | LOW (1 column) | **MEDIUM** — inconsistent values could be mistaken for authoritative |
| **B. Controlled slug taxonomy** | `industry TEXT` with suggested values + free-form allowed | LOW | HIGH (suggested + custom) | LOW (1 column) | **LOW** — suggested values guide, don't constrain |
| **C. Enum** | `industry ENUM('wellness', 'real_estate', ...)` | LOW | LOW (new value = migration) | MEDIUM (enum change) | **LOW** — enum is clearly a label, not a source |
| **D. No industry field** | Infer everything from capabilities | NONE | N/A | NONE | **NONE** — no field, no risk |

### Recommendation: **Option B (Controlled Slug Taxonomy)**

**Why:**
- Suggested values ensure consistent experience memory patterns
- Free-form allows new verticals without migrations
- Low migration cost (1 column)
- Low risk of becoming source of truth (capabilities are the source)
- Matches existing `experience_memory.industry` pattern (free-form TEXT)

### Suggested Values

| Slug | Display Name | Experience Memory Patterns |
|------|-------------|--------------------------|
| `wellness_beauty` | Bienestar y Belleza | `salud_suplementos` (existing) |
| `inmobiliaria` | Inmobiliaria | `inmobiliaria` (existing) |
| `calzado` | Calzado | (to be seeded) |
| `ropa` | Ropa y Moda | (to be seeded) |
| `general` | General / Otro | (none — fallback) |

Users can type any custom value. The suggested values are UI convenience, not constraints.

---

## Capability Independence

### The Invariant

**INDUSTRY MUST NOT BE REQUIRED TO DETERMINE ACTIVE CAPABILITIES.**

### Test Results

| Test | Result |
|------|--------|
| Can capabilities be set without industry? | ✅ YES — `businesses.capabilities` is independent of `businesses.industry` |
| Can industry change without affecting capabilities? | ✅ YES — changing industry does not auto-modify capabilities |
| Can two businesses in the same industry have different capabilities? | ✅ YES — capabilities are per-business config |
| Does the resolution algorithm require industry? | ✅ NO — `resolveCapabilities()` uses industry only for defaults, not for active set |
| Can the system function with `industry = NULL`? | ✅ YES — falls back to `'general'`, no industry patterns loaded |

### What Industry May Do (Non-Exclusive)

| Consumer | How It Uses Industry | Override? |
|----------|---------------------|-----------|
| **Onboarding** | Suggest default capabilities based on industry | User can confirm/reject |
| **Experience memory** | Load industry-specific objection patterns | Adds to, doesn't replace |
| **Analytics** | Segment tenants by industry for reporting | Read-only classification |
| **Admin dashboard** | Filter/search businesses by industry | UI convenience |

### What Industry MUST NOT Do

| Forbidden Use | Reason |
|--------------|--------|
| Determine active capabilities | Capabilities are independently configurable |
| Override explicit capability config | Industry provides defaults, not mandates |
| Gate API access | Edition + business_settings gate access |
| Affect prompt behavior directly | Only through experience memory (indirect) |
| Replace edition as source of truth | Edition is the ceiling |
| Control module activation | business_settings.enabled controls activation |

---

## Vertical Tests

### Test 1: Wellness (Vitanova)

| Aspect | Representation |
|--------|---------------|
| Industry | `wellness_beauty` |
| Capabilities | `CORE_*`, `CHANNEL_WHATSAPP`, `CHANNEL_WEBCHAT`, `CHANNEL_LANDING`, `SALES_EXPERIENCE`, `SALES_FOLLOWUP` |
| No inventory | `MOD_INVENTORY` not in capabilities |
| No delivery | `MOD_DELIVERY` not in capabilities |
| Experience memory | Loads `salud_suplementos` patterns |

**Result:** ✅ No vertical-specific code needed.

### Test 2: Real Estate

| Aspect | Representation |
|--------|---------------|
| Industry | `inmobiliaria` |
| Capabilities | `CORE_*`, `CHANNEL_WHATSAPP`, `CHANNEL_LANDING`, `SALES_EXPERIENCE`, `SALES_QUOTE_REQUEST`, `SALES_FOLLOWUP`, `SALES_MULTI_PRODUCT`, `MOD_DELIVERY` |
| No inventory | `MOD_INVENTORY` not in capabilities |
| Quote flow | `SALES_QUOTE_REQUEST` enabled |
| Experience memory | Loads `inmobiliaria` patterns |

**Result:** ✅ No vertical-specific code needed.

### Test 3: Zapatería

| Aspect | Representation |
|--------|---------------|
| Industry | `calzado` |
| Capabilities | `CORE_*`, `CHANNEL_WHATSAPP`, `SALES_EXPERIENCE`, `SALES_SKU_VARIANTS`, `SALES_BULK_PRICING`, `SALES_MULTI_PRODUCT`, `MOD_INVENTORY`, `MOD_DELIVERY` |
| SKU variants | `SALES_SKU_VARIANTS` enabled |
| Bulk pricing | `SALES_BULK_PRICING` enabled |
| Inventory | `MOD_INVENTORY` enabled |

**Result:** ✅ No vertical-specific code needed.

### Test 4: Ropa

| Aspect | Representation |
|--------|---------------|
| Industry | `ropa` |
| Capabilities | `CORE_*`, `CHANNEL_WHATSAPP`, `SALES_EXPERIENCE`, `SALES_SKU_VARIANTS`, `SALES_MULTI_PRODUCT`, `MOD_INVENTORY` |
| SKU variants | `SALES_SKU_VARIANTS` enabled |
| No bulk pricing | `SALES_BULK_PRICING` not in capabilities |

**Result:** ✅ No vertical-specific code needed.

### Test 5: Service Business (Consultoría)

| Aspect | Representation |
|--------|---------------|
| Industry | `general` (or custom) |
| Capabilities | `CORE_*`, `CHANNEL_WEBCHAT`, `SALES_QUOTE_REQUEST`, `SALES_FOLLOWUP` |
| No products | `CORE_PRODUCT_PRESENTATION` still active (services can be presented) |
| No inventory | `MOD_INVENTORY` not in capabilities |
| Quote-based | `SALES_QUOTE_REQUEST` enabled |

**Result:** ✅ No vertical-specific code needed. Services are just a different capability combination.

### Test 6: B2B Business (Distribuidora)

| Aspect | Representation |
|--------|---------------|
| Industry | `general` (or custom) |
| Capabilities | `CORE_*`, `CHANNEL_WHATSAPP`, `SALES_BULK_PRICING`, `SALES_MULTI_PRODUCT`, `SALES_QUOTE_REQUEST`, `SALES_FOLLOWUP`, `MOD_INVENTORY` |
| Bulk pricing | `SALES_BULK_PRICING` enabled |
| Multi-product | `SALES_MULTI_PRODUCT` enabled |
| Quote-based | `SALES_QUOTE_REQUEST` enabled |

**Result:** ✅ No vertical-specific code needed. B2B is a capability combination.

### Test Summary

| Vertical | Industry Label | Unique Capabilities | Vertical-Specific Code? |
|----------|---------------|--------------------|-----------------------|
| Wellness | `wellness_beauty` | (none unique) | ❌ NO |
| Real Estate | `inmobiliaria` | `SALES_QUOTE_REQUEST` | ❌ NO |
| Zapatería | `calzado` | `SALES_SKU_VARIANTS`, `SALES_BULK_PRICING` | ❌ NO |
| Ropa | `ropa` | `SALES_SKU_VARIANTS` | ❌ NO |
| Service | `general` | `SALES_QUOTE_REQUEST` | ❌ NO |
| B2B | `general` | `SALES_BULK_PRICING`, `SALES_QUOTE_REQUEST` | ❌ NO |

**All 6 verticals pass.** Industry is a label, not a behavior controller.

---

## Godzilla Review

### H1: "industry is necessary"

**PARTIALLY_SURVIVES**

Industry is **useful** (onboarding UX, experience memory, analytics) but not **necessary** (the system functions without it). The experience memory system is the strongest argument for industry — it provides objection patterns specific to a business's field. But even this is optional (global patterns still load).

**Classification:** NICE-TO-HAVE, not REQUIRED.

### H2: "industry should control capabilities"

**FAILS**

This would make industry a second source of truth, competing with capabilities. The v2 contract explicitly forbids this: "Industry may provide defaults but must not silently override explicit capability configuration." If industry controls capabilities, then changing industry changes behavior — violating the capability independence invariant.

**Classification:** FORBIDDEN.

### H3: "industry can safely derive defaults"

**SURVIVES**

Industry-derived defaults are safe because:
1. They're applied during onboarding, not at resolution time
2. The user confirms/rejects them
3. They can be overridden by manual config
4. The resolution algorithm treats them as one input among many

**Classification:** SAFE.

### H4: "free-form industry is acceptable"

**FAILS**

Free-form text risks:
1. Inconsistent values (`"Zapateria"` vs `"zapateria"` vs `"Zapatería"` vs `"calzado"`)
2. Experience memory patterns won't match (query uses exact string match)
3. Analytics segmentation becomes unreliable

A controlled slug taxonomy (Option B) provides the benefits of free-form (extensibility) without the risks (inconsistency).

**Classification:** NEEDS IMPROVEMENT — use controlled slugs.

### H5: "taxonomy should be exhaustive"

**FAILS**

An exhaustive taxonomy (enum or closed list) would require a migration every time a new vertical appears. MIA is designed for multi-vertical growth — the taxonomy should be open-ended. Suggested values + free-form is the right balance.

**Classification:** TOO RESTRICTIVE.

### H6: "industry should affect prompt behavior directly"

**FAILS**

If industry directly affects the prompt (e.g., "if industry is wellness, use warm tone"), then industry becomes a behavior controller — competing with capabilities and sales config. Industry should only affect the prompt **indirectly** through experience memory patterns.

**Classification:** FORBIDDEN — only indirect effects allowed.

### H7: "industry and vertical are interchangeable"

**FAILS**

They are different concepts:
- `industry` = what the business sells (Sales domain concern)
- `vertical` = how the business operates technically (Inventory domain concern)

A wellness business could be ecommerce (sell online) or retail (sell in-store). A real estate business could be manufacturing (build homes) or brokerage (sell homes). These are orthogonal dimensions.

**Classification:** DISTINCT CONCEPTS.

### Godzilla Summary

| Hypothesis | Verdict |
|-----------|---------|
| H1: industry is necessary | PARTIALLY_SURVIVES — useful, not necessary |
| H2: industry should control capabilities | FAILS — forbidden |
| H3: industry can safely derive defaults | SURVIVES — safe |
| H4: free-form industry is acceptable | FAILS — needs controlled slugs |
| H5: taxonomy should be exhaustive | FAILS — too restrictive |
| H6: industry should affect prompt directly | FAILS — only indirect effects |
| H7: industry and vertical are interchangeable | FAILS — distinct concepts |

---

## Allowed Consumers

| Consumer | How It May Use Industry | Constraint |
|----------|------------------------|-----------|
| Onboarding | Suggest default capabilities | User confirms/rejects |
| Experience memory | Load industry-specific patterns | Adds to global, doesn't replace |
| Analytics dashboard | Segment tenants by industry | Read-only classification |
| Admin platform | Filter/search businesses | UI convenience |
| Capability resolution | Provide default capability sets | Defaults only, not mandates |

---

## Forbidden Consumers

| Consumer | Why Forbidden |
|----------|--------------|
| Capability resolution (as required input) | Capabilities must work without industry |
| Prompt builder (as direct input) | Only indirect effect via experience memory |
| API gating | Edition + business_settings gate access |
| Module activation | business_settings.enabled controls activation |
| Edition system | Edition is the ceiling, industry is orthogonal |
| Sales config | business_sales_config controls prompt behavior |

---

## Implementation Implications

### If Industry Is Added (Recommended)

| Work Item | Effort | Priority |
|----------|--------|----------|
| Add `industry TEXT` column to `businesses` | 0.5 day | MEDIUM |
| Fix 2 phantom references (`context.ts:95`, `patterns/route.ts:26`) | 0.5 day | HIGH |
| Seed experience memory patterns for `calzado`, `ropa` | 0.5 day | LOW |
| Add industry dropdown to onboarding quiz | 1 day | MEDIUM |
| Add industry to admin platform dashboard | 0.5 day | LOW |

**Total:** ~3 days (additive to capability contract implementation)

### If Industry Is NOT Added

| Consequence | Impact |
|-------------|--------|
| Experience memory | Only global patterns load (no industry-specific) |
| Onboarding | No industry-based capability suggestions |
| Analytics | No industry segmentation |
| Phantom references | Continue to silently fall back to `'general'` |

**Total:** Zero implementation cost, but loses convenience features.

---

## Human Decision Required

1. **Should `businesses.industry` be added?** (Recommended: YES, as optional TEXT column)
2. **Should the onboarding quiz include an industry question?** (Recommended: YES, as a dropdown with free-form option)
3. **Should experience memory patterns be seeded for `calzado` and `ropa`?** (Recommended: YES, low effort)
4. **Should the admin dashboard show industry?** (Recommended: YES, for tenant segmentation)

---

## Terminal State

`MISSION_COMPLETE`

No conflicts found. No ADR violations. No ambiguity remaining.

The industry concept is cleanly separated from capabilities:
- **Capabilities** = what the system does (source of truth)
- **Industry** = what the business is (convenience label)

Industry is optional, non-authoritative, and safe to add.
