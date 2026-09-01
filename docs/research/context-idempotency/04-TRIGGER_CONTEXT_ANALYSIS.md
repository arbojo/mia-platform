# 04 — Trigger vs Context Analysis

**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Status:** EVIDENCE_LOCKED — DISCOVERY ONLY

---

## 1. Mechanics (FACT, media.ts:11-53)

- `triggerMatches(message, trigger)`: normalize (lowercase, strip accents, collapse spaces) → split trigger by `,` → whole-word regex per part with plural tolerance `(?:s|es)?`. Any part matching ⇒ true.
- `intentMatchesTrigger(intentTag, trigger)`: exact `intent {tag}` part match.
- `isResendRequest(message)`: media word (`imagen|foto...`) + resend verb (`reenvia|manda|pasa...` or `otra vez|de nuevo`).
- `detectIntent` (intents.ts): substring matching — different false-positive profile from whole-word `triggerMatches` (documented divergence, image-core 04 §11.2).

## 2. Are triggers evaluated globally? — YES (FACT)

When no product is resolved for the message (`resolveRecommendedProduct` → null), `resolveConditionalMedia` queries **generic media** (`product_id IS NULL AND trigger_condition IS NOT NULL`) and tests `triggerMatches(rawUserMessage, trigger)` (conditional-media.ts:14+). There is:

- no conversation-phase gate,
- no "previous product" gate,
- no LLM-confirmed-need gate,
- no negative/rejected-product filter.

**Triggers are global string tests against every inbound message.** Classification: FACT.

## 3. Case-by-case behavior (evidence + inference)

Each case states what the code does. Verification method: code trace at HEAD.

| # | Scenario | Current behavior | Why |
|---|---|---|---|
| 1 | Trigger for Product A in message | If A resolved (name/intent match) → A-scoped media (MEDIA_INVARIANT). If A NOT resolved → generic triggers tested globally; A's media is invisible (product-scoped excluded when productId null) | conditional-media.ts product branch |
| 2 | Triggers for A and B in one message | Product resolver returns **one** product (`.find()` first match, product-recommendation cascade); media of the other product never considered this turn | INFERENCE from single-return contract core.ts:86 |
| 3 | Generic media language ("mandame la foto") | Generic trigger match, global; if the intended product isn't guessed, generic or wrong media | FACT |
| 4 | Sentence mentioning multiple products | Only first/resolver-preferred product gets media | INFERENCE (single product contract) |
| 5 | Product name + unrelated trigger words | Product-scoped media (invariant ignores message keywords entirely when product known — trigger not even consulted for product-scoped items unless product_id IS NULL... product media requires product_id match) | FACT (invariant) |
| 6 | Trigger referring to previously discussed product | No memory of it; only works if the message re-resolves the product. "¿Me la muestras?" (no name, no keyword) → product null → only generic triggers tested | ARCHITECTURAL_GAP |
| 7 | Trigger referring to rejected product | No rejected-product concept; trigger fires normally | ARCHITECTURAL_GAP |
| 8 | Trigger for newly introduced product | Works only via full name/keyword coincidence in resolver; otherwise falls to generic pool | FACT |

## 4. Cross-contamination answers

- **Can one message activate media of multiple products?** No — resolution returns at most one media item per turn, and product resolution returns at most one product. Classification: FACT (by construction, not by understanding).
- **Can old context accidentally activate a new trigger?** There IS no old context — so nothing old can activate, but equally nothing old can *inform*. The failure is amnesia, not haunting. Classification: FACT/ARCHITECTURAL_GAP.
- **Can a new product inherit an old trigger?** Only via the generic pool (`product_id IS NULL`) — shared by all products (image-core 04 §11.6). E.g. generic trigger `"envio"` illustrates with the generic image regardless of which product is active. Product deletion (`SET NULL`) migrates product media INTO this shared pool. Classification: **BUG-adjacent** (documented in image-core finding #3).

## 5. Verdict on hypothesis premise

"Does MIA know which product is currently relevant?" — **Only within a single message, via a fragile per-message guess, and never across turns.** The contextual half of the hypothesis has no implementation to refute; it is absent.