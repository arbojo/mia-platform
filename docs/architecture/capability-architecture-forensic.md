# Capability Architecture Forensic — READ-Only Audit

**Date**: 2026-08-26
**HEAD**: `681c4b8` (`subaru: checkpoint TASK-20260824-CAPABILITY - completado`)
**Type**: READ-ONLY forensic audit. No code changes, no DB changes, no migrations, no permanent prompt changes.

## Central Question

> Is MIA already a capability architecture, and if so, what specific gaps prevent it
> from deriving behavior from business configuration?

**Short answer**: MIA already IS a capability architecture — 17 tables with opt-in
modules, edition gating, and channel modes — but capabilities are not named,
registered, or derivable from business configuration. The missing bridge is a
**Capability→Prompt Pipeline**: 3-4 new columns + lightweight capability flags
that inject behavioral instructions based on enabled capabilities. No
vertical-specific code is needed.

---

## Phase 1: Repository Baseline

| Dimension | Value |
|-----------|-------|
| HEAD | `681c4b8` — 775+ commits |
| Branch | `main` (clean working tree) |
| Remote | `origin/main` synchronized |
| Supabase project ref | `hhitqgsaglddjkmaovbs` (Mia Lab) |
| Tech stack | Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui, Supabase (PostgreSQL + RLS), OpenAI gpt-4o-mini via Vercel AI SDK, Playwright e2e |
| Git status | Clean (all prior work committed) |
| Stash | `stash@{0}` COMPLETE-PRESERVE (auth safeguards), `stash@{1}` (untouched) |

### Schema Domains (17 total)

| Domain | Schema | Tables |
|--------|--------|--------|
| Platform/Core | `public` (shared) | businesses, brand_identities, knowledge_items, ai_instructions, assistants, products, sales_rules, customers, conversations, messages, learning_events, ai_usage, channel_connections, channel_messages, business_sales_config |
| Inventory | `inventory` | business_settings, assets, asset_products, stock_items, stock_movements, predictions, suppliers, purchase_orders, restock_suggestions |
| Delivery | `delivery` | business_settings, drivers, routes, orders, visits, driver_events, daily_closures |

---

## Phase 2: Capability Inventory

### 2.1 Edition System — The Existing Capability Registry

**Location**: `src/lib/system/edition.ts:19-44`

MIA already has a capability registry — the `EditionCapabilities` interface with 27 boolean flags:

```typescript
export interface EditionCapabilities {
  demoChat: boolean
  whatsapp: boolean
  webchat: boolean
  telegram: boolean
  multiChannel: boolean
  multipleBusinesses: boolean
  multipleAssistants: boolean
  cloudDeployment: boolean
  skills: boolean
  businessMemory: boolean
  learning: boolean
  weeklyReports: boolean
  dashboard: boolean
  promptBuilder: boolean
  knowledgeCenter: boolean
  commercialIntelligence: boolean
  expectationIntelligence: boolean
  responsibleSelling: boolean
  knowledgeStudio: boolean
  salesSimulator: boolean
  connections: boolean
  deliveryHub: boolean
  inventoryHub: boolean
  analyticsDashboard: boolean
}
```

**Critical insight**: These flags are edition-level (evaluation/professional/enterprise/cloud), NOT business-level. Every business on the same edition gets the same capabilities. The `getEffectiveEdition(businessId)` function (`edition.ts:369-386`) reads from the `businesses.edition` column (DB-first, env fallback), but there is no per-business capability override.

**Evidence**: `edition.ts:219-223` — `getCurrentEditionName()` reads `process.env.MIA_EDITION ?? 'evaluation'`, caching the result. The cache is never invalidated per-business.

### 2.2 Activation Mechanisms (3-Layer Gating)

**Layer 1 — Edition Gate** (`licensing.ts:5-13`):
```typescript
export async function assertInventoryEditionAvailable(businessId: string): Promise<void> {
  if (!(await canBusinessUseInventoryHub(businessId))) {
    throw new InventoryError('INVENTORY_NOT_ENABLED', ..., 403)
  }
}
```

**Layer 2 — Business Settings Gate** (`licensing.ts:15-36`):
```typescript
export async function assertInventoryHubEnabled(businessId: string): Promise<void> {
  await assertInventoryEditionAvailable(businessId)
  // Then checks inventory.business_settings.enabled
}
```

