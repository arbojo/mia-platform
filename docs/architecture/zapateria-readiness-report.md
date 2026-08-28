# Zapatería (Shoe Store) Vertical Readiness Report

**Date**: 2026-08-26
**HEAD**: `681c4b8`
**Type**: READ-ONLY forensic audit. No code changes, no DB changes, no migrations.

## Central Question

> How ready is MIA to serve a zapatería (shoe store) — with variants (size/color),
> dual pricing (mayoreo/público), volume discounts, and inventory awareness — using
> ONLY existing capabilities?

**Score: 2.5/5 (~38% ready)**. MIA's knowledge and anti-hallucination systems
are strong, but the variant system is ignored by Sales AI, dual pricing doesn't
exist, volume pricing doesn't exist, and multi-product presentation is blocked
by the singular ProductReference architecture.

---

## 1. Knowledge (4.5/5)

**Strength**: Knowledge system handles shoe store FAQs well.

| Zapatería Need | MIA Capability | Score |
|---------------|---------------|-------|
| Product knowledge | `knowledge_items` — unlimited Q&A | 5/5 |
| Care instructions | Knowledge items with categories | 4/5 |
| Size guides | Knowledge items (free text) | 3/5 |
| Material info | Knowledge items | 4/5 |
| Return policy | Knowledge items | 5/5 |

**Gap**: Size guide is free text, not structured. Cannot filter by size availability.

**Evidence**: `knowledge.ts:29-109` — `getBusinessContext()` loads all active
knowledge items. No schema constraint on content.

---

## 2. Anti-Hallucination (4.5/5)

**Strength**: MIA's anti-hallucination system is excellent for retail.

| Anti-Hallucination Need | MIA Capability | Score |
|------------------------|---------------|-------|
| Never invent products | `prompts.ts:279` — "NUNCA inventes" | 5/5 |
| Never invent prices | Authority hierarchy (`knowledge.ts:3-11`) | 5/5 |
| Never invent promotions | `prompts.ts:317` — "cannotDo" | 5/5 |
| Never invent availability | Knowledge boundary (`prompts.ts:283`) | 4/5 |
| Source attribution | Authority tags (`knowledge.ts:13-27`) | 5/5 |

**Evidence**: `prompts.ts:279` — Rule 1: "NUNCA inventes información. Si no
tienes la respuesta, di que no sabes y ofrece contactar a un asesor."
`prompts.ts:317` — "No inventes promociones ni descuentos que no existen."

---

## 3. Objection Handling (4.0/5)

**Strength**: Objection handling works for retail.

| Zapatería Objection | MIA Handling | Score |
|--------------------|-------------|-------|
| "Es muy caro" | Price objection → experience pattern | 4/5 |
| "No tiene mi talla" | Size objection → knowledge response | 3/5 |
| "Es muy grande/chico" | Fit objection → knowledge response | 3/5 |
| "Necesito pensarlo" | Low readiness → consultative | 4/5 |
| "Lo vi más barato en otro lado" | Price comparison → experience | 3/5 |

**Gap**: No structured size/fit objection handling. All must be free-text knowledge.

**Evidence**: `prompt-enricher.ts:43-73` — `identifyPermittedActions()` adjusts
based on customer state. `prompt-enricher.ts:90-132` — `buildGuidance()` provides
context-aware guidance.

---

## 4. Brand Identity (4.0/5)

**Strength**: Brand identity system works for retail.

| Zapatería Need | MIA Capability | Score |
|---------------|---------------|-------|
| Store personality | `brand_identities.tone_of_voice` | 5/5 |
| Target market | `brand_identities.target_customers` | 4/5 |
| Differentiators | `brand_identities.differentiators` | 4/5 |
| Elevator pitch | `brand_identities.elevator_pitch` | 5/5 |
| Assistant personality | `assistants.personality` | 3/5 |

**Gap**: No retail-specific personality traits (fashion expertise, style advice).

**Evidence**: `prompts.ts:242-243` — personality from `assistant.personality`.
`prompts.ts:244-246` — tone from `brand_identities.tone_of_voice`.

---

## 5. Variant Presentation (1.5/5)

**Strength**: The variant system EXISTS in the Inventory domain but Sales AI
completely ignores it.

| Variant Need | MIA Capability | Score |
|-------------|---------------|-------|
| Size options | `inventory.assets` with `item_type='sku'` | 1/5 |
| Color options | `inventory.assets` with `attributes` JSONB | 1/5 |
| Stock per variant | `inventory.stock_items` with `quantity` | 2/5 |
| Variant resolution | `inventory.resolve_variant()` SQL function | 2/5 |
| **Sales AI reads variants** | **NEVER** — `prompts.ts:86-107` formats flat products only | **0/5** |

**Gap**: The variant system is fully implemented in the Inventory domain:
- `inventory.assets` table with `item_type` (sku/material/asset), `tracking_mode`
  (quantity/serial/single), `attributes` JSONB
