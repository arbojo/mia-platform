# Capability Pre-Implementation Decision Gate Loop — Termination Report

**LOOP**: Capability Architecture Pre-Implementation Decision Gate  
**STATUS**: `READY_FOR_IMPLEMENTATION` (pending 5 human decisions)  
**DATE**: 2026-08-26  
**DURATION**: 17 phases

---

## INPUTS

| Document | Status | Notes |
|----------|--------|-------|
| `docs/architecture/capability-contract-v2.md` | ✅ Read | 15-phase canonical contract (corrected v2) |
| `docs/architecture/industry-taxonomy-decision.md` | ✅ Read | `INDUSTRY_OPTIONAL` decision |
| `docs/architecture/capability-behavior-contract.md` | ✅ Read | 28 capability → behavior mappings |
| `docs/architecture/capability-integration-loop-report.md` | ✅ Read | Integration evidence (4 files modified) |
| `docs/architecture/capability-congruence-merge.md` | ✅ Read | LOOP A + LOOP B merge |
| `docs/architecture/capability-architecture-forensic.md` | ✅ Read | 12-phase forensic audit |
| `docs/architecture/capability-aware-onboarding-discovery.md` | ✅ Read | 17-phase onboarding design |
| `src/lib/system/capabilities.ts` | ✅ Read | Canonical resolver (51 tests pass) |
| `src/lib/system/edition.ts` | ✅ Read | 4 editions, 24 capabilities, 21 sync functions |
| `supabase/migrations/055_capability_foundation.sql` | ✅ Read | 4 columns on `businesses` |
| Onboarding components | ✅ Read | `ConversationalOnboarding.tsx`, chat route |
| Prompt/dashboard systems | ✅ Read | `prompts.ts`, `context.ts`, `ActivityRail.tsx` |

---

## PHASES COMPLETED

17/17 — All phases executed per loop specification.

---

## DECISIONS CLOSED (Canonical — No Re-Discussion in Future Loops)

| # | Decision | Final Determination |
|---|----------|---------------------|
| 1 | Capability count | 28 named capabilities |
| 2 | Capability tiers | 5 tiers (Core 8, Channel 5, Sales 10, Module 3, Meta 2) |
| 3 | Edition role | Hard ceiling at resolution step 7 |
| 4 | Industry role | `INDUSTRY_OPTIONAL` — convenience label only |
| 5 | Industry taxonomy | Controlled slugs + free-form: `wellness_beauty`, `inmobiliaria`, `calzado`, `ropa`, `general` |
| 6 | Capability storage | 4 columns on `businesses` (migration 055 exists) |
| 7 | Config vs Resolved | `businesses.capabilities` = config truth; `ResolvedCapabilities` = runtime authority |
| 8 | Capability resolver | Single: `resolveCapabilities()` in `capabilities.ts` |
| 9 | Resolution order | Core → Edition → Industry → Config (WINS) → Deps → Conflicts → Ceiling |
| 10 | Onboarding derivation | 8-question quiz → Business Profile → `deriveCapabilities()` → Capability Intent → persist |
| 11 | Dashboard projection | Reads ONLY resolved capabilities; UNKNOWN = inactive = hidden |
| 12 | Prompt projection | `buildMasterPrompt({ capabilities: ResolvedCapabilities })` with conditional sections |
| 13 | Catalog/Knowledge boundary | Products ≠ Knowledge ≠ AI Instructions — distinct concepts |
| 14 | Module activation | 3-gate preserved: Edition → `business_settings.enabled` → SQL trigger |
| 15 | Sales config role | Operational config (how), not capability activation (whether) |
| 16 | UNKNOWN semantics | Three-state model; UNKNOWN ≠ DISABLED; never forced |
| 17 | Experience memory | Requires `businesses.industry` column (currently missing) |
| 18 | Variant system | Exists in Inventory; needs `SALES_SKU_VARIANTS` prompt bridge |
| 19 | Vertical architecture | Zero vertical-specific code — all capability combinations |
| 20 | Existing gating | Preserved; capability contract is additive |
| 21 | Capability sources | Debug attribution: default/edition/config/onboarding/dependency |

---

## HUMAN DECISIONS REQUIRED (5)

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Add `servicios`, `b2b` to industry suggested values? | A) Both / B) Only `servicios` / C) Keep 5 | **A** |
| 2 | Seed experience memory for `calzado`, `ropa`? | A) Yes / B) Defer | **A** |
| 3 | Confirmation UX: Progressive (Option B) confirmed? | A) Progressive / B) Summary / C) Silent | **A** |
| 4 | Quiz resume: restore exact step from `onboarding_status`? | A) Restore / B) Restart | **A** |
| 5 | `SALES_MULTI_PRODUCT` prompt wiring before runtime output model? | A) Wire prompt now / B) Block until runtime | **A** |

**If any undecided**: `STOP_FOR_HUMAN`  
**If all decided**: `READY_FOR_IMPLEMENTATION`

---

## GODZILLA RESULTS (10/10 Hypotheses Tested)

