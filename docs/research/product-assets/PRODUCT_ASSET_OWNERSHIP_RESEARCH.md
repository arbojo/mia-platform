# Product Asset Ownership Research — Current State Audit

**Date**: 2026-08-25
**Mission**: Product Asset Ownership & Dashboard UX
**Type**: Read-only architecture research

---

## Executive Summary

MIA has **two competing product-image storage paths** that create ambiguity for the customer:

1. **`products.image_url`** — a single TEXT column on the products table
2. **`knowledge_items.image_url`** — media items in the knowledge system, optionally linked to products via `product_id`

The customer encounters **two dashboard entry points** for managing product images:
- **Catalog > Product Detail > Media section** (via `ProductMedia` → `MediaBrowser`)
- **Knowledge Center > Biblioteca Multimedia tab** (via `MediaLibrary` → `MediaBrowser`)

Both entry points use the **same underlying component** (`MediaBrowser`) and write to the **same database table** (`knowledge_items`). However, the existence of `products.image_url` creates a second source of truth that is only populated by the import engine, never by any upload UI.

---

## 1. Image Storage Architecture

### 1.1 Two Storage Paths

| Path | Table | Column | Written By | Read By |
|------|-------|--------|-----------|---------|
| **Product-native** | `products` | `image_url TEXT` | Import engine only | `product-recommendation.ts` (primary), runtime |
| **Knowledge-media** | `knowledge_items` | `image_url TEXT` | `MediaBrowser` (upload UI) | Catalog thumbnails, conditional media, prompts |

### 1.2 Storage Bucket

| Bucket | Purpose | Visibility | Path Convention |
|--------|---------|------------|-----------------|
| `knowledge-media` | Product/media images sent to customers | Public read | `{businessId}/{uuid}.{ext}` |
| `delivery-evidence` | Driver proof-of-delivery photos | Signed URLs (5min TTL) | `{businessId}/{driverId}/{orderId}/{uuid}.{ext}` |

### 1.3 Runtime Image Resolution

`product-recommendation.ts:102-128`:
```
product.image_url (products table)
  → knowledge_items.image_url WHERE product_id = product.id (fallback)
  → null
```

The product's own `image_url` is **preferred**. Knowledge media is only a fallback.

---

## 2. UI Entry Points

### 2.1 Entry Point 1: Catalog Product Detail

**Path**: `/dashboard/catalog/[id]`
**Component**: `ProductDetail.tsx` → `ProductMedia.tsx` → `MediaBrowser.tsx`

- Shows media scoped to `product.id`
- User uploads image → `MediaUpload` → `POST /api/knowledge/media/upload` → Storage
- User creates media item → `POST /api/knowledge/items` with `image_url`, `product_id`, `trigger_condition`, `media_type`
- User edits/deletes media items

### 2.2 Entry Point 2: Knowledge Center Multimedia Tab

**Path**: `/dashboard/knowledge` (tab "Biblioteca Multimedia")
**Component**: `KnowledgeCenter.tsx` → `MediaLibrary.tsx` → `MediaBrowser.tsx`

- Shows **all** media (product-bound + generic)
- Same upload and CRUD flow as Catalog
- User can create product-bound or generic media items

### 2.3 Entry Point 3: Import Engine

**Path**: `/dashboard/catalog` → Import button
**Component**: `ImportDialog` → API routes

- Writes `image_url` to `products.image_url` column (NOT `knowledge_items`)
- External URLs only (CSV, WooCommerce, scrape, feed)
- No upload to Supabase Storage

### 2.4 Entry Point 4: Knowledge File Upload (Non-asset)

**Path**: `/dashboard/knowledge` (tab "Archivos")
**Component**: `FileUpload.tsx` → `POST /api/knowledge/learn`

- Uploads documents/images for AI extraction
- Files are NOT stored as persistent assets
- AI extracts text/knowledge, not image storage

---

## 3. Data Flow Diagrams

### 3.1 Upload Flow (Current)

```
Customer clicks "Subir imagen"
  ↓
MediaUpload component
  ↓
POST /api/knowledge/media/upload (FormData: business_id + file)
  ↓
Validate: auth, MIME (jpeg/png/webp/gif), 5MB max
  ↓
Upload to Supabase Storage: knowledge-media/{businessId}/{uuid}.{ext}
  ↓
Return public URL
  ↓
MediaBrowser creates knowledge_items row:
  - image_url = public URL
  - trigger_condition = user-provided keyword (or null for product-bound)
  - media_type = 'image' | 'testimonial'
  - product_id = product UUID (or null for generic)
```