- `inventory.resolve_variant()` SQL function for variant resolution
- `inventory.asset_products` N:M bridge between assets and products
- `042_polymorphic_variants.sql` migration with full variant support

**But Sales AI (`prompts.ts`) never queries any of this.** `formatProducts()`
(`prompts.ts:86-107`) formats the `products` table only — flat product listing
with name, price, description, benefits, FAQ, restrictions. No variant data
appears in the prompt.

**Evidence**:
- `inventory/types.ts:35-55` — `InventoryAsset` interface with `item_type`,
  `tracking_mode`, `attributes`, `current_qty`, `min_qty`, `max_qty`
- `042_polymorphic_variants.sql` — `inventory.assets` table,
  `inventory.resolve_variant()` function, `inventory.asset_products` bridge
- `prompts.ts:86-107` — `formatProducts()` formats flat products only

---

## 6. Dual Pricing (Mayoreo/Público) (1.0/5)

**Strength**: None. Dual pricing doesn't exist.

| Dual Pricing Need | MIA Capability | Score |
|------------------|---------------|-------|
| Wholesale price | **NOT IN SCHEMA** | 0/5 |
| Retail price | `products.price` (single price) | 2/5 |
| Price selection logic | **NOT AVAILABLE** | 0/5 |
| Volume threshold | **NOT AVAILABLE** | 0/5 |
| Customer type detection | **NOT AVAILABLE** | 0/5 |

**Gap**: `products` table has a single `price` column. No wholesale price,
no volume threshold, no customer type (retail vs. wholesale).

**Evidence**: `001_initial_schema.sql` — `products` table has `price numeric`.
No `wholesale_price`, `min_wholesale_qty`, or `pricing_tier` columns.

**Impact**: A zapatería that sells both retail and wholesale cannot use MIA
for wholesale pricing. The AI would quote only the retail price.

---

## 7. Volume Pricing (0.5/5)

**Strength**: None. Volume pricing doesn't exist.

| Volume Pricing Need | MIA Capability | Score |
|--------------------|---------------|-------|
| Quantity discounts | **NOT IN SCHEMA** | 0/5 |
| Tier pricing | **NOT IN SCHEMA** | 0/5 |
| Discount calculation | **NOT AVAILABLE** | 0/5 |
| Minimum order quantity | **NOT AVAILABLE** | 0/5 |
| Bulk order detection | **NOT AVAILABLE** | 0/5 |

**Gap**: No pricing tiers, no quantity discounts, no minimum order quantities.
The `hasSalesTrigger()` function (`detect.ts:47-70`) has no bulk/wholesale
keywords (`mayoreo`, `volumen`, `cantidad`, `docena`, `lot`).

**Evidence**:
- `detect.ts:47-70` — `hasSalesTrigger()` keywords: `compr`, `quiero`,
  `llevo`, `confirmo`, `pago`, `tarjeta`, `transferencia`, `envío`,
  `dirección`, `teléfono`. No wholesale/bulk keywords.
- No pricing tier tables in schema.

---

## 8. Inventory Bridge (1.0/5)

**Strength**: The inventory→sales event trigger exists but doesn't bridge
to prompt construction.

| Inventory Bridge Need | MIA Capability | Score |
|----------------------|---------------|-------|
| Stock → availability in prompt | **NOT AVAILABLE** | 0/5 |
| Low stock warnings | `inventory.stock_items.low_stock_threshold` | 2/5 |
| Out of stock handling | `inventory.stock_items.quantity = 0` | 1/5 |
| Restock suggestions | `inventory.restock_suggestions` table | 2/5 |
| Sales → inventory update | `inventory.handle_sale_won()` trigger | 3/5 |

**Gap**: The trigger (`handle_sale_won`) updates stock when a sale is made,
but the prompt never reads stock levels. MIA cannot say "we only have 3 left"
or "this size is out of stock."

**Evidence**:
- `034_inventory_hub.sql` — `handle_sale_won()` trigger fires on SALE_WON
  events and decrements stock
- `prompts.ts:86-107` — `formatProducts()` never queries `stock_items`
- No stock-level information in prompt construction

---

## 9. Multi-Product Presentation (1.0/5)

**Strength**: None. MIA recommends exactly one product per message.

| Multi-Product Need | MIA Capability | Score |
|-------------------|---------------|-------|
| Show 2-3 options | **BLOCKED** — singular ProductReference | 0/5 |
| Compare features | **NOT AVAILABLE** | 0/5 |
| Filter by size/color | **NOT AVAILABLE** | 0/5 |
| "Which do you prefer?" | **NOT AVAILABLE** | 0/5 |

**Gap**: `product-recommendation.ts:65` — `if (matchedProductIds.length > 1)
return null`. When multiple products match, MIA gives up.

**Evidence**:
- `product-recommendation.ts:16-100` — returns `ProductReference | null`
- `product-recommendation.ts:65` — `if (matchedProductIds.length > 1) return null`
- `stream-response.ts:26-29` — emits exactly one `{ type: 'product' }` event

