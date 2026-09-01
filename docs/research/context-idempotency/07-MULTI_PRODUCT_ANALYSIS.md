# 07 — Multi-Product Analysis

**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Status:** EVIDENCE_LOCKED (DISCOVERY ONLY)

---

## 1. Does the System Distinguish Product Roles?

| Role | Represented? | Evidence |
|------|-------------|----------|
| PRIMARY PRODUCT | ❌ No field. *De facto* primary = whatever the current message resolves to | `core.ts:86-98` — resolution from `userMessage` only |
| SECONDARY PRODUCT | ❌ | `resolveRecommendedProduct` returns a single product (`product-recommendation.ts:16` return type) |
| PREVIOUS PRODUCT | ❌ | Nothing persisted per conversation (schema review, doc 06 §3) |
| REJECTED PRODUCT | ❌ | No rejection record in any table (schema review; `sales_events` has outcomes, not per-product rejections) |
| COMPLEMENTARY PRODUCT | ❌ | No relation/bundle concept in `products` schema (`supabase/schemas/public/tables/products.sql:1-18`) |

**FACT:** All products exist as a **flat set of active candidates**
(`products WHERE is_active=true`) scanned by keyword matching per message.

## 2. Scenario Tests (repository behavior)

### A → B
Message names A → A resolved, A media dispatched (M1/M2 updated). Next message names
B → B resolved, B media dispatched. Works. ✔ (per-message re-derivation is
sufficient when every message names the product.)

### A → B → A
Works for text. A media blocked by M2 (conversation-scoped). Customer asking to
*see again* must use resend wording ("mandame la foto"). ⚠ (doc 06 §2).

### A + B in same message ("¿cómo funcionan Clean Nails y Bye Canas?")
- `resolveRecommendedProduct` returns **one** product (first keyword match in
  iteration order; ordering `created_at`/priority — `product-recommendation.ts:108`).
- Media: MEDIA_INVARIANT scopes to the single winner → media for the loser product
  never considered this turn.
- **Result:** arbitrary single winner; no multi-product turn. 🔴 ARCHITECTURAL_GAP.

### A rejected → B accepted
- No rejection state; A behaves identically to any other product. If customer later
  mentions A accidentally ("¿el Clean Nails era el que manchaba?"), product
  resolution will match A again and could dispatch A media (if not yet sent) —
  media for a rejected product. 🔴.

### A purchased → B upsell
- Post-SALE_WON, conversation continues; no purchase-scoped product state is
  consulted by the media pipeline. `sales_events` stores `product_name` (string,
  `sales/events.ts`) but nothing reads it for media. Upsell B behaves like any
  product mention. Media dedup is unaffected (correct). Missing: notion that A is
  *owned* → A media re-requests should be fulfillment-related, not sales. ⚠ UNKNOWN
  product behavior (LLM prompt has no ownership state either).

### A discussed → unrelated product mentioned in passing
- "Mi vecina usa Bye Canas pero yo quiero el Clean Nails" →
  `mentionsOtherProduct`-style filtering exists ONLY in landing context
  (`knowledge.ts:129-206`), NOT in the runtime media path. Product resolution sees
  both names → winner is iteration-order dependent → possible wrong-product media. 🔴

## 3. Where Does Product Context Live Today?

| Location | Present? | Evidence |
|----------|----------|----------|
| Current message | ✔ (transient, recomputed) | `core.ts:86-98` |
| Landing context | ✔ (explicit `productId` override) | `knowledge.ts:111-116`, `core.ts:93` |
| `messages.metadata.product_id` | ✔ (written by web card feature) — **never read by media pipeline** | web-card task record; no reader found in runtime |
| `conversations` | ✖ | schema |
| `customers` | ✖ (memory text may mention products, unstructured, injected to LLM only — not to deterministic pipeline) | `customer-memory.ts:1-120` |
| `sales_events` | ✔ (post-hoc, string names, unused by media) | `sales/events.ts` |

**CONCLUSION:** Product context is **message-scoped**, with one explicit override
(landing) and one write-only trace (web card metadata). There is no durable
primary/secondary model.

## 4. Minimum Concepts the Evidence Demands

For correct multi-product behavior, the data shows a need for exactly:

1. **Active product set per conversation** (ordered: primary first) — covers
   A+B-in-one-message (primary = most recent/confirmed, secondary = secondary),
   A→B→A (history), passing mentions (rank by confirmation, not keyword order).
2. **Per-product lifecycle flag**: `discussed | rejected | sold` — covers
   rejected-product media suppression and post-sale semantics.
3. **Media dispatch granularity decision**: per product (current M2) vs per media
   item (M1) vs per (product, media) pair — required to fix case I of doc 05.

Anything richer (phases, intents per product, bundles) is NOT demanded by any
observed failure; it would be speculative (see doc 12 Option C).
