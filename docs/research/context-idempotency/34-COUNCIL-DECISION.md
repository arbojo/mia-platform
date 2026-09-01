# Council Decision — Context + Idempotency Phase 1

**Decision ID:** DEC-20260830-CONTEXT-IDEMPOTENCY-PHASE1
**Date:** 2026-08-30
**Repo HEAD at decision:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Status:** APPROVED (Phase 1 only)
**Authority:** Human operator directive — Loop 6 mission (COUNCIL → GOVERNANCE → IMPLEMENTATION AUTHORIZATION)
**Evidence base:** `docs/research/context-idempotency/01–33` (frozen), `GATE-CHECK-LOOP5.md`

---

## Provenance note

`GATE-CHECK-LOOP5.md` correctly recorded that D1/D2/D5/C-1 had **no approval record** — only
contractual recommendations (docs 22, 24, 26, 32, 33). This document closes that gate:

- **D1, D2, D5** are decided here exactly as stated by the human operator in the Loop 6
  directive (verbatim decisions reproduced below). No technical recommendation was promoted
  to approval by inference.
- **C-1** is decided by adopting the **existing contractual recommendation** (safe-default,
  no-dispatch), explicitly authorized by the Loop 6 directive ("usar la recomendación
  contractual existente si está documentada; NO inventar una alternativa nueva"). The
  recommendation IS documented (doc 22 INV-4, doc 32 §2, doc 33 §C-1). No alternative was created.

---

## D1 — Context TTL → APPROVED

**Decision (verbatim from Loop 6 directive):** VIDA DE CONVERSACIÓN (conversation lifetime) para Phase 1.

- `active_product_ids[]` persists for the lifetime of the conversation row.
- No time-based decay, no summarization-based eviction in Phase 1.
- Scope can only be changed by the explicit-scope authority (D5) or accumulated per
  doc 22 §3 (acumulación) and INV-5 (set semantics, coexistence).
- Known open business question (real multi-day WhatsApp TTL, doc 32 U-2 / C-2) remains
  registered as UNKNOWN and is **not** resolved by this decision; it does not block Phase 1
  because conversation lifetime is the decided Phase 1 semantics.

**Sources:** doc 22 §3, doc 17 (state model validation), doc 32 U-2, Loop 6 directive.

## D2 — Idempotency TTL → APPROVED

**Decision (verbatim from Loop 6 directive):** NUNCA re-presentar automáticamente el mismo
asset al mismo scope.

- Idempotency key: `(conversation_id, knowledge_item_id)` — atomic claim table
  `chat_media_dispatched` (existing UNIQUE constraint; doc 19 KEEP verdict, GC-11).
- No automatic TTL, no automatic re-presentation, ever, within the same conversation scope.
- **Explicit bypasses (only two, both contract-bound):**
  1. **Customer-requested resend** — explicit re-request detected by the natural
     explicit-re-request detector (`isResendRequest` + anaphora repair, doc 19 REPAIR row,
     GC-07). Bypasses dedup exactly once per explicit request.
  2. **Recovery when applicable** — a claim stuck in `failed` may be re-claimed per the
     FAILED state semantics of doc 26 §1 (claim ≠ delivered; P1-4).
- `attempted`, `claimed`, `dispatched` and `delivered` are NOT equivalent: Phase 1
  implements `claimed / dispatched / failed` states (P1-4); `delivered` is Phase 2 (D3).


---

## D5 — Explicit Scope Authority → APPROVED

**Decision (verbatim from Loop 6 directive):** El scope explícito únicamente puede ser
establecido por:

1. nombre literal de producto
2. SKU

El LLM **NO** puede mutar `active_product_ids[]`.

- Trigger keywords, generic media language, categories and any LLM-derived signal are
  JAMÁS scope authority (doc 22 §5, F2/F4, INV-3 hierarchy reduced to literal+SKU
  for Phase 1 per doc 24 §5).
- LLM output may *report* resolved context (P1-6 feedback) but has zero write authority
  over scope state.

**Sources:** doc 22 §4/§5, doc 24 §5, doc 19 (REPAIR row), Loop 6 directive.

## C-1 — Multi-product UX → APPROVED

**Decision (existing contractual recommendation, adopted verbatim):** safe-default —
**no dispatch on ambiguity**.

- When a message plausibly references more than one product without hierarchy (INV-4),
  the system does NOT arbitrarily select a product, does NOT dispatch ambiguous media,
  and responds with a clarification question.
- Two explicitly mentioned products may coexist in `active_product_ids[]` (INV-5, set
  semantics validated in doc 17); generic triggers inside a multi-product scope are
  blocked from cross-product contamination by scope isolation (doc 22 isolation proof:
  Clean Nails vs Neurotin).
- No new UX alternative was invented; the recommendation documented in doc 32 §2 and
  doc 33 §C-1 is adopted as the decision, per Loop 6 directive.

**Sources:** doc 22 INV-4 + isolation proof, doc 32 §2 (contradiction registered),
doc 33 §C-1, Loop 6 directive.

---

## Deferred decisions — NOT approved in Phase 1

| Decision | Topic | Status |
|---|---|---|
| D3 | `delivered_at` / provider receipts semantics (Baileys spike) | **Phase 2** — not approved; Phase 1 lives with `unknown` constant (doc 33) |
| D4 | Identity hardening / cross-channel identity | **Phase 2** — not approved (doc 22 §8, GT-19..21) |
| D6 | Customer × asset dedup (read path of `chat_media_dispatched.customer_id`) | **Phase 2** — not approved; column write remains, read path stays unimplemented |

Implementing any of these in Phase 1 is a Council deviation = forbidden (see doc 35).

---

## Decision record

| ID | Decision | Status | Provenance |
|---|---|---|---|
| D1 | Context TTL = conversation lifetime | APPROVED | Loop 6 human directive (verbatim) |
| D2 | Never re-present same asset to same scope; 2 explicit bypasses | APPROVED | Loop 6 human directive (verbatim) |
| D5 | Explicit scope = literal name + SKU only; LLM excluded | APPROVED | Loop 6 human directive (verbatim) |
| C-1 | Safe-default: no dispatch on ambiguity | APPROVED | Loop 6 directive adopting documented contractual recommendation (docs 22/32/33) |
| D3 | delivered_at / provider receipts | PHASE 2 | not approved |
| D4 | identity hardening | PHASE 2 | not approved |
| D6 | customer × asset dedup | PHASE 2 | not approved |

**Gate result:** D1 ✅ D2 ✅ D5 ✅ C-1 ✅ → governance manifest authorized
(see `35-GOVERNANCE-MANIFEST.md` and `.governance/tasks/DEC-20260830-CONTEXT-IDEMPOTENCY-PHASE1.json`).