**Impact**: A zapatería with 50+ shoe models cannot have MIA present options.
The customer must ask for each shoe individually.

---

## 10. Intent Detection (2.5/5)

**Strength**: Basic retail intents work.

| Zapatería Intent | MIA Detection | Score |
|-----------------|--------------|-------|
| "Show me shoes" | `catalog` intent | 3/5 |
| "How much?" | `price` intent | 4/5 |
| "Do you have size 9?" | **NOT AVAILABLE** | 0/5 |
| "I want 12 pairs" | **NOT AVAILABLE** | 0/5 |
| "Wholesale price?" | **NOT AVAILABLE** | 0/5 |
| "Do you ship?" | `shipping` intent | 3/5 |

**Gap**: No size inquiry intent, no quantity intent, no wholesale intent.

**Evidence**: `intents.ts:15-66` — 6 intent tags: catalog, price, shipping,
payment, contact, greeting. No retail-specific intents.

---

## 11. Sales Rules (3.0/5)

**Strength**: Sales rules can encode retail policies.

| Zapatería Rule | MIA Capability | Score |
|---------------|---------------|-------|
| "No returns on sale items" | `sales_rules` with priority | 4/5 |
| "Minimum purchase for wholesale" | `sales_rules` | 2/5 |
| "Free shipping over $500" | `sales_rules` | 3/5 |
| "Size exchange within 7 days" | `sales_rules` | 3/5 |
| "Cash discount 5%" | `sales_rules` | 2/5 |

**Gap**: Rules are text-only. No structured enforcement (e.g., "apply 5%
discount if payment_method='cash'").

**Evidence**: `prompts.ts:109-115` — `formatRules()` renders rules as text.
No execution logic.

---

## 12. Customer Memory (2.5/5)

**Strength**: Basic memory works.

| Zapatería Memory Need | MIA Capability | Score |
|----------------------|---------------|-------|
| Preferred sizes | `customers.memory.interests` | 1/5 |
| Preferred brands | `customers.memory.interests` | 1/5 |
| Style preferences | `customers.memory.interests` | 1/5 |
| Purchase history | `customers.memory` (not tracked) | 1/5 |
| Price sensitivity | `customers.memory.objections` (price only) | 2/5 |

**Gap**: Memory extraction is keyword-based (`customer-memory.ts:260-276`).
Only detects price/delivery/guarantee objections. No retail-specific memory
(sizes, brands, styles, purchase history).

**Evidence**: `customer-memory.ts:260-276` — `mergeMemory()` extracts only
price/delivery/guarantee objections. No size, brand, or style extraction.

---

## Overall Score: 2.5/5

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Knowledge | 4.5/5 | 15% | 0.675 |
| Anti-Hallucination | 4.5/5 | 10% | 0.45 |
| Objection Handling | 4.0/5 | 10% | 0.40 |
| Brand Identity | 4.0/5 | 5% | 0.20 |
| Variant Presentation | 1.5/5 | 15% | 0.225 |
| Dual Pricing | 1.0/5 | 15% | 0.15 |
| Volume Pricing | 0.5/5 | 10% | 0.05 |
| Inventory Bridge | 1.0/5 | 5% | 0.05 |
| Multi-Product | 1.0/5 | 5% | 0.05 |
| Intent Detection | 2.5/5 | 5% | 0.125 |
| **Total** | | **100%** | **2.375** |

---

## Recommendation

**Not Viable for Zapatería Today.** The critical gaps are:

1. **Variant system exists but is invisible to Sales AI** — The Inventory domain
   has full variant support (`inventory.assets`, `resolve_variant()`,
   `asset_products`), but `prompts.ts` never queries it. This is the #1 gap.

2. **No dual pricing** — Single `price` column in `products`. No wholesale price,
   no volume threshold, no customer type detection.

3. **No volume pricing** — No pricing tiers, no quantity discounts, no minimum
   order quantities.

4. **Multi-product blocked** — `product-recommendation.ts:65` bails when multiple
   products match. The output model (`ProductReference | null`) is singular.

**Configuration-Only MVP**: Partially viable for basic shoe knowledge and
objection handling. NOT viable for the core zapatería workflow (showing
shoes with size/color options and wholesale pricing).

**Estimated Effort for Full Zapatería Support**: 3-4 weeks
- Variant→prompt bridge: 5-7 days (query `inventory.assets` in prompt)
- Dual pricing: 3-5 days (add `wholesale_price` column + prompt logic)
- Volume pricing: 3-5 days (add pricing tiers + prompt logic)
- Multi-product presentation: 3-5 days (output model change)
- Retail-specific intents: 2-3 days (size inquiry, quantity, wholesale)
- Inventory→prompt bridge: 2-3 days (stock levels in prompt)

**Key Insight**: The variant system is already built in the Inventory domain.
The fix is NOT building a new variant system — it's bridging the existing
one to the Sales AI prompt. This is a 5-7 day task, not a months-long project.
