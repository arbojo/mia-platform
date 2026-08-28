# Real Estate Vertical Readiness Report

**Date**: 2026-08-26
**HEAD**: `681c4b8`
**Type**: READ-ONLY forensic audit. No code changes, no DB changes, no migrations.

## Central Question

> How ready is MIA to serve a real estate business (property listings, client
> management, visit scheduling) using ONLY existing capabilities and configuration?

**Score: 3.4/5 (~72% ready)**. Configuration-only MVP is viable for knowledge-heavy
use cases (property FAQs, objection handling). Major gaps: visit scheduling (1.0/5),
structured property attributes (2.5/5), multi-property presentation (1.0/5).

---

## 1. Knowledge (4.5/5)

**Strength**: MIA's knowledge system is the strongest fit for real estate.

| Capability | Evidence | Score |
|-----------|----------|-------|
| FAQ handling | `knowledge_items` table — unlimited Q&A pairs | 5/5 |
| Property details | Can store property info as knowledge items | 4/5 |
| Objection handling | `experience_memory` — blended objection patterns | 5/5 |
| Neighborhood info | Knowledge items with categories | 4/5 |
| Process explanations | Knowledge items for buying/renting process | 5/5 |

**Gap**: No structured property attributes (m², bedrooms, bathrooms, parking).
All property data must be stored as free-form knowledge text.

**Evidence**: `knowledge.ts:29-109` — `getBusinessContext()` loads all active
knowledge items sorted by source tier and confidence. No schema constraint on
what knowledge can contain.

---

## 2. Objection Handling (4.5/5)

**Strength**: The experience memory system handles real estate objections well.

| Real Estate Objection | MIA Handling | Evidence |
|----------------------|-------------|----------|
| "Es muy caro" | Price objection → experience pattern | `customer-memory.ts:262` — detects `precio`/`cuanto`/`cuesta` |
| "Está lejos" | Location objection → knowledge response | `knowledge_items` — can store location FAQs |
| "No tengo tiempo" | Hesitation → consultative approach | `prompt-enricher.ts:90-132` — guidance system |
| "Necesito pensarlo" | Low readiness → no close pressure | `prompt-enricher.ts:98-99` — `BAJA DISPOSICIÓN` |
| "Es pequeño" | Size objection → knowledge response | `knowledge_items` — can store size comparisons |

**Evidence**: `prompt-enricher.ts:43-73` — `identifyPermittedActions()` dynamically
adjusts permitted actions based on customer state (readiness, trust, interest,
clarity, engagement). Low trust → REASSURE. Low readiness → no CLOSE.

---

## 3. Brand Identity (4.0/5)

**Strength**: Brand identity system maps well to real estate.

| Real Estate Need | MIA Capability | Score |
|-----------------|---------------|-------|
| Professional tone | `brand_identities.tone_of_voice` | 5/5 |
| Target market | `brand_identities.target_customers` | 4/5 |
| Differentiators | `brand_identities.differentiators` | 4/5 |
| Elevator pitch | `brand_identities.elevator_pitch` | 5/5 |
| Agent personality | `assistants.personality` (warmth/formality/humor/aggressiveness) | 3/5 |

**Gap**: No agent specialization (buyer's agent vs. seller's agent vs. rental agent).
One assistant handles all roles.

**Evidence**: `prompts.ts:242-243` — personality loaded from `assistant.personality`
JSONB. `prompts.ts:244-246` — tone of voice from `brand_identities.tone_of_voice`.

---

## 4. Sales Rules (3.5/5)

**Strength**: Sales rules can encode real estate processes.

| Real Estate Rule | MIA Capability | Score |
|-----------------|---------------|-------|
| "No promises about appreciation" | `sales_rules` with priority | 4/5 |
| "Always verify availability" | `sales_rules` with category | 3/5 |
| "Require pre-approval for mortgages" | `sales_rules` | 3/5 |
| "Schedule viewings only during business hours" | `sales_rules` | 2/5 |
| "Never share client info with third parties" | `sales_rules` | 4/5 |

