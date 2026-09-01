# 18 — Context-First Decision Table (Adversarial Loop 2)

**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Status:** EVIDENCE_LOCKED — DISCOVERY ONLY
**Rule classification:** each rule is FACT (evidence in code today), INFERENCE (derived from evidence), PROPOSED (design requirement from contradictions), or UNKNOWN (insufficient evidence).

---

## R1 — Scope resolution (who defines the product universe for this message)

| # | Rule | Class | Evidence |
|---|------|-------|----------|
| R1.1 | IF message names a product explicitly (name match) THEN explicit scope wins over active context | PROPOSED | C-001: global matching today handles this correctly by accident; context-first would break it without this rule |
| R1.2 | ELSE IF conversation has `active_product_ids = [one]` THEN scope = that product | INFERENCE | product-recommendation resolves deterministically per message; persistence is the proposed delta |
| R1.3 | ELSE IF `active_product_ids` has >1 (comparison) THEN suppress product-scoped media; allow generic | PROPOSED | C-002: cannot choose one asset for two candidates |
| R1.4 | ELSE (no product context) THEN resolve message-locally as today (global trigger scan) | FACT | this is current behavior in `conditional-media.ts` + `media.ts:11-26` |
| R1.5 | Context ages: IF context is stale relative to a topic change → `context_source = 'none'` | UNKNOWN | no evidence defines topic-change detection; flagged for Council |

## R2 — Media eligibility

| # | Rule | Class | Evidence |
|---|------|-------|----------|
| R2.1 | Media rows must be `is_active = true` and match scope (product_id ∈ scope, or generic with product_id NULL) | FACT | MEDIA_INVARIANT (image-core finding #3, docs 04-05) |
| R2.2 | IF scope has a product AND media is product-scoped for ANOTHER product THEN ineligible (no cross-contamination) | FACT | 05-TRIGGER-CONTAMINATION.md |
| R2.3 | IF conversation outcome = `sold` THEN product-scoped media allowed only on explicit request | PROPOSED | C-012 |

## R3 — Selection (when multiple eligible assets)

| # | Rule | Class | Evidence |
|---|------|-------|----------|
| R3.1 | Order by `position` (if set) then `created_at ASC` | PROPOSED | `position` column exists but unused (finding #11); `created_at ASC` is current behavior |
| R3.2 | Dispatch ONE asset per resolution (single best) | FACT | current code returns single media object |
| R3.3 | IF ambiguity between asset types (photo vs testimonial) and message doesn't specify → prefer media_type matching the media-word in message; default image | INFERENCE | `media_type` exists ('image','testimonial'); testimonial misclassification exists (finding #5) — needs validation |

## R4 — Idempotency / dedup

| # | Rule | Class | Evidence |
|---|------|-------|----------|
| R4.1 | IF claim exists for (asset, conversation) AND delivered_at IS NOT NULL THEN suppress (already received in this conversation) | FACT | `conditional-media.ts:98-114` (minus delivered_at, which is proposed) |
| R4.2 | IF claim exists AND delivered_at IS NULL THEN attempt-in-flight/failed → allow retry (do not block) | PROPOSED | C-006: today failed sends are permanently claimed |
| R4.3 | IF customer explicitly re-requests (resend verbs + media word, or names the asset/product) THEN override suppression for that asset once | PROPOSED | ATTACK #5/#10: explicit request must beat dedup |
| R4.4 | New conversation (same customer): default = allow re-send (asset scoped to conversation) | FACT | today's UNIQUE key is conversation-scoped |
| R4.5 | Cross-channel same customer: default = allow re-send | FACT | dedup has no channel dimension; identity fragmentation (C-007) makes customer-level unsafe now |
| R4.6 | Customer-level dedup (never re-send same asset to same human) — target state, deferred | UNKNOWN | C-003/C-007: needs identity merge + time semantics decision |
| R4.7 | Duplicate webhook (same message id): suppress via message-level idempotency, not media dedup | INFERENCE | media layer must not be the duplicate-filter |

## R5 — Ordering / authority

| # | Rule | Class | Evidence |
|---|------|-------|----------|
| R5.1 | Runtime resolves context + eligibility + selection deterministically BEFORE LLM call | FACT (current order) / PROPOSED (as contract) | `core.ts:100-137`: resolveConditionalMedia runs before executeAI |
| R5.2 | LLM may request media semantically but never grants eligibility | PROPOSED | C-010 |
| R5.3 | Runtime result (resolved/blocked/deduplicated/failed) must be fed back into the LLM prompt so it never claims what was not sent | PROPOSED | image-core finding #9 (no feedback loop) |

## R6 — Failure / concurrency

| # | Rule | Class | Evidence |
|---|------|-------|----------|
| R6.1 | Dispatch claim must be a single atomic upsert (never read-then-write arrays) | FACT + PROPOSED | upsert path is atomic; `media-guard.ts:87-98` array append is not — race documented (finding #16) |
| R6.2 | Transport confirms delivery asynchronously → set delivered_at | PROPOSED | adapters currently fire-and-forget |
| R6.3 | If selection fails (no eligible asset) → LLM informed, no media promise made | PROPOSED | findings #8/#9 |

---

## Combined deterministic pipeline

```text
message →
  extract explicit product mentions        (R1.1)
  load conversation context                (R1.2-R1.3)
  scope = explicit ⊕ implicit ⊕ global     (R1.4)
  eligible = filter catalog by scope+state (R2.1-R2.3)
  IF resend → eligible = [last_media_asset](R2.4)
  selected = order+pick one                (R3.x)
  IF claim exists:
     delivered → suppress UNLESS explicit  (R4.1, R4.3)
     not delivered → retry allowed         (R4.2)
  atomic claim write                       (R6.1)
  dispatch → transport ack → delivered_at  (R6.2)
  feed result into LLM prompt              (R5.3)
```

---

**Next:** `19-ARCHITECTURE-VERDICT.md`