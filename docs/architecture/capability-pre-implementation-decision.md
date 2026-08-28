# Capability Architecture Pre-Implementation Decision Gate

**Status**: `READY_FOR_IMPLEMENTATION` (pending 5 human decisions)  
**Date**: 2026-08-26  
**Loop**: Capability Architecture Pre-Implementation Decision Gate  
**Authoritative Inputs**: All prior loops (Capability Contract v2, Industry Taxonomy, Capability Behavior Contract, Integration Loop, Congruence Merge, Architecture Forensic, Onboarding Discovery) + implementation files

---

## Executive Summary

This decision gate loop validates that all architectural decisions required for capability-aware onboarding and configuration discovery are sufficiently determined before implementation begins. The analysis confirms:

- **28 canonical capabilities** in 5 tiers — defined, named, and mapped to behaviors
- **Edition remains the hard ceiling** — enforced at resolution step 7
- **Industry is optional metadata** — `INDUSTRY_OPTIONAL` decision upheld; provides defaults, never mandates
- **4 database columns exist** (migration 055) — `industry`, `capabilities`, `onboarding_answers`, `capability_sources`
- **Single canonical resolver exists** — `resolveCapabilities()` in `src/lib/system/capabilities.ts` with 51 passing tests
- **8-question adaptive quiz designed** — derives 20+ capabilities via industry defaults + language inference + dependency resolution
- **No database migrations needed** — all infrastructure exists
- **5 human decisions required** before implementation can proceed

---

## Phase 2 — Canonical Decisions (Closed)

| Decision | Current Decision | Source | Confidence | Human Required? |
|----------|------------------|--------|------------|-----------------|
| Capability Count | 28 named capabilities (8 Core + 5 Channel + 10 Sales + 3 Module + 2 Meta) | Capability Contract v2 (§3.1) | HIGH | No |
| Capability Tiers | 5 tiers: Core (always on), Channels, Sales Intelligence, Operational Modules, Meta | Capability Contract v2 (§3.1) | HIGH | No |
| Edition Ceiling | Edition is hard ceiling — enforced at resolution step 7; config preserved but not resolved | Capability Contract v2 (§4.3, §6.2) | HIGH | No |
| Industry Role | `INDUSTRY_OPTIONAL` — convenience label only; provides defaults, never mandates | Industry Taxonomy Decision | HIGH | No |
| Industry Taxonomy | Controlled slugs with free-form: `wellness_beauty`, `inmobiliaria`, `calzado`, `ropa`, `general` | Industry Taxonomy Decision (§Taxonomy) | HIGH | No |
| Capability Storage | 4 columns on `businesses`: `industry` (TEXT), `capabilities` (TEXT[]), `onboarding_answers` (JSONB), `capability_sources` (JSONB) | Migration 055, Capability Contract v2 (§5.2) | HIGH | No |
| Configuration vs Resolved State | `businesses.capabilities` = config source of truth; `ResolvedCapabilities` = runtime authority (ephemeral) | Capability Contract v2 (§4.3) | HIGH | No |
| Capability Resolution | Single canonical resolver: `resolveCapabilities()` in `src/lib/system/capabilities.ts` | Capability Contract v2 (§6.2) | HIGH | No |
| Resolution Order | Core → Industry defaults → Explicit config (WINS) → Dependencies → Conflicts → Edition ceiling (HARD) | Capability Contract v2 (§6.2) | HIGH | No |
| Onboarding Derivation | 8-question quiz → Business Profile → `deriveCapabilities()` → Capability Intent → persist | Onboarding Discovery (§Phase 5, 8) | HIGH | No |
| Dashboard Projection | Dashboard reads ONLY resolved capabilities; UNKNOWN = inactive = hidden; CTA for edition-blocked | Onboarding Discovery (§Phase 9) | HIGH | No |
| Prompt Projection | `buildMasterPrompt({ capabilities: ResolvedCapabilities })` — conditional sections per capability | Capability Contract v2 (§7.2) | HIGH | No |
| Catalog Boundary | Products = structured data; Knowledge = free-form; AI Instructions = behavioral rules — distinct | Capability Contract v2 (§3.2), ADR-010 | HIGH | No |
| Knowledge Boundary | Authority tiers: IMMUTABLE > MANUAL > ACTIVE_RULE > REVIEWED_KNOWLEDGE > DOCUMENT_KNOWLEDGE > AUTO_INSTRUCTION > MEMORY_PATTERN | `src/lib/ai/knowledge.ts` | HIGH | No |
| Module Activation | 3-gate preserved: Edition → `business_settings.enabled` → SQL trigger | Capability Contract v2 (§4.5) | HIGH | No |
| Sales Config Boundary | `business_sales_config` = operational config (how), not capability activation (whether) | Onboarding Discovery (§Phase 3) | HIGH | No |
| UNKNOWN ≠ DISABLED | Three-state model: UNKNOWN/ENABLED/DISABLED; UNKNOWN never forced to DISABLED | Onboarding Discovery (§Phase 6) | HIGH | No |
| Experience Memory | Requires `businesses.industry` column; currently broken (column missing) | Capability Contract v2 (§7.1) | HIGH | No |
| Variant System | Exists in Inventory, ignored by Sales AI — needs `SALES_SKU_VARIANTS` prompt bridge | Capability Architecture Forensic | HIGH | No |
| No Vertical-Specific Code | All 6 verticals expressed as capability combinations | Capability Contract v2 (§10) | HIGH | No |
| Existing Gating Preserved | Edition→licensing and business_settings→licensing NOT replaced; capability contract is additive | Capability Contract v2 (§4.5) | HIGH | No |
| Capability Sources | Debug attribution: `'default' \| 'edition' \| 'config' \| 'onboarding' \| 'dependency'` | Capability Contract v2 (§4.3) | HIGH | No |

