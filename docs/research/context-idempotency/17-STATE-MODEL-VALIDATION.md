# 17 — State Model Validation (Adversarial Loop 2)

**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Status:** EVIDENCE_LOCKED — DISCOVERY ONLY

---

## 1. What state exists today

### Conversation state

| State | Where | Evidence |
|-------|-------|----------|
| conversation identity | `conversations.id` | `conversation/resolver.ts` — `resolveConversation(assistantId, customerId)` |
| media_sent_products | `conversations.media_sent_products UUID[]` | `media-guard.ts:74-98` (read + non-atomic append) |
| sales outcome / phase | `conversations.outcome`, `sales_cancelled_at` | `sales/process.ts:34-55, 514-554` |
| discount-offer sentinel | `sales_cancelled_at = 0001-01-01T00:00:01Z` | `sales/process.ts:34-55` |

### Customer state

| State | Where | Evidence |
|-------|-------|----------|
| identity (external_id, phone, email) | `customers` | `identity.ts:68-116` |
| name/phone/city/address | `customers` | `sales/process.ts:481-497` |
| semantic memory | `customer_memory` (via `ai/customer-memory.ts`) | read at prompt-build time; never used by media resolution |

### Product state

| State | Where | Evidence |
|-------|-------|----------|
| catalog | `products` (is_active, sku, image_url) | `schemas/public/tables/products.sql` |
| resolution per-message | `product-recommendation.ts:16-108` | trigger matches → name match → order-number match; **no persistence** |

### Media state

| State | Where | Evidence |
|-------|-------|----------|
| dispatch claim | `chat_media_dispatched` UNIQUE (knowledge_item_id, conversation_id) | `conditional-media.ts:98-114` |
| customer_id column | `chat_media_dispatched.customer_id` — WRITTEN, NEVER READ | `conditional-media.ts:104` |
| media catalog | `knowledge_items` (image_url, trigger_condition, media_type, product_id) | `schemas/.../knowledge_items.sql:12-15` |

### Transport state

| State | Where | Evidence |
|-------|-------|----------|
| none | channel adapters (`baileys.ts`, `web.ts`) hold no dispatch memory | send is fire-and-forget from runtime |

## 2. What state is missing

| Missing state | Consequence | Evidence |
|---------------|-------------|----------|
| active product across messages | product switches not tracked; A→B→A loses A | doc 04, 06 (Loop 1) |
| delivery confirmation | failed WhatsApp send permanently blocks retry | `core.ts:100-137` ordering |
| last media asset per conversation | resend requests re-resolve globally instead of "that one" | `media.ts:38-53` |
| explicit-request flag | no way to override dedup when customer explicitly asks again | no code path reads dedup for override |
| cross-channel customer dedup | WhatsApp vs WebChat dedup independently | `identity.ts:68-116` |
| context timestamp/source | stale context indistinguishable from fresh | nothing persists context |

## 3. What Loop 1 proposed

```ts
{ active_product_id, active_intent, presented_media_scope[] }  // owner: customers.id
```

## 4. What is actually necessary (post-attack)

| Field | Verdict | Rationale (evidence) |
|-------|---------|----------------------|
| `active_product_ids[]` (plural, ordered, 1..n) | **KEEP — amended from singular** | C-002: comparison messages need candidates or explicit suppression; product-recommendation already returns null on ambiguity |
| `active_intent` | **REMOVE from persistence** | C-004: derivable per message; triggers today are keywords, not intents |
| `presented_media_scope[]` | **REPLACE** with two precise pieces: `presented_assets[]` (asset-level, facts) and `last_media_asset` (resend semantics, C-008) | "scope" was ambiguous (ATTACK #13) |
| explicit scope in message | **NOT stored — computed per message** | C-001/C-005: it is a message property, not state |
| `context_updated_at` + `context_source` | **KEEP** | stale-context recovery (ATTACK #15/C-012); cheap, prevents wrong-product dispatch |
| owner | **conversation first, customer later** | C-003/C-007: identity fragmentation makes customer-owned state unsafe until merge exists |

**Minimum sufficient state (post-attack):**

```ts
{
  active_product_ids: UUID[],      // 0..n, ordered; [] = no active product
  context_updated_at: timestamp,
  context_source: 'explicit' | 'implicit' | 'none',
  last_media_asset: UUID | null    // per conversation
}
```

plus (unchanged, existing):

```text
chat_media_dispatched (knowledge_item_id, conversation_id, customer_id)  -- atomic claim
+ NEW: delivered_at | null   -- attempted vs received (C-006)
```

## 5. What must NEVER be persisted

| Item | Why |
|------|-----|
| per-message intent | derivable; persisting creates staleness bugs (C-004) |
| LLM's claimed media state | LLM output is not authoritative (C-010) |
| trigger vocabulary snapshots | triggers live in `knowledge_items`; duplicating invites drift |
| channel-specific media decisions | breaks parity invariant (doc 09) |

## 6. Layered ownership

| Layer | Owns |
|-------|------|
| Customer layer | identity, memory, long-term dedup (FUTURE — after identity hardening) |
| Conversation layer | active product context, last_media_asset, dispatch claims (TODAY) |
| Product layer | catalog, media catalog (`knowledge_items` rows) |
| Media layer | eligibility + selection rules (deterministic) |
| Transport layer | delivery confirmations → feed `delivered_at` |

---

**Next:** `18-CONTEXT-FIRST-DECISION-TABLE.md`