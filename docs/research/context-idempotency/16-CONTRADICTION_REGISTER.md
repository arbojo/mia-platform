# 16 — Contradiction Register (Adversarial Loop 2)

**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Status:** EVIDENCE_LOCKED — DISCOVERY ONLY
**Method:** each hypothesis of Loop 1 attacked with repository evidence; contradictions registered below with severity and required resolution.

---

## Register

| # | Hypothesis | Contradicting Evidence | Classification | Severity | Resolution |
|---|-----------|------------------------|----------------|----------|------------|
| C-001 | Context-first always works | `media.ts:11-26` `triggerMatches()` is invoked with NO product context; a message naming an explicit product ("muéstrame la imagen de Clean Nails") is resolved by keyword match only. Context-first with a stale/empty `active_product_id` would scope to the WRONG product. | CONTRADICTION | 🔴 HIGH | Context-first needs an **explicit-scope escape hatch**: explicit product mention in message > active context. |
| C-002 | One `active_product_id` is enough | `product-recommendation.ts:54-65`: 2+ trigger matches → `null` (no product). "¿Cuál me conviene más, Clean Nails o Neurotin?" is a REAL commercial case (comparison). Single ID cannot represent it. | CONTRADICTION | 🟠 HIGH | Context must support `active_product_ids[]` (ordered candidates) OR mark intent `comparison` with media suppressed. Minimum: plural-capable field. |
| C-003 | `customer × asset` is sufficient for idempotency | `conditional-media.ts:98-114`: dedup today is `(knowledge_item_id, conversation_id)` — customer_id is WRITTEN (line 104) but NEVER READ anywhere. Customer-level dedup does not exist. Also `identity.ts:68-116`: WebChat customers can fragment into multiple `customers.id` rows → customer-level dedup would silently re-send for the "same" human. | CONTRADICTION | 🔴 CRITICAL | Customer-level dedup is the right TARGET but is **unsafe until identity is stable**. Interim: keep conversation-level claim (atomic), add customer-level as advisory with explicit-request override. |
| C-004 | `active_intent` is required as persisted state | `intents.ts` derives intent per-message from message keywords (`detectIntent`); no persisted intent is read anywhere in media resolution. Eligibility keys on product scope + `media_type`, not intent (`conditional-media.ts`, `knowledge_items.media_type`). Same image IS valid for multiple intents (price/catalog). | CONTRADICTION | 🟡 MEDIUM | `active_intent` must be **derived per-message, never persisted** — it does not gate eligibility in any evidence path. Dropped from minimum state. |
| C-005 | Explicit scope solves ambiguity | Explicit product mention disambiguates PRODUCT, but NOT asset: if Clean Nails has hero+testimonial+usage images (ATTACK #13), explicit scope still needs an asset-selection rule. No evidence of deterministic asset ordering today (`conditional-media.ts` orders by `created_at ASC`; `position` column exists but unused — image-core finding #11). | CONTRADICTION | 🟡 MEDIUM | Explicit scope wins for PRODUCT; asset selection needs deterministic ordering (PROPOSED: `position`, then `created_at`). |
| C-006 | Atomic dedup prevents duplicate dispatch | `conditional-media.ts:98-114` upsert+ignoreDuplicates IS atomic per (item, conversation). BUT `media-guard.ts:87-98` `addConversationMediaSentProduct()` is read-then-write on `conversations.media_sent_products[]` — non-atomic, concurrent webhooks can drop entries. AND the claim is written **before** the channel send (`core.ts:100-137`), so a failed WhatsApp send is permanently marked "dispatched" — dedup then BLOCKS a legitimate retry. | CONTRADICTION + BUG | 🔴 CRITICAL | Claim must distinguish **attempted vs confirmed-delivered**; delivery confirmation is the dedup key for retries, claim-only for in-flight races. |
| C-007 | `customers.id` is stable cross-channel | `identity.ts:68-116`: resolution = external_id+channel → phone → email → create-new. WhatsApp links by phone; WebChat anonymous sessions create NEW customers with no phone/email → same human = 2+ ids. Customer-level idempotency inherits this fragmentation. | CONTRADICTION | 🟠 HIGH | State owner must tolerate identity merge later; store dedup under `customer_id` but design merge (re-point rows) as explicit operation. |
| C-008 | Same trigger → same response (statelessness OK) | `isResendRequest()` (`media.ts:38-53`) exists precisely because stateless matching re-sends on "otra vez / enséñamela de nuevo". Requires LAST-DISPATCHED memory to behave correctly. | FACT | 🟠 HIGH | Need `last_media_asset` (per conversation) for resend semantics — not derivable from triggers alone. |
| C-009 | "Recently" is definable now | No TTL, no time-window, no campaign concept anywhere in media resolution (no recency filter in `conditional-media.ts`). Any "recently" in the Loop-1 hypothesis is UNDEFINED. | UNKNOWN | 🟠 HIGH | Time semantics must be decided by Council; evidence supports only conversation-lifetime scoping today. |
| C-010 | Context must come from LLM only | `product-recommendation.ts` resolves product deterministically from triggers+names; `prompts.ts:141-144` injects `[IMAGEN_DISPONIBLE]` so the LLM also signals. Two authorities disagree silently (LLM claims image; runtime may not send — image-core finding #8). | CONTRADICTION | 🔴 CRITICAL | Context must be a **deterministic runtime artifact** derived from message+state; LLM informs intent/semantics but never owns eligibility. |
| C-011 | Global triggers must be replaced | Resend requests ("manda la foto otra vez") and generic requests ("¿tenés fotos?") work TODAY precisely because matching is global and message-local. A pure context-first model would break retry-after-context-loss. | CONTRADICTION | 🟠 HIGH | Triggers remain as message-local layer INSIDE a context gate (doc 12 Option C), not replaced. |
| C-012 | Purchased product dominates context | `sales/process.ts:514-554` post-SALE_WON: outcome becomes `sold`; no media gating afterwards. If A was purchased and customer uses a generic trigger, media for A may re-send even though the sale closed. | ARCHITECTURAL_GAP | 🟡 MEDIUM | Context phase (sold/post-sale) must gate generic media; explicit requests still pass. |

---

## Verdict from register

The hypothesis **survives only with amendments** (see doc 20):
1. explicit-scope > implicit context (C-001, C-005)
2. plural-capable product context (C-002)
3. conversation-level atomic claim stays; customer-level is target-state after identity hardening (C-003, C-007)
4. attempted ≠ received; dedup keyed on delivery for retries (C-006)
5. `active_intent` not persisted — derived (C-004)
6. time semantics: UNKNOWN, Council decision (C-009)

---

**Next:** `17-STATE-MODEL-VALIDATION.md`