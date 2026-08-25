# Council Decision Contract — Product Asset Ownership & Dashboard UX

**Decision ID**: DEC-20260825-PRODUCT-ASSETS
**Date**: 2026-08-25
**Status**: DECISION_ACCEPTED
**Parent**: PRODUCT_ASSET_OWNERSHIP_RESEARCH.md
**Governance**: COUNCIL_REQUIRED (Complex cross-domain architecture decision)

---

## 1. Problem Statement

MIA has two competing product-image storage paths:
1. `products.image_url` — a single TEXT column, only written by the import engine
2. `knowledge_items.image_url` — media items in the knowledge system, written by the upload UI

The customer encounters two dashboard entry points (Catalog Product Detail + Knowledge Center Multimedia) that both write to `knowledge_items`. Meanwhile, the runtime prefers `products.image_url` over knowledge media. This creates confusion: different screens show different images for the same product.

---

## 2. Verified Findings

### 2.1 Dual Storage Paths — CONFIRMED

| Attribute | `products.image_url` | `knowledge_items.image_url` |
|-----------|---------------------|---------------------------|
| Written by | Import engine only | MediaBrowser upload UI |
| Read by | Runtime (primary) | Catalog thumbnails, conditional media, prompts |
| Storage | External URL | Supabase Storage `knowledge-media` |
| Multiple images | No (single column) | Yes (multiple rows) |

### 2.2 Runtime Resolution — CONFIRMED

`product-recommendation.ts:102-128`:
```
product.image_url (products table) → knowledge_items.image_url (fallback) → null
```

The product's own `image_url` is preferred. Knowledge media is only a fallback.

### 2.3 Two UI Entry Points — CONFIRMED

- **Catalog Product Detail** → `ProductMedia` → `MediaBrowser` → `knowledge_items` (scoped to product)
- **Knowledge Center Multimedia tab** → `MediaLibrary` → `MediaBrowser` → `knowledge_items` (all media)

Both use the same underlying component and write to the same table.

### 2.4 `products.image_url` is Effectively Dead — CONFIRMED

No upload UI writes to `products.image_url`. Only the import engine populates it. The column exists but is not part of any customer-facing upload flow.

### 2.5 Orphaned Storage on Soft-Delete — CONFIRMED

Soft-deleting a knowledge item (`is_active = false`) does NOT remove the file from Supabase Storage. Files accumulate indefinitely.

---

## 3. Deliberation: D1 — Source of Truth

**Question**: Which system should be the canonical source of truth for product images?

**Options**:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | `products.image_url` as primary, knowledge as supplementary | Runtime already prefers it; clear hierarchy | Import-only write path; no upload UI for single image |
| B | `knowledge_items` as primary, `products.image_url` as read-only cache | Already the write target; supports multiple images | Runtime prefers wrong source; needs resolution change |
| C | `knowledge_items` as primary, `products.image_url` deprecated | Clean; single source; no dual-path | Requires runtime change + import migration |

**Decision**: **Option C** — `knowledge_items` is the single source of truth.

**Rationale**:
1. `knowledge_items` already supports multiple images per product (gallery)
2. The upload UI already writes to `knowledge_items`
3. `products.image_url` has no upload UI — it's effectively dead
4. The import engine should migrate to writing `knowledge_items` rows (with `product_id` + `trigger_condition = null`)
5. Runtime resolution should change to: `knowledge_items WHERE product_id = X ORDER BY created_at LIMIT 1`

**Modification**: Deprecate `products.image_url` — do NOT drop the column. Mark as deprecated in schema comments. Import engine writes `knowledge_items` rows instead.

---

## 4. Deliberation: D2 — UX Entry Points

**Question**: How many entry points should the customer use to manage product images?

**Analysis**:

The customer has two needs:
1. Manage images for a specific product (product-centric)
2. Manage all media assets for the business (business-centric)

These are different intents. The customer should NOT need to think about which system stores the images.

**Decision**: **Two entry points, one mental model**.

### Entry Point 1: Product Detail > Images (Primary)

- Customer manages images for ONE product
- Shows all `knowledge_items` linked to that product
- Upload, edit, delete, reorder
- This is the canonical entry point for product images

### Entry Point 2: Knowledge Center > Multimedia (Secondary)

- Customer manages ALL media for the business
- Shows product-bound + generic media
- Upload with optional product association
- This is for business-level assets (testimonials, flyers, generic images)

**Key Rule**: Both entry points write to the same `knowledge_items` table. No data duplication.

---

## 5. Deliberation: D3 — Image Deletion

**Question**: What happens when a customer deletes a product image?

**Decision**: **Cascade deletion** — soft-delete the knowledge item AND delete the Storage file.

**Implementation**:
1. `knowledge_items.is_active = false` (soft-delete)
2. Delete file from `knowledge-media` Storage bucket
3. Remove from `chat_media_dispatched` (if dispatched)
4. Runtime skips soft-deleted items (already implemented)

**Rationale**: Prevents orphaned storage accumulation. The current soft-delete-only approach leaves files in Storage indefinitely.

---

## 6. Deliberation: D4 — Image Ordering

**Question**: Should customers be able to reorder product images?

**Decision**: **Yes, add ordering**.

**Implementation**:
1. Add `position INT` column to `knowledge_items` (nullable, default = created_at-based)
2. Product Detail page shows images in `position` order
3. Customer can drag-to-reorder
4. Runtime picks the first image (lowest position or oldest) as the "primary" for that product

---

## 7. Deliberation: D5 — Import Engine Migration

**Question**: How should the import engine be updated?

**Decision**: **Migrate import to write `knowledge_items` rows**.