---

## Phase 3 — Sales Intelligence Prompt Priority

| Capability | Current Runtime | Current Prompt | User Value | Risk | Priority |
|------------|----------------|----------------|------------|------|----------|
| `SALES_EXPERIENCE` | Patterns exist, `experienceContext` injected at `prompts.ts:357` | **ALREADY EXISTS** | High | Low | **MUST_HAVE_NOW** |
| `SALES_COMMERCIAL_INTELLIGENCE` | Edition gate only | None | Medium | Medium | **SHOULD_HAVE** |
| `SALES_EXPECTATION_INTELLIGENCE` | Edition gate only | None | Medium | Medium | **SHOULD_HAVE** |
| `SALES_RESPONSIBLE_SELLING` | Edition gate only | None | High | Low | **MUST_HAVE_NOW** |
| `SALES_MULTI_PRODUCT` | Singular `ProductReference` only | None | High | **HIGH** | **REQUIRES_RUNTIME_FIRST** |
| `SALES_SKU_VARIANTS` | Inventory has variants, Sales AI ignores | None | High | **HIGH** | **REQUIRES_RUNTIME_FIRST** |
| `SALES_BULK_PRICING` | No schema/runtime/prompt | None | High | Medium | **SHOULD_HAVE** |
| `SALES_QUOTE_REQUEST` | No schema/runtime/prompt | None | High | Medium | **REQUIRES_RUNTIME_FIRST** |
| `SALES_FOLLOWUP` | `follow_up_hours` config exists | None | High | Low | **MUST_HAVE_NOW** |
| `SALES_RECOVERY` | No runtime/prompt | None | High | Low | **MUST_HAVE_NOW** |

---

## Phase 4 — Sales Capability Prompt Contract (MUST_HAVE_NOW)

### SALES_EXPERIENCE
- **Trigger**: `ResolvedCapabilities.active.has('SALES_EXPERIENCE')` AND `experienceContext` non-empty
- **Available Data**: Blended objection patterns from `experience_memory` (industry + business-specific)
- **Allowed**: Reference past successful responses; adapt wording; maintain essence
- **Forbidden**: Invent new responses; quote probabilities; present as guaranteed
- **Prompt Instruction**: (Already at `prompts.ts:357-359`) — "Usa estas respuestas probadas como guía..."

### SALES_RESPONSIBLE_SELLING
- **Trigger**: `ResolvedCapabilities.active.has('SALES_RESPONSIBLE_SELLING')`
- **Allowed**: Disclose limitations proactively; respect cancellation windows; avoid pressure; escalate on distress
- **Forbidden**: Hide limitations; create false urgency; pressure after explicit decline
- **Prompt Instruction**: "Vendes responsablemente: informa limitaciones antes de que el cliente las descubra, respeta su derecho a cancelar, nunca presiones tras un 'no' explícito, escala a humano si detectas incomodidad."