### 3.2 Runtime Dispatch Flow

```
Customer sends message
  ↓
resolveConditionalMedia()
  ↓
Query knowledge_items WHERE image_url IS NOT NULL AND trigger_condition IS NOT NULL
  ↓
Match trigger against message (deterministic keyword matching)
  ↓
Check dedup: chat_media_dispatched (one-time-per-conversation)
  ↓
Check product priority: if productId known, only serve that product's media
  ↓
Check per-product session: conversations.media_sent_products
  ↓
URL safety check: isSafeMediaUrl()
  ↓
Return MediaAttachment { imageUrl, mediaType }
  ↓
SSE stream → WhatsApp bridge → send image
```

### 3.3 Import Flow (Divergent)

```
Customer imports CSV/WooCommerce/scrape
  ↓
Import engine parses image URLs from external source
  ↓
Writes to products.image_url (NOT knowledge_items)
  ↓
No upload to Supabase Storage
  ↓
Image URL is external (may become stale/broken)
```

---

## 4. Identified Ambiguities

### 4.1 Dual Source of Truth

| Attribute | `products.image_url` | `knowledge_items.image_url` |
|-----------|---------------------|---------------------------|
| **Who writes** | Import engine | MediaBrowser (upload UI) |
| **Who reads** | Runtime (primary) | Catalog thumbnails, conditional media, prompts |
| **Storage** | External URL | Supabase Storage (managed) |
| **Multiple images** | No (single column) | Yes (multiple rows) |
| **Trigger conditions** | No | Yes |
| **Dedup tracking** | No | Yes (chat_media_dispatched, media_sent_products) |
| **Deletion** | Hard delete with product | Soft delete (is_active=false), storage NOT cleaned |

**Ambiguity**: If a customer imports a product with an external image URL AND later uploads a media item for the same product, both exist. The runtime prefers `products.image_url`, but the catalog thumbnail uses `knowledge_items.image_url`. The customer sees different images in different contexts.

### 4.2 Two Dashboard Entry Points

The customer can manage product images from:
1. **Catalog > Product Detail > Media** — scoped to one product
2. **Knowledge > Biblioteca Multimedia** — all products + generic

Both write to `knowledge_items`. The customer may not understand the difference between "product media" and "generic media."

### 4.3 No Image Deletion from Storage

When a knowledge item is soft-deleted (`is_active = false`), the image file in `knowledge-media` Storage is **never removed**. This creates orphaned storage that accumulates over time.

### 4.4 Import ≠ Upload

The import engine writes to `products.image_url` (external URLs). The upload UI writes to `knowledge_items.image_url` (Supabase Storage). These are fundamentally different storage mechanisms that the customer may not distinguish.

### 4.5 `products.image_url` is Effectively Dead

No upload UI writes to `products.image_url`. Only the import engine populates it. The column exists in schema but is not part of any customer-facing upload flow. Yet the runtime prefers it over knowledge media.

---

## 5. Current Tenant Isolation

| Layer | Mechanism | File |
|-------|-----------|------|
| Database | RLS policies on `products` and `knowledge_items` using `business_id` | `001_initial_schema.sql` |
| Storage | Path-based: `{businessId}/` prefix, owner write policy | `016_knowledge_media.sql` |
| Runtime | `businessId` parameter passed through all resolution | `conditional-media.ts` |
| API | Auth check + business ownership verification | `upload/route.ts` |

---

## 6. Security Properties

| Property | Status | Notes |
|----------|--------|-------|
| Tenant isolation (DB) | PASS | RLS on all tables |
| Tenant isolation (Storage) | PASS | Path-based ownership |
| Cross-tenant URL access | PASS | SSRF guard + path-based bucket |
| Public URL exposure | INTENTIONAL | `knowledge-media` bucket is public (required for WhatsApp) |
| Signed URL for evidence | PASS | `delivery-evidence` uses signed URLs (5min TTL) |
| Orphaned storage | RISK | Soft-deleted items leave files in Storage |
