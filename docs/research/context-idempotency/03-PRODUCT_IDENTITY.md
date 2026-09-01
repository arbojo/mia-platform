# 03 — Product Identity

**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Status:** EVIDENCE_LOCKED — DISCOVERY ONLY

---

## 1. Where product identity lives

| Representation | Form | Stable? | Evidence |
|---|---|---|---|
| `products.id` | UUID PK | ✅ Stable | `supabase/schemas/public/tables/products.sql:2` |
| `products.name` | TEXT | ⚠️ Mutable by owner | products.sql:4 |
| `products.image_url` | TEXT | ⚠️ DEPRECATED source | Loop termination report; still read at product-recommendation.ts:124 (finding #17) |
| `knowledge_items.product_id` | UUID FK (SET NULL on delete) | ⚠️ Breaks on product delete | knowledge_items.sql:22 |
| `messages.metadata.product_id` | JSONB | ⚠️ Advisory only | messages schema; persisted for product cards (TASK-20260813) |
| `conversations.media_sent_products` | UUID[] | ⚠️ Idempotency only, no semantics | migration 038 |
| `sales_events` product | Name string (`productName`), not FK | ❌ Not stable identity | sales/process.ts:471-472 passes `product` (name) |
| Product recommendation result | Volatile per message | ❌ Not persisted | core.ts:86-98 |

## 2. Identity breakpoints (evidence)

1. **`ON DELETE SET NULL`** on `knowledge_items.product_id` (knowledge_items.sql:22): deleting a product silently converts its product-scoped media into **generic media with the same trigger_condition** → cross-product trigger contamination (image-core finding #3, Clean Nails product_id=NULL). Classification: **ARCHITECTURAL_GAP**.
2. **Sales events store product as a name string** (process.ts:471 `productName: product`), matched upstream by name. Rename = identity break. Classification: **FACT** (weakest link in lifecycle).
3. **Two image sources**: `products.image_url` (deprecated) and `knowledge_items.image_url` (source of truth per product-assets decision). Resolution cascade at product-recommendation.ts:124 still reads the deprecated column. Classification: **BUG-class residue / PARITY_GAP**.
4. **No lifecycle entity** ties "customer ↔ product under discussion". `media_sent_products` is the closest thing and it means only "media was sent", not "this is the active product".

## 3. Smallest reliable unit for media idempotency — candidate comparison (evidence-based)

| Candidate | Supported by evidence? | Analysis |
|---|---|---|
| `media_id` (knowledge_item_id) | ✅ Existing: `chat_media_dispatched UNIQUE(knowledge_item_id, conversation_id)` (migration 016) | Prevents exact media repeat **per conversation**. Fails across conversations/channels (new conversation = no record). Cannot distinguish "two media for same product" spam (fixed by #media_sent_products) |
| `product_id` | ❌ Alone insufficient | A product may legitimately have several media (image + testimonial); pure product dedup would block the testimonial after the image |
| `product_id + conversation_id` | ✅ Existing: `conversations.media_sent_products` | Blocks any further media of an already-illustrated product within the conversation. Evidence of intent: migration 038 ("regla de envio unico de imagen por producto/sesion") |
| `product_id + customer_id` | ❌ No table supports it | Would suppress re-illustration in future conversations; no evidence the business wants that; would also break the legitimate "new conversation, same product re-explained" case |
| `product_id + commercial_context` | ❌ No context entity exists | Requires the very state this investigation proposes; can't be evaluated against current code |
| `media_id + conversation_id` (status quo pair) | ✅ | The implemented design |

**Evidence verdict**: the two implemented keys — `(knowledge_item_id, conversation_id)` and `(product_id, conversation_id)` — are **conversation-scoped**. Every idempotency mechanism in the codebase keys on `conversation_id`, never `customer_id`. That is a consistent, deliberate design (media dedup = per conversation session). The missing piece is not a different key; it is that **"active product" itself is not persisted anywhere**, so product-scoped dedup only fires when the per-message product guess happens to succeed.

**Answer to "smallest reliable unit"**: `conversation_id` as scope, with two keys inside it: the **media item** (`knowledge_item_id`) for exact-media dedup and the **product** (`product_id`) for per-product illustration dedup — plus one **new** piece of state that does not exist today: a persisted `active_product_id` per conversation, without which the product key is only intermittently computable.