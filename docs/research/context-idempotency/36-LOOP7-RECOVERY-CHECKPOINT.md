# 36 — LOOP 7 RECOVERY CHECKPOINT

**Date**: 2026-09-01
**Auditor**: Loop 7 Recovery Protocol (token-exhaustion recovery)
**Status**: AUDIT COMPLETE — NOT READY FOR COMMIT (P1-8 missing)

---

## 1. Repository State

| Field | Value |
|-------|-------|
| Baseline (origin/main) | `d12ce6503ddc8a7b11a71c6037b87c33939702c0` |
| HEAD | `d12ce6503ddc8a7b11a71c6037b87c33939702c0` |
| Branch | `main` |
| Commits ahead of origin | 0 |
| Working tree | Modified (tracked + untracked) |

## 2. Modified Files (tracked diff)

| File | Lines changed | Nature |
|------|--------------|--------|
| `src/lib/ai/prompts.ts` | +48 | P1-6: `withMediaResolutionFeedback()` + `MediaResolutionFeedback` interface |
| `src/lib/runtime/core.ts` | +81/-8 | Pipeline reorder: scope → media → claim → feedback |
| `src/lib/runtime/media-guard.ts` | +11 | P1-5: `@deprecated` annotations on `media_sent_products` functions |
| `src/lib/types/index.ts` | +6 | Type additions: `state` on `chat_media_dispatched`, `active_product_ids` on `conversations` |