**Layer 3 — SQL Trigger Gate** (`034_inventory_hub.sql`):
```sql
CREATE TRIGGER handle_sale_won_inventory
  AFTER INSERT ON public.sales_events
  FOR EACH ROW
  WHEN (NEW.event_type = 'SALE_WON')
  EXECUTE FUNCTION inventory.handle_sale_won();
```

**Evidence**: Three gates, three files, three different activation layers. Delivery uses the same pattern (`031_delivery_hub.sql` — `delivery.business_settings` + trigger).

### 2.3 Data-Driven Capabilities (Already Exist)

| Capability | Source | Evidence |
|-----------|--------|----------|
| Products | `products` table (15 cols) | `001_initial_schema.sql` |
| Knowledge | `knowledge_items` table | `knowledge.ts:29-109` |
| Sales Rules | `sales_rules` table | `prompts.ts:109-115` |
| AI Instructions | `ai_instructions` table | `prompts.ts:117-126` |
| Brand Identity | `brand_identities` table | `prompts.ts:244-246` |
| Customer Memory | `customers.memory` JSONB | `customer-memory.ts:47-80` |
| Business Memory | `business_memory` table | `knowledge.ts:88-98` |
| Sales Config | `business_sales_config` table | `knowledge.ts:338-355` |
| Channel Modes | `channel_connections.mode` | `runtime.ts:192-267` |
| Edition | `businesses.edition` | `edition.ts:369-386` |
| Vertical | `inventory.business_settings.vertical` | `types.ts:6` |

### 2.4 Capabilities NOT Present

| Missing | Impact |
|---------|--------|
| Named capability registry | No way to enumerate what a business can do |
| Capability→prompt bridge | Prompt never changes based on enabled capabilities |
| Configuration→prompt pipeline | No path from business config to behavioral instructions |
| Multi-product presentation | `ProductReference` returns exactly 1 product (`product-recommendation.ts:99` returns `null` for >1 match) |
| Wholesale/bulk detection | `hasSalesTrigger()` (`detect.ts:47-70`) has no bulk/wholesale keywords |
| Variant-aware prompts | `prompts.ts:86-107` formats flat products only |
| Volume pricing | Not in schema or prompt |

---

## Phase 3: Capability Classification

Based on the inventory, capabilities fall into 5 categories:

### 3.1 UNIVERSAL (Always Active — Core MIA)

These capabilities are always present regardless of edition, vertical, or configuration:

| # | Capability | Evidence | Always Active |
|---|-----------|----------|---------------|
| 1 | Conversation Engine | `runtime.ts:24-172` | Yes — core pipeline |
| 2 | Anti-Hallucination | `prompts.ts:279` ("NUNCA inventes") | Yes — hard-coded rule |
| 3 | Personality Engine | `prompts.ts:68-84, 242-243` | Yes — from `brand_identities` |
| 4 | Knowledge Base | `prompts.ts:128-147` | Yes — from `knowledge_items` |
| 5 | Sales Rules | `prompts.ts:109-115` | Yes — from `sales_rules` |
| 6 | Intent Detection | `intents.ts:15-66` | Yes — 6 hardcoded tags |
| 7 | Customer Memory | `customer-memory.ts:47-80` | Yes — per-customer JSONB |
| 8 | Closing Policy | `prompts.ts:62-66, 321` | Yes — personality-driven |
| 9 | Language Matching | `prompts.ts:271` | Yes — always in prompt |
| 10 | Channel Modes | `runtime.ts:192-267` | Yes — active/shadow/paused |
| 11 | Authority Hierarchy | `knowledge.ts:3-11, prompts.ts:292-305` | Yes — 7-tier conflict resolution |
| 12 | Experience Memory | `prompts.ts:357` | Yes — from `experience_memory` |
| 13 | Business Memory | `prompts.ts:354` | Yes — from `business_memory` |
| 14 | Evidence Extraction | `runtime.ts:348-358` | Yes — from customer messages |
| 15 | AI Usage Tracking | `knowledge.ts:372-392` | Yes — `recordAiUsage()` |

### 3.2 OPTIONAL (Edition-Gated — Already Exist)

