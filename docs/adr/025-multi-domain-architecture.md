# ADR-025: MIA Platform Multi-Domain Architecture

## Status

Accepted

## Date

2026-08-18

## Supersedes

ADR-010 (MIA Sales Domain Boundary) — marked as Superseded

## Council

CTO, Architect, Domain Expert, Database Engineer, Backend Engineer, Security Engineer, Performance Engineer, AI Engineer, Analytics Engineer, QA Engineer

---

## 1. Context

ADR-010 defined MIA as a single-domain "Conversational Sales Intelligence" platform. This was correct when MIA consisted solely of sales conversation features. However, the codebase has evolved significantly:

- **ADR-019** (2026-08-08): Created the Delivery Hub as an isolated module with its own PostgreSQL schema (`delivery`), triggers on `sales_events`, and independent API/UI.
- **ADR-020** (2026-08-08): Created the Inventory Hub as an isolated module with its own PostgreSQL schema (`inventory`), triggers on `sales_events`, and independent API/UI.
- Both modules follow identical patterns: schema isolation, `ENABLE RLS + FORCE RLS + REVOKE ALL`, `business_settings.enabled` gating, `ingest_errors` for fail-safe trigger handling, and edition-based licensing.

The current state is that **the codebase already implements a multi-domain architecture**, but the documentation (ADR-010), the PRD Generator, and the Governance system still assume a single-domain (Sales) worldview. This creates a concrete problem: the PRD Generator flags Inventory features as `inDomain: false` because ADR-010's boundary test ("Does this help MIA sell better?") does not recognize non-sales modules.

This ADR formalizes the multi-domain architecture that the codebase has already built, aligns documentation with reality, and updates the Governance system to classify features by domain.

---

## 2. Decision

**MIA Platform is a multi-domain federation.** Sales is the commercial entry point. Inventory, Delivery, and Analytics are independent, optional modules. Each domain maintains autonomy, owns its data, and communicates via explicit contracts. Analytics observes enabled modules in read-only mode.

### 2.1 Core Statement

> MIA Platform consists of independent domains, each with its own responsibilities, data, and logic. Sales is always the entry point for customer conversations. Inventory, Delivery, and Analytics are optional modules that a business can contract independently. Domains communicate via events and explicit read-only interfaces. No domain directly modifies another domain's internal data.

### 2.2 The Five Domains

| Domain | Schema | Responsibility | Boundary Test |
|--------|--------|---------------|---------------|
| **Platform/Core** | `public` (shared tables) | Identity, configuration, tenant management, shared infrastructure | "Does this serve the platform infrastructure?" |
| **Sales** | `public` (sales tables) | Customer conversations, product presentation, closing, follow-up | "Does this help converse with or sell to customers?" |
| **Inventory** | `inventory` | Stock management, catalog availability, purchasing, suppliers | "Does this manage stock, catalog, purchasing, or suppliers?" |
| **Delivery** | `delivery` | Order fulfillment, driver management, route planning | "Does this fulfill orders, manage drivers, or plan routes?" |
| **Analytics** | `analytics` (FUTURE) | Cross-domain insights, business intelligence | "Does this generate cross-domain business insights?" |

### 2.3 Diagram

```
                         CLIENTE
                            │
                            ▼
                    ┌───────────────┐
                    │ MIA Platform  │  ← public (shared infra)
                    │   Core        │
                    └───────┬───────┘
                            │
                    ┌───────┴───────┐
                    │  MIA Sales    │  ← public (conversation + sales)
                    │  (entry)      │
                    └───────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
          INVENTORY     DELIVERY     ANALYTICS
          inventory     delivery     analytics (FUTURE)
             🔒            🔒            🔒
          (optional)   (optional)   (optional)
```

---

## 3. Domain Definitions

### 3.1 Platform/Core

| Aspect | Definition |
|--------|-----------|
| **Responsibility** | Identity, configuration, tenant management, shared infrastructure, cross-domain coordination |
| **Owns** | `businesses`, `brand_identities`, `ai_instructions`, `assistants`, `assistant_channels`, `channel_connections`, `whatsapp_sessions`, `business_sales_config`, `ai_usage`, `mia_signals`, `media_assets` |
| **Can read** | Everything (it IS the platform) |
| **Can modify** | Platform-level configuration only. Never modifies module-internal data. |
| **Events published** | `sales_events` (14 types), `mia_signals` |
| **Events consumed** | None (it is the origin) |
| **Dependencies allowed** | None (it IS the foundation) |
| **Dependencies prohibited** | Must not depend on any module's internal implementation |

### 3.2 Sales