## 3. New Files (untracked)

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/runtime/context-media.ts` | P1-3/P1-4/P1-7: Scoped trigger evaluation + atomic claims + decision logging | COMPLETE |
| `src/lib/runtime/context-scope.ts` | P1-1/P1-2: Conversation-scoped context + explicit scope detection | COMPLETE |
| `supabase/migrations/057_active_product_ids.sql` | P1-1: `active_product_ids UUID[]` column + GIN index | COMPLETE |
| `supabase/migrations/058_media_claim_state.sql` | P1-4: `state TEXT` column on `chat_media_dispatched` | COMPLETE |
| `workshop/loop/governance.test.ts` | Governance checker unit tests (286 lines) | COMPLETE |
| `.governance/tasks/DEC-20260830-CONTEXT-IDEMPOTENCY-PHASE1.json` | Governance manifest | EXISTS (status: in_progress) |
| `.governance/logs/subaru-CHECKPOINT-CONTEXT-IDEMPOTENCY-PHASE1.md` | Subaru checkpoint log | EXISTS |
| `docs/research/context-idempotency/` | 36 research documents | EXISTS |

## 4. P1 Matrix — Status

| ID | Component | Status | Evidence |
|----|-----------|--------|----------|
| P1-1 | `active_product_ids[]` | ✅ IMPLEMENTED | Migration 057 + `context-scope.ts` load/persist/detect + types updated |
| P1-2 | Explicit scope (literal + SKU) | ✅ IMPLEMENTED | `context-scope.ts:83-127` — `detectExplicitScopes()` with compact SKU matching |
| P1-3 | Scoped trigger evaluation | ✅ IMPLEMENTED | `context-media.ts:393-464` — `resolveScopedIdempotency()` filters by `product_id` |
| P1-4 | Atomic claims | ✅ IMPLEMENTED | `context-media.ts:336-368` — upsert with `onConflict`, `setMediaClaimState()` |
| P1-5 | Deprecate `media_sent_products[]` | ✅ IMPLEMENTED | `media-guard.ts:75-97` — `@deprecated` JSDoc on both functions |
| P1-6 | LLM media feedback | ✅ IMPLEMENTED | `prompts.ts:459-497` — `withMediaResolutionFeedback()` + integrated in `core.ts` |
| P1-7 | Decision logging | ✅ IMPLEMENTED | `context-media.ts:116-139` — `logMediaDecision()` + called from `core.ts:141-146` |
| P1-8 | Golden tests GT-01…GT-35 | ❌ **FALTANTE** | Zero context-idempotency tests found in `tests/` |

## 5. Contract Verification

### CLAIMED ≠ DISPATCHED ≠ DELIVERED
- ✅ `claimed` = set at upsert (context-media.ts:344)
- ✅ `dispatched` = set after URL safety check (core.ts:162-170)
- ✅ `delivered` = always `'unknown'` in Phase 1 (context-media.ts:45, 77, 255, 309, 379)
- ✅ No `delivered_at` column in any migration

### C-1 Scope Rules
- ✅ 0 scopes → NO dispatch (context-media.ts:181-188)
- ✅ 1 scope → scoped media (context-media.ts:415-419)
- ✅ 2+ scopes → NO dispatch (context-media.ts:191-201)

### D2 Recovery
- ✅ Failed claim → re-claimable (context-media.ts:281-313)
- ✅ Same conversation × asset → idempotency hit (context-media.ts:262-276)
- ✅ Explicit resend → bypass permitted (context-media.ts:229-259)

### LLM Cannot Mutate active_product_ids
- ✅ Scope mutation only via `detectExplicitScopes()` (literal/SKU) and `landingProductId`
- ✅ LLM receives feedback as read-only block (prompts.ts:487-493)

### Customer-Level Idempotency NOT Implemented (Phase 1)
- ✅ No `customer_id` in the `onConflict` clause (context-media.ts:346)
- ✅ Dedup is conversation × asset only

## 6. Fixes Applied During Recovery

1. **TypeScript** `core.ts:120,131,143` — `input.conversationId` (`string | undefined`) coerced to `string | null` via `?? null`
2. **TypeScript** `core.ts:136` — `scopeContext.explicit[0]?.source` (`undefined`) coerced via `?? null`
3. **ESLint** `context-media.ts:278` — `let selected` → `const selected` (prefer-const)
4. **ESLint** `context-scope.ts:2` — Removed unused `Database` import

## 7. Tests Executed

| Suite | Result | Notes |
|-------|--------|-------|
| `vitest run` (unit) | Pre-existing errors in test mocks | NOT Loop 7 — infrastructure debt |
| TypeScript (`tsc --noEmit`) | Loop 7 files: 0 errors | Pre-existing test errors remain |
| ESLint | Loop 7 files: 0 errors, 0 warnings | Pre-existing warnings remain |

## 8. Risks

1. **P1-8 (Golden Tests) MISSING** — The entire GT-01…GT-35 test suite (35 tests) was never written. This is a blocking gap for COMMIT readiness.
2. **Governance manifest status = `in_progress`** — Not yet `approved`. The Subaru checkpoint log exists but governance hasn't formally closed.
3. **Dead import in `runtime.ts:7`** — `resolveConditionalMedia` is imported but unused (the old flow was replaced). This is cosmetic debt, not blocking.
4. **Migrations not applied** — 057 and 058 exist as files but have not been run against any database.

## 9. UNKNOWNs

- Whether the governance council formally approved the manifest (status shows `in_progress`)
- Whether the Subaru checkpoint was ever frozen/completed for this task
- Whether golden tests were planned but never started, or were planned for a later loop

## 10. Out-of-Scope Changes Detected

| File | Classification |
|------|---------------|
| `.governance/EXECUTOR-CONTRACT.md` | Governance infrastructure (not Loop 7) |
| `.governance/logs/governance-2026-08-27.log` | Governance infrastructure |
| `.governance/tasks/TASK-20260827-072633048.json` | Governance infrastructure |
| `.governance/tasks/TASK-20260830-0363673.json` | Governance infrastructure |
| `docs/infrastructure/` | Deployment docs (not Loop 7) |
| `docs/research/dashboard-ux/` | Dashboard research (not Loop 7) |
| `docs/research/deployment/` | Deployment research (not Loop 7) |
| `docs/research/image-core/` | Image research (not Loop 7) |
| `docs/research/onboarding/` | Onboarding research (not Loop 7) |
| `supabase/config.toml` | Supabase config (not Loop 7) |
| `supabase/schemas/` | Schema dump (not Loop 7) |

These files are present in the working tree but are NOT part of the context-idempotency scope. They should be committed separately or excluded from the Loop 7 commit.

## 11. Continuation Decision

**NOT READY FOR COMMIT** — P1-8 (golden tests GT-01…GT-35) is missing and is a mandatory deliverable per the governance manifest.

**Next steps:**
1. Write GT-01…GT-35 golden tests (P1-8)
2. Close governance manifest (change status to `approved`)
3. Run full test suite
4. Commit Loop 7 scope only (exclude out-of-scope files)
5. Push to origin
