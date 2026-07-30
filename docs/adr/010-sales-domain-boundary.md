# ADR-010: MIA Sales Domain Boundary

## Status

Accepted

## Date

2026-07-29

## Council

CTO, Architect, Domain Expert, Product Manager, Backend Engineer, Frontend Engineer, Database Engineer, AI Engineer, QA Engineer, Security Engineer

---

## 1. Context

Since MIA's inception, the platform has been described as "an AI sales assistant." However, no formal boundary had been defined between what MIA **does** (sales conversation) and what MIA **does not do** (operations, logistics, billing). As the platform matured through multiple sprints — auth, onboarding, knowledge management, Laboratorio simulation, runtime extraction — the risk of implicit scope expansion grew.

Without an explicit domain boundary, the following risks accumulate:

- **Scope creep**: Stakeholders may request operational features ("Can MIA also manage inventory?") that dilute the product's purpose.
- **Architectural pollution**: Operational concerns would introduce tables, routes, and logic orthogonal to sales conversation.
- **AI confusion**: The assistant's prompts would need to cover both sales and operations, degrading performance in both.
- **Security surface expansion**: Operational data (pricing logic, customer financial data) is more sensitive and requires stricter controls.
- **Product identity loss**: "AI sales assistant" becomes "AI business assistant," losing focus and market differentiation.

The Council convened to formalize the boundary, establish explicit responsibilities and prohibitions, and ensure the entire engineering organization aligns around a single vision.

---

## 2. Problem

MIA's original documentation stated "MIA is an AI sales assistant" but did not define:

1. Where MIA's responsibility **begins** (what triggers its involvement).
2. Where MIA's responsibility **ends** (what happens after its job is done).
3. What MIA **explicitly does not do** (operational responsibilities that belong to other systems).
4. What events MIA **generates** for downstream consumption.

The absence of this boundary creates ambiguity for every engineering decision: "Should we add this feature?" currently has no clear answer.

---

## 3. Decision

**MIA is a Conversational Sales Intelligence platform. Its sole domain is sales conversations. It has zero responsibility for operational, logistical, or administrative processes.**

### 3.1 Core Statement

> MIA's responsibility begins when a conversation with a customer starts. It ends when:
> 1. The sale is closed or discarded,
> 2. The data is structured,
> 3. Sales Intelligence events are recorded.
>
> Everything after that belongs to another domain.

### 3.2 Sales Events (Single Source of Integration)

MIA generates Sales Intelligence events for downstream consumption. It does **not** process these events further.

```
SALE_STARTED
PRODUCT_SELECTED
OBJECTION_DETECTED
OBJECTION_RESOLVED
UPSELL_ACCEPTED
CROSSSELL_ACCEPTED
FOLLOWUP_REQUIRED
SALE_WON
SALE_LOST
CUSTOMER_HESITATION
PRICE_ACCEPTED
PRICE_REJECTED
```

These events are the **exclusive integration contract** between MIA and external systems (ERP, CRM, billing, logistics, etc.).

---

## 4. Domain Limits

### 4.1 Inbound Boundary

MIA's domain begins when:

| Trigger | Description |
|---------|-------------|
| Customer sends a message via any channel | Web chat, WhatsApp, Instagram, etc. |
| Assistant initiates proactive contact | Follow-up / recovery outreach |
| Simulation session starts | Laboratorio MIA training |

### 4.2 Outbound Boundary

MIA's domain ends when:

| Terminal State | Description |
|----------------|-------------|
| Sale closed | Customer accepts, data captured, SALE_WON emitted |
| Sale discarded | Customer rejects or disengages, SALE_LOST emitted |
| Follow-up required | Needs future contact, FOLLOWUP_REQUIRED emitted |
| Data structured | Customer data, selected products, preferences captured |
| Events emitted | All relevant Sales Intelligence events recorded |

### 4.3 Event Flow

```
MIA Domain                      External Systems
┌─────────────────────┐         ┌────────────────┐
│  Conversation       │         │  ERP           │
│  Sales Intelligence │ ──────► │  CRM           │
│  Event Generation   │  Events │  Billing       │
│  Data Structuring   │         │  Logistics     │
└─────────────────────┘         │  Inventory     │
                                │  Analytics     │
                                └────────────────┘
```

MIA **emits** events. MIA **does not** consume, process, or manage downstream results.

---

## 5. Explicit Responsibilities of MIA

MIA **must** optimize these capabilities:

### 5.1 Conversational Abilities

| Capability | Description |
|------------|-------------|
| Conversation | Natural, fluent dialogue across channels |
| Rapport | Emotional connection and trust building |
| Need Discovery | Uncover customer pain points and desires |
| Product Presentation | Present products based on discovered needs |
| Objection Handling | Address and resolve customer objections |
| Closing Techniques | Guide toward commitment |
| Customer Recovery | Re-engage inactive or lost customers |
| Intelligent Follow-up | Timely, context-aware re-contact |
| Consultative Selling | Act as advisor, not just order-taker |
| Upselling | Offer premium alternatives when appropriate |
| Cross-selling | Offer complementary products when appropriate |

