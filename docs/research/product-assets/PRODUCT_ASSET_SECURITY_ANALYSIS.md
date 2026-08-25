# Product Asset Security Analysis

**Date**: 2026-08-25
**Mission**: Product Asset Ownership & Dashboard UX

---

## Attack Surface

### 1. Cross-Tenant Asset Access

| Attack | Current Mitigation | Status |
|--------|-------------------|--------|
| User A accesses User B's product images via API | RLS on `knowledge_items` using `business_id` | PASS |
| User A accesses User B's images via Storage URL | Storage path `{businessId}/` + owner write policy | PASS |
| User A queries products table for User B's `image_url` | RLS on `products` using `business_id` | PASS |

### 2. Guessed Storage URLs

| Attack | Current Mitigation | Status |
|--------|-------------------|--------|
| Attacker guesses `knowledge-media/{businessId}/{uuid}.ext` | UUID in filename is random (v4), unguessable | PASS |
| Attacker brute-forces UUIDs | 128-bit entropy, rate limiting at Supabase edge | PASS |
| Attacker enumerates business IDs | Business IDs are UUIDs, not sequential | PASS |

### 3. Manipulated product_id

| Attack | Current Mitigation | Status |
|--------|-------------------|--------|
| User sends `product_id = OtherBusiness.product` in API | `POST /api/knowledge/items` validates `product_id` belongs to business (lines 140-154) | PASS |
| User changes `product_id` on existing item | `PATCH /api/knowledge/items/[id]` validates ownership (lines 104-118) | PASS |

### 4. Manipulated asset_id

| Attack | Current Mitigation | Status |
|--------|-------------------|--------|
| User queries `knowledge_items` with random ID | RLS policies filter by `business_id` | PASS |
| User deletes another tenant's item | RLS + API ownership check | PASS |

### 5. Deleted Asset Still Accessible

| Attack | Current Mitigation | Status |
|--------|-------------------|--------|
| Soft-deleted item still has public Storage URL | Storage files are NOT deleted on soft-delete | **RISK** |
| Deleted product's images still accessible | `ON DELETE SET NULL` on `product_id` FK; images become generic | BY DESIGN |

**Finding**: Soft-deleting a knowledge item does NOT remove the Storage file. The public URL remains accessible indefinitely. This is a minor information exposure risk (images are intentionally public for WhatsApp delivery).

### 6. Private Asset Exposed Through Public URL

| Attack | Current Mitigation | Status |
|--------|-------------------|--------|
| Private image accidentally uploaded to public bucket | `knowledge-media` bucket is intentionally public (required for WhatsApp) | BY DESIGN |
| Sensitive content in product images | Customer responsibility; no system-level mitigation | ACCEPTED |

### 7. Knowledge Referencing Another Tenant's Asset

| Attack | Current Mitigation | Status |
|--------|-------------------|--------|
| User creates `knowledge_item` with `image_url` pointing to another tenant's Storage path | API does NOT validate URL ownership; only validates `product_id` belongs to business | **RISK** |

**Finding**: The `POST /api/knowledge/items` route validates that `product_id` belongs to the business, but does NOT validate that `image_url` points to a Storage path under the same business. A user could理论上 create a knowledge item with `image_url = https://supabase.co/storage/v1/object/public/knowledge-media/OTHER_BUSINESS_ID/file.jpg`.

**Mitigation**: The SSRF guard (`isSafeMediaUrl`) only checks hostname, not path. The Storage bucket is public, so the URL is technically accessible. However, the user would need to know the exact path of another tenant's file.

**Risk level**: LOW — requires knowledge of another tenant's UUIDs, and the images are intentionally public.

### 8. MIA Receiving Unauthorized Asset

| Attack | Current Mitigation | Status |
|--------|-------------------|--------|
| MIA sends image from wrong product | Product-priority enforcement in `conditional-media.ts` (lines 62-70) | PASS |
| MIA sends image from wrong tenant | RLS on `knowledge_items` ensures only business's items are returned | PASS |
| MIA sends deleted image | Soft-deleted items have `is_active = false`, filtered in queries | PASS |

### 9. Direct Storage Access Bypassing Catalog

| Attack | Current Mitigation | Status |
|--------|-------------------|--------|
| User uploads directly to Storage bucket | Storage INSERT policy requires auth + business ownership path | PASS |
| User uses Supabase client to bypass API | RLS on Storage objects enforces path-based ownership | PASS |

### 10. F12/Browser Manipulation

| Attack | Current Mitigation | Status |
|--------|-------------------|--------|
| User modifies `product_id` in browser DevTools | API validates ownership server-side | PASS |
| User modifies `business_id` in upload request | API validates auth token business membership | PASS |
| User inspects network requests for Storage URLs | URLs are public by design; no sensitive data exposure | ACCEPTED |

### 11. Repository/Source Exposure

| Attack | Current Mitigation | Status |
|--------|-------------------|--------|
| Storage credentials in source code | Uses `createAdminClient()` from environment variables | PASS |
| Signed URLs in source code | `delivery-evidence` signed URLs generated at runtime, 5min TTL | PASS |
| API keys in git history | Not found in current audit | PASS |

---

## Summary

| Category | Findings | Severity |
|----------|----------|----------|
| Cross-tenant access | 0 | — |
| Manipulated IDs | 0 | — |
| Orphaned storage (soft-delete) | 1 | LOW |
| URL ownership validation gap | 1 | LOW |
| Public bucket by design | 1 | ACCEPTED |
| **Total** | **2 LOW, 1 ACCEPTED** | — |

No CRITICAL or HIGH security findings.