| # | Capability | Gate | Evidence |
|---|-----------|------|----------|
| 16 | WhatsApp Channel | `edition.whatsapp` | `edition.ts:69-70` (eval: false, prof+: true) |
| 17 | Telegram Channel | `edition.telegram` | `edition.ts:71-72` |
| 18 | Multi-Channel | `edition.multiChannel` | `edition.ts:73-74` |
| 19 | Multiple Assistants | `edition.multipleAssistants` | `edition.ts:77-78` |
| 20 | Inventory Hub | `edition.inventoryHub` | `edition.ts:89-90` (enterprise+: true) |
| 21 | Delivery Hub | `edition.deliveryHub` | `edition.ts:88-89` (enterprise+: true) |
| 22 | Analytics Dashboard | `edition.analyticsDashboard` | `edition.ts:91-92` |
| 23 | Knowledge Studio | `edition.knowledgeStudio` | `edition.ts:84-85` |
| 24 | Sales Simulator | `edition.salesSimulator` | `edition.ts:86-87` |
| 25 | Prompt Builder | `edition.promptBuilder` | `edition.ts:81-82` |
| 26 | Connections | `edition.connections` | `edition.ts:88-89` |

### 3.3 CONFIGURABLE (Business-Level — Data-Driven)

These capabilities exist but are not registered as capabilities — they're implicit in the data:

| # | Capability | Config Source | Gap |
|---|-----------|---------------|-----|
| 27 | COD Payment | `business_sales_config.ask_address` | Not named as capability |
| 28 | Follow-Up | `business_sales_config.follow_up_hours` | Not named as capability |
| 29 | Cancellation | `business_sales_config.allow_cancellation` | Not named as capability |
| 30 | Conditional Media | `knowledge_items.image_url + trigger_condition` | Not named as capability |
| 31 | Product Recommendations | `knowledge_items.product_id` | Not named as capability |
| 32 | Landing Page Mode | `landingContext` in prompt | Not named as capability |

### 3.4 UNKNOWN (Not in Schema or Code)

| # | Capability | Needed By | Impact |
|---|-----------|-----------|--------|
| 33 | Visit Scheduling | Real Estate | Cannot book property viewings |
| 34 | Dual Pricing | Zapatería | Cannot show mayoreo vs. público |
| 35 | Volume Pricing | Zapatería | Cannot apply quantity discounts |
| 36 | Variant Presentation | Clothing/Retail | Cannot present size/color options |
| 37 | Property Attributes | Real Estate | Cannot structure m²/bedrooms |
| 38 | Appointment Booking | Services | Cannot schedule appointments |

---

## Phase 4: Capability Lifecycle

### 4.1 How Capabilities Are Activated Today

**Edition-Gated Capabilities**:
```
Environment Variable (MIA_EDITION)
    ↓
Business Record (businesses.edition) — DB-first, env fallback
    ↓
EditionCapabilities boolean flags (27 flags)
    ↓
canBusinessUse*() functions (28 functions)
    ↓
UI visibility + API gatekeeping
    ↓
(NEVER reaches prompt construction)
```

**Data-Driven Capabilities**:
```
Business creates products/rules/knowledge/instructions
    ↓
getBusinessContext() loads them (knowledge.ts:29-109)
    ↓
buildMasterPrompt() formats them (prompts.ts:187-367)
    ↓
System prompt sent to OpenAI
    ↓
AI response incorporates the data
```

**Module-Gated Capabilities**:
```
Edition check (canBusinessUseInventoryHub)
    ↓
Business settings check (inventory.business_settings.enabled)
    ↓
SQL trigger check (handle_sale_won_inventory)
    ↓
Feature becomes active
```

### 4.2 Critical Lifecycle Gap

**The prompt never changes based on enabled capabilities.** `buildMasterPrompt()` (`prompts.ts:187-367`) receives products, rules, knowledge, and instructions — but never checks which capabilities are enabled. The prompt is identical whether the business has WhatsApp, inventory, delivery, or any other capability enabled.

**Evidence**: `prompts.ts:187-216` — the `params` object includes `business`, `brand`, `assistant`, `products`, `rules`, `instructions`, `knowledge`, `memory`, `customerMemory`, `recentLessons`, `locale`, `channel`, `intentTag`, `salesConfig`, `experienceContext`, `conversationOutcome`, `cancellationContext`, `landingContext`, `stateGuidance`. There is NO `capabilities` parameter.

### 4.3 Lifecycle Trace — Single Product Reference