### 5.2 Data Responsibilities

| Responsibility | Description |
|----------------|-------------|
| Correct Data Capture | Structure customer-provided information |
| Sales Event Recording | Generate and persist Sales Intelligence events |
| Conversation Memory | Remember customer context across sessions |
| Training & Learning | Improve through corrections and simulation |

### 5.3 Product Responsibilities

| Entity | Purpose |
|--------|---------|
| Products | Structured data for **presentation** to customers |
| Knowledge Base | Sales knowledge (FAQs, objections, tips) |
| Sales Rules | Behavioral rules for sales conversations |
| AI Instructions | How the assistant should behave |
| Brand Identity | Tone, personality, communication style |
| Customers | Commercial memory (not operational profiles) |

---

## 6. Explicitly Prohibited Responsibilities

MIA **must never** assume these responsibilities:

| Prohibited Area | Reason |
|-----------------|--------|
| **ERP operations** | Inventory management, purchase orders, supplier management |
| **Inventory control** | Stock tracking, warehouse management, SKU reconciliation |
| **Route calculation** | Delivery route optimization, geolocation tracking |
| **Driver management** | Delivery personnel assignment, shift scheduling |
| **Payment collection** | Payment processing, collection workflows, debt tracking |
| **Invoice generation** | Billing, receipts, tax document creation |
| **Logistic decisions** | Shipping method selection, carrier management, dispatch |
| **Financial reconciliation** | Payment vs invoice matching, dispute resolution |
| **Operational dashboards** | KPIs for logistics, inventory, finance |

### 6.1 Boundary Test

When evaluating any proposed feature, ask:

> **"Does this help MIA sell better?"**

If the answer is no — if the feature is about operating, tracking, or managing operations — it belongs to another domain.

---

## 7. Technical Impact

### 7.1 Current Codebase Assessment

The Council reviewed the entire codebase and confirmed:

| Area | Verdict |
|------|---------|
| Database schema (15 tables) | **Clean** — All tables are sales-focused. No operational tables exist. |
| API routes (`src/app/api/`) | **Clean** — No operational routes (no /inventory, /orders, /billing, /logistics). |
| UI components (`src/components/`) | **Clean** — One minor finding addressed below. |
| AI prompts (`src/lib/ai/`) | **Clean** — Prompts focus on sales conversation. |
| Laboratorio (`src/app/api/laboratorio/`) | **Clean** — Simulation modes are customer-difficulty focused, not operational. |
| Channel system (`src/lib/channels/`) | **Clean** — Message routing, not logistics. |
| Runtime (`src/lib/runtime/`) | **Clean** — Conversation execution, not business process execution. |

### 7.2 Minor Finding

`src/components/laboratorio/ScenariosPanel.tsx:26` contains the word "logística" in a training scenario focus label. This is acceptable — it refers to a **sales scenario** where the customer asks about logistics (a realistic sales conversation), not to MIA performing logistics. No change required.

### 7.3 Security Impact

| Factor | Impact |
|--------|--------|
| Attack surface | **Reduced** — No operational data means less sensitive information to protect. |
| Data sensitivity | **Lower** — Sales conversation data is less sensitive than financial/operational data. |
| Permission model | **Simpler** — No need for operational role hierarchies. |
| RLS complexity | **Unchanged** — Current policies remain sufficient. |
| Event integration | **Controlled** — One-way event emission reduces exposure vs. bidirectional integration. |

### 7.4 No Migration Required

The current schema already respects this boundary. No tables need to be added, removed, or modified. The `products` table notably lacks columns like `stock_quantity`, `warehouse_location`, `supplier_id` — confirming its purpose is sales presentation, not inventory management.

---

## 8. Impact on Future Sprints

### 8.1 Sprint Priority Changes

After this decision, the following roadmap adjustments are recommended:

| Sprint | Original Priority | Adjusted Priority | Rationale |
|--------|-------------------|-------------------|-----------|
| Phase 3: Knowledge | High | **Unchanged** | Knowledge management is core to sales intelligence. |
| Phase 4: Analytics | Medium | **Unchanged** | Sales analytics (close rates, objection patterns) are in-domain. |
| Phase 5: Channels | High | **Unchanged** | Multi-channel expands conversational reach. |
| Phase 6: Billing Integration | Medium | **Reduced to Low** | Billing integration is downstream — belongs to external system integration, not MIA core. Should be deferred until Sales Intelligence event system is stable. |
| Phase 7: Advanced Laboratorio | Medium | **Unchanged** | Simulation with more customer personas improves sales training. |
| Inventory sync feature | Not prioritized | **Rejected** | Inventory is explicitly out of domain. Never add. |
| Payment gateway integration | Not prioritized | **Rejected** | Payment processing is explicitly prohibited. |

### 8.2 New Roadmap Items

