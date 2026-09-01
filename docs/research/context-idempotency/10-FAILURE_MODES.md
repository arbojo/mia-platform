# 10 — Failure Modes

**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Status:** EVIDENCE_LOCKED — DISCOVERY ONLY

Catalog of concrete failure modes induced by the current global-trigger
model, each with mechanism and evidence. Codes reused by 11-EVIDENCE_MATRIX
and 15-FINAL_INVESTIGATION_REPORT.

---

## F1 — False Promise (LLM claims, runtime denies) 🔴

- **Mechanism**: prompt says `[IMAGEN_DISPONIBLE]`; LLM answers "¡claro, te
  mando la foto!"; deterministic resolver fails to match trigger; no media
  is attached; no feedback loop corrects the text.
- **Files**: prompts.ts:135-144; conditional-media.ts:14-82; core.ts:100-119.
- **Class**: BUG (claim/execution invariant violated) — image-core #8.

## F2 — Silent No-Media on Morphology 🔴

- **Mechanism**: whole-word matching without stemming; diminutives /
  conjugations / typos fail; nothing tells the customer why.
- **File**: media.ts:11-26.
- **Class**: BUG (product-visible silent failure).

## F3 — Cross-Product Trigger Ambiguity (contamination) 🔴

- **Mechanism**: generic media (`product_id IS NULL`) with trigger `"precio"`
  matches while discussing ANY product; if two products' items share a
  trigger and product resolution is ambiguous, MEDIA_INVARIANT forces
  `product_id = X OR NULL` only when a product IS resolved — ambiguity →
  null product → only generic media (acceptable), but when product
  resolution is WRONG (keyword cascade false positive), media of the wrong
  product can be sent.
- **Files**: conditional-media.ts (product filter); product-recommendation.ts:16-100 (cascade).
- **Class**: ARCHITECTURAL_GAP — image-core #7.

## F4 — Duplicate Media Across Conversations 🟡

- **Mechanism**: dedup keys include `conversation_id`; new conversation (new
  session, channel switch, days later) re-sends identical media to same
  customer.
- **Files**: migration 016 (UNIQUE includes conversation_id); migration 038 (media_sent_products is a conversations column).
- **Class**: FACT (behavior), potential BUG (product intent) — idempotency cases D/E/F.

## F5 — Resend Dead-End 🟡

- **Mechanism**: re-ask requires media word ("foto/imagen"); "otra vez"
  alone is not a resend; even with media word, per-item UNIQUE blocks the
  re-send unless `isResend=true` bypass is reached — and the bypass depends
  on `isResendRequest` lexical detection.
- **Files**: media.ts:38-53; core.ts:110; migration 016.
- **Class**: BUG.

## F6 — Non-Atomic Product-Dedup Append 🟡

- **Mechanism**: `addConversationMediaSentProduct` reads the array, appends
  in JS, writes back; concurrent messages (customer double-send, webhook
  retry) can lose an update → duplicate product media.
- **File**: media-guard.ts:87.
- **Class**: BUG (race) — image-core #16.

## F7 — Media Ordering Inconsistency 🟡

- **Mechanism**: conditional media orders by `created_at ASC`; product
  recommendation orders by `position` — two sources of truth for "which
  media is primary".
- **Files**: conditional-media.ts:35 vs product-recommendation.ts:108.
- **Class**: BUG — image-core #10, #11.

## F8 — Deprecated Dual Image Source 🟡

- **Mechanism**: `products.image_url` still populated by import engine and
  read as fallback; knowledge_items is declared source of truth.
- **Files**: product-recommendation.ts:124; engine.ts:83-87.
- **Class**: BUG — image-core #17, #18.

## F9 — No Observability of Media Decisions 🟠

- **Mechanism**: no logs/metrics for resolve → match/no-match → dedup-skip →
  send; incidents cannot be diagnosed.
- **Class**: ARCHITECTURAL_GAP — image-core #19, #20.

## F10 — Context Amnesia Across Turns 🟠

- **Mechanism**: no persisted "active product" or per-conversation product
  history; every message re-runs a stateless keyword cascade; "¿y ese cómo
  funciona?" resolves to nothing.
- **Files**: core.ts:86-98 (per-message resolution); no conversation-scoped product state in schema (conversations.sql has none).
- **Class**: ARCHITECTURAL_GAP.

## F11 — Dead/Inactive Data Served or Blocking 🟠

- **Mechanism**: inactive items excluded by `is_active` filter (good), but
  misclassified items (testimonial typed as image, image with product_id
  NULL) produce wrong or orphan media; cleanup is manual (image-core #3-#5).
- **Class**: BUG (data quality).

## F12 — Multi-Product Message Races 🟠

- **Mechanism**: message naming two products with two matching triggers —
  one media wins (ordering by created_at), other silently dropped; no
  queueing for later turns.
- **Files**: conditional-media.ts query + `.limit` semantics; media.ts triggerMatches (any-match boolean).
- **Class**: ARCHITECTURAL_GAP.

---

## Summary Table

| Code | Failure | Customer-visible effect | Severity | Class |
|---|---|---|---|---|
| F1 | False promise | "te la mando" + nothing arrives | 🔴 | BUG |
| F2 | Morphology miss | Media never comes | 🔴 | BUG |
| F3 | Wrong-product media | Irrelevant image | 🔴 | ARCH_GAP |
| F4 | Cross-conversation dup | Same image repeated | 🟡 | FACT |
| F5 | Resend dead-end | Re-ask ignored | 🟡 | BUG |
| F6 | Dedup race | Occasional dup | 🟡 | BUG |
| F7 | Ordering split | Arbitrary media choice | 🟡 | BUG |
| F8 | Dual image source | Stale/wrong image | 🟡 | BUG |
| F9 | No observability | Undiagnosable | 🟠 | ARCH_GAP |
| F10 | Context amnesia | "ese" unresolved | 🟠 | ARCH_GAP |
| F11 | Data quality | Wrong/orphan media | 🟠 | BUG |
| F12 | Multi-product race | One of two medias lost | 🟠 | ARCH_GAP |

**Next**: `11-EVIDENCE_MATRIX.md`