**Implementation**:
1. Import engine creates `knowledge_items` row with:
   - `product_id` = product UUID
   - `image_url` = external URL (from CSV/WooCommerce/scrape)
   - `trigger_condition` = null (not a conditional media)
   - `media_type` = 'image'
   - `business_id` = tenant UUID
2. `products.image_url` remains as deprecated column (read-only)
3. No change to Storage — imported images keep external URLs

**Rationale**: Unifies the write path. All product images flow through `knowledge_items`.

---

## 8. Deliberation: D6 — Security Implications

**Question**: Are there new security risks from this change?

**Analysis**:

| Risk | Status | Notes |
|------|--------|-------|
| Cross-tenant access | NO NEW RISK | RLS on `knowledge_items` already enforces tenant isolation |
| Storage deletion | NEW | Must verify auth + ownership before deleting Storage files |
| URL ownership validation | EXISTING LOW | Import writes external URLs; no SSRF risk (customer-provided) |
| Orphaned storage | IMPROVED | Cascade deletion prevents accumulation |

**Decision**: **ACCEPT** — No new critical security risks. Storage deletion requires auth + ownership check (standard pattern).

---

## 9. Deliberation: D7 — Runtime Resolution Change

**Question**: How should runtime resolve the product image?

**Current**: `product.image_url` (primary) → `knowledge_items.image_url` (fallback)

**New**: `knowledge_items.image_url WHERE product_id = X AND is_active = true ORDER BY position ASC NULLS LAST, created_at ASC LIMIT 1`

**Decision**: **ACCEPT** — Runtime queries `knowledge_items` directly.

**Rationale**: Single source, no fallback needed. The `position` column determines which image is "primary."

---

## 10. Adversarial Review

| # | Scenario | Architecture Response | Verdict |
|---|----------|----------------------|---------|
| 1 | Customer imports product with external image URL | Import writes `knowledge_items` row; runtime resolves via `knowledge_items` | PASS |
| 2 | Customer uploads image for product | `MediaBrowser` writes `knowledge_items` row; same table, same resolution | PASS |
| 3 | Customer deletes product image | Soft-delete + Storage deletion; runtime skips deleted items | PASS |
| 4 | Customer reorders images | `position` column; runtime picks lowest position as primary | PASS |
| 5 | Customer views Knowledge Center | Shows all `knowledge_items` (product-bound + generic); same data | PASS |
| 6 | Customer views Product Detail | Shows only `knowledge_items WHERE product_id = X`; scoped | PASS |
| 7 | Imported image URL becomes stale | External URL may break; customer re-imports or uploads | ACCEPTED |
| 8 | Customer deletes product | `ON DELETE SET NULL` on `product_id` FK; images become generic | PASS |
| 9 | Concurrent upload + import | Both write `knowledge_items`; no conflict (different rows) | PASS |
| 10 | Storage deletion fails | Log error; soft-delete still succeeds; manual cleanup possible | PASS |

**All 10 scenarios PASS.**

---

## 11. Decision

**DECISION**: **ACCEPT — Unified `knowledge_items` as single source of truth for product images.**

With the following implementation:
1. `knowledge_items` is the canonical source for all product images
2. `products.image_url` is deprecated (column remains, no writes from UI)
3. Import engine migrates to write `knowledge_items` rows
4. Runtime queries `knowledge_items WHERE product_id = X` (no fallback)
5. Image deletion cascades: soft-delete row + delete Storage file
6. New `position INT` column for image ordering
7. Two UX entry points (Product Detail + Knowledge Center) with one mental model

---

## 12. Invariants

| ID | Invariant | Failure Behavior |
|----|-----------|-----------------|
| INV-ASSET-001 | Every product image MUST be stored in `knowledge_items` with `product_id` set | Block |
| INV-ASSET-002 | Runtime MUST resolve product image from `knowledge_items`, not `products.image_url` | Block |
| INV-ASSET-003 | Image deletion MUST cascade: soft-delete row + delete Storage file | Block |
| INV-ASSET-004 | `products.image_url` MUST NOT be written by any upload UI | Block |
| INV-ASSET-005 | Product Detail page MUST show images scoped to `product_id` | Block |
| INV-ASSET-006 | Knowledge Center MUST show all media (product-bound + generic) | Block |
| INV-ASSET-007 | Image ordering MUST use `position` column (nullable, default NULL) | Block |
| INV-ASSET-008 | Import engine MUST write `knowledge_items` rows, not `products.image_url` | Block |

---

## 13. Acceptance Criteria

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Single source of truth | 0 writes to `products.image_url` from UI | Code audit |
| Runtime resolution | 100% from `knowledge_items` | Code audit |
| Image deletion cascade | 100% of deletions remove Storage file | Manual test |
| Customer confusion | 0 "where are my images?" support tickets | Support tracking |
| Orphaned storage | 0 files without active `knowledge_items` row | Storage audit |

---

## 14. Implementation Authorization

**AUTHORIZED**: Yes, with the following conditions:
1. All 8 invariants must be enforced
2. Schema migration adds `position INT` to `knowledge_items`
3. Import engine writes `knowledge_items` rows
4. Runtime resolves from `knowledge_items`
5. Image deletion cascades (soft-delete + Storage)
6. Two UX entry points with consistent behavior

**NOT AUTHORIZED**:
- Dropping `products.image_url` column
- Changing Storage bucket structure
- Modifying conditional media dispatch logic
- Changing WhatsApp delivery flow

---

## 15. Dissenting Opinions

**None recorded.** The Council reaches unanimous decision.

---

**Decision recorded**: 2026-08-25
**Decision authority**: Engineering Council
**Status**: DECISION_ACCEPTED — Implementation Authorized