| Aspect | Definition |
|--------|-----------|
| **Responsibility** | Customer conversations, sales intelligence, product presentation, closing, follow-up |
| **Owns** | `products`, `knowledge_items`, `knowledge_versions`, `sales_rules`, `customers`, `assistant_memories`, `conversations`, `messages`, `learning_events`, `sales_events`, `conversation_notes`, `business_memory` |
| **Can read** | Delivery: `delivery.orders` (order number lookup, optional with graceful fallback) |
| **Can modify** | Own tables only. Never modifies delivery/inventory/analytics data. |
| **Events published** | 14 `sales_events` types (the central event bus) |
| **Events consumed** | None via events. Reads delivery orders via direct query (graceful fallback). |
| **Dependencies allowed** | `delivery.orders` (read-only, optional, try/catch) |
| **Dependencies prohibited** | `inventory.*` (no direct access), `delivery.*` writes, `analytics.*` |

### 3.3 Inventory

| Aspect | Definition |
|--------|-----------|
| **Responsibility** | Stock management, catalog availability, demand prediction, purchasing, supplier management |
| **Owns** | `business_settings`, `stock_items`, `stock_movements`, `assets`, `asset_products`, `locations`, `predictions`, `suppliers`, `purchase_orders`, `bom_items`, `restock_suggestions`, `transfers`, `delivery_promises`, `ingest_errors`, `audit_log` |
| **Can read** | `public.sales_events` (velocity calculations), `public.products` (unit cost, SKU mapping) |
| **Can modify** | Own schema only. Never writes to `public`, `delivery`, or `analytics`. |
| **Events published** | `stock_movements` (ledger), `restock_suggestions` |
| **Events consumed** | `sales_events.SALE_WON` (via trigger — decrements stock) |
| **Dependencies allowed** | `public.sales_events` (read), `public.products` (read) |
| **Dependencies prohibited** | `delivery.*`, `analytics.*`, `public.*` writes |

### 3.4 Delivery

| Aspect | Definition |
|--------|-----------|
| **Responsibility** | Order fulfillment, driver management, route planning, delivery execution, daily closure |
| **Owns** | `business_settings`, `drivers`, `routes`, `orders`, `visits`, `driver_events`, `daily_closures`, `driver_sessions`, `outbox_events`, `evidence_photos`, `order_counters`, `ingest_errors`, `audit_log` |
| **Can read** | `public.customers` (snapshot at order creation) |
| **Can modify** | Own schema only. Never writes to `public`, `inventory`, or `analytics`. |
| **Events published** | `outbox_events` (WhatsApp notifications), `driver_events` (driver actions) |
| **Events consumed** | `sales_events.SALE_WON` (via trigger — creates order) |
| **Dependencies allowed** | `public.sales_events` (trigger), `public.customers` (read at trigger time) |
| **Dependencies prohibited** | `inventory.*`, `analytics.*`, `public.*` writes |

### 3.5 Analytics (FUTURE)

| Aspect | Definition |
|--------|-----------|
| **Responsibility** | Cross-domain insights, business intelligence, trend analysis, recommendations |
| **Owns** | Aggregated views, materialized views, analysis results, reports |
| **Can read** | `public.*` (sales data), `delivery.*` (orders, closures), `inventory.*` (stock, movements, predictions) |
| **Can modify** | Own schema only. Never writes to sales, delivery, or inventory schemas. |
| **Events published** | Insights, recommendations, alerts (consumed by dashboard, not by other modules) |
| **Events consumed** | All domain events (SALE_WON, ORDER_DELIVERED, INVENTORY_LOW_STOCK, etc.) |
| **Dependencies allowed** | Read-only access to all enabled modules |
| **Dependencies prohibited** | Write access to any module, direct modification of module data |

---

## 4. Communication Protocol

### 4.1 Established Patterns (Already Implemented)

| Pattern | Mechanism | Example |
|---------|-----------|---------|
| **1-way triggers** | DB trigger `AFTER INSERT ON public.sales_events` | `delivery.handle_sale_won()`, `inventory.handle_sale_won()` |
| **Direct read queries** | TypeScript queries across schemas via admin client | `fetchOrderNumber()` reads `delivery.orders`, `getBusinessContext()` reads `inventory.assets` |
| **Fail-safe triggers** | `EXCEPTION → ingest_errors`, never abort source | Both Delivery and Inventory triggers catch all errors |
| **Gated by enabled** | `business_settings.enabled` check in trigger | Trigger silently skips when `enabled=false` |

### 4.2 Future Event Protocol

For new cross-module events, use the same pattern:

1. **Source module** writes to its own event table
2. **DB trigger** fires to notify consumers
3. **Consumer modules** subscribe via triggers or polling
4. **Each consumer** has its own `ingest_errors` for resilience

### 4.3 Eventual Consistency Guarantees

