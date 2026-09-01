# 15 — Final Investigation Report

**Mission:** Deep Investigation — Context-First Media & Product Idempotency
**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Mode:** DISCOVERY ONLY — no source, schema, migration, or prompt changes were made.
**Status:** COMPLETE — **STOP_FOR_HUMAN**

---

## 1. Verdict on the central hypothesis

**The hypothesis is substantially correct, but not in its strict form.**

Evidence supports "context-first" as the correct *scoping* model (findings #1, #2, #6, #7, #8, #13 — all ARCHITECTURAL_GAP):

- Media triggers are scanned globally per message with no notion of the conversation's commercial topic.
- Product identity is recomputed from scratch each turn and never persisted.
- The LLM is never told what media was actually resolved or sent.

However, pure context-first (Option B) demonstrably fails real conversation shapes: multi-product requests, comparisons, cross-sell and out-of-context testimonial requests (refutation loop, doc 10 §B). The evidence therefore supports a **refined** hypothesis:

> Resolve the commercial context first; scope media to it; but let explicit customer language
> (naming another product, asking for a photo/testimonial generically) deliberately widen the
> scope for that turn — and record the outcome so both the dedup layer and the LLM know it.

That is Option C (doc 12), the recommended model.

## 2. The final question — answered from evidence

> *"What is the smallest piece of state that MIA needs to know what the customer is currently talking about, so that MIA can select relevant media without mixing products or repeating media, while keeping the customer interaction completely natural?"*

**Answer: a persisted Commercial Context record with three components:**

1. **`active_product_id`** (+ small set: `discussed[]`, `rejected[]`) — the product under consideration, surviving turns. This is the missing join key that all current defects trace back to (doc 03: identity exists only as per-message recomputation; doc 07: no primary/secondary/previous/rejected distinction).
2. **`active_intent`** (lexical, from the existing `intents.ts` primitive) — distinguishes "talking about product" from "talking about shipping/price", which is what today lets generic media fire in the wrong context (doc 04).
3. **`media_state`** — what was sent, for which product, when. Without it, idempotency is conversation-scoped only (doc 05 cases E–G) and the LLM contradicts the runtime (finding #13).

Smallest **key** for idempotency: `(product_id, media/knowledge_item, conversation_id, customer_id)` with a temporal policy. Evidence, not intuition: every observed duplication or wrongful suppression (doc 05 cases A–J) decomposes into exactly one missing dimension among {product, customer, time/context-return}.

Smallest **representation** that keeps the customer natural: this record costs ~100–350 tokens when projected into the prompt and one upsert per message. It requires no embeddings, no new NLP, no schema change to `knowledge_items` — it is one new table plus rewiring of existing deterministic primitives (`triggerMatches`, `intents.ts`, `product-recommendation.ts` cascade).

## 3. Key findings (top 6, full list in doc 11)

| # | Finding | Classification |
|---|---------|----------------|
| 1 | Global trigger scan, no context scoping (`conditional-media.ts` via `core.ts:100-119`) | ARCHITECTURAL_GAP |
| 2 | No persisted conversation context anywhere (`context.ts`, `conversations` schema) | ARCHITECTURAL_GAP |
| 7 | Stateless per-message product identity (`product-recommendation.ts:16-170`) | ARCHITECTURAL_GAP |
| 13 | One-way media note to LLM; no feedback of media outcome (`prompts.ts:141-144`, `core.ts:100-119`) | ARCHITECTURAL_GAP |
| 14/15 | Dedup is conversation-scoped; new conversations reset media state (migrations 016/038) | FACT |
| 16 | A→B→A return-to-A suppressed by product dedup unless lexically a resend (`media-guard.ts`, `media.ts:38-53`) | FACT |

## 4. Channel parity

Context and idempotency already live in CORE (`runtime/`), not in adapters — the desired invariant ("same context + same state ⇒ same media decision") is architecturally reachable without relocating logic. Remaining gaps are rendering parity only (Lab lacks product cards; WhatsApp lacks the card, sends raw image; docs 09, image-core/07).

## 5. Recommendation

**Option C — Context-First with Explicit-Scope Escape** (doc 12). Staged rollout: shadow-resolve → gated scoping → per-business enable → MEDIA_STATE projection. Full PRD requirements in doc 13; Council submission in doc 14.

## 6. Compliance

- ✅ No source code modified
- ✅ No migrations created or modified
- ✅ No prompts changed
- ✅ No fixes implemented
- ✅ No commits of implementation
- ✔ 15 investigation documents produced under `docs/research/context-idempotency/`
- ✔ Every finding carries classification, file:line, verification method, and HEAD

## 7. Pipeline position

```
INVESTIGATION ✅ (this package)
   → CONTRADICTION LOOP   (human-initiated)
   → COUNCIL              (doc 14 is the submission)
   → PRD                  (doc 13 is the input)
   → GOVERNANCE
   → SUBARU
   → IMPLEMENTATION       (NOT STARTED — and must not start before the above)
```

---

**STOP_FOR_HUMAN**