### SALES_FOLLOWUP
- **Trigger**: Capability active + `business_sales_config.follow_up_hours` configured
- **Allowed**: Schedule follow-up at configured hours; reference previous context; offer value
- **Forbidden**: Follow up before window; spam; follow up after opt-out
- **Prompt Instruction**: "Si la conversación termina sin cierre y follow_up_hours > 0, agenda un seguimiento a las {follow_up_hours} horas. En el seguimiento, referencia lo conversado y ofrece valor nuevo."

### SALES_RECOVERY
- **Trigger**: Capability active + customer status = 'lost' OR `last_interaction` > 30 days
- **Allowed**: Re-engage with personalized value; acknowledge previous hesitation; offer alternative
- **Forbidden**: Pretend previous conversation didn't happen; push same rejected offer; contact opted-out
- **Prompt Instruction**: "Si un cliente perdido reaparece o detectas inactividad > 30 días, re-engage reconociendo su objeción previa y ofreciendo alternativa concreta. Nunca repitas la oferta que rechazó."

---

## Phase 5 — Industry Taxonomy Decision

**Current**: `INDUSTRY_OPTIONAL` — 5 slugs + free-form fallback

### Recommended Additions

| Proposed | Capability Defaults | Evidence | Decision |
|----------|---------------------|----------|----------|
| `servicios` | `SALES_QUOTE_REQUEST`, `SALES_FOLLOWUP` | Services need quotes + follow-up; distinct from products | **ADD** |
| `b2b` | `SALES_BULK_PRICING`, `SALES_QUOTE_REQUEST`, `SALES_MULTI_PRODUCT` | Cross-vertical B2B pattern: bulk + quotes + multi-product | **ADD** |
| `alimentacion` | `MOD_INVENTORY`, `MOD_DELIVERY`, `SALES_SKU_VARIANTS` | Overlaps with `calzado`/`ropa` | **DEFER** |

---

## Phase 6 — Industry vs Capability Adversarial Check

| Hypothesis | Verdict |
|------------|---------|
| H1: Industry becoming capability | **FAILS** — Config > Industry > Ceiling |
| H2: Industry forces unwanted capabilities | **FAILS** — Explicit confirmation required |
| H3: New industry requires new code | **FAILS** — Data-driven, same derivation |
| H4: Industry taxonomy = source of truth | **FAILS** — Not read by resolver as required |
| H5: Unknown industries break onboarding | **FAILS** — Free-form + explicit quiz answers |

---

## Phase 7 — Quiz i18n Strategy

- Questions live in `src/lib/onboarding/quiz.ts` with `translations: Record<Locale, string>`
- Options have invariant `value` + translated labels
- Derivation uses canonical values ONLY — language never affects capability IDs
- Extraction schema uses fixed keys (`industry`, `sales_mode`, `modules[]`, etc.)
- LLM prompted in user's locale, returns structured JSON with invariant keys

---

## Phase 8 — Confirmation UX Decision

**Selected: Option B — Progressive Confirmation**

Only high-impact decisions confirmed inline:
- Q2 (Industry): "Based on 'calzado', MIA enables: SKU variants, bulk pricing, inventory. ¿Correcto?"
- Q3 (Sales Mode): "MIA will actively sell. ¿Correcto?"
- Q6 (Modules): "MIA will manage inventory/deliveries. ¿Confirmas?"
- Q7 (Channels): "MIA will connect to WhatsApp, Web, Landing. ¿Correcto?"

Low-impact (Q1, Q5, Q8): no confirmation.

---

## Phase 9 — Abandoned Quiz Resume

### State Model (`businesses.onboarding_status`)

| State | Persisted Data | Resume From |
|-------|----------------|-------------|
| `created` | — | Q1 |
| `identity_completed` | `{ q1 }` | Q2 |
| `industry_completed` | `{ q1, q2 }` | Q3 |
| `sales_completed` | `{ q1-q4 }` | Q5 |
| `products_completed` | `{ q1-q5 }` | Q6 |
| `modules_completed` | `{ q1-q6 }` | Q7 |
| `channels_completed` | `{ q1-q7 }` | Q8 |
| `ready` | Full + capabilities derived | Complete |

### Rules
- `onboarding_answers` = immutable append-only log
- Derivation runs ONLY at `ready` transition
- Re-onboarding = new log entry; config wins per resolution order
- Capability derivation is idempotent

---

## Phase 10 — Capability State Semantics

