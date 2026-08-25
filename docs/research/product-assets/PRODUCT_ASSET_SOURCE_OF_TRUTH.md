# Product Asset Source of Truth Matrix

**Date**: 2026-08-25
**Mission**: Product Asset Ownership & Dashboard UX

---

## Principle

Every product asset attribute must have exactly **ONE authoritative source**. Consumers may reference but must not compete.

---

## Source of Truth Matrix

| Attribute | Authoritative Source | Consumers | Notes |
|-----------|---------------------|-----------|-------|
| **Product name** | `products.name` | Catalog UI, Knowledge, MIA prompts, Import | Single column, single source |
| **Product price** | `products.price` | Catalog UI, Knowledge, MIA prompts, Import | Single column, single source |
| **Product description** | `products.description` | Catalog UI, Knowledge, MIA prompts, Import | Single column, single source |
| **Product SKU** | `products.sku` | Catalog UI, Import | Single column, single source |
| **Primary image URL** | `products.image_url` | Runtime (primary resolution) | **PROBLEM**: Only import writes here; no upload UI |
| **Gallery images** | `knowledge_items.image_url WHERE product_id = products.id` | Catalog thumbnails, conditional media, prompts | Multiple rows per product |
| **Image trigger condition** | `knowledge_items.trigger_condition` | Runtime (keyword matching) | N/A for product-bound (optional) |
| **Image media type** | `knowledge_items.media_type` | Runtime, UI badges | 'image' or 'testimonial' |
| **Image ordering** | `knowledge_items.created_at` | Catalog (implicit order) | No explicit ordering column |
| **Image deletion** | `knowledge_items.is_active = false` | Soft delete only | **PROBLEM**: Storage file NOT deleted |
| **Image storage bytes** | Supabase Storage `knowledge-media` bucket | Public URL consumers | Infrastructure, not authority |
| **Image metadata** | `knowledge_items` row | All consumers | question, answer, source, confidence |
| **Product-image link** | `knowledge_items.product_id` FK | Catalog, runtime, prompts | ON DELETE SET NULL |
| **Dispatch history** | `chat_media_dispatched` | Runtime (dedup) | One-time-per-conversation |
| **Product session state** | `conversations.media_sent_products` | Runtime (per-product dedup) | UUID array |

---

## Identified Conflicts

### Conflict 1: Primary Image

| Source | Value | Authority |
|--------|-------|-----------|
| `products.image_url` | External URL from import | Runtime prefers this |
| `knowledge_items.image_url WHERE product_id = X` | Uploaded image | Catalog uses this for thumbnails |

**Impact**: Customer imports product with external URL → runtime sends that image. Customer later uploads media → catalog shows uploaded image, but runtime still sends the imported one.

**Resolution required**: Define which is the canonical "product image."

### Conflict 2: No Explicit Ordering

Gallery images have no `position` or `sort_order` column. Order is implicit via `created_at`. This means:
- No customer control over image ordering
- Reordering requires deleting and re-creating

### Conflict 3: Orphaned Storage

Soft-deleting a knowledge item (`is_active = false`) does NOT remove the file from Supabase Storage. Over time, storage accumulates orphaned files with no cleanup mechanism.

---

## Recommended Target State

| Attribute | Target Source | Migration Path |
|-----------|--------------|----------------|
| **Primary image** | `products.image_url` (managed by Catalog) | Import writes here; upload UI also writes here |
| **Gallery images** | `knowledge_items WHERE product_id = products.id` | Already correct |
| **Image ordering** | New `knowledge_items.position INT` column | Migration required |
| **Image deletion** | Cascade: soft-delete row + delete Storage file | New cleanup logic |
| **Knowledge reference** | `knowledge_items` (read-only for knowledge purposes) | Already correct |
| **MIA consumption** | Read from `knowledge_items` via runtime | Already correct |