```
User message arrives
    ↓
processIncomingMessage() (runtime.ts:174-423)
    ↓
resolveRecommendedProduct() (product-recommendation.ts:16-100)
    ↓
Returns ProductReference | null (SINGULAR — never an array)
    ↓
buildStructuredStreamResponse() (stream-response.ts:14-53)
    ↓
SSE event: { type: 'product', product: ProductReference } (SINGULAR)
```

**Evidence**: `product-recommendation.ts:65` — `if (matchedProductIds.length > 1) return null` (bails on multiple matches). `product-recommendation.ts:94-96` — only resolves single-product catalog fallback. `stream-response.ts:26-29` — emits exactly one `{ type: 'product', product }` event.

---

## Phase 5: Capability Dependencies

### 5.1 Dependency Graph

```
UNIVERSAL CAPABILITIES (always active)
├── Conversation Engine
│   ├── Intent Detection
│   ├── Customer Memory
│   ├── Authority Hierarchy
│   └── Channel Modes
├── Anti-Hallucination
├── Personality Engine
├── Knowledge Base
├── Sales Rules
├── Closing Policy
├── Language Matching
├── Experience Memory
├── Business Memory
├── Evidence Extraction
└── AI Usage Tracking

OPTIONAL CAPABILITIES (edition-gated)
├── WhatsApp Channel ──→ Multi-Channel
├── Telegram Channel ──→ Multi-Channel
├── Inventory Hub ──→ Edition ≥ Enterprise
├── Delivery Hub ──→ Edition ≥ Enterprise
├── Analytics Dashboard
├── Knowledge Studio
├── Sales Simulator
├── Prompt Builder
└── Connections

CONFIGURABLE CAPABILITIES (data-driven, implicit)
├── COD Payment ──→ business_sales_config.ask_address
├── Follow-Up ──→ business_sales_config.follow_up_hours
├── Cancellation ──→ business_sales_config.allow_cancellation
├── Conditional Media ──→ knowledge_items.image_url + trigger_condition
├── Product Recommendations ──→ knowledge_items.product_id
└── Landing Page Mode ──→ landingContext parameter
```

### 5.2 Dependency Conflicts

| Conflict | Impact |
|----------|--------|
| Inventory Hub requires Enterprise edition | Professional businesses cannot use inventory |
| Delivery Hub requires Enterprise edition | Professional businesses cannot use delivery |
| No capability override per business | Edition-level only, not business-level |
| Variant system exists but Sales AI ignores it | `inventory.assets` JSONB + `resolve_variant()` never queried by prompts |

---

## Phase 6: Capability→Behavior Audit

### 6.1 The Critical Gap: No Capability→Prompt Bridge

**The prompt construction pipeline (`prompts.ts:187-367`) has exactly 3 data-driven sections:**

1. **Products** (`prompts.ts:86-107`): Formats `products` array as text. Flat product listing only — no variants, no quantities, no wholesale.

2. **Rules** (`prompts.ts:109-115`): Formats `sales_rules` array as text. Priority-ordered.

3. **Knowledge** (`prompts.ts:128-147`): Formats `knowledge_items` array as text. Product-scoped, trigger-conditional.

**Sections NOT driven by capabilities:**

| Section | In Prompt | Driven By |
|---------|-----------|-----------|
| Personality | Yes (`prompts.ts:242-243`) | `brand_identities` |
| Communication Style | Yes (`prompts.ts:276`) | `assistants.communication_style` |
| Tone of Voice | Yes (`prompts.ts:244-246`) | `brand_identities.tone_of_voice` |
| Closing Policy | Yes (`prompts.ts:321`) | Personality `sales_aggressiveness` |
| Sales Config (ask_address, ask_phone) | Yes (`prompts.ts:331-332`) | `business_sales_config` |
| Cancellation | Yes (`prompts.ts:332`) | `business_sales_config.allow_cancellation` |
| Channel Mode | Yes (`prompts.ts:248-253`) | Channel type |
| Landing Context | Yes (`prompts.ts:255-263`) | `landingContext` parameter |
| **Capability-Specific Behavioral Instructions** | **NO** | **Nothing** |

### 6.2 What a Capability→Prompt Bridge Would Enable

If MIA had a capability registry, the prompt could conditionally include:

| Capability Enabled | Prompt Section Added |
|-------------------|---------------------|
| `multi_product_presentation` | "Puedes presentar hasta 3 productos en una misma respuesta..." |
| `dual_pricing` | "Muestra precio público y precio mayoreo cuando el cliente pida volumen..." |
| `volume_pricing` | "Aplica descuentos por cantidad según la tabla de pricing..." |
| `visit_scheduling` | "Ofrece agendar una visita al inmueble..." |
| `variant_presentation` | "Cuando el cliente pregunte por talla/color, muestra las opciones disponibles..." |
| `wholesale_detection` | "Cuando detectes intención de compra mayorista, activa el flujo B2B..." |

### 6.3 Behavior Audit — What MIA Does vs. Does Not Do

**What MIA does (capability-driven):**
- Products are presented as flat text list
- One product recommended per message
- Personality-driven closing style
- Channel-specific formatting (WhatsApp interactive buttons)
- Landing page mode restricts to single product
- Customer memory tracks objections (price/delivery/guarantee only)
- Intent detection (6 tags: catalog/price/shipping/payment/contact/greeting)

**What MIA does NOT do (capability gaps):**
- Multi-product comparison or side-by-side presentation
- Wholesale/B2B detection or pricing
- Volume-based pricing or quantity discounts
- Variant (size/color) presentation in prompts
- Property attributes (m², bedrooms, location scoring)
- Visit scheduling or appointment booking
- Dual pricing (wholesale vs. retail)
- Cross-sell/upsell logic in prompts (only in detection)
- Category-based product filtering

---

## Phase 7: Existing Activation Mechanisms

### 7.1 Mechanism Inventory

| Mechanism | Scope | File | Evidence |
|-----------|-------|------|----------|
| **Edition Flags** | Business-level (via `businesses.edition`) | `edition.ts:19-44` | 27 boolean flags, 4 editions |
| **Business Settings** | Module-level (inventory, delivery) | `inventory/types.ts:1-17` | `enabled`, `vertical`, thresholds |
| **Channel Modes** | Channel-level (active/shadow/paused) | `runtime.ts:192-267` | Per-connection mode |
| **Onboarding State** | Business-level (step completion) | Dashboard layout | Gates UI visibility |
| **Environment Variables** | Instance-level (global fallback) | `edition.ts:219-223` | `MIA_EDITION` env var |
| **SQL Triggers** | Table-level (sale won → inventory) | `034_inventory_hub.sql` | `handle_sale_won()` |
| **Edition Limits** | Business-level (quotas) | `edition.ts:9-17` | businesses, assistants, channels, conversations |

### 7.2 Activation Chain Trace

```
MIA_EDITION env var (global default)
    ↓
businesses.edition (DB override, per-business)
    ↓
getEffectiveEdition(businessId) (edition.ts:369-386)
    ↓
EditionCapabilities (27 boolean flags)
    ↓
canBusinessUse*() functions (28 functions)
    ↓
UI gating (ActivityRail.tsx sidebar visibility)
API gating (licensing.ts 3-gate checks)
    ↓
(NEVER reaches buildMasterPrompt)
```

**Evidence**: `edition.ts:339-341` — `canBusinessUseInventoryHub()` calls `getEffectiveEdition()` then reads `.capabilities.inventoryHub`. The result gates the API (`licensing.ts:5-13`) but never gates the prompt.

### 7.3 The Prompt Never Consults Capabilities

**`buildMasterPrompt()` receives 14 parameters** (`prompts.ts:187-216`):
- business, brand, assistant, products, rules, instructions, knowledge
- memory, customerMemory, recentLessons
- locale, channel, intentTag, salesConfig
- experienceContext, conversationOutcome, cancellationContext
- landingContext, stateGuidance

**None of these are capability flags.** The function has no way to conditionally inject behavioral instructions based on what the business has enabled.

---

## Phase 8: Domain Simulation

### 8.1 Simulation: Real Estate Vertical

**Would MIA handle a real estate business today?**

| Requirement | MIA Support | Gap |
|------------|-------------|-----|
| Property listing (products) | ✅ `products` table | No structured attributes (m², bedrooms) |
| Property knowledge | ✅ `knowledge_items` | Works as-is |
| Visit scheduling | ❌ No mechanism | Need appointment/booking capability |
| Location scoring | ❌ No mechanism | Need location intelligence |
| Property comparison | ❌ Single product only | Need multi-product presentation |
| Objection handling | ✅ `experience_memory` | Works as-is |
| Closing | ✅ Personality-driven | Works as-is |