```typescript
type CapabilityState = 'UNKNOWN' | 'ENABLED' | 'DISABLED'

UNKNOWN  = "Not explicitly configured, not inferred, not defaulted"
ENABLED  = "Explicit config, confirmed inference, or core default"
DISABLED = "Explicitly removed, blocked by edition, or conflict-resolved"
```

| State | `businesses.capabilities` | `ResolvedCapabilities` | Dashboard | Prompt |
|-------|---------------------------|------------------------|-----------|--------|
| Core | N/A (implicit) | Always | Visible | Active |
| UNKNOWN | Absent | Absent | Hidden + CTA | No behavior |
| ENABLED | Present | Present | Visible | Active |
| DISABLED (edition) | Present | Absent | Lock + paywall | No behavior |

**Invariant**: Config persists through edition changes. Downgrade hides from resolved; upgrade restores.

---

## Phase 11 — Resolution Order (Frozen)

```text
1. CORE (always, source='default')
2. EDITION DEFAULTS (ceiling, source='edition')
3. INDUSTRY DEFAULTS (onboarding, source='onboarding')
4. EXPLICIT CONFIG (businesses.capabilities, source='config') ← WINS
5. DEPENDENCIES (HARD blocks, SOFT adds+warns)
6. CONFLICTS (CHANNEL_MULTI≥2, BULK→MULTI_PRODUCT, QUOTE→FOLLOWUP)
7. EDITION CEILING (remove caps not in edition) ← HARD
8. RESOLVED CAPABILITIES (runtime authority)
```

### Dependencies (Final)

| Capability | Depends On | Type | Missing Action |
|------------|------------|------|----------------|
| `CHANNEL_MULTI` | ≥2 `CHANNEL_*` | HARD | BLOCK |
| `SALES_EXPERIENCE` | `businesses.industry` set | HARD | BLOCK |
| `SALES_FOLLOWUP` | `CORE_CUSTOMER_MEMORY` | SOFT | WARN + add |
| `SALES_RECOVERY` | `CORE_CUSTOMER_MEMORY` + `SALES_FOLLOWUP` | SOFT | WARN + add |
| `MOD_DELIVERY` | (none) | NONE | — |
| `MOD_ANALYTICS` | Any `MOD_*` | SOFT | WARN |
| `SALES_BULK_PRICING` | `SALES_MULTI_PRODUCT` | SOFT | WARN + add |
| `SALES_QUOTE_REQUEST` | `SALES_FOLLOWUP` | SOFT | WARN + add |

---

## Phase 12 — Implementation Sequencing

### Recommended Loop Sequence

| Loop | Name | Prerequisite | Deliverable |
|------|------|--------------|-------------|
| **1** | **Onboarding Foundation** | DB columns (055), `resolveCapabilities()` | 8-question quiz working; capabilities persisted; config seeded |
| **2** | **Prompt Bridge — Phase A (MUST_HAVE_NOW)** | Loop 1 (industry populated) | 4 sales intelligence prompt sections; `SALES_EXPERIENCE` functional |
| **3** | **Dashboard Congruence** | Loop 1 (resolved capabilities) | All surfaces capability-gated; edition paywall visible |
| **4** | **Prompt Bridge — Phase B (SHOULD_HAVE)** | Loop 2 | 3 additional prompt sections; bulk pricing behavior |
| **5** | **Runtime First — Multi-Product & Variants** | Loop 2 | `ProductReference[]` output; variant-aware prompts |
| **6** | **Runtime First — Quote & Recovery Flows** | Loop 2 | Conversation state machine for quotes/recovery |
| **7** | **Integration Validation** | Loops 1-6 | 6 vertical E2E passing; Godzilla review clean |

**Parallel**: Loops 2-3 after Loop 1. Loops 4-6 after Loop 2. Loop 7 after all.

---

## Phase 13 — Cross-System Congruence Gate

### Authority Matrix

| Question | Answer |
|----------|--------|
| Who is the authority? | `businesses.capabilities` (config) + `EditionCapabilities` (ceiling) |
| Who derives? | `resolveCapabilities()` — single, deterministic, idempotent |
| Who projects to prompt? | `buildMasterPrompt({ capabilities: ResolvedCapabilities })` |
| Who projects to dashboard? | All surfaces reading `ResolvedCapabilities` |
| Who executes at runtime? | `loadConversationContext()` → prompt; `canBusinessUse*()` → API; SQL triggers → module ops |
| Who can modify? | Admin (Settings UI) → `businesses.capabilities`; Edition change → ceiling; Onboarding (once) → initial config |

