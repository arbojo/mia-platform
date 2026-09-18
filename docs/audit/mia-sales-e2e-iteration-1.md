# MIA SALES — Loop Engineering Iteration 1 Report

**Mission**: Build the Missing TRUE_E2E Sales Path
**Date**: 2026-08-23
**Result**: ✅ SUCCESS — first genuine TRUE_E2E MIA Sales journey, passing 4/4 browsers

---

## 1. Objective

Prove or refute, with a real browser-driven test:

> "A real customer journey has been proven from user message to client-visible MIA
> response, with evidence showing what product and media were actually selected."

Scope constraints honored: minimal changes, test-only files, zero production code
modifications, no mocks of product resolution / media resolution / final response.

## 2. Files Changed

All files are NEW and untracked. **Zero existing production files modified.**

| File | Purpose |
|------|---------|
| `tests/e2e/mia-sales-core.spec.ts` | THE first TRUE_E2E sales journey test |
| `tests/fixtures/seed-e2e-tenant.mjs` | Idempotent deterministic tenant seeder (Supabase Admin API, service role from `.env.local`, secrets never printed) |
| `tests/fixtures/seed-media-flow.sql` | SQL-equivalent seed, corrected against real migrations |
| `docs/audit/mia-sales-e2e-baseline-report.md` | Phase 2 baseline audit (16/100, NOT_READY) |

## 3. TRUE_E2E Coverage

**Test**: `customer asks about a product and receives product data + media in the visible response`
**Executions**: 4 (chromium, firefox, mobile-chrome, mobile-safari) — **4 passed**, ~1.2 min total.

Journey proven, in order:

```
USER MESSAGE       "Quiero ver el E2E Test Neurofeet" typed into real widget input
        ↓          (POST /api/widget/chat)
PRODUCT RESOLUTION resolveRecommendedProduct() against seeded context
        ↓
PRODUCT DATA       ProductMessageCard rendered with "$499"
        ↓
MEDIA DECISION     resolveConditionalMedia(): trigger_condition matched
        ↓
MEDIA DISPATCH     SSE event {type:'media', imageUrl} emitted by runtime
        ↓
CLIENT VISIBLE     <img alt="Imagen enviada por el asistente"> present in widget DOM
```

## 4. Reality Boundary

**REAL (production path, unmocked)**: browser, widget page (`src/app/widget/page.tsx`),
`ChatWindow` UI, `/api/widget/chat` route, `processStreaming()` runtime, product
recommendation, conditional media resolution, media guard, SSE streaming,
OpenAI `gpt-4o-mini` call, Supabase reads/writes (channel_messages, customers via
`resolveCustomer`, conversations, messages), DOM rendering.

**SEEDED (deterministic test data only)**: auth user, business, brand_identity,
assistant, product ("E2E Test Neurofeet", price 499), knowledge_item with
`trigger_condition = 'E2E Test Neurofeet'` and media_type `image`.

**Mocked**: nothing.

## 5. Media Forensics

Captured per execution via console output:

```
[FORENSICS] assistant response text: "El E2E Test Neurofeet es un producto diseñado para validar
la resolución de productos de MIA... Su precio es de $499..."   <- grounded in seeded context
[FORENSICS] product card visible with price $499
[FORENSICS] media dispatched imageUrl: https://xyz.supabase.co/storage/v1/object/public/media/e2e-test-neurofeet.jpg
```

The five-state chain (AVAILABLE → ELIGIBLE → SELECTED → DISPATCHED → RECEIVED BY CLIENT)
is evidenced at its two observable ends: seeded eligibility data as input, dispatched URL +
rendered `<img>` (count exactly 1) as output. Intermediate states remain unit-covered
(`media-forensics.spec.ts`), not directly asserted E2E.

## 6. Customer Data

No customer was pre-seeded — deliberately. The synthetic customer is created **at runtime
by the production path** (`resolveCustomer` with `channel='widget'` and the visitor UUID
from `sessionStorage['mia_widget_visitor']`). This is correct: customers are runtime
artifacts of real interactions, and the test proves that creation flow too.

## 7. Failures During Iteration (all resolved)

| # | Failure | Root cause | Resolution |
|---|---------|-----------|------------|
| 1 | `test.info().setOutput is not a function` | API absent in installed Playwright version | Removed usage |
| 2 | Login-flow dead end: chat input never appears | Seeded-less user redirected to `/dashboard/onboarding`; dashboard home has no chat | Switched entry point to `/widget` — the actual customer-facing surface |
| 3 | Signup assertion `Crear mi asistente` not found | Text belongs to landing, not signup page | Obsolete after widget switch |
| 4 | Original seed SQL invalid | Schema drift: `businesses` has no industry/pitch columns (live in `brand_identities`); `knowledge_items.category/source` CHECKs reject test values; `assistants.communication_style` is NOT NULL | Rewrote seed verified against migrations 001/016/024/029/039 |
| 5 | `Enviar` button never re-enables | Button disabled also by empty `input` after send | Completion signal = Input enabled (`disabled={isLoading}` only) |
| 6 | Seeder crashed reading `insKi.data[0]` | Insert returned null data (trigger RETURN NULL), row WAS inserted | Verified row exists; fixed log line |
| 7 | Assistant text captured mid-stream ("El E2E Test Neuro") | Count-based wait fired before stream finished | Added input-enabled completion wait → stable 4/4 |

## 8. Baseline Comparison

| Metric | Baseline (Phase 2) | After Iteration 1 |
|--------|--------------------|--------------------|
| Unique tests | 21 | 22 (+1 TRUE_E2E) |
| TRUE_E2E tests | **0** | **1** |
| Placeholder tests (`expect(true)`) | 60 executions | unchanged (pending cleanup) |
| Core sales journey proven | No | **Yes, 4/4 browsers** |
| Score | 16/100 NOT_READY | improved; still NOT_READY overall until placeholders are retired |

## 9. Regression Risk

**None to product**: zero production files touched. Costs introduced: suite grows ~1.2 min;
each run makes 4 real `gpt-4o-mini` calls (token spend tracked automatically via
`recordAiUsage`) and writes rows to the shared database under an isolated test tenant.
Safe for CI, but token budget should be noted.

## 10. Remaining Gaps

1. Negative-path E2E unproven: message WITHOUT trigger match must show text but NO media.
2. DB side-effects (`chat_media_dispatched`, `conversations.media_sent_products`) proven
   only indirectly through UI; direct assertion via admin client pending.
3. Image host is a fake placeholder (`xyz.supabase.co`) — `src` asserted, bytes not loadable.
4. Authenticated surfaces (training chat at `/dashboard/assistants/[id]/training`) still have
   no TRUE_E2E; now feasible by logging in as the seeded owner.
5. 60 placeholder executions from the forensic suite still inflate pass counts.

## 11. Recommendation

Iteration 2 (in priority order):
1. Retire placeholder tests from `media-forensics.spec.ts` (keeps unit coverage honest).
2. Add negative-path E2E (question without trigger → assert `img` count === 0).
3. Assert dispatch ledger rows directly via service-role read inside the test teardown.
4. Extend TRUE_E2E to the authenticated training chat reusing the seeded owner login.

## 12. DO NOT BUILD YET

- Multi-turn conversation E2E flows
- Laboratorio simulation E2E
- WhatsApp bridge E2E
- Landing-context widget variants
- Performance optimizations of any kind
- Any production refactor — the pipeline held under real traffic without needing one

---

**Quality gates**: lint ✅ (0 errors/0 warnings) · build ✅ · Playwright TRUE_E2E ✅ 4/4
**Production diff**: none (only new test fixtures + this report)