**Gap**: Rules are text-only. No structured workflow enforcement (e.g., "must
collect pre-approval before scheduling viewing").

**Evidence**: `prompts.ts:109-115` — `formatRules()` renders rules as text lines
with priority and category tags. No execution logic.

---

## 5. Closing Policy (3.5/5)

**Strength**: Personality-driven closing works for real estate.

| Real Estate Closing Need | MIA Capability | Score |
|------------------------|---------------|-------|
| Consultative selling | `personality.sales_aggressiveness < 30` → `closingConsultative` | 4/5 |
| No high-pressure tactics | Personality-driven closing policy | 4/5 |
| Follow-up scheduling | `business_sales_config.follow_up_hours` | 3/5 |
| Appointment booking | **NOT AVAILABLE** | 1/5 |
| Offer submission | **NOT AVAILABLE** | 1/5 |

**Gap**: No appointment booking mechanism. MIA can suggest "let's schedule a
visit" but cannot actually book it.

**Evidence**: `prompts.ts:62-66` — `buildClosingPolicy()` selects closing style
based on `personality.sales_aggressiveness`. `prompts.ts:321` — closing policy
injected into prompt.

---

## 6. Customer Memory (3.0/5)

**Strength**: Customer memory tracks basic preferences.

| Real Estate Memory Need | MIA Capability | Score |
|------------------------|---------------|-------|
| Budget range | `customers.memory.interests` | 2/5 |
| Preferred locations | `customers.memory.interests` | 2/5 |
| Property type preference | `customers.memory.interests` | 2/5 |
| Family size | `customers.city` | 2/5 |
| Timeline | `customers.memory.preferences` | 2/5 |

**Gap**: Memory extraction is keyword-based (`customer-memory.ts:260-276`).
Only detects price/delivery/guarantee objections. No real estate-specific
memory extraction (budget, location, property type, timeline).

**Evidence**: `customer-memory.ts:260-276` — `mergeMemory()` extracts only:
- `precio`/`cuanto`/`cuesta` → `price` objection
- `envío`/`entrega` → `delivery` objection
- `garantía`/`devolver` → `guarantee` objection
- `whatsapp`/`llamar` → `prefers_phone` preference

---

## 7. Visit Scheduling (1.0/5)

**Strength**: None. This is the biggest gap.

| Visit Scheduling Need | MIA Capability | Score |
|----------------------|---------------|-------|
| Check availability | **NOT AVAILABLE** | 0/5 |
| Book time slot | **NOT AVAILABLE** | 0/5 |
| Send confirmation | **NOT AVAILABLE** | 0/5 |
| Reschedule | **NOT AVAILABLE** | 0/5 |
| Calendar integration | **NOT AVAILABLE** | 0/5 |

**Gap**: No scheduling mechanism exists. MIA can only suggest "let's schedule"
but cannot check availability, book a slot, or send confirmation.

**Evidence**: No scheduling-related code in `src/lib/` or `src/app/api/`.
No calendar-related tables in schema.

---

## 8. Multi-Property Presentation (1.0/5)

**Strength**: None. MIA recommends exactly one product per message.

| Multi-Property Need | MIA Capability | Score |
|---------------------|---------------|-------|
| Compare 2-3 properties | **NOT AVAILABLE** | 0/5 |
| Side-by-side features | **NOT AVAILABLE** | 0/5 |
| Filter by criteria | **NOT AVAILABLE** | 0/5 |
| Ranking by relevance | **NOT AVAILABLE** | 0/5 |

**Gap**: `product-recommendation.ts:65` — `if (matchedProductIds.length > 1)
return null`. When multiple properties match, MIA gives up and returns no
recommendation.

**Evidence**: `product-recommendation.ts:16-100` — `resolveRecommendedProduct()`
returns `ProductReference | null` (singular). `stream-response.ts:26-29` —
emits exactly one product event.

---

## 9. Structured Property Attributes (2.5/5)

**Strength**: Products have 15 columns that can store some property data.

| Property Attribute | Product Column | Score |
|-------------------|---------------|-------|
| Price | `products.price` | 5/5 |
| Description | `products.description` | 4/5 |
| Benefits | `products.benefits` | 3/5 |
| FAQ | `products.faq` (JSONB) | 4/5 |
| Restrictions | `products.restrictions` | 2/5 |
| m² | **NOT AVAILABLE** | 0/5 |
| Bedrooms | **NOT AVAILABLE** | 0/5 |
| Bathrooms | **NOT AVAILABLE** | 0/5 |
| Parking | **NOT AVAILABLE** | 0/5 |
| Floor/Level | **NOT AVAILABLE** | 0/5 |
| Year Built | **NOT AVAILABLE** | 0/5 |
| HOA Fees | **NOT AVAILABLE** | 0/5 |

**Gap**: No structured fields for real estate-specific attributes. All must be
stored in `description` or `benefits` as free text, making filtering and
comparison impossible.

**Evidence**: `001_initial_schema.sql` — `products` table has 15 columns:
`id, business_id, name, description, price, benefits, restrictions, faq,
image_url, is_active, created_at, updated_at, sku, metadata, tags`. No
property-specific columns.

---

## 10. Intent Detection (3.0/5)

**Strength**: Basic intent detection works for real estate.

| Real Estate Intent | MIA Detection | Score |
|-------------------|--------------|-------|
| Property inquiry | `catalog` intent (`intents.ts:15-24`) | 3/5 |
| Price question | `price` intent (`intents.ts:25-33`) | 4/5 |
| Location question | `shipping` intent (repurposed) | 2/5 |
| Schedule viewing | **NOT AVAILABLE** | 0/5 |
| Make offer | **NOT AVAILABLE** | 0/5 |
| Apply for mortgage | **NOT AVAILABLE** | 0/5 |

**Gap**: No real estate-specific intents (schedule_viewing, make_offer,
apply_mortgage). The `shipping` intent could be repurposed for "location
question" but the keywords are delivery-focused (`envío`, `despacho`,
`entrega`).