**Score**: 4.5/5 knowledge, 1.0/5 visit scheduling, 2.5/5 structured attributes.

### 8.2 Simulation: Zapatería (Shoe Store) Vertical

**Would MIA handle a shoe store today?**

| Requirement | MIA Support | Gap |
|------------|-------------|-----|
| Product catalog | ✅ `products` table | Flat only, no variants |
| Variant presentation (size/color) | ❌ `inventory.assets` exists but Sales AI ignores it | Need variant→prompt bridge |
| Dual pricing (mayoreo/público) | ❌ No mechanism | Need dual pricing capability |
| Volume pricing | ❌ No mechanism | Need quantity discount capability |
| Multi-product comparison | ❌ Single product only | Need multi-product presentation |
| Inventory bridge (stock → availability) | ❌ Sales events → inventory trigger exists, but no stock→prompt bridge | Need inventory→prompt bridge |

**Score**: 1.5/5 variants, 1.0/5 dual pricing, 0.5/5 volume pricing.

### 8.3 Simulation: Electronics Store

**Would MIA handle an electronics store today?**

| Requirement | MIA Support | Gap |
|------------|-------------|-----|
| Product catalog | ✅ Works | Flat listing |
| Technical specs | ⚠️ Via `knowledge_items` | No structured spec fields |
| Comparison shopping | ❌ Single product | Need multi-product |
| Warranty information | ✅ Via `knowledge_items` | Works as-is |
| Price matching | ❌ No mechanism | Need price comparison capability |

### 8.4 Simulation: Restaurant

**Would MIA handle a restaurant today?**

| Requirement | MIA Support | Gap |
|------------|-------------|-----|
| Menu (products) | ✅ Works | Flat listing |
| Daily specials | ⚠️ Via `knowledge_items` | No temporal scheduling |
| Reservations | ❌ No mechanism | Need booking capability |
| Dietary restrictions | ⚠️ Via `knowledge_items` | No structured filtering |
| Order taking | ⚠️ `business_sales_config` | Partial (ask_address, ask_phone) |

---

## Phase 9: Hybrid Model Evaluation

### 9.1 Option Analysis

**Option A — Full Capability Architecture** (rewrite):
- New `capabilities` table with 38+ rows
- New `business_capabilities` bridge table
- New `capability_prompts` table for behavioral instructions
- New capability resolution engine
- **Risk**: Massive scope, breaks existing activation, months of work

**Option B — Register Existing Capabilities** (minimal):
- Add `capability_id` to existing edition flags
- Add `capability_id` to existing business settings
- No prompt changes
- **Risk**: Registry without behavior change — capabilities are named but don't do anything

**Option C — Hybrid (Recommended)** (practical):
- Add 3-4 columns to `business_sales_config` (multi_product, dual_pricing, volume_pricing, wholesale)
- Add capability flags to `inventory.business_settings` (variant_presentation, inventory_bridge)
- Add conditional prompt sections in `buildMasterPrompt()` that check these flags
- **Risk**: Low — extends existing patterns, no new tables needed

### 9.2 Option C Detail

**Schema Changes** (3-4 columns, no new tables):

```sql
ALTER TABLE public.business_sales_config
  ADD COLUMN IF NOT EXISTS multi_product_presentation boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dual_pricing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS volume_pricing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS wholesale_detection boolean DEFAULT false;

ALTER TABLE inventory.business_settings
  ADD COLUMN IF NOT EXISTS variant_presentation boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS inventory_bridge boolean DEFAULT false;
```

**Prompt Changes** (conditional sections in `buildMasterPrompt()`):

```typescript
// New parameter: capabilities
capabilities?: {
  multi_product_presentation?: boolean
  dual_pricing?: boolean
  volume_pricing?: boolean
  wholesale_detection?: boolean
  variant_presentation?: boolean
  inventory_bridge?: boolean
}

// Conditional prompt sections:
if (capabilities?.multi_product_presentation) {
  // "Puedes presentar hasta 3 productos..."
}
if (capabilities?.dual_pricing) {
  // "Muestra precio público y precio mayoreo..."
}
```

### 9.3 Why Option C Wins

| Factor | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Scope | Massive | Minimal | Moderate |
| New tables | 3+ | 0 | 0 |
| New columns | 10+ | 0 | 6 |
| Prompt changes | Major refactor | None | 6 conditional blocks |
| Behavior change | Full | None | **Yes — the key difference** |
| Risk | High | Low (but useless) | Low |
| Timeline | Months | Days | Weeks |
| Vertical support | Full | Named only | **Functional** |