| Guarantee | Implementation |
|-----------|---------------|
| **At-least-once delivery** | Idempotency keys on all event consumers |
| **Ordering within a business** | `created_at` timestamp + business_id scoping |
| **No cross-module transactions** | Each module processes events independently |
| **Failure isolation** | `ingest_errors` per module, never abort source |
| **Staleness tolerance** | Analytics accepts lag (materialized view refresh interval) |

---

## 5. Module Lifecycle

### 5.1 Module States

| State | Edition | `business_settings.enabled` | Behavior |
|-------|---------|---------------------------|----------|
| **Not available** | `evaluation` / `professional` | N/A | Paywall shown. API returns 403. Triggers skip silently. |
| **Available but disabled** | `enterprise` / `cloud` | `false` | Module visible. Settings accessible. Operational API returns 403. Triggers skip. |
| **Enabled** | `enterprise` / `cloud` | `true` | Full functionality. Triggers active. |
| **Newly contracted** | Upgraded to `enterprise`/`cloud` | `false` | Admin configures and enables. No data loss. |
| **Suspended** | Downgraded to `professional` | Remains `true` in DB | Edition gate blocks. Data preserved. Re-upgrade restores. |
| **Cancelled** | Set to `evaluation` | Remains `true` in DB | Same as suspended. Data preserved for re-activation. |

### 5.2 Two-Tier Defense

```
Layer 1: Edition Gate (canBusinessUse*Hub)
  → Checks businesses.edition or MIA_EDITION env
  → Blocks at UI level (paywall) and API level (403)

Layer 2: Enabled Gate (business_settings.enabled)
  → Per-tenant toggle
  → Blocks at API level (403) and trigger level (silent skip)
```

---

## 6. Analytics Architecture (FUTURE)

### 6.1 Design Principles

- **Dedicated schema** (`analytics`) with same isolation pattern as Delivery/Inventory
- **Read-only access** to all enabled modules via views
- **Materialized views** for heavy aggregations (refreshed periodically, not real-time)
- **Service-role only** — never expose cross-schema joins to PostgREST
- **Gated by each module's enabled flag** — if a module is disabled, its analytics view returns empty for that business

### 6.2 Cross-Schema Access Pattern

```sql
-- analytics.sales_summary (view)
CREATE VIEW analytics.sales_summary AS
SELECT business_id, event_type, COUNT(*) as event_count, SUM(amount) as total_amount
FROM public.sales_events
GROUP BY business_id, event_type;

-- analytics.inventory_status (view)
CREATE VIEW analytics.inventory_status AS
SELECT si.business_id, a.sku, a.current_qty, si.low_stock_threshold
FROM inventory.assets a
JOIN inventory.stock_items si ON ...
WHERE a.current_qty <= si.low_stock_threshold;

-- analytics.delivery_performance (view)
CREATE VIEW analytics.delivery_performance AS
SELECT o.business_id, COUNT(*) as total_orders,
  SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) as delivered
FROM delivery.orders o
GROUP BY o.business_id;
```

### 6.3 Security Model

```sql
ALTER SCHEMA analytics OWNER TO postgres;
REVOKE ALL ON SCHEMA analytics FROM anon, authenticated, PUBLIC;
GRANT USAGE ON SCHEMA analytics TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA analytics TO service_role;
```

---

## 7. Multi-Domain Features

### 7.1 Classification Rules

When a feature could belong to multiple domains:

| Feature | Primary Domain | Affected Domains |
|---------|---------------|-----------------|
| "Show stock during conversation" | Sales | `[sales, inventory]` |
| "Auto-reorder when low" | Inventory | `[inventory]` |
| "Track delivery in real-time" | Delivery | `[delivery]` |
| "Why did conversion drop?" | Analytics | `[analytics, sales]` |
| "New auth system" | Platform | `[platform]` |
| "Inventory + Delivery integration" | Cross-module | `[inventory, delivery]` |

### 7.2 Governance Routing

When `affectedDomains.length > 1`:
1. The PRD is routed to **all affected domain experts**
2. Each domain expert reviews their portion independently
3. The Architect ensures cross-domain contracts are clean
4. Quality gates include tests for **each affected module**

---

## 8. Boundary Tests

The superior rule when a feature could belong to multiple domains:

```
1. Platform    → "Does this serve the platform infrastructure?"
2. Sales       → "Does this help sell better?"
3. Inventory   → "Does this manage stock/catalog?"
4. Delivery    → "Does this fulfill orders?"
5. Analytics   → "Does this generate cross-domain insights?"
```

If a feature does not match any domain test, it is outside MIA Platform.

---

## 9. What This ADR Changes

### 9.1 Supersedes ADR-010

ADR-010 defined a single-domain boundary. This ADR replaces it with a multi-domain model. ADR-010 is marked as **Superseded**.

Key changes from ADR-010:
- "MIA's sole domain is sales conversations" → "MIA has 5 independent domains"
- Binary `inDomain` test → Multi-domain classification
- "MIA does NOT: inventory, routing, delivery" → "Inventory and Delivery are independent domains"
- 12 event types as "exclusive integration contract" → 14+ types with module-specific events