---

## Phase 14 — Godzilla Pre-Implementation Review

| Hypothesis | Verdict |
|------------|---------|
| H1: Framework too complex | **SURVIVES** — 28 caps, 5 tiers, 1 resolver, 4 columns |
| H2: Onboarding becomes giant wizard | **SURVIVES** — 8 questions, heavy derivation |
| H3: Config duplication | **PARTIALLY_SURVIVES** — `enabled` seeds capability; then capability = source |
| H4: Industry = vertical architecture | **FAILS** — 6 verticals, same code, no `if industry` |
| H5: Prompt wiring masks missing runtime | **PARTIALLY_SURVIVES** — 3 caps explicitly `REQUIRES_RUNTIME_FIRST` |
| H6: Dashboard = second auth system | **FAILS** — UX only; server gates preserved |
| H7: Edition ceiling bypassed | **FAILS** — Ceiling step 7 runs after config step 3 |
| H8: UNKNOWN → DISABLED | **FAILS** — Three-state model; resolver never writes DISABLED |
| H9: Non-deterministic resolution | **FAILS** — Pure function, 51 tests verify |
| H10: Vitanova regresses | **SURVIVES** — Regression tests required in Loop 7 |

---

## Phase 15 — Implementation Readiness Gate

| Area | READY | BLOCKED | HUMAN DECISION |
|------|-------|---------|----------------|
| Capability model | ✅ | | |
| Industry taxonomy | ✅ | | Add `servicios`, `b2b`? |
| Onboarding quiz design | ✅ | | |
| Prompt wiring — MUST_HAVE_NOW | ✅ | | |
| Prompt wiring — SHOULD_HAVE | | | Runtime-first for 3 caps |
| Dashboard congruence | ✅ | | Audit all surfaces |
| Runtime / API gating | ✅ | | 3-gate preserved |
| i18n strategy | ✅ | | |
| UX — Confirmation | ✅ | | Option B confirmed |
| UX — Abandoned resume | ✅ | | State model defined |
| Capability state semantics | ✅ | | UNKNOWN≠DISABLED |
| Resolution order | ✅ | | Frozen |

---

## Phase 16 — Human Decision Gate

### 5 Decisions Required

| # | Decision | Options | Recommendation | Consequence |
|---|----------|---------|----------------|-------------|
| 1 | Add `servicios`, `b2b` to industry suggested values? | A) Both / B) Only `servicios` / C) Keep 5 | **A** | Better defaults for services/B2B |
| 2 | Seed experience memory for `calzado`, `ropa`? | A) Yes / B) Defer | **A** | Real patterns from day 1 |
| 3 | Confirmation UX: Progressive (Option B)? | A) Progressive / B) Summary / C) Silent | **A** | Balance trust + completion |
| 4 | Quiz resume: restore exact step? | A) Restore / B) Restart | **A** | Respects user time |
| 5 | `SALES_MULTI_PRODUCT` prompt before runtime output model? | A) Wire prompt now / B) Block until runtime | **A** | Partial value now, full later |

**If any undecided**: `STOP_FOR_HUMAN`  
**If all decided**: `READY_FOR_IMPLEMENTATION`

---

## Phase 17 — Final Contract

### Preservation Invariants

> ✅ **Industry is descriptive/defaulting metadata, not capability authority**  
> ✅ **Edition is the ceiling**  
> ✅ **Capabilities represent what the business has enabled**  
> ✅ **Operational configuration represents how an enabled capability behaves**  
> ✅ **UNKNOWN never becomes DISABLED**  
> ✅ **Dashboard visibility ≠ authorization**  
> ✅ **No vertical-specific code paths**  
> ✅ **Existing gating mechanisms preserved**  
> ✅ **Single canonical resolver: `resolveCapabilities()`**  
> ✅ **Configuration persists; resolved is ephemeral**

### Next Loop: Onboarding Foundation

**Prerequisites**: 5 human decisions resolved  
**Governance**: CTO + Architect + Domain Expert + AI Engineer approval  
**Scope**: Quiz definition, derivation logic, API rewrite, UI rewrite, operational config seeding  
**Deliverable**: Working onboarding that populates all 4 `businesses` columns + seeds module settings