# Product Asset UX Contract

**Date**: 2026-08-25
**Mission**: Product Asset Ownership & Dashboard UX

---

## Mental Model

The customer must have exactly one mental model:

> **"Product → Images"**

Not:
- "Catalog vs Knowledge vs Storage"
- "Product images vs Knowledge media"
- "Generic media vs Product media"

---

## Customer-Facing Contract

### What the Customer Sees

| Screen | What It Shows | What the Customer Thinks |
|--------|--------------|-------------------------|
| **Catalog Grid** | Product card with thumbnail | "My product has an image" |
| **Product Detail** | Product info + image gallery | "I can manage my product's images here" |
| **Import** | Upload CSV/file with image URLs | "I can import product images" |
| **Knowledge Center** | Text knowledge + multimedia library | "I can manage media for my business" |

### What the Customer Should NOT Need to Think

- "Should this image go into Catalog or Knowledge?"
- "Is this a product image or a knowledge image?"
- "Which system stores my product images?"
- "Why does my product show different images in different places?"

---

## UX Entry Points

### Primary Entry Point (Canonical)

**Catalog > Product Detail > Images**

This is the **single canonical entry point** for managing a specific product's images.

Customer actions:
- Upload new image for this product
- View all images for this product
- Edit image metadata (description, type)
- Delete image from this product
- Reorder images (future)

### Secondary Entry Point (Knowledge Media)

**Knowledge Center > Biblioteca Multimedia**

This is the **business-level media library** for managing all media assets.

Customer actions:
- View all media (product-bound + generic)
- Upload new media (with optional product association)
- Edit media metadata
- Delete media

**Key distinction**: This entry point shows ALL media, not just product-specific. It is appropriate for managing generic business images (testimonials, flyers, etc.) that are not tied to a specific product.

### Import Entry Point

**Catalog > Import**

Customer actions:
- Import products from CSV/WooCommerce/URL
- Image URLs from external sources are stored on the product

---

## UX Rules

### Rule 1: One Product, One Image Gallery

A product's images are managed from the Product Detail page. The customer does not need to visit Knowledge Center to add images to a product.

### Rule 2: Knowledge Media is Supplementary

Knowledge Center media is for business-level assets (testimonials, flyers, generic images). Product-specific images belong on the Product Detail page.

### Rule 3: No Duplicate Entry Points for Same Operation

The customer should NOT be able to:
- Upload a product image from Knowledge Center and expect it to appear on the Product Detail page (unless explicitly linked)
- Upload a product image from Product Detail and expect it to appear in Knowledge Center as a separate item

### Rule 4: Consistent Thumbnail

The thumbnail shown on the Catalog Grid must be the same image the runtime sends for that product. No divergent resolution paths.

### Rule 5: Deletion is Deterministic

When the customer deletes a product image:
- The image is removed from the product's gallery
- The image is removed from Storage (orphan prevention)
- The image is no longer sent in conversations for that product
- If the image was also linked to Knowledge, the Knowledge reference is updated

---

## Non-Goals (UX)

The customer should NOT need to:
- Understand the difference between `products.image_url` and `knowledge_items.image_url`
- Manage image Storage paths
- Configure trigger conditions for product images (product images are always available for that product)
- Choose between Catalog and Knowledge for product images
- Understand the conditional media dispatch system