### 9.2 Updates Governance System

- PRD Generator: `inDomain` boolean → `primaryDomain` + `affectedDomains`
- Orchestrator: Domain-aware routing to appropriate experts
- Types: New `BusinessDomain` type

### 9.3 Does NOT Change

- Existing schemas (public, delivery, inventory) — already correct
- Existing triggers — already correct
- Existing RLS policies — already correct
- Existing module gating — already correct
- Existing fail-safe patterns — already correct

---

## 10. Consequences

### Positive

- Documentation aligns with codebase reality
- PRD Generator correctly classifies Inventory/Delivery features
- Governance system routes work to appropriate domain experts
- Clear boundaries prevent accidental monolith creep
- Multi-domain features get proper cross-domain review
- Analytics can be built on a formal foundation when needed

### Negative

- More complex domain model (5 domains vs. 1)
- PRD system needs multi-domain output schema
- Governance system needs domain-aware routing
- Team must think in terms of domains, not just "features"

### Risks Mitigated

- **Analytics becomes "God module"**: Analytics is read-only, cannot modify other schemas
- **Accidental monolith**: Each feature must pass domain boundary test
- **Platform/Core becomes monolith**: Platform only handles identity, config, shared infra
- **Sales becomes "owner"**: Sales emits events but never consumes module-internal data

---

## 11. What NOT to Build Yet

| Item | Why Not |
|------|---------|
| Domain Module SDK/Framework | ADR-019/020 patterns are sufficient. Generalize when Analytics proves the pattern needs it. |
| `analytics` schema | Build when the business actually needs cross-domain insights. |
| Cross-module event bus | PostgreSQL triggers on `sales_events` are sufficient. Don't introduce Kafka/RabbitMQ until scale demands it. |
| Domain-specific agent roles | Existing 16 agents can handle multi-domain work. Add specialists only when complexity demands it. |

---

## 12. References

- ADR-010 — MIA Sales Domain Boundary (Superseded by this ADR)
- ADR-019 — Delivery Hub (established the isolated module pattern)
- ADR-020 — Inventory Hub (reused the isolated module pattern)
- `src/lib/system/edition.ts` — Module licensing and capabilities
- `src/lib/prd/builder.ts` — PRD Generator (updated in this ADR)
- `workshop/governance/orchestrator.ts` — Task classification (updated in this ADR)

---

## 13. Council Perspectives

### CTO

This ADR is the natural evolution. The codebase built the multi-domain reality before the documentation caught up. Formalizing it now prevents architectural drift and enables the Governance system to correctly route work across domains.

### Architect

The federated model maps cleanly to Domain-Driven Design bounded contexts. Each domain has its own model, its own data, and its own lifecycle. The event-driven communication via `sales_events` is a proven integration pattern that avoids tight coupling.

### Domain Expert

This ADR codifies what ADR-019 and ADR-020 already established: independent domains with shared platform infrastructure. The 15 original sales entities remain in `public`, while new domains own their schemas. No entity needs to be created, removed, or modified.

### Product Manager

The mental model is clean: "MIA Platform has departments. You hire the departments you need." This is easier to explain, easier to sell, and easier to use than a monolithic platform.

### Database Engineer

Schema isolation is already proven across 3 schemas. The Analytics schema will follow the same pattern. No changes to existing schemas are required by this ADR.

### Security Engineer

Each domain maintains its own RLS + REVOKE isolation. Analytics uses service-role only for cross-schema queries. The security model is unchanged and remains sound.

### AI Engineer

The PRD Generator now correctly classifies features by domain. Multi-domain features get proper cross-domain review. The AI system prompt must be updated to reflect the multi-domain architecture.

### QA Engineer

Each domain needs its own test suite. Cross-domain integration tests verify event flow and data consistency. Quality gates include module-specific tests.

---

## 14. Migration Plan

### Phase 1: Formalize (This ADR)

- [x] Create ADR-025
- [ ] Mark ADR-010 as Superseded
- [ ] Update AGENTS.md
- [ ] Update PRD Generator (types + builder)
- [ ] Update Governance (types + orchestrator + CLI)

### Phase 2: Analytics (FUTURE — when business need exists)

- [ ] Create `analytics` schema
- [ ] Create cross-domain views
- [ ] Create materialized views for heavy aggregations
- [ ] Create Analytics API routes
- [ ] Create Analytics dashboard UI

### Phase 3: Cross-Module Events (FUTURE — when consumers exist)

- [ ] Define event schema for INVENTORY_LOW_STOCK, ORDER_DELIVERED
- [ ] Implement event producers in source modules
- [ ] Implement event consumers in target modules
- [ ] Add idempotency and resilience patterns