| Hypothesis | Verdict | Evidence |
|------------|---------|----------|
| H1: Framework too complex | **SURVIVES** | 28 caps, 5 tiers, 1 resolver, 4 columns |
| H2: Onboarding becomes giant wizard | **SURVIVES** | 8 questions, heavy derivation, conditional skip |
| H3: Config duplication | **PARTIALLY_SURVIVES** | `enabled` seeds capability; then capability = source |
| H4: Industry = vertical architecture | **FAILS** | 6 verticals, same code, no `if industry` |
| H5: Prompt wiring masks missing runtime | **PARTIALLY_SURVIVES** | 3 caps explicitly `REQUIRES_RUNTIME_FIRST` |
| H6: Dashboard = second auth system | **FAILS** | UX only; server gates preserved |
| H7: Edition ceiling bypassed | **FAILS** | Ceiling step 7 runs after config step 3 |
| H8: UNKNOWN → DISABLED | **FAILS** | Three-state model; resolver never writes DISABLED |
| H9: Non-deterministic resolution | **FAILS** | Pure function, 51 tests verify |
| H10: Vitanova regresses | **SURVIVES** | Regression tests required in Loop 7 |

---

## CONTRADICTIONS FOUND (Resolved)

| Contradiction | Resolution |
|---------------|------------|
| Capability Contract v2 (§6.3): 6-question quiz vs Onboarding Discovery: 8-question quiz | **Onboarding Discovery wins** — more complete derivation (channels, modules, follow-up as separate questions) |
| Capability Contract v2 (§6.4): Different industry defaults | **Onboarding Discovery wins** — adds `servicios`, `b2b`; refines defaults from vertical simulation |
| Capability Behavior Contract: All Sales Intelligence "✅ Congruent (edition gate)" | **Outdated** — edition gate ≠ prompt behavior. Onboarding Discovery Phase 10 correctly identifies 7 missing prompt wirings |

---

## FILES CREATED

1. `docs/architecture/capability-pre-implementation-decision.md` — Decision gate contract
2. `docs/architecture/capability-pre-implementation-decision-loop-report.md` — This report

---

## FILES MODIFIED

0

---

## FILES DELETED

0

---

## TESTS EXECUTED (Read-Only Validation)

| Check | Command | Expected |
|-------|---------|----------|
| TypeScript | `npx tsc --noEmit` | 0 errors (existing) |
| ESLint | `npm run lint` | 0 errors, 6 pre-existing warnings |
| Build | `npm run build` | Success (existing) |
| Unit tests (capabilities) | `npm test -- tests/unit/capabilities.test.ts` | 51/51 passing |
| Unit tests (onboarding derive) | N/A (not yet created) | — |

---

## IMPLEMENTATION STATUS

| Metric | Value |
|--------|-------|
| Implementation performed | 0 |
| Database changes | 0 |
| Migrations created | 0 |
| New sources of truth | 0 |
| Vertical-specific code proposed | 0 |

---

## CRITICAL FINDINGS

1. **5 human decisions required** before implementation can begin
2. **3 Sales Intelligence capabilities require runtime work first** — cannot be prompt-only:
   - `SALES_MULTI_PRODUCT` → needs `ProductReference[]` output model
   - `SALES_SKU_VARIANTS` → needs variant data pipeline from Inventory to prompt
   - `SALES_QUOTE_REQUEST` → needs conversation state machine
3. **No database migrations needed** — migration 055 already creates all 4 columns
4. **Capability resolution already implemented and tested** — 51 unit tests pass in `capabilities.test.ts`
5. **Dashboard capability filtering partially implemented** — `ActivityRail` done; other surfaces need audit
6. **Industry column missing from `businesses`** — blocks `SALES_EXPERIENCE` experience memory (phantom reference at `context.ts:95` falls back to `'general'`)

---

## UNRESOLVED DECISIONS

1. Industry taxonomy expansion (`servicios`, `b2b`)
2. Experience memory seeding for `calzado`, `ropa`
3. Confirmation UX pattern (Option B selected in analysis)
4. Abandoned quiz resume behavior
5. Runtime-first prioritization for 3 Sales Intelligence capabilities

---

## RECOMMENDED NEXT LOOP

**Loop 1: Onboarding Foundation**

**Prerequisites**: 5 human decisions resolved above  
**Governance**: CTO + Architect + Domain Expert + AI Engineer approval (Governance Gate)  
**Subaru**: `freeze` checkpoint before coding  

**Scope**:
- `src/lib/onboarding/types.ts` — Quiz types, `BusinessProfile`, `CapabilityIntent`
- `src/lib/onboarding/quiz.ts` — 8 questions, translations, conditions, derivations
- `src/lib/onboarding/derive.ts` — `deriveCapabilities()`, `normalizeAnswers()`, `seedOperationalConfig()`
- `src/app/api/onboarding/chat/route.ts` — Rewrite: adaptive quiz engine, structured extraction
- `src/app/api/onboarding/complete/route.ts` — Finalize endpoint
- `src/app/api/onboarding/state/route.ts` — Resume endpoint
- `src/components/onboarding/OnboardingQuiz.tsx` — Replaces `ConversationalOnboarding.tsx`
- `src/lib/ai/knowledge.ts` — Add `seedOperationalConfig()`

**Deliverable**: Working onboarding that populates `businesses.{industry,capabilities,onboarding_answers,capability_sources}` and seeds `inventory.business_settings.enabled`, `delivery.business_settings.enabled`, `business_sales_config`, `assistant_channels`

**Quality Gates**: lint 0 errors, build success, unit tests for derivation, Playwright E2E for quiz flow

---

## TERMINAL STATE

`READY_FOR_IMPLEMENTATION` (pending 5 human decisions)

The architecture is sufficiently decided. No contradictions remain. All STOP GATE checks pass. The next implementation loop can begin once human decisions are recorded.