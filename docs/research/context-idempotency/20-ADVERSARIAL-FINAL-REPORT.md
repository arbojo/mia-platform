# 20 — Adversarial Final Report (Loop 2: Contradiction / Adversarial Validation)

**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Status:** EVIDENCE_LOCKED — DISCOVERY ONLY
**Pipeline stage:** INVESTIGATION ✅ → CONTRADICTION LOOP ✅ → **STOP_FOR_HUMAN** → COUNCIL → PRD → GOVERNANCE → SUBARU → IMPLEMENTATION

---

## Executive Summary

Loop 1 proposed context-first media resolution with customer-level idempotency and minimal state `{active_product_id, active_intent, presented_media_scope[]}`. Loop 2 attacked this hypothesis through 20 adversarial attacks, 12 registered contradictions, and 15 golden conversations (docs 16–19, 21).

**Verdict: B — CONFIRMED WITH AMENDMENTS.**

The core insight survives: MIA's media system fails today because trigger evaluation is global and message-local, with zero commercial context (FACT: `media.ts:11-26` invoked with no product scope; `product-recommendation.ts:54-65` re-resolves per message with no persistence). But the Loop 1 formulation needed **five amendments** forced by evidence, not preference:

1. **Explicit scope > implicit context** (C-001, C-005) — a named product in the message must override stale context, or context-first misfires worse than the status quo.
2. **Plural product context** (C-002) — one `active_product_id` cannot represent comparison, a real commercial case.
3. **`active_intent` is not persisted state** (C-004) — it is derivable per message; no evidence path gates eligibility on intent.
4. **Attempted ≠ received** (C-006) — the dispatch claim is written before the channel send (`core.ts:100-137`), so dedup currently blocks legitimate retries after a failed send. This is a BUG, not a design choice.
5. **Customer-level dedup is target-state, not day-one** (C-003, C-007) — `customers.id` fragments across channels (`identity.ts:68-116`); customer-level idempotency is unsafe until identity merge is reliable. Conversation-level atomic claims stay as the race-safe floor; the `customer_id` column already written (`conditional-media.ts:104`) becomes the read path once identity hardens.

## Original Hypothesis

```text
MESSAGE → CUSTOMER CONTEXT → ACTIVE PRODUCT/INTENT → CONTEXT-SCOPED TRIGGER
EVALUATION → MEDIA ELIGIBILITY → SELECTION → CUSTOMER-LEVEL IDEMPOTENCY →
DISPATCH → PRESENTATION EVIDENCE
```

Minimum state: `{active_product_id, active_intent, presented_media_scope[]}`, owned by `customers.id`, answering "has this customer received this asset anywhere, recently?"

## Evidence For

| Finding | Evidence |
|---------|----------|
| Trigger evaluation is global, message-local; no context exists | `media.ts:11-26` — `triggerMatches()` scans the full message against all knowledge items (FACT) |
| No active product persists across messages | `product-recommendation.ts:16-108` — per-message re-resolution, no persistence (FACT) |
| A→B→A context switch loses the first product | Loop 1 doc 06; product resolution is stateless (FACT) |
| `customer_id` is already persisted on dispatch claims but never read | `conditional-media.ts:104` (FACT) — the customer-level hook exists, unused |
| Atomic claim machinery exists and is race-safe per conversation | `conditional-media.ts:98-114` upsert + ignoreDuplicates (FACT) |
| Global triggers legitimately serve resend + generic requests | `media.ts:38-53` `isResendRequest()`; GC-05/GC-07 in doc 21 (FACT) |
| LLM and runtime disagree silently about media | `prompts.ts:141-144` `[IMAGEN_DISPONIBLE]` vs runtime null resolution — image-core finding #8 (FACT) |

## Evidence Against

| Finding | Evidence |
|---------|----------|
| Pure context-first breaks explicitly-named products with empty/stale context | C-001; GC-04 in doc 21 (CONTRADICTION) |
| Single active product cannot represent comparison | C-002; `product-recommendation.ts:54-65` returns `null` on 2+ matches (CONTRADICTION) |
| Customer identity fragments across channels | C-007; `identity.ts:68-116` — WebChat anonymous sessions create new `customers.id` rows (CONTRADICTION) |
| Claim-before-send converts "attempted" into "received" | C-006; `core.ts:100-137` ordering (BUG) |
| `media_sent_products[]` append is non-atomic | `media-guard.ts:87-98` read-then-write (BUG) |
| "Recently" has no definition anywhere in the codebase | C-009; no TTL/time-window exists (UNKNOWN) |
| Context-first would kill the resend path that works today | C-011 — resend and generic requests work *because* matching is global (CONTRADICTION) |

## Contradictions

Full register: doc 16 (C-001 … C-012). Severity: 4 CRITICAL (C-003, C-006, C-010, and the claim-execution gap), 5 HIGH, 3 MEDIUM. All carry resolutions incorporated into the amended model below.

## Minimum Required State

Post-attack model (doc 17, section 4):

```ts
// conversation-owned (TODAY)
{
  active_product_ids: UUID[],      // 0..n, ordered; [] = no active product
  context_updated_at: timestamp,
  context_source: 'explicit' | 'implicit' | 'none',
  last_media_asset: UUID | null
}

// dedup (existing table, amended)
chat_media_dispatched (knowledge_item_id, conversation_id, customer_id)
  + delivered_at | null            // attempted vs received (C-006)
```

Dropped from Loop 1 proposal: `active_intent` (derivable, C-004), `presented_media_scope[]` (ambiguous; dissolves into per-asset claims + `last_media_asset`, ATTACK #13). Customer ownership of context is **future-state** gated on identity hardening (C-003/C-007).

## Explicit Scope Rules

- **Explicit product mention in the current message > active context** (PROPOSED rule, grounded in C-001; there is no counter-evidence).
- Explicit scope resolves the PRODUCT, not the ASSET — asset selection still needs deterministic ordering (C-005; PROPOSED: `position` then `created_at`, both already exist or are inert in schema).
- Explicit re-request overrides dedup suppression (GC-07; PROPOSED — no current code path reads dedup for override, evidence of the gap in doc 17 §2).

## Idempotency Semantics

| Question | Answer | Classification | Evidence |
|----------|--------|----------------|----------|
| Unit of dedup today | `(knowledge_item_id, conversation_id)` UNIQUE | FACT | `conditional-media.ts:98-114`; migration 016 |
| Unit of dedup target (day 1) | Same, + `delivered_at` distinguishing attempted from received | PROPOSED (grounded in BUG C-006) | `core.ts:100-137` ordering |
| Unit of dedup target (future) | `(customer_id, knowledge_item_id)` once identity hardens | PROPOSED (grounded in C-003/C-007) | `conditional-media.ts:104` — column exists, never read |
| Same asset, same conversation, repeated trigger | Suppress | FACT (current) + PROPOSED (keep) | UNIQUE constraint |
| Same asset, new conversation | Re-send | FACT (current behavior) + PROPOSED (keep until identity hardens) | dedup is conversation-scoped |
| Same asset, different channel | Re-send today (separate conversations); customer-level suppression is FUTURE | FACT + PROPOSED | doc 09 parity analysis |
| Explicit re-request ("otra vez") | Must override suppression | PROPOSED — grounded in `isResendRequest()` existing as a separate path | `media.ts:38-53`; GC-07 |
| Retry after failed dispatch | Must re-send | PROPOSED — today impossible (BUG) | C-006 |
| "Recently" / TTL | No evidence, no mechanism, no requirement found | UNKNOWN | C-009 |

## Cross-Channel Semantics

- Context and dedup live in CORE, keyed by `conversation_id` (FACT — `conditional-media.ts` has no channel parameter).
- Channel affects PRESENTATION only (Baileys media message vs `<img>` in web; FACT — `baileys.ts:65`, `ChatWindow.tsx:365`).

## Failure Semantics

- Dispatch failure after claim: dedup treats media as sent → no retry (BUG, C-006). Amendment: `delivered_at` NULL until adapter confirms.
- No product resolved: current system falls back to global trigger match on generic items (FACT — `product-recommendation.ts:54-65` returns null, matching continues unscoped). This fallback is retained as the no-context path.
- Ambiguous product (2+ in one message): current = null + global triggers can cross-contaminate (C-002). Amendment: `active_product_ids[]` plural.
- DB race on `media_sent_products[]`: lost updates (BUG — `media-guard.ts:87-98`). Amendment: single atomic claim table only; deprecate the array.

## Race Conditions

- `chat_media_dispatched` upsert with `ignoreDuplicates` is atomic per conversation (FACT — safe).
- `media_sent_products[]` read-then-append is NOT atomic (FACT — `media-guard.ts:87-98`); two concurrent messages can both read absent → both append → one write lost, or both send.
- Concurrent sends of the same asset in different conversations: no guard today (customer-level read path absent); future-state only.
- Webhook duplicate delivery: dedup on `(knowledge_item_id, conversation_id)` incidentally absorbs exact-duplicate media dispatches within a conversation; text replies are not deduplicated (UNKNOWN — out of media scope).

## Golden Conversations

15 defined in doc 21 (GC-01 … GC-15): single product, product switch, two products in one message, explicit product with no context, generic trigger, repeated trigger, same image twice, different image, new conversation, cross-channel, technical retry, dispatch failure, ambiguous request, explicit override, stale context. Each specifies expected context, intent, trigger evaluation, media, idempotency, and channel behavior; the parity matrix maps each to Lab/Core/WhatsApp/WebChat.

## Architecture Verdict

Full table in doc 19. Summary:

| Component | Decision |

## PRD Requirements

1. Persist plural, ordered `active_product_ids` + `context_source` + `context_updated_at` on the conversation (minimal state, doc 17 §4).
2. Explicit-scope-wins rule as the first branch of the decision table (doc 18 R-01).
3. Split claim into `claimed_at` / `delivered_at`; retry path on NULL `delivered_at`.
4. Deprecate `media_sent_products[]`; single source of dedup truth.
5. Feed media resolution outcome (resolved / suppressed / failed) back into the LLM prompt.
6. Explicit re-request override path for dedup.
7. Phase 2 (gated): identity merge → promote `(customer_id, knowledge_item_id)` to the dedup read path.
8. Explicitly deferred: TTL/"recently" semantics (UNKNOWN — decide in PRD with product input, not in code).

## Risks

- Context persistence adds a write per message on the hot path (small; single-row update).
- Explicit-scope detection depends on product-name matching quality (exact-substring today; INFERENCE — false positives possible for overlapping names).
- Removing `media_sent_products[]` requires a migration and dual-read window.
- Customer-level dedup promoted too early would silently suppress legitimate sends across fragmented identities (C-007) — hence phase-gated.
- Attempted/received split depends on adapter delivery confirmation, which Baileys may not reliably provide (UNKNOWN — needs verification of Baileys ack events).

## UNKNOWNs

1. "Recently" / TTL semantics — no evidence anywhere (C-009).
2. Baileys delivery-ack reliability for `delivered_at` (needs runtime verification).
3. Whether the LLM can be trusted to emit explicit-scope, or whether scope extraction must be deterministic (ATTACK #16 resolution incomplete).
4. Multi-business customer identity (same phone across businesses) — unresolved by `identity.ts` reading alone.

## TERMINATION CONDITION — MET

1. ✅ Hypothesis attacked from all 20 angles (docs 16–18, 21)
2. ✅ Contradictions registered (doc 16: C-001 … C-012, all resolved)
3. ✅ Minimum state identified (doc 17 §4 — reduced from Loop 1 proposal)
4. ✅ `active_product_id` insufficiency proven → plural (C-002)
5. ✅ `active_intent` necessity disproven → dropped (C-004)
6. ✅ `presented_media_scope` semantics dissolved into per-asset claims (doc 17 §3)
7. ✅ Customer-level idempotency semantics determined (phase-gated, C-003/C-007)
8. ✅ Retries and failures analyzed (C-006, attempted ≠ received)
9. ✅ Race conditions analyzed (atomic claim safe; array append not)
10. ✅ Cross-channel analyzed (decision-layer parity holds; identity layer does not)
11. ✅ Explicit overrides analyzed (C-001, C-005; explicit > implicit)
12. ✅ 15 golden conversations produced (doc 21)
13. ✅ Decision table produced (doc 18, rules with classifications)
14. ✅ Architecture verdict produced (doc 19)
15. ✅ Clear recommendation for PRD (this document, PRD Requirements)

**Next stage: CONTRADICTION LOOP complete → STOP_FOR_HUMAN → human review → COUNCIL (doc 14) → PRD (doc 13).**

## Verdict

**B — CONFIRMED WITH AMENDMENTS.** Context-first media resolution survives adversarial validation only as *context-scoped by default with explicit-scope escape hatch*, plural product context, no persisted intent, conversation-level atomic idempotency with attempted/received semantics, and customer-level idempotency phase-gated behind identity hardening.

## Architecture Verdict (summary — full detail in doc 19)

| Component | Decision |
|-----------|----------|
| `triggerMatches()` keyword core | **KEEP** (matcher is sound; the failure is scope, not matching) |
| Global unscoped evaluation as the ONLY path | **REPAIR** → becomes the no-context fallback inside a context-scoped model |
| `resolveConditionalMedia()` claim ordering | **REPAIR** (attempted/received split) |
| `chat_media_dispatched` atomic claim | **KEEP** (extend with `delivered_at`; later promote `customer_id` to read path) |
| `conversations.media_sent_products[]` | **DEPRECATE** (non-atomic, redundant) |
| `active_intent` as persisted state | **MISSING → do not build** (derivable; C-004) |
| Customer-level idempotency | **MISSING → build later**, gated on identity hardening |
| Identity resolution (`identity.ts`) | **REPAIR** (merge strategy required first) |
| `[IMAGEN_DISPONIBLE]` prompt note without resolution feedback | **REPAIR** (feed resolution result back to LLM) |

- Parity gaps: Lab does not render product cards (`LabChatWindow.tsx:292` — PARITY_GAP); media fallback missing in web (`ChatWindow.tsx:365`).
- Cross-channel customer identity is the blocker for customer-level idempotency: `identity.ts:68-116` (external_id+channel → phone → email → new row) means an anonymous WebChat visitor and a WhatsApp contact are different `customers.id` rows (FACT). **The invariant "same context + same media state → same decision regardless of channel" holds at CORE level and fails only through identity fragmentation** (PARITY_GAP at the identity layer, not the decision layer).

---

# STOP_FOR_HUMAN

The adversarial loop is complete. No code, prompts, migrations, or schema were modified. Next stages require human action:

**CONTRADICTION LOOP (this document) → human review → COUNCIL (doc 14) → PRD (doc 13) → GOVERNANCE → SUBARU → IMPLEMENTATION.**

Do not proceed to implementation before those stages complete.

