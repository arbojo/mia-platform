# 05 — Idempotency Analysis

**Mission:** Context-First Media & Product Idempotency
**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Status:** EVIDENCE_LOCKED (discovery only — no code changed)

---

## 1. Current Anti-Duplication Mechanisms (Complete Inventory)

| # | Mechanism | File:Line | Scope | Granularity | Verified |
|---|-----------|-----------|-------|-------------|----------|
| 1 | `chat_media_dispatched` table, `UNIQUE (knowledge_item_id, conversation_id)` | media dedup migration; enforced in `media-guard.ts` insert path | conversation | **per knowledge_item_id** | FACT |
| 2 | `conversations.media_sent_products` UUID[] array | `media-guard.ts:74` (`getConversationMediaSentProducts`), `media-guard.ts:87` (`addConversationMediaSentProduct`) | conversation | **per product_id** | FACT |
| 3 | `isResendRequest()` — explicit "mándame la foto otra vez" bypass | `src/lib/runtime/media.ts:38-53` | message | verb + media-word | FACT |
| 4 | MEDIA_INVARIANT — product_id filtering when product is known | `src/lib/runtime/conditional-media.ts` (resolution filters) | message | per product scope | FACT |
| 5 | `isSafeMediaUrl()` SSRF guard | `media-guard.ts:58` | message | URL safety (not dedup) | FACT |
| 6 | products.image_url deprecated fallback | `product-recommendation.ts:124` | message | catalog image (bypasses #1/#2) | FACT |

**Key fact:** There is NO deduplication at customer level, channel level, or cross-conversation level. All dedup state lives on the `conversation` row (or a table keyed by conversation).

**Key fact:** Mechanism #2 is a non-atomic read-then-write (`media-guard.ts:87`); two concurrent messages can double-send (BUG, already registered as #16 in image-core evidence matrix).

**Key fact:** Mechanism #6 (product catalog image via `product-recommendation`) is a *different send path* that does NOT consult `chat_media_dispatched`, so the same visual asset can arrive twice — once as knowledge media, once as product reference image (ARCHITECTURAL_GAP).

---

## 2. Case Analysis (A–J as specified by the mission)

Legend: CURRENT = observed behavior from code; EXPECTED = behavior implied by the mission's desired customer experience; GAP = classification of the discrepancy.

### A. Customer repeats the same trigger
- **CURRENT:** Second occurrence is blocked by `chat_media_dispatched` UNIQUE (same knowledge_item, same conversation). Silent skip — no feedback loop to LLM (`core.ts:100-119`: LLM is not told the media was suppressed), so the LLM may still *claim* it sent an image (image-core finding #8). Re-send intent (`isResendRequest`, media.ts:38) can bypass and re-send intentionally.
- **EXPECTED:** No repeat; if customer asks again naturally, either resend (explicit) or acknowledge.
- **EVIDENCE:** `conditional-media.ts` dedup check; `media-guard.ts:87`.
- **GAP:** PARTIAL — dedup works, LLM-awareness missing (BUG).

### B. Customer asks for the same product again
- **CURRENT:** Blocked only if the *same knowledge_item_id* was dispatched. A second media item bound to the same product (same product_id, different row) is covered by `media_sent_products` product-level dedup — but only on the paths that consult it. Generic (product_id=NULL) media is NOT covered by the product array.
- **EXPECTED:** Same product re-mentioned → no new media unless asked.
- **EVIDENCE:** `media-guard.ts:74-110`; `conversations.media_sent_products`.
- **GAP:** ARCHITECTURAL_GAP — product-level dedup exists but is path-dependent and race-prone; generic media escapes it.

### C. Same question, different wording (no keyword)
- **CURRENT:** `triggerMatches()` is whole-word keyword matching (`media.ts:11-26`). "¿Cómo la uso?" will not match trigger "modo de uso". Intent path (`intentMatchesTrigger`, media.ts:28-36) only matches explicit `intent:` tags. LLM may *mention* `[IMAGEN_DISPONIBLE]` (prompts.ts:135) but media only dispatches on keyword/intent match.
- **EXPECTED:** Semantic equivalence should resolve the same media.
- **EVIDENCE:** `media.ts:11-36`; image-core finding #7 (no semantic trigger system).
- **GAP:** ARCHITECTURAL_GAP — no semantic resolution layer.

### D. Customer changes channel (WhatsApp → WebChat)
- **CURRENT:** `chat_media_dispatched` and `media_sent_products` are keyed by **conversation_id**. A new conversation is created per channel/session (`resolveConversation`, `src/lib/conversation/resolver.ts`); channels do not share conversation ids. Same media will be re-sent on the new channel.
- **EXPECTED:** Same customer context should not re-send identical media across channels within a short window.
- **EVIDENCE:** `chat_media_dispatched` schema (conversation-scoped); `conversations.customer_id` exists but is not consulted by any dedup path.
- **GAP:** ARCHITECTURAL_GAP — idempotency is conversation-scoped, not customer-scoped.

### E. Customer starts a new conversation
- **CURRENT:** Fresh conversation → both dedup stores empty → media re-sent. Same-day repeated contact re-sends identical media.
- **EXPECTED:** Arguably acceptable on a genuinely new session, but within minutes (customer reopens chat) it feels duplicated.
- **EVIDENCE:** conversation-scoped dedup (A–D).
- **GAP:** ARCHITECTURAL_GAP (no time-window heuristic anywhere; whether one is wanted is a Council decision).

### F. Customer returns hours/days later
- **CURRENT:** If a new conversation row is created (depends on the reuse window in `conversation/resolver.ts`), media re-sent. If the same conversation resumes, dedup still holds.
- **EVIDENCE:** `resolveConversation` reuse window (conversation-scoped).
- **GAP:** UNKNOWN — needs a live-DB probe of conversation reuse window (listed as open verification in 11-EVIDENCE_MATRIX).

### G. Product A → B → A again
- **CURRENT:** Media for A is deduped per conversation regardless of context switches: after A→B→A, A's media will NOT re-send (good for idempotency). But a natural re-ask ("¿me mostrás otra vez la de Clean Nails?") only works through `isResendRequest`, which requires literal foto/imagen words + a resend verb (media.ts:38-53).
- **EXPECTED:** Context return to A should not re-send automatically (correct today); natural re-asks should work.
- **EVIDENCE:** dedup tables + `isResendRequest`.
- **GAP:** PARTIAL — the natural-language path is keyword-hostage (ARCHITECTURAL_GAP, see 08-CUSTOMER_SIMPLICITY).

### H. Two triggers for the same product in one message
- **CURRENT:** `resolveConditionalMedia` selects at most one media per dispatch (ordering `created_at ASC`, conditional-media.ts:35); the second matching item is silently dropped — no tracking of "also matched".
- **EXPECTED:** Deterministic selection is fine, but the choice is by creation date, not relevance or `position` (image-core findings #10, #11).
- **GAP:** ARCHITECTURAL_GAP — no relevance ranking; position column ignored.

### I. Two different media items belong to the same product
- **CURRENT:** First match (oldest by created_at) wins; the other item is never sent this conversation even if more appropriate. `media_sent_products` blocks all further product media for that conversation.
- **GAP:** Ordering BUG-adjacent + design decision never formalized (no Council record).

### J. Same media item associated with multiple products
- **CURRENT:** Schema forces one `product_id` per knowledge_item (knowledge_items.sql:15, FK). A media row *cannot* belong to multiple products. However, multiple rows can duplicate the same `image_url` pointing at the same Storage object, each with a different product_id — dedup then treats them as *different* media and can send the same picture twice.
- **EVIDENCE:** `knowledge_items.sql:15,22`; dedup keyed by knowledge_item_id (not by image_url).
- **GAP:** ARCHITECTURAL_GAP — idempotency unit is the *row*, not the *asset*.

---

## 3. What Is the Smallest Reliable Idempotency Unit? (evidence, not intuition)

The evidence narrows the candidates:

1. **media_id (knowledge_item_id) + conversation_id** — what exists today. Fails J (same asset, multiple rows), fails D/E (cross-conversation).
2. **product_id + conversation_id** — what `media_sent_products` approximates. Fails generic media (product_id NULL), fails D/E.
3. **asset identity (storage object / content hash)** — the only unit invariant to row duplication. No support anywhere in the schema today.
4. **product_id + customer_id** — the only unit that survives channels (D) and new conversations (E/F). The `customers` table is shared across channels (`conversations.customer_id`), so the join key already exists. No schema support today.

**Evidence-backed conclusion:** the current system conflates two different idempotency questions:
- *"Did I already send this conversation this product's media?"* (served today, imperfectly)
- *"Did this customer already receive this asset, anywhere, recently?"* (NOT served)

The central hypothesis (context-first + idempotency) requires answering the second question; today's mechanism cannot answer it. This is the load-bearing finding for the PRD.

---

## 4. Race Conditions

- `addConversationMediaSentProduct` (`media-guard.ts:87`) is read-modify-write on a UUID[] column: two concurrent webhook deliveries (WhatsApp retries are common via the Baileys webhook path) can interleave and lose one append → duplicate media. Classify: BUG.
- `chat_media_dispatched` INSERT with UNIQUE constraint is atomic and is the *correct* pattern; the product-array mechanism should converge to this pattern (INFERENCE for the PRD, decision deferred to Council).

---

## 5. Summary Table

| Dimension | State |
|---|---|
| Per-conversation media dedup | ✅ exists (UNIQUE constraint), atomic |
| Per-conversation product dedup | ⚠️ exists, race-prone, path-dependent |
| Per-customer dedup | ❌ none |
| Per-asset dedup | ❌ none (row-keyed only) |
| Cross-channel dedup | ❌ none |
| Time-window heuristics | ❌ none |
| LLM feedback after suppression | ❌ none (core.ts:100-119) |
| Semantic trigger equivalence | ❌ none (keyword-only) |

**Classification counts:** FACT 12 · INFERENCE 2 · BUG 2 · ARCHITECTURAL_GAP 7 · PARITY_GAP 0 · UNKNOWN 1.

**Next:** `06-CONTEXT_TRANSITIONS.md`.