| New Priority | Item | Rationale |
|--------------|------|-----------|
| **High** | Sales Intelligence Event System | The event emission layer (tables, API, prompt integration) is now a prerequisite for all downstream integrations. Must be built before any external system integration. |
| **Medium** | Event integration examples | Reference implementations showing how external systems consume MIA events (webhook examples, API documentation). |
| **Low** | External system adapters (ERP, CRM) | Once the event system is stable, build adapters that translate MIA events into specific external system formats. |

---

## 9. Risks Avoided

| Risk | How This Decision Avoids It |
|------|----------------------------|
| Scope creep into operations | Explicit prohibition gives clear "no" to every operational feature request. |
| Architectural pollution | No operational tables, routes, or logic will enter the codebase. |
| AI capability dilution | Prompts remain focused on sales — no split attention with operations. |
| Security bloat | No financial or operational data means simpler compliance and fewer breach risks. |
| Product identity loss | "Best sales assistant" is a clear, defensible market position. |
| Maintenance burden | Fewer features = fewer bugs, less technical debt, lower cognitive load. |
| Integration coupling | One-way event emission prevents tight coupling with external systems. |

---

## 10. Recommendations for Maintaining This Boundary

### 10.1 Engineering Practices

1. **Code review gate**: Every PR must pass the boundary test ("Does this help MIA sell better?").
2. **Architecture review**: Any new table, route, or module that touches operations must be rejected by Architect.
3. **AI prompt audit**: Quarterly review to ensure prompts don't drift into operational instructions.
4. **Event contract stability**: The Sales Intelligence event schema must be versioned and stable before any external system integration.

### 10.2 Product Practices

1. **Feature definition**: Every feature ticket must include a "Domain alignment" section explaining how it fits within the sales boundary.
2. **Stakeholder education**: When operational features are requested, explain that MIA emits events for other systems to consume — it does not perform operations.
3. **Integration over extension**: When operational needs arise, build event consumers in external systems, not new features in MIA.

### 10.3 AI Prompt Guidelines

The AI Engineer must ensure the system prompt includes explicit boundary instructions:

```
You are a sales assistant. Your role ends when the sale is closed or discarded.
You do not process payments, manage inventory, calculate shipping, or handle logistics.
You record sales events for other systems to process.
```

### 10.4 Event-First Integration

All external system integrations must follow this pattern:

1. MIA generates a Sales Intelligence event.
2. The event is persisted in MIA's database.
3. An external system consumes the event (via webhook, polling, or API).
4. The external system performs the operational action.

MIA never calls external operational APIs directly.

---

## 11. Council Perspectives

### CTO

This decision is the single most important architectural boundary MIA will ever draw. It keeps the platform scalable by preventing the #1 cause of platform bloat: scope creep into adjacent domains. MIA stays lean, focused, and excellent at one thing — sales conversation.

### Architect

The formal boundary creates a clean "black box" architecture. MIA takes conversation in, emits structured events out. What happens on either side is someone else's problem. This maps directly to a bounded context in Domain-Driven Design terms.

### Domain Expert

This ADR codifies what was always implicit. All 15 domain entities are sales-focused. The `products` table is for presentation, not inventory. The `customers` table is commercial memory, not operational profiles. No entity needs to be created, removed, or modified.

### Product Manager

This is the right decision for users. A business owner thinks of MIA as "my salesperson," not "my operations manager." Keeping the product focused on selling makes it easier to explain, easier to use, and easier to sell.

### Backend Engineer

No code changes needed today. The backend is clean. Going forward, this boundary simplifies every implementation decision: if a request involves operations, the answer is no.

### Frontend Engineer

No UI changes needed. The only finding (ScenariosPanel logistics reference) is about training content, not operations. Future UI must never assume operational capabilities.

### Database Engineer

Schema is already aligned. No migration needed. The absence of operational columns (stock, warehouse, supplier, invoice) in the current schema confirms that the domain boundary was implicitly respected from the start.

### AI Engineer

This sharpens the AI roadmap. Every learning capability must be about selling better — objection handling, closing, upselling, rapport. The Sales Intelligence event system must be integrated into prompts so the AI generates events naturally during conversation.

### QA Engineer

Acceptance criteria should now test: (1) Does the conversation conclude correctly? (2) Are Sales Intelligence events emitted? (3) Does MIA avoid operational language? Tests should never check operational outcomes.

### Security Engineer

Smaller domain means smaller attack surface. No operational data means fewer compliance requirements. The event-based integration model is more secure than bidirectional API calls. This decision has a net-positive security impact.

---

## 12. References

- `AGENTS.md` — Main agent guide (updated to reflect this boundary)
- `supabase/migrations/001_initial_schema.sql` — Current schema (no operational tables)
- `docs/adr/001-agent-system.md` — Engineering agent system
- `src/lib/runtime/runtime.ts` — Conversation execution
- `src/lib/channels/` — Channel abstraction (message routing, not logistics)
- `src/lib/ai/prompts.ts` — Prompt builder (must respect domain boundary)