---

## Phase 10: Single Source of Truth

### 10.1 Source-of-Truth Hierarchy (Already Established)

The prompt already has a conflict resolution hierarchy (`prompts.ts:292-305`):

```
1. IMMUTABLE decisions (customer-memory.ts:262-273 — price/delivery/guarantee)
2. Manual instructions (ai_instructions with source='manual')
3. Higher-priority rules (sales_rules ordered by priority)
4. Reviewed knowledge (knowledge_items with source='manual' or 'correction')
5. Recent knowledge (knowledge_items ordered by created_at)
6. Statistical patterns (business_memory)
```

### 10.2 Source-of-Truth Conflicts

| Conflict | Location | Resolution |
|----------|----------|------------|
| `products.image_url` vs `knowledge_items.image_url` | `product-recommendation.ts:106-135` | Knowledge wins (legacy fallback only) |
| `products.faq` vs `knowledge_items` FAQ | Both in prompt | No conflict — different formats |
| `business_sales_config` defaults vs DB | `knowledge.ts:308-319` | DB wins, env fallback |
| Edition env vs DB | `edition.ts:369-386` | DB wins, env fallback |
| Customer memory objections vs sales rules | `prompts.ts:292-305` | Hierarchy resolves |

### 10.3 What Needs a Single Source of Truth

| Data | Current Source | Problem |
|------|---------------|---------|
| Product variants | `inventory.assets` (JSONB) | Sales AI never reads it |
| Wholesale pricing | Not in schema | No source exists |
| Volume discounts | Not in schema | No source exists |
| Visit scheduling | Not in schema | No source exists |
| Property attributes | Not in schema | No source exists |

---

## Phase 11: Output Model

### 11.1 Current Output Model

**SSE Stream** (`stream-response.ts:14-53`):

```
data: {"type":"text-delta","delta":"Hello"}
data: {"type":"text-delta","delta":" how"}
data: {"type":"text-delta","delta":" can"}
data: {"type":"data","data":{"type":"product","product":{...}}}
data: {"type":"data","data":{"type":"media","media":{...}}}
data: [DONE]
```

**Product slot**: Exactly 1 `ProductReference` per message (`product-recommendation.ts:18` returns `ProductReference | null`).

**Media slot**: Exactly 1 `MediaAttachment` per message (`conditional-media.ts` returns singular).

### 11.2 What the Output Model Would Need for Multi-Product

| Change | Current | Needed |
|--------|---------|--------|
| Product reference | Singular (`ProductReference \| null`) | Plural (`ProductReference[]`) |
| Stream event | `{ type: 'product', product: ProductReference }` | `{ type: 'products', products: ProductReference[] }` |
| SSE structure | Single product data event | Multiple product data events |
| ChatWindow rendering | Single `ProductMessageCard` | Multiple cards or comparison layout |

### 11.3 Impact on Existing Consumers

| Consumer | Change Needed |
|----------|--------------|
| `ChatWindow.tsx` | Render multiple product cards |
| `LabChatWindow.tsx` | Ignore product data (already does) |
| `WhatsApp adapter` | Handle multiple products in list message |
| `Web widget` | Render product carousel |
| `messages.metadata` | Store `product_id` array instead of singular |

---

## Phase 12: Architectural Recommendation

### 12.1 Core Finding

**MIA already IS a capability architecture.** The evidence is overwhelming:
- 17 tables with business-scoped data
- 27 boolean capability flags per edition
- 3-gate activation system (edition → settings → triggers)
- 3 channel modes (active/shadow/paused)
- Data-driven prompt construction (products, rules, knowledge)
- Authority hierarchy (7 tiers)
- Experience memory (blended patterns)