**Evidence**: `intents.ts:35-44` — shipping keywords: `envío`, `envios`,
`despacho`, `entrega`, `domicilio`, `zona`, `reparto`, `donde lo llevan`.
None are real estate location keywords.

---

## Overall Score: 3.4/5

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Knowledge | 4.5/5 | 20% | 0.90 |
| Objection Handling | 4.5/5 | 15% | 0.675 |
| Brand Identity | 4.0/5 | 10% | 0.40 |
| Sales Rules | 3.5/5 | 10% | 0.35 |
| Closing Policy | 3.5/5 | 10% | 0.35 |
| Customer Memory | 3.0/5 | 10% | 0.30 |
| Visit Scheduling | 1.0/5 | 10% | 0.10 |
| Multi-Property | 1.0/5 | 5% | 0.05 |
| Structured Attributes | 2.5/5 | 5% | 0.125 |
| Intent Detection | 3.0/5 | 5% | 0.15 |
| **Total** | | **100%** | **3.40** |

---

## Recommendation

**Configuration-Only MVP**: Viable for knowledge-heavy use cases. A real estate
business can use MIA today for:
- Property FAQs and knowledge base
- Objection handling and consultative selling
- Brand-consistent communication
- Customer memory and follow-up

**Not Viable Without Code Changes**:
- Visit scheduling (needs new capability)
- Multi-property presentation (needs output model change)
- Structured property attributes (needs schema extension)
- Real estate-specific intents (needs intent system extension)

**Estimated Effort for Full Real Estate Support**: 2-3 weeks
- Structured property attributes: 3-5 days
- Multi-property presentation: 3-5 days
- Visit scheduling: 5-7 days
- Real estate intents: 2-3 days