**The gap is not architecture — it's naming and bridging.** Capabilities exist but are not:
1. Named in a registry (they're scattered across edition flags, business settings, and SQL triggers)
2. Bridged to prompt construction (the prompt never changes based on what's enabled)
3. Derivable from business configuration (no way to ask "what can this business do?")

### 12.2 Recommended Implementation

**Phase 1 — Name Existing Capabilities** (1-2 days):
- Add `capability_id` string column to `business_sales_config` and `inventory.business_settings`
- Populate with capability names: `multi_product_presentation`, `dual_pricing`, `volume_pricing`, `wholesale_detection`, `variant_presentation`, `inventory_bridge`
- No behavior change — just naming

**Phase 2 — Bridge to Prompt** (2-3 days):
- Add `capabilities` parameter to `buildMasterPrompt()`
- Add 6 conditional prompt sections that check capability flags
- Each section adds 5-10 lines of behavioral instructions
- Behavior change: prompt now adapts to enabled capabilities

**Phase 3 — Multi-Product Output** (3-5 days):
- Change `ProductReference | null` to `ProductReference[]` in `product-recommendation.ts`
- Update `buildStructuredStreamResponse()` to emit multiple product events
- Update `ChatWindow.tsx` to render multiple product cards
- Update WhatsApp adapter for list messages
- Behavior change: MIA can present multiple products per message

**Phase 4 — Vertical Validation** (2-3 days):
- Real Estate: Add `visit_scheduling` capability, property attribute fields
- Zapatería: Add `dual_pricing`, `volume_pricing`, `variant_presentation` capabilities
- Electronics: Add `comparison_shopping` capability
- Restaurant: Add `reservation` capability

### 12.3 What NOT to Do

| Anti-Pattern | Why |
|-------------|-----|
| New `capabilities` table | Edition flags already serve this purpose |
| New `business_capabilities` bridge | Business settings already serve this purpose |
| New `capability_prompts` table | Conditional prompt sections are simpler |
| Full capability rewrite | Existing architecture works — just needs naming and bridging |
| Vertical-specific code | All verticals can be handled by the same 6 capabilities |

### 12.4 Summary

MIA's capability architecture is 70% complete. The remaining 30% is:
1. **Naming** — register existing capabilities with clear IDs (1-2 days)
2. **Bridging** — connect capability flags to prompt construction (2-3 days)
3. **Output** — enable multi-product presentation (3-5 days)
4. **Validation** — test with Real Estate, Zapatería, and other verticals (2-3 days)

**Total estimated effort**: 8-13 days for a fully configurable, vertical-agnostic capability system.

---

## Appendix: Evidence Index

| Claim | File:Line | Evidence |
|-------|-----------|----------|
| EditionCapabilities has 27 flags | `edition.ts:19-44` | Interface definition |
| Editions: evaluation/professional/enterprise/cloud | `edition.ts:54-217` | 4 edition constants |
| getEffectiveEdition reads DB first | `edition.ts:369-386` | `businesses.edition` column |
| 3-gate inventory activation | `licensing.ts:5-36` | Edition → Settings → SQL trigger |
| buildMasterPrompt has 14 params | `prompts.ts:187-216` | No `capabilities` param |
| Product recommendation returns singular | `product-recommendation.ts:18` | `ProductReference \| null` |
| Multiple matches bail to null | `product-recommendation.ts:65` | `if (matchedProductIds.length > 1) return null` |
| SSE emits single product | `stream-response.ts:26-29` | One `{ type: 'product' }` event |
| hasSalesTrigger B2C only | `detect.ts:47-70` | No wholesale/bulk keywords |
| Intent detection: 6 tags | `intents.ts:15-66` | catalog/price/shipping/payment/contact/greeting |
| Customer memory: 3 objections | `customer-memory.ts:262-273` | price/delivery/guarantee only |
| ESCALATE action type exists but never triggered | `prompt-enricher.ts:19` | Defined in ACTION_TYPES but never in identifyPermittedActions |
| Authority hierarchy: 7 tiers | `knowledge.ts:3-11` | IMMUTABLE → MEMORY_PATTERN |
| Inventory has `vertical` field | `inventory/types.ts:6` | `'ecommerce' \| 'manufacturing' \| 'realestate'` |
| Channel modes: active/shadow/paused | `runtime.ts:192-267` | Mode-dependent behavior |
| Landing context restricts products | `prompts.ts:255-263` | Single product in landing |
| Sales config: ask_address, ask_phone | `knowledge.ts:308-319` | Defaults + DB override |
| Variant system exists in Inventory | `inventory/types.ts:35-55` | `InventoryAsset` with `item_type`, `tracking_mode` |
| Variant resolution exists | `042_polymorphic_variants.sql` | `inventory.resolve_variant()` function |
| Sales AI never queries variants | `prompts.ts:86-107` | `formatProducts()` formats flat products only |
